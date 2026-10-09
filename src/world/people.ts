// MakeHuman（CC0）捏的真人模型 + 用代码驱动骨骼的简单动作（站、走、坐、躺）。
// 模型由 tools/blender/make_people.py 生成，骨骼是 Mixamo 兼容的，以后也能换成 Mixamo 动作。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type PoseState = 'idle' | 'walk' | 'sit' | 'sleep' | 'work'
  | 'shoot' | 'melee' | 'down' | 'zwalk' | 'zattack' | 'dead' | 'carry' | 'sitEat' | 'drink' | 'fish' | 'wave' | 'pet'

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

/** 一家人用哪套模型：'real' = MakeHuman 真人，'toon' = Blender 捏的 Q 版（?people=toon 或者调试菜单切换） */
export function peopleStyle(): 'real' | 'toon' {
  try {
    const q = new URLSearchParams(location.search).get('people')
    if (q === 'toon' || q === 'real') return q
    const v = localStorage.getItem('rbte-proto-people')
    if (v === 'toon' || v === 'real') return v
  } catch { /* 默认 */ }
  return 'real'
}

export function setPeopleStyle(v: 'real' | 'toon'): void {
  try { localStorage.setItem('rbte-proto-people', v) } catch { /* 没关系 */ }
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

interface Joint { bone: THREE.Bone; rest: THREE.Quaternion; worldRest: THREE.Quaternion; prev?: THREE.Quaternion }

type Rots = [THREE.Vector3, number][]
/** 站着没事时的小动作：发呆、抱胳膊、叉腰、东张西望、挠头、伸懒腰 */
export type IdleVar = 'plain' | 'crossed' | 'hips' | 'look' | 'scratch' | 'stretch'
/** 名字、权重、最短秒数、最长秒数 */
const IDLE_PICK: [IdleVar, number, number, number][] = [
  ['plain', 34, 4, 9], ['crossed', 22, 6, 12], ['hips', 16, 5, 10], ['look', 14, 3, 5], ['scratch', 8, 2.4, 2.4], ['stretch', 6, 2.8, 2.8],
]
/** 坐着的姿势：坐直、往后靠、跷二郎腿（名字、权重、最短、最长秒数） */
export type SitVar = 'upright' | 'lean' | 'cross'
const SIT_PICK: [SitVar, number, number, number][] = [['upright', 40, 5, 10], ['lean', 32, 6, 14], ['cross', 28, 8, 16]]
/** 一个短动作的力度：开头 0.45 秒抬起、结尾 0.45 秒放下 */
const envelope = (t: number, dur: number) => {
  const k = Math.max(0, Math.min(1, t / 0.45, (dur - t) / 0.45))
  return k * k * (3 - 2 * k)
}

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
    const names = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg',
      'LeftFoot', 'RightFoot', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftShoulder', 'RightShoulder']
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
    // 大腿长度：Q 版人物腿短，坐下时身体往下放的距离要跟着缩短（以 MakeHuman 真人约 0.37 米为准）
    const up = this.joints.get('LeftUpLeg')
    const knee = this.joints.get('LeftLeg')
    if (up && knee) {
      const thigh = up.bone.getWorldPosition(new THREE.Vector3()).distanceTo(knee.bone.getWorldPosition(new THREE.Vector3()))
      this.legK = THREE.MathUtils.clamp(thigh / 0.37, 0.6, 1.2)
    }
  }

  /** 腿长相对真人的比例（坐下时用） */
  private legK = 1

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
  private rotMany(name: string, rots: [THREE.Vector3, number][], pre?: THREE.Quaternion, keep = false): void {
    const j = this.joints.get(name)
    if (!j) return
    // keep = 叠加在这一帧已经摆好的姿势上（转头看人时不把点头、歪头冲掉）
    if (!keep) {
      j.bone.quaternion.copy(j.rest)
      if (pre) j.bone.quaternion.multiply(pre)
    }
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

  /** 在聊天：轮到自己说时手比划，听的时候点点头（外面每帧设） */
  talking = false
  /** 平常站着时会换小动作（打仗时、访客、丧尸不换） */
  fidget = false
  private readonly seed = Math.random() * 100
  private idleVar: IdleVar = 'plain'
  private idleLeft = 1 + Math.random() * 5
  private idleT = 0
  private talkT = 0

  /** 调试用：固定一个小动作（null = 恢复随机） */
  forceIdle(v: IdleVar | null): void {
    this.forced = v
    if (v) { this.idleVar = v; this.idleT = 1.2 }
  }
  private forced: IdleVar | null = null
  private sitVar: SitVar = 'upright'
  private sitLeft = 2 + Math.random() * 6
  /** 调试用：固定一个坐姿 */
  forceSit(v: SitVar | null): void {
    this.sitForced = v
    if (v) this.sitVar = v
  }
  private sitForced: SitVar | null = null

  private pickSit(dt: number): void {
    if (this.sitForced) return
    if (!this.fidget) { this.sitVar = 'upright'; return }
    this.sitLeft -= dt
    if (this.sitLeft > 0) return
    const total = SIT_PICK.reduce((n, x) => n + x[1], 0)
    let r = Math.random() * total
    let pick = SIT_PICK[0]
    for (const x of SIT_PICK) { r -= x[1]; if (r <= 0) { pick = x; break } }
    this.sitVar = pick[0]
    this.sitLeft = pick[2] + Math.random() * (pick[3] - pick[2])
  }

  private pickIdle(dt: number): void {
    if (this.forced) return
    if (!this.fidget) { this.idleVar = 'plain'; return }
    this.idleT += dt
    this.idleLeft -= dt
    if (this.idleLeft > 0) return
    const total = IDLE_PICK.reduce((n, x) => n + x[1], 0)
    let r = Math.random() * total
    let pick = IDLE_PICK[0]
    for (const x of IDLE_PICK) { r -= x[1]; if (r <= 0) { pick = x; break } }
    // 同一个小动作不连着做两次（发呆除外）
    if (pick[0] === this.idleVar && pick[0] !== 'plain') pick = IDLE_PICK[0]
    this.idleVar = pick[0]
    this.idleT = 0
    this.idleLeft = pick[2] + Math.random() * (pick[3] - pick[2])
  }

  recoil(): void {
    this.kick = 0.18
  }

  /** 头想转向哪边（弧度，正 = 往角色右手边看）；外面每帧设，这里平滑地跟过去 */
  lookYaw = 0
  private lookCur = 0
  private lastState: PoseState | null = null
  private prevY = 0
  private prevRX = 0

  update(dt: number, state: PoseState, speed = 1): void {
    this.pose(dt, state, speed)
    // 转头看人：坐着、站着、干活时才转（走路、开枪、躺着不转）
    const canLook = state === 'idle' || state === 'sit' || state === 'sitEat' || state === 'work' || state === 'drink' || state === 'fish'
    this.lookCur += ((canLook ? this.lookYaw : 0) - this.lookCur) * Math.min(1, dt * 4)
    if (Math.abs(this.lookCur) > 0.01) {
      this.rotMany('Neck', [[UP, this.lookCur * 0.35]], undefined, true)
      this.rotMany('Head', [[UP, this.lookCur * 0.65]], undefined, true)
    }
    // 和上一帧之间平滑过渡：换动作（站→坐、走→停）不再一下子跳过去；倒地、死亡要快一点
    const fast = state === 'down' || state === 'dead' || state === 'shoot'
    const k = this.lastState === null || dt <= 0 ? 1 : 1 - Math.exp(-dt * (fast ? 22 : 13))
    for (const j of this.joints.values()) {
      if (!j.prev) j.prev = j.bone.quaternion.clone()
      else if (k < 1) j.bone.quaternion.copy(j.prev.slerp(j.bone.quaternion, k))
      j.prev.copy(j.bone.quaternion)
    }
    if (this.lastState !== null && k < 1 && this.lastState !== state) {
      // 位置（坐下的下沉、躺下的抬高）只在换动作的那一小段过渡
      this.blendT = 0.25
    }
    if (this.blendT > 0 && dt > 0) {
      this.blendT -= dt
      const kk = 1 - Math.exp(-dt * 10)
      this.model.position.y = this.prevY + (this.model.position.y - this.prevY) * kk
      this.model.rotation.x = this.prevRX + (this.model.rotation.x - this.prevRX) * kk
    }
    this.prevY = this.model.position.y
    this.prevRX = this.model.rotation.x
    this.lastState = state
  }

  private blendT = 0

  private pose(dt: number, state: PoseState, speed = 1): void {
    const rate = state === 'walk' || state === 'carry' ? 7.5 * speed : state === 'zwalk' ? 4.2 : state === 'zattack' ? 7 : state === 'melee' ? 6.5 : 1.6
    this.t += dt * rate
    this.kick = Math.max(0, this.kick - dt)
    const s = Math.sin(this.t)
    const leftDown = this.armDown.get('Left')
    const rightDown = this.armDown.get('Right')
    for (const j of this.joints.values()) j.bone.quaternion.copy(j.rest)
    this.model.position.y = 0
    this.model.rotation.x = 0
    this.model.position.x = 0
    if (state === 'walk' || state === 'carry') {
      // 走路：摆动腿时膝盖弯、脚尖勾起，支撑腿后蹬时脚跟抬起；胯跟着腿扭、往支撑腿那边微微移，
      // 肩膀反着扭；手臂比腿慢半拍地甩（抱箱子时手在胸前抱着）
      const carry = state === 'carry'
      const amp = carry ? 0.8 : Math.min(1.2, 0.8 + speed * 0.2)
      const p = this.t - 0.2
      const thighL = -s * 0.46 * amp
      const thighR = s * 0.46 * amp
      const swingL = Math.max(0, Math.cos(p)) ** 1.4
      const swingR = Math.max(0, -Math.cos(p)) ** 1.4
      const kneeL = 0.08 + swingL * 0.9 * amp
      const kneeR = 0.08 + swingR * 0.9 * amp
      const pushL = Math.max(0, -Math.sin(p)) * Math.max(0, -Math.cos(p)) * 2
      const pushR = Math.max(0, Math.sin(p)) * Math.max(0, Math.cos(p)) * 2
      this.rot('LeftUpLeg', SIDE, thighL)
      this.rot('RightUpLeg', SIDE, thighR)
      this.rot('LeftLeg', SIDE, kneeL)
      this.rot('RightLeg', SIDE, kneeR)
      this.rot('LeftFoot', SIDE, -(thighL + kneeL) * 0.85 + pushL * 0.4 - swingL * 0.12)
      this.rot('RightFoot', SIDE, -(thighR + kneeR) * 0.85 + pushR * 0.4 - swingR * 0.12)
      const c = Math.cos(this.t)
      this.rotMany('Hips', [[UP, s * 0.1 * amp], [FWD, c * 0.035]])
      this.rotMany('Spine', [[UP, -s * 0.08 * amp], [SIDE, carry ? -0.06 : 0.05]])
      this.rot('Spine1', UP, -s * 0.06 * amp)
      this.rotMany('Head', [[UP, s * 0.06 * amp], [SIDE, -Math.abs(c) * 0.025]])
      if (carry) {
        this.rotMany('LeftArm', [[SIDE, -0.75], [FWD, 0.08]], leftDown)
        this.rotMany('RightArm', [[SIDE, -0.75], [FWD, -0.08]], rightDown)
        this.rot('LeftForeArm', SIDE, -0.8)
        this.rot('RightForeArm', SIDE, -0.8)
      } else {
        const a = Math.sin(this.t - 0.25)
        this.rotMany('LeftArm', [[SIDE, a * 0.42 * amp], [FWD, 0.07]], leftDown)
        this.rotMany('RightArm', [[SIDE, -a * 0.42 * amp], [FWD, -0.07]], rightDown)
        this.rot('LeftForeArm', SIDE, -0.25 - Math.max(0, -a) * 0.4)
        this.rot('RightForeArm', SIDE, -0.25 - Math.max(0, a) * 0.4)
      }
      this.model.position.y = Math.abs(c) * (carry ? 0.02 : 0.028)
      this.model.position.x = -Math.cos(p) * 0.016
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
      this.model.position.y = -0.42 * this.legK
    } else if (state === 'pet') {
      // 蹲下摸猫：膝盖弯、身子往前探，右手伸下去来回摸，左手搭在膝盖上
      const stroke = Math.sin(this.t * 2.6)
      this.rot('LeftUpLeg', SIDE, -1.2)
      this.rot('RightUpLeg', SIDE, -1.05)
      this.rot('LeftLeg', SIDE, 1.6)
      this.rot('RightLeg', SIDE, 1.5)
      this.rot('LeftFoot', SIDE, -0.35)
      this.rot('RightFoot', SIDE, -0.4)
      this.rot('Spine', SIDE, 0.5)
      this.rot('Spine1', SIDE, 0.15)
      this.rotMany('RightArm', [[SIDE, -0.62 + stroke * 0.1], [FWD, -0.05]], rightDown)
      this.rot('RightForeArm', SIDE, -0.15 - stroke * 0.1)
      this.rot('LeftArm', SIDE, -0.6, leftDown)
      this.rot('LeftForeArm', SIDE, -0.7)
      this.rot('Head', SIDE, 0.25)
      this.model.position.y = -0.27 * this.legK
    } else if (state === 'wave') {
      // 挥手：右手举过肩、往外张开，小臂左右摆；身子微微踮一下
      const k = Math.sin(this.t * 5.5)
      this.rotMany('RightArm', [[FWD, 0.55], [SIDE, -2.35]], rightDown)
      this.rotMany('RightForeArm', [[FWD, k * 0.38], [SIDE, -0.35]])
      this.rot('LeftArm', SIDE, 0.03, leftDown)
      this.rot('Spine', SIDE, -0.04)
      this.rotMany('Head', [[SIDE, -0.06], [FWD, -0.05]])
      this.model.position.y = Math.max(0, Math.sin(this.t * 2.2)) * 0.012
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
    } else if (state === 'sit') {
      // 坐着也会换姿势：坐直、往后靠、跷二郎腿；聊天时右手照样比划
      this.pickSit(dt)
      const g = this.talkGesture(dt)
      const v = this.sitVar
      let la: Rots = [[SIDE, -0.35]]
      let ra: Rots = [[SIDE, -0.35 - g.arm], [FWD, -g.out]]
      let lf: Rots = [[SIDE, -0.9]]
      let rf: Rots = [[UP, g.turn], [SIDE, -0.9 - g.fore]]
      let spine = Math.sin(this.t) * 0.015 + g.lean
      let head = g.nod
      let lk = 1.45
      let rk = 1.45
      let rThigh: Rots = [[SIDE, -1.45]]
      if (v === 'lean') {
        // 往后一靠，腿往前伸一点，两手搭在沙发上
        spine -= 0.2
        head += 0.08
        lk = 1.15
        rk = 1.2
        la = [[SIDE, -0.1], [FWD, 0.35]]
        lf = [[SIDE, -0.35]]
        if (!this.talking) { ra = [[SIDE, -0.1], [FWD, -0.35]]; rf = [[SIDE, -0.35]] }
      } else if (v === 'cross') {
        // 跷二郎腿：右腿搭在左腿上，两手放在膝盖上
        rThigh = [[UP, 0.4], [SIDE, -1.75]]
        rk = 1.15
        la = [[SIDE, -0.55]]
        lf = [[SIDE, -0.55]]
        if (!this.talking) { ra = [[SIDE, -0.6]]; rf = [[SIDE, -0.5]] }
      }
      this.rot('LeftUpLeg', SIDE, -1.45)
      this.rotMany('RightUpLeg', rThigh)
      this.rot('LeftLeg', SIDE, lk)
      this.rot('RightLeg', SIDE, rk)
      this.rotMany('LeftArm', la, leftDown)
      this.rotMany('RightArm', ra, rightDown)
      this.rotMany('LeftForeArm', lf)
      this.rotMany('RightForeArm', rf)
      this.rot('Spine', SIDE, spine)
      this.rot('Head', SIDE, head)
      this.model.position.y = -0.42 * this.legK
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
      this.idlePose(dt, s, leftDown, rightDown)
    }
  }

  /** 聊天时的手势：轮到自己说时右手比划、身子微微前倾，听的时候点点头 */
  private talkGesture(dt: number): { arm: number; out: number; fore: number; turn: number; lean: number; nod: number } {
    if (!this.talking) return { arm: 0, out: 0, fore: 0, turn: 0, lean: 0, nod: 0 }
    this.talkT += dt
    const speak = Math.max(0, Math.sin(this.talkT * 0.55 + this.seed)) ** 0.7
    const wave = Math.sin(this.talkT * 2.3 + this.seed)
    return {
      arm: speak * (0.3 + wave * 0.1),
      out: speak * 0.12,
      fore: speak * (0.25 + Math.sin(this.talkT * 3.1) * 0.22),
      turn: speak * 0.35,
      lean: speak * 0.04,
      nod: (1 - speak) * Math.max(0, Math.sin(this.talkT * 2.4)) * 0.07 + speak * Math.sin(this.talkT * 1.7) * 0.03,
    }
  }

  /** 站着：呼吸、慢慢换重心，隔一会儿换个小动作；聊天时手比划 */
  private idlePose(dt: number, s: number, leftDown?: THREE.Quaternion, rightDown?: THREE.Quaternion): void {
    this.pickIdle(dt)
    const v = this.talking ? 'plain' : this.idleVar
    let headYaw = Math.sin(this.t * 0.23) > 0.6 ? Math.sin(this.t * 0.9) * 0.3 : 0
    let headPitch = Math.sin(this.t * 0.37) * 0.05
    let spinePitch = Math.sin(this.t * 1.4) * 0.015
    let la: Rots = [[SIDE, s * 0.03]]
    let ra: Rots = [[SIDE, -s * 0.03]]
    let lf: Rots = [[SIDE, -0.12]]
    let rf: Rots = [[SIDE, -0.12]]
    if (v === 'crossed') {
      la = [[SIDE, -0.3], [FWD, -0.06]]
      ra = [[SIDE, -0.26], [FWD, 0.06]]
      lf = [[UP, -1.35], [SIDE, -0.88]]
      rf = [[UP, 1.35], [SIDE, -0.78]]
      headPitch -= 0.04
    } else if (v === 'hips') {
      la = [[SIDE, 0.25], [FWD, 0.62]]
      ra = [[SIDE, 0.25], [FWD, -0.62]]
      lf = [[UP, -0.6], [FWD, -1.2]]
      rf = [[UP, 0.6], [FWD, 1.2]]
      spinePitch -= 0.03
    } else if (v === 'look') {
      headYaw = Math.sin(this.idleT * 1.25) * 0.65
      headPitch -= 0.03
    } else if (v === 'scratch') {
      const k = envelope(this.idleT, 2.4)
      ra = [[FWD, -0.35 * k], [SIDE, -2.3 * k]]
      rf = [[FWD, -0.9 * k], [SIDE, -1.3 * k + Math.sin(this.idleT * 14) * 0.07 * k]]
      headPitch += 0.14 * k
      headYaw = -0.12 * k
    } else if (v === 'stretch') {
      const k = envelope(this.idleT, 2.8)
      la = [[FWD, -0.25 * k], [SIDE, -2.85 * k]]
      ra = [[FWD, 0.25 * k], [SIDE, -2.85 * k]]
      lf = [[SIDE, -0.35 * k]]
      rf = [[SIDE, -0.35 * k]]
      spinePitch -= 0.12 * k
      headPitch -= 0.22 * k
    }
    const g = this.talkGesture(dt)
    if (this.talking) {
      ra = [[SIDE, -0.3 - g.arm], [FWD, -0.08 - g.out]]
      rf = [[UP, g.turn], [SIDE, -0.5 - g.fore]]
      spinePitch += g.lean
      headPitch += g.nod
    }
    this.rotMany('LeftArm', la, leftDown)
    this.rotMany('RightArm', ra, rightDown)
    this.rotMany('LeftForeArm', lf)
    this.rotMany('RightForeArm', rf)
    this.rotMany('Hips', [[FWD, Math.sin(this.t * 0.31) * 0.035]])
    this.rot('Spine', SIDE, spinePitch)
    this.rot('Spine1', SIDE, Math.sin(this.t * 1.4 + 0.5) * 0.012)
    this.rotMany('Head', [[UP, headYaw], [SIDE, headPitch]])
    this.rot('LeftLeg', SIDE, Math.max(0, Math.sin(this.t * 0.31)) * 0.12)
  }
}
