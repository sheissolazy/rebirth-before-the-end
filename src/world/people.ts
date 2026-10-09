// MakeHuman（CC0）捏的真人模型 + 用代码驱动骨骼的简单动作（站、走、坐、躺）。
// 模型由 tools/blender/make_people.py 生成，骨骼是 Mixamo 兼容的，以后也能换成 Mixamo 动作。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type PoseState = 'idle' | 'walk' | 'sit' | 'sleep' | 'work'
  | 'shoot' | 'melee' | 'down' | 'zwalk' | 'zattack' | 'dead' | 'carry' | 'sitEat' | 'drink' | 'fish'

const SIDE = new THREE.Vector3(1, 0, 0)
const FWD = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)
const TMP_A = new THREE.Quaternion()
const TMP_B = new THREE.Quaternion()
const TMP_C = new THREE.Quaternion()
const TMP_D = new THREE.Quaternion()

type Rect = [number, number, number, number]
/** 衣服贴图的小修改（贴图坐标 0~1，左上角是原点）：
 *  clone = 用旁边干净的布料盖住 MakeHuman 的标志；patch = 旁边没地方就用附近的颜色填平；
 *  tint = 只给上衣换颜色（color 模式保留明暗，multiply 用来把白 T 恤染深） */
interface Outfit {
  clone?: [Rect, number, number][]
  patch?: { rects: Rect[]; sample: [number, number] }
  tint?: { color: string; mode: 'color' | 'multiply'; regions: Rect[] }
  /** 头发颜色（乘在贴图上） */
  hair?: string
}
const WARDROBE: Record<string, Outfit> = {
  // 女主：蓝 T 恤去掉胸口的标志
  'heroine.female_casualsuit01': { clone: [[[0.7, 0.16, 0.88, 0.37], -0.17, 0]] },
  // 江野：白 T 恤上印着 MAKEHUMAN → 去掉，染成炭黑色
  'jiangye.male_casualsuit06': {
    clone: [[[0.42, 0.11, 0.7, 0.23], 0, 0.14], [[0.17, 0.09, 0.33, 0.17], 0, 0.12], [[0.7, 0.13, 0.78, 0.2], 0, 0.12]],
    tint: { color: '#36363a', mode: 'multiply', regions: [[0, 0, 1, 0.47]] },
  },
  // 顾沉：军绿色
  'guchen.male_casualsuit04': {
    patch: { rects: [[0.48, 0.08, 0.64, 0.26]], sample: [0.57, 0.3] },
    tint: { color: '#66753f', mode: 'color', regions: [[0, 0, 1, 0.39]] },
  },
  // 礼帽大叔：咖啡色
  'survivor_m.male_casualsuit02': {
    patch: { rects: [[0.49, 0.09, 0.66, 0.27]], sample: [0.57, 0.33] },
    tint: { color: '#8a5a3a', mode: 'color', regions: [[0, 0, 1, 0.42], [0.74, 0.42, 1, 1]] },
  },
  // 辫子姑娘：砖红色运动服
  'survivor_f.female_sportsuit01': { tint: { color: '#b0463c', mode: 'color', regions: [[0, 0, 1, 0.44], [0.72, 0.62, 1, 0.9]] } },
  // 王阿姨：和女主同款 T 恤 → 去掉标志，换成豆沙紫
  'neighbor.female_casualsuit02': {
    clone: [[[0.7, 0.16, 0.88, 0.37], -0.17, 0]],
    tint: { color: '#8e5a6e', mode: 'color', regions: [[0, 0, 1, 0.42], [0.68, 0.6, 1, 0.92]] },
  },
  // 妈妈：原来是一头白发，染回深棕色（五十岁出头）
  'mom.bob02': { hair: '#5a4438' },
  // 谢临：一头黑色长发
  'xielin.long01': { hair: '#3a3436' },
}

