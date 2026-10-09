// 储藏室：东西按种类放在柜子里，不再满地小方块。
// 北墙三个铁架子：两架放吃的（真空包装、罐头、纸箱）、一架放水（一加仑的水桶）；
// 西墙一架：上面两层药箱，下面两层弹药箱；东墙根一排油桶；吃的架子放满了，就在门南边码纸箱。
// 摆几件跟着家里的存货变（一件代表几份，见 PER）；再多就看不出来了——可以收进空间。
import * as THREE from 'three'
import { PANTRY_SHELVES, SHELF_LEVELS, type PantryShelf } from './layout'
import type { ParadiseKit } from './paradise'

export interface PantryStock { food: number; water: number; medkits: number; ammo: number; fuel: number }

/** 一件东西代表几份 */
export const PER = { food: 3, water: 2, medkits: 1, ammo: 10, fuel: 1 } as const

interface Slot { x: number; y: number; z: number; rot: number }

/** 纸条贴在架子前沿外面一点 */
const SHELF_DEPTH_FRONT = 0.27

/** 一个模型的所有零件烘成几何体（原点挪到底面中心、缩放好），每个零件一个实例化网格 */
class Stack {
  readonly meshes: THREE.InstancedMesh[] = []
  constructor(parent: THREE.Object3D, src: THREE.Object3D, max: number, scale: number) {
    src.updateMatrixWorld(true)
    const parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[] = []
    src.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) parts.push({ geo: m.geometry.clone().applyMatrix4(m.matrixWorld), mat: m.material })
    })
    const box = new THREE.Box3()
    for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox!) }
    for (const p of parts) {
      p.geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
      p.geo.scale(scale, scale, scale)
      const im = new THREE.InstancedMesh(p.geo, p.mat, max)
      im.count = 0
      // 实例化网格的包围球按原点那一个算，会被当成"不在镜头里"裁掉
      im.frustumCulled = false
      im.castShadow = true
      im.receiveShadow = true
      parent.add(im)
      this.meshes.push(im)
    }
  }

  set(slots: Slot[]): void {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    for (const im of this.meshes) {
      slots.forEach((s, i) => {
        q.setFromAxisAngle(up, s.rot)
        m.compose(new THREE.Vector3(s.x, s.y, s.z), q, one)
        im.setMatrixAt(i, m)
      })
      im.count = slots.length
      im.instanceMatrix.needsUpdate = true
    }
  }
}

/** 架子上的一个位置：u 沿架子宽度（左右），v 沿深度（前后），按架子的朝向转到世界坐标 */
function onShelf(s: PantryShelf, level: number, u: number, v: number, lift = 0, spin = 0): Slot {
  const a = THREE.MathUtils.degToRad(s.rot)
  return {
    x: s.x + u * Math.cos(a) + v * Math.sin(a),
    z: s.z - u * Math.sin(a) + v * Math.cos(a),
    y: SHELF_LEVELS[level] + lift,
    rot: a + spin,
  }
}

/** 架子顶上贴的手写纸条（"粮食""饮用水"……） */
function label(text: string): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#efe4c8'
  g.fillRect(0, 0, 256, 96)
  g.strokeStyle = '#b9a47c'
  g.lineWidth = 4
  g.strokeRect(6, 6, 244, 84)
  g.fillStyle = '#3b2b1e'
  g.font = 'bold 50px "Songti SC", "STSong", serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 50)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  return m
}

export class PantryView {
  private readonly foodSet: Stack
  private readonly cans: Stack
  private readonly box: Stack
  private readonly jug: Stack
  private readonly medkit: Stack
  private readonly ammo: Stack
  private readonly fuel: Stack
  /** 吃的：架子上的位置（按先放眼睛高度那层的顺序）和地上码纸箱的位置 */
  readonly foodSlots: Slot[] = []
  readonly floorBoxes: Slot[] = []
  readonly waterSlots: Slot[] = []
  readonly medSlots: Slot[] = []
  readonly ammoSlots: Slot[] = []
  readonly fuelSlots: Slot[] = []
  private shown = ''

