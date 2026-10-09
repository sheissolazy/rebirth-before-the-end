// MakeHuman（CC0）捏的真人模型 + 用代码驱动骨骼的简单动作（站、走、坐、躺）。
// 模型由 tools/blender/make_people.py 生成，骨骼是 Mixamo 兼容的，以后也能换成 Mixamo 动作。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type PoseState = 'idle' | 'walk' | 'sit' | 'sleep' | 'work'
  | 'shoot' | 'melee' | 'down' | 'zwalk' | 'zattack' | 'dead'

const SIDE = new THREE.Vector3(1, 0, 0)
const FWD = new THREE.Vector3(0, 0, 1)

export async function loadPerson(name: string): Promise<THREE.Object3D> {
  const g = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/people/${name}.glb`)
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    m.castShadow = true
    m.receiveShadow = true
    m.frustumCulled = false // 蒙皮网格的包围盒按绑定姿势算，转身时容易被误裁掉
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const std = mat as THREE.MeshStandardMaterial
      // 头发、眉毛、睫毛镂空；其他不透明
      if (/hair|eyebrow|eyelash|ponytail|bob|short|long|braid/i.test(std.name)) {
        std.alphaTest = 0.5
        std.transparent = false
        std.side = THREE.DoubleSide
        std.depthWrite = true
      } else {
        std.transparent = false
        std.alphaTest = 0
      }
    }
  })
  return g.scene
}

interface Joint { bone: THREE.Bone; rest: THREE.Quaternion; worldRest: THREE.Quaternion }

/** 按名字找骨骼（three.js 会把 "mixamorig:LeftUpLeg" 变成 "mixamorigLeftUpLeg"） */
function findBone(root: THREE.Object3D, suffix: string): THREE.Bone | null {
  let hit: THREE.Bone | null = null
  root.traverse((o) => {
    if (!hit && (o as THREE.Bone).isBone && o.name.replace(/[^A-Za-z]/g, '').endsWith(suffix)) hit = o as THREE.Bone
  })
  return hit
}

/** 用代码摆姿势：在绑定姿势上叠加绕"人物左右轴 / 前后轴"的旋转 */
export class PoseDriver {
  private readonly joints = new Map<string, Joint>()
  private readonly armDown = new Map<string, THREE.Quaternion>()
  private t = 0
  private readonly model: THREE.Object3D
  readonly height: number

  constructor(model: THREE.Object3D) {
    this.model = model
    model.updateMatrixWorld(true)
    const names = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg',
      'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftShoulder', 'RightShoulder']
    for (const n of names) {
      const bone = findBone(model, n)
      if (bone) this.joints.set(n, { bone, rest: bone.quaternion.clone(), worldRest: bone.getWorldQuaternion(new THREE.Quaternion()) })
    }
    // 绑定姿势是 A 字，算出把手臂放到身体两侧需要的旋转
    for (const side of ['Left', 'Right']) {
      const arm = this.joints.get(`${side}Arm`)
      const fore = this.joints.get(`${side}ForeArm`)
      if (!arm || !fore) continue
      const a = arm.bone.getWorldPosition(new THREE.Vector3())
      const b = fore.bone.getWorldPosition(new THREE.Vector3())
      const dir = b.sub(a).normalize()
      const want = new THREE.Vector3(Math.sign(dir.x) * 0.16, -1, 0.04).normalize()
      const world = new THREE.Quaternion().setFromUnitVectors(dir, want)
      this.armDown.set(side, this.toLocal(arm, world))
    }
    const box = new THREE.Box3().setFromObject(model)
    this.height = box.max.y - box.min.y
  }

  /** 把武器之类的东西挂到骨骼上（抵消骨骼链上的缩放） */
  attach(obj: THREE.Object3D, boneSuffix: string): boolean {
    const bone = findBone(this.model, boneSuffix)
    if (!bone) return false
    this.model.updateMatrixWorld(true)
    const s = bone.getWorldScale(new THREE.Vector3())
    const root = this.model.getWorldScale(new THREE.Vector3())
    obj.scale.set(root.x / s.x, root.y / s.y, root.z / s.z)
    bone.add(obj)
    return true
  }

  /** 把人物空间里的旋转换算到骨骼自己的局部空间 */
  private toLocal(j: Joint, world: THREE.Quaternion): THREE.Quaternion {
    return j.worldRest.clone().invert().multiply(world).multiply(j.worldRest)
  }

  private rot(name: string, axis: THREE.Vector3, angle: number, pre?: THREE.Quaternion): void {
    const j = this.joints.get(name)
    if (!j) return
    // 有预旋转（手臂先放下）时，摆动轴要按放下之后的朝向来换算
    const frame = pre ? j.worldRest.clone().multiply(pre) : j.worldRest
    const world = new THREE.Quaternion().setFromAxisAngle(axis, angle)
    const q = frame.clone().invert().multiply(world).multiply(frame)
    j.bone.quaternion.copy(j.rest)
    if (pre) j.bone.quaternion.multiply(pre)
    j.bone.quaternion.multiply(q)
  }

  /** 开枪后的后坐力（秒） */
  private kick = 0

  recoil(): void {
    this.kick = 0.18
  }

  update(dt: number, state: PoseState, speed = 1): void {
    const rate = state === 'walk' ? 7.5 * speed : state === 'zwalk' ? 4.2 : state === 'zattack' ? 7 : state === 'melee' ? 6.5 : 1.6
    this.t += dt * rate
    this.kick = Math.max(0, this.kick - dt)
    const s = Math.sin(this.t)
    const leftDown = this.armDown.get('Left')
    const rightDown = this.armDown.get('Right')
    for (const j of this.joints.values()) j.bone.quaternion.copy(j.rest)
    this.model.position.y = 0
    this.model.rotation.x = 0
    if (state === 'walk') {
      this.rot('LeftUpLeg', SIDE, -s * 0.45)
      this.rot('RightUpLeg', SIDE, s * 0.45)
      this.rot('LeftLeg', SIDE, Math.max(0, s) * 0.7)
      this.rot('RightLeg', SIDE, Math.max(0, -s) * 0.7)
      this.rot('LeftArm', SIDE, s * 0.35, leftDown)
      this.rot('RightArm', SIDE, -s * 0.35, rightDown)
      this.rot('LeftForeArm', SIDE, -0.25)
      this.rot('RightForeArm', SIDE, -0.25)
      this.rot('Spine', FWD, s * 0.04)
      this.model.position.y = Math.abs(Math.cos(this.t)) * 0.025
    } else if (state === 'sit') {
      this.rot('LeftUpLeg', SIDE, -1.45)
      this.rot('RightUpLeg', SIDE, -1.45)
      this.rot('LeftLeg', SIDE, 1.45)
      this.rot('RightLeg', SIDE, 1.45)
      this.rot('LeftArm', SIDE, -0.35, leftDown)
      this.rot('RightArm', SIDE, -0.35, rightDown)
      this.rot('LeftForeArm', SIDE, -0.9)
      this.rot('RightForeArm', SIDE, -0.9)
      this.rot('Spine', SIDE, Math.sin(this.t) * 0.015)
      this.model.position.y = -0.42
    } else if (state === 'sleep') {
      this.rot('LeftArm', SIDE, 0, leftDown)
      this.rot('RightArm', SIDE, 0, rightDown)
      this.rot('Spine', SIDE, Math.sin(this.t * 0.6) * 0.02)
      this.model.rotation.x = -Math.PI / 2
      this.model.position.y = 0.55
    } else if (state === 'work') {
      // 弯腰在台面上忙（做饭、喝水、翻东西）
      this.rot('Spine', SIDE, 0.35 + s * 0.05)
      this.rot('LeftArm', SIDE, -0.9 + s * 0.15, leftDown)
      this.rot('RightArm', SIDE, -0.9 - s * 0.15, rightDown)
      this.rot('LeftForeArm', SIDE, -0.8)
      this.rot('RightForeArm', SIDE, -0.8)
    } else if (state === 'zwalk' || state === 'zattack') {
      // 丧尸：双手往前伸，身子前倾，拖着脚走；攻击时手上下乱抓
      const attack = state === 'zattack'
      const leg = attack ? 0.08 : 0.32
      this.rot('LeftUpLeg', SIDE, -s * leg)
      this.rot('RightUpLeg', SIDE, s * leg)
      this.rot('LeftLeg', SIDE, Math.max(0, s) * 0.45)
      this.rot('RightLeg', SIDE, Math.max(0, -s) * 0.45)
      const claw = attack ? Math.sin(this.t * 1.7) * 0.5 : Math.sin(this.t * 0.5) * 0.08
      this.rot('LeftArm', SIDE, -1.35 + claw, leftDown)
      this.rot('RightArm', SIDE, -1.25 - claw, rightDown)
      this.rot('LeftForeArm', SIDE, -0.2)
      this.rot('RightForeArm', SIDE, -0.35)
      this.rot('Spine', SIDE, 0.22 + (attack ? Math.abs(s) * 0.12 : 0))
      this.rot('Head', FWD, 0.25 + Math.sin(this.t * 0.31) * 0.12)
      this.model.position.y = attack ? 0 : Math.abs(Math.cos(this.t)) * 0.015
    } else if (state === 'shoot') {
      // 端着霰弹枪瞄准，开枪时往后一顿
      // 右手大臂稍微往前、小臂端平；左手往前托着枪管
      const k = this.kick > 0 ? this.kick / 0.18 : 0
      this.rot('LeftArm', SIDE, -1.2 - k * 0.2, leftDown)
      this.rot('RightArm', SIDE, -0.55 - k * 0.15, rightDown)
      this.rot('LeftForeArm', SIDE, -0.35)
      this.rot('RightForeArm', SIDE, -1.05 - k * 0.2)
      this.rot('Spine', SIDE, 0.04 - k * 0.12)
    } else if (state === 'melee') {
      // 抡撬棍/擀面杖
      const swing = Math.max(0, Math.sin(this.t))
      this.rot('RightArm', SIDE, -0.4 - swing * 1.6, rightDown)
      this.rot('RightForeArm', SIDE, -0.6 + swing * 0.4)
      this.rot('LeftArm', SIDE, -0.5, leftDown)
      this.rot('LeftForeArm', SIDE, -0.9)
      this.rot('Spine', SIDE, 0.12 + swing * 0.15)
      this.rot('LeftUpLeg', SIDE, -0.25)
      this.rot('LeftLeg', SIDE, 0.2)
    } else if (state === 'down' || state === 'dead') {
      // 倒地：受伤的人仰面躺着，死掉的丧尸脸朝下
      this.rot('LeftArm', SIDE, -0.6, leftDown)
      this.rot('RightArm', SIDE, 0.3, rightDown)
      this.rot('LeftUpLeg', SIDE, -0.2)
      this.model.rotation.x = state === 'dead' ? Math.PI / 2 : -Math.PI / 2
      this.model.position.y = 0.14
    } else {
      this.rot('LeftArm', SIDE, s * 0.03, leftDown)
      this.rot('RightArm', SIDE, -s * 0.03, rightDown)
      this.rot('Spine', SIDE, s * 0.012)
      this.rot('Head', FWD, Math.sin(this.t * 0.37) * 0.06)
    }
  }
}