function restyle(mat: THREE.MeshStandardMaterial, o: Outfit): void {
  if (o.hair) mat.color.set(o.hair)
  const tex = mat.map
  const img = tex?.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!tex || !img?.width || (!o.clone && !o.patch && !o.tint)) return
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const g = c.getContext('2d')
  if (!g) return
  const W = c.width
  const H = c.height
  g.drawImage(img, 0, 0)
  for (const [[x0, y0, x1, y1], dx, dy] of o.clone ?? []) {
    g.drawImage(c, (x0 + dx) * W, (y0 + dy) * H, (x1 - x0) * W, (y1 - y0) * H, x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H)
  }
  if (o.patch) {
    const [sx, sy] = o.patch.sample
    const d = g.getImageData(Math.round(sx * W) - 6, Math.round(sy * H) - 6, 12, 12).data
    const avg = [0, 1, 2].map((k) => { let v = 0; for (let i = k; i < d.length; i += 4) v += d[i]; return Math.round(v / (d.length / 4)) })
    g.fillStyle = `rgb(${avg.join(',')})`
    for (const [x0, y0, x1, y1] of o.patch.rects) g.fillRect(x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H)
  }
  if (o.tint) {
    g.globalCompositeOperation = o.tint.mode
    g.fillStyle = o.tint.color
    for (const [x0, y0, x1, y1] of o.tint.regions) g.fillRect(x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H)
    g.globalCompositeOperation = 'source-over'
  }
  tex.image = c
  tex.needsUpdate = true
}

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
      const outfit = WARDROBE[std.name]
      if (outfit) restyle(std, outfit)
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
    this.rotMany(name, [[axis, angle]], pre)
  }

  /** 同一根骨骼绕几个轴一起转（比如上身同时前倾和扭腰）。
   *  轴是"人物空间"的（x 左右、y 上、z 前），按父骨骼**这一帧**的朝向换算，
   *  所以大臂放下/抬起之后，小臂弯曲的方向也是对的。 */
  private rotMany(name: string, rots: [THREE.Vector3, number][], pre?: THREE.Quaternion): void {
    const j = this.joints.get(name)
    if (!j) return
    j.bone.quaternion.copy(j.rest)
    if (pre) j.bone.quaternion.multiply(pre)
    const parent = j.bone.parent
    if (!parent) return
    parent.updateWorldMatrix(true, false)
    const toChar = this.model.getWorldQuaternion(TMP_A).invert()
    const frame = toChar.multiply(parent.getWorldQuaternion(TMP_B)).multiply(j.bone.quaternion)
    const world = TMP_C.identity()
    for (const [axis, angle] of rots) world.multiply(TMP_D.setFromAxisAngle(axis, angle))
    const q = frame.clone().invert().multiply(world).multiply(frame)
    j.bone.quaternion.multiply(q)
  }

  /** 开枪后的后坐力（秒） */
  private kick = 0

  recoil(): void {
    this.kick = 0.18
  }

  update(dt: number, state: PoseState, speed = 1): void {
    const rate = state === 'walk' || state === 'carry' ? 7.5 * speed : state === 'zwalk' ? 4.2 : state === 'zattack' ? 7 : state === 'melee' ? 6.5 : 1.6
    this.t += dt * rate
    this.kick = Math.max(0, this.kick - dt)
    const s = Math.sin(this.t)
    const leftDown = this.armDown.get('Left')
    const rightDown = this.armDown.get('Right')
    for (const j of this.joints.values()) j.bone.quaternion.copy(j.rest)
    this.model.position.y = 0
    this.model.rotation.x = 0
    if (state === 'walk') {
      // 迈腿时膝盖比大腿晚一点弯（抬脚），胯左右摆、上身反方向扭，头保持朝前
      const k = Math.sin(this.t + 0.5)
      this.rot('LeftUpLeg', SIDE, -s * 0.5)
      this.rot('RightUpLeg', SIDE, s * 0.5)
      this.rot('LeftLeg', SIDE, Math.max(0, k) * 0.8)
      this.rot('RightLeg', SIDE, Math.max(0, -k) * 0.8)
      this.rotMany('Hips', [[UP, s * 0.08], [FWD, Math.cos(this.t) * 0.04]])
      this.rotMany('Spine', [[UP, -s * 0.1], [SIDE, 0.04]])
      this.rot('Head', UP, s * 0.05)
      this.rot('LeftArm', SIDE, s * 0.45, leftDown)
      this.rot('RightArm', SIDE, -s * 0.45, rightDown)
      this.rot('LeftForeArm', SIDE, -0.3 - Math.max(0, -s) * 0.3)
      this.rot('RightForeArm', SIDE, -0.3 - Math.max(0, s) * 0.3)
      this.model.position.y = Math.abs(Math.cos(this.t)) * 0.03
    } else if (state === 'sitEat') {
      // 坐着吃饭：左手端碗，右手隔一会儿把筷子送到嘴边
      const lift = Math.max(0, Math.sin(this.t * 1.6)) ** 2
      this.rot('LeftUpLeg', SIDE, -1.45)
      this.rot('RightUpLeg', SIDE, -1.45)
      this.rot('LeftLeg', SIDE, 1.45)
      this.rot('RightLeg', SIDE, 1.45)
      this.rot('LeftArm', SIDE, -0.55, leftDown)
      this.rot('LeftForeArm', SIDE, -1.15)
      this.rot('RightArm', SIDE, -0.55 - lift * 0.55, rightDown)
      this.rot('RightForeArm', SIDE, -1.0 - lift * 1.0)
      this.rotMany('Spine', [[SIDE, 0.12 - lift * 0.05]])
      this.rot('Head', SIDE, 0.12 - lift * 0.1)
      this.model.position.y = -0.42
    } else if (state === 'fish') {
      // 钓鱼：两手往前握着竿，偶尔轻轻抖一下
      const twitch = Math.sin(this.t * 0.7) > 0.95 ? Math.sin(this.t * 9) * 0.06 : 0
      this.rot('RightArm', SIDE, -0.75 + twitch, rightDown)
      this.rot('RightForeArm', SIDE, -0.55)
      this.rot('LeftArm', SIDE, -0.95, leftDown)
      this.rot('LeftForeArm', SIDE, -0.45)
      this.rot('Spine', SIDE, 0.08)
      this.rot('Head', SIDE, 0.15)
    } else if (state === 'drink') {
      // 站着喝水/吃两口：右手送到嘴边，头微微后仰
      const lift = Math.max(0, Math.sin(this.t * 1.3)) ** 2
      this.rot('RightArm', SIDE, -0.5 - lift * 0.7, rightDown)
      this.rot('RightForeArm', SIDE, -1.1 - lift * 0.9)
      this.rot('LeftArm', SIDE, s * 0.03, leftDown)
      this.rot('Head', SIDE, -lift * 0.2)
      this.rot('Spine', SIDE, -lift * 0.04)
    } else if (state === 'carry') {
      // 抱着箱子走：腿照常迈，两只手往前抱住
      this.rot('LeftUpLeg', SIDE, -s * 0.4)
      this.rot('RightUpLeg', SIDE, s * 0.4)
      this.rot('LeftLeg', SIDE, Math.max(0, s) * 0.6)
      this.rot('RightLeg', SIDE, Math.max(0, -s) * 0.6)
      this.rot('LeftArm', SIDE, -0.75, leftDown)
      this.rot('RightArm', SIDE, -0.75, rightDown)
      this.rot('LeftForeArm', SIDE, -0.8)
      this.rot('RightForeArm', SIDE, -0.8)
      this.rot('Spine', SIDE, -0.06)
      this.model.position.y = Math.abs(Math.cos(this.t)) * 0.02
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
      // 在灶台前忙：左手扶着锅，右手画圈翻炒，身子跟着轻轻动
      const c = this.t * 2.6
      this.rotMany('Spine', [[SIDE, 0.3], [UP, Math.sin(c) * 0.05]])
      this.rot('LeftArm', SIDE, -0.85, leftDown)
      this.rot('LeftForeArm', SIDE, -0.75)
      this.rotMany('RightArm', [[SIDE, -0.95 + Math.sin(c) * 0.12], [FWD, Math.cos(c) * 0.12]], rightDown)
      this.rot('RightForeArm', SIDE, -0.7 + Math.cos(c) * 0.15)
      this.rot('Head', SIDE, 0.2)
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
      // 站着：呼吸、慢慢换重心、偶尔左右看看
      const look = Math.sin(this.t * 0.23) > 0.6 ? Math.sin(this.t * 0.9) * 0.35 : 0
      this.rot('LeftArm', SIDE, s * 0.03, leftDown)
      this.rot('RightArm', SIDE, -s * 0.03, rightDown)
      this.rotMany('Hips', [[FWD, Math.sin(this.t * 0.31) * 0.035]])
      this.rot('Spine', SIDE, Math.sin(this.t * 1.4) * 0.015)
      this.rot('Spine1', SIDE, Math.sin(this.t * 1.4 + 0.5) * 0.012)
      this.rotMany('Head', [[UP, look], [FWD, Math.sin(this.t * 0.37) * 0.05]])
      this.rot('LeftLeg', SIDE, Math.max(0, Math.sin(this.t * 0.31)) * 0.12)
    }
  }
}