  constructor(parent: THREE.Object3D, kit: ParadiseKit) {
    const get = (slug: string) => {
      const m = kit.models.get(slug)
      if (!m) throw new Error(`缺少模型 ${slug}`)
      return m
    }
    this.foodSet = new Stack(parent, get('long_life_food'), 24, 1.0)
    this.cans = new Stack(parent, get('russian_food_cans_01'), 24, 2.0)
    this.box = new Stack(parent, get('cardboard_box_01'), 40, 0.92)
    this.jug = new Stack(parent, get('plastic_bottle_gallon'), 40, 1.4)
    this.medkit = new Stack(parent, get('medical_box'), 12, 0.85)
    this.ammo = new Stack(parent, get('ammo_box'), 12, 1.5)
    this.fuel = new Stack(parent, get('metal_jerrycan'), 12, 1.0)

    const [food1, food2, water, med] = PANTRY_SHELVES
    // 吃的：先放第二层（眼睛高度），再第三层、最下面、最上面；每层左右两件
    for (const level of [1, 2, 0, 3]) {
      for (const s of [food1, food2]) for (const u of [-0.27, 0.27]) this.foodSlots.push(onShelf(s, level, u, 0))
    }
    // 吃的架子满了：门南边贴着西墙码纸箱（两列、两层）
    for (let layer = 0; layer < 2; layer++) {
      for (const z of [5.5, 4.95, 4.4, 3.85, 3.3]) for (const x of [8.42, 8.84]) this.floorBoxes.push({ x, z, y: layer * 0.315, rot: 0 })
    }
    // 水重，从最下面一层往上放；每层前后两排、一排四桶
    for (const level of [0, 1, 2, 3]) {
      for (const v of [-0.11, 0.11]) for (const u of [-0.39, -0.13, 0.13, 0.39]) this.waterSlots.push(onShelf(water, level, u, v))
    }
    // 药箱：上面两层，每层左右两摞、一摞三个
    for (const level of [2, 3]) {
      for (let k = 0; k < 3; k++) for (const u of [-0.26, 0.26]) this.medSlots.push(onShelf(med, level, u, 0, k * 0.088))
    }
    // 弹药箱：下面两层，一层六个竖着排（长边朝里）
    for (const level of [1, 0]) {
      for (let k = 0; k < 6; k++) this.ammoSlots.push(onShelf(med, level, -0.42 + k * 0.168, 0))
    }
    // 油桶：东墙根两排，宽的一面朝屋里
    for (const x of [11.68, 11.42]) {
      for (const z of [5.5, 5.1, 4.7, 4.3, 3.9, 3.5]) this.fuelSlots.push({ x, z, y: 0, rot: -Math.PI / 2 })
    }
    // 架子顶上的纸条（朝外）；没有画布的环境（单测）就不贴
    if (typeof document !== 'undefined') for (const s of PANTRY_SHELVES) {
      const t = label(s.label)
      const p = onShelf(s, 3, 0, SHELF_DEPTH_FRONT, 0.42)
      t.position.set(p.x, p.y, p.z)
      t.rotation.y = p.rot
      parent.add(t)
    }
  }

  /** 按家里的存货决定摆几件 */
  sync(st: PantryStock): void {
    // 四舍五入；只剩一点点也摆一件（不然家里明明还有半份吃的，架子却是空的）
    const n = (v: number, per: number, cap: number) => (v <= 0.05 ? 0 : Math.min(cap, Math.max(1, Math.round(v / per))))
    const food = n(st.food, PER.food, this.foodSlots.length + this.floorBoxes.length)
    const water = n(st.water, PER.water, this.waterSlots.length)
    const med = n(st.medkits, PER.medkits, this.medSlots.length)
    const ammo = n(st.ammo, PER.ammo, this.ammoSlots.length)
    const fuel = n(st.fuel, PER.fuel, this.fuelSlots.length)
    const key = `${food}|${water}|${med}|${ammo}|${fuel}`
    if (key === this.shown) return
    this.shown = key
    // 架子上：真空包装、罐头、纸箱轮着放，看着是分门别类码好的
    const onShelves = this.foodSlots.slice(0, Math.min(food, this.foodSlots.length))
    const sets: Slot[] = []
    const cans: Slot[] = []
    const boxes: Slot[] = []
    onShelves.forEach((s, i) => {
      const k = i % 3
      if (k === 0) sets.push(s)
      else if (k === 1) {
        // 一格放两组罐头
        const dx = Math.cos(s.rot) * 0.13
        const dz = -Math.sin(s.rot) * 0.13
        cans.push({ ...s, x: s.x - dx, z: s.z - dz }, { ...s, x: s.x + dx, z: s.z + dz })
      } else boxes.push({ ...s, rot: s.rot + Math.PI / 2 })
    })
    boxes.push(...this.floorBoxes.slice(0, Math.max(0, food - this.foodSlots.length)))
    this.foodSet.set(sets)
    this.cans.set(cans)
    this.box.set(boxes)
    this.jug.set(this.waterSlots.slice(0, water))
    this.medkit.set(this.medSlots.slice(0, med))
    this.ammo.set(this.ammoSlots.slice(0, ammo))
    this.fuel.set(this.fuelSlots.slice(0, fuel))
  }
}
