// 2.5D 原型的 3D 世界：小别墅 + 门前一条街。
// 家里（院子围栏以内）用固定 45° 视角；出了铁门换成高角度跟拍。两种镜头同一个朝向，
// 切换时用 0.9 秒平滑过渡，同时屋顶淡出、靠近镜头的墙压低。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  FLOOR_H, FURNITURE, GARDEN, GATE, HOUSE, HOUSE_CENTER, PARADISE_EXTRAS, PROPS, STAIR_HOLE, STREET, WALLS, WORLD, YARD,
  fenceSegments, isHome, type Floor, type Placement, type Spot,
} from './layout'
import { navFloors, type NavGrid } from './nav'
import { loadPerson } from './people'
import {
  ParadiseMaterials, Petals, RIVER, River, boxProjectUV, hills, loadParadiseKit, placeModel, sakuraTree, samplers, scatter, type ArtStyle, type ParadiseKit,
} from './paradise'
import {
  COLORS, barrel, box, car, counter, crowbar, desk, fridge, neighborHouse, rollingPin, shelf, shotgun, sofa, stairs,
  toon, toonify, tree, villaRoof, wallMap,
} from './meshes'
import { Actor, Household, type LogEntry, type NightReport, type PersonHud } from './residents'
import { PROLOGUE_DAYS, calendarLabel, isCrisisNight, isNight } from './life'
import { LAYERS, type LayerId } from './siege'
import { SiegeView } from './siegeView'
import { Sound } from './sound'
import { npcs } from '../content/npcs'
import { lt, t, type UiKey } from '../i18n'
import { Rain } from './weather'
import { clearWorld, loadWorld, saveWorld } from './save'
import { Bubbles, bubbleMaterial } from './bubbles'
import { SCAVENGE, nearestSpot } from './scavenge'
import { VISITORS, Visitor } from './visitors'
import { skyAt, type StyleDay } from './daylight'

export type ViewMode = 'home' | 'outside'
export interface Hud {
  loading: boolean
  mode: ViewMode
  floor: Floor
  selected: string
  error?: string
  /** 顶栏日期，比如"末日前 4 天 · 08:30" */
  time: string
  night: boolean
  rain: number
  crisis: boolean
  /** 月底危机夜的类型（尸潮、匮乏…） */
  crisisKind: string | null
  speed: number
  food: number
  water: number
  people: PersonHud[]
  /** 短暂的提示（比如"有人在用"） */
  toast: string
  ammo: number
  cores: number
  /** 正在打丧尸：还剩几只、守的是哪一层、这一层的耐久 */
  siege: { left: number; layer: LayerId | null; hp: number; max: number; ambush: boolean } | null
  log: LogEntry[]
  muted: boolean
  day: number
  hour: number
  money: number
  medkits: number
  prologue: boolean
  report: NightReport | null
  /** 空间异能里放了多少、最多放多少 */
  space: { food: number; water: number; cap: number }
  molotovs: number
  /** 菜地：开了没有、长到多少 */
  garden: { built: boolean; growth: number }
  /** 屋外：女主身边能搜的地方 */
  search: { kind: string; state: string; progress: number | null } | null
  /** 有人在门口等回话 */
  visit: { id: string; icon: string; name: string; textKey: string; choices: { id: string; ok: boolean }[] } | null
}

interface Pose { target: THREE.Vector3; elev: number; dist: number; fov: number }

const YAW = Math.PI / 4
const HOME_VIEW = { elev: THREE.MathUtils.degToRad(40), dist: 30, fov: 24 }
const OUT_VIEW = { elev: THREE.MathUtils.degToRad(52), dist: 15, fov: 38 }
const TWEEN_S = 0.9
const STUB = 0.12
const SKY = '#bfe3f2'
const WALK_SPEED = 2.2
const HEMI_DAY = new THREE.Color('#dcefff')
const HEMI_NIGHT = new THREE.Color('#5d74b0')
const RAIN_GREY = new THREE.Color('#9aa3a8')

type ToastKey = 'world.toast.busy' | 'world.toast.fighting' | 'world.toast.garden' | 'world.toast.siege' | 'world.toast.crisis' | 'world.toast.won'
  | 'world.toast.lost' | 'world.log.broken.gate' | 'world.log.broken.door' | 'world.log.broken.stairs'

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const EMPTY_HUD: Hud = {
  loading: true, mode: 'home', floor: 0, selected: '林知夏', time: '', night: false, rain: 0, crisis: false, crisisKind: null, speed: 1,
  food: 0, water: 0, people: [], toast: '', ammo: 0, cores: 0, siege: null, log: [], muted: false, day: 0, hour: 0, money: 0, medkits: 0, prologue: true, report: null, visit: null, space: { food: 0, water: 0, cap: 6 }, molotovs: 0, search: null, garden: { built: false, growth: 0 },
}

export class World {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200)
  private readonly sun = new THREE.DirectionalLight('#fff1d6', 2.4)
  private readonly clock = new THREE.Clock()
  private readonly raycaster = new THREE.Raycaster()
  private readonly navs: Record<Floor, NavGrid>
  private readonly actors: Actor[] = []
  private life!: Household
  private heroine!: Actor
  private selected!: Actor
  private readonly nearWalls: THREE.Object3D[] = []
  private readonly floor2 = new THREE.Group()
  private roof: THREE.Group | null = null
  private roofMats: THREE.Material[] = []
  private readonly marker: THREE.Mesh
  private readonly ring: THREE.Mesh
  private mode: ViewMode = 'home'
  private viewFloor: Floor = 0
  private tweenT = TWEEN_S
  private tweenFrom: Pose | null = null
  private floorTween = false
  private homeness = 1
  private zoom = { home: 1, outside: 1 }
  private readonly pan = new THREE.Vector3()
  private readonly pose: Pose = { target: new THREE.Vector3(HOUSE_CENTER.x, 0.8, HOUSE_CENTER.z), ...HOME_VIEW }
  private readonly keys = new Set<string>()
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private press: { x: number; y: number; t: number; moved: boolean } | null = null
  private pinchDist = 0
  private followTimer = 0
  private raf = 0
  private disposed = false
  private hud: Hud = { ...EMPTY_HUD }
  private hudTimer = 0
  private toastTimer = 0
  private readonly clickables: THREE.Object3D[] = []
  private readonly lamps: THREE.PointLight[] = []
  private readonly bulbs: THREE.Mesh[] = []
  private readonly sunDir = new THREE.Vector3(0.4, 0.9, 0.2)
  private dayBase: StyleDay = { sky: SKY, fog: SKY, sun: '#fff1d6' }
  private readonly siegeView: SiegeView
  readonly sound = new Sound()
  private readonly weapons: THREE.Object3D[] = []
  private readonly groanT = new WeakMap<object, number>()
  private nightness = 0
  private readonly rain = new Rain()
  private readonly glass: THREE.Material[] = []
  private fogBase = 0.013
  private saveTimer = 10
  private readonly bubbles = new Bubbles()
  /** 菜地：一块土 + 两排苗（苗按长势缩放），熟了头上冒 🥬 */
  private readonly gardenObj = new THREE.Group()
  private readonly sprouts: THREE.Object3D[] = []
  private readonly ripeMark = new THREE.Sprite(bubbleMaterial('🥬'))
  /** 街上能搜的地方头顶的放大镜 */
  private readonly spotMarks: THREE.Sprite[] = SCAVENGE.map((sp) => {
    const m = new THREE.Sprite(bubbleMaterial('🔍'))
    m.position.set(sp.at.x, 1.9, sp.at.z)
    m.scale.setScalar(0.6)
    m.visible = false
    return m
  })
  private frontDoor: THREE.Object3D | null = null
  private barricade: THREE.Object3D | null = null
  private sunBase = 2.4
  private hemiBase = 1.5
  private envBase = 0
  private readonly resize: ResizeObserver
  private readonly listeners: [EventTarget, string, EventListener][] = []
  private readonly host: HTMLElement
  private readonly onHud: (h: Hud) => void
  private keysMoving = false
  private readonly style: ArtStyle
  private readonly hemi = new THREE.HemisphereLight('#dcefff', '#b59b78', 1.5)
  private petals: Petals | null = null
  private river: River | null = null
  private elapsed = 0
  private groundMesh: THREE.Mesh | null = null

  constructor(host: HTMLElement, onHud: (h: Hud) => void, style: ArtStyle = 'toon') {
    this.host = host
    this.onHud = onHud
    this.style = style
    this.navs = navFloors(style)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.touchAction = 'none'

    this.scene.background = new THREE.Color(SKY)
    this.scene.fog = new THREE.Fog(SKY, 55, 110)
    this.scene.add(this.hemi)
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048)
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.28, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }))
    this.marker.rotation.x = -Math.PI / 2
    this.marker.visible = false
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), new THREE.MeshBasicMaterial({ color: '#ffd166' }))
    this.ring.rotation.x = -Math.PI / 2
    this.scene.add(this.marker, this.ring)

    this.buildGround()
    this.buildStreet()
    this.spawnActors()
    this.scene.add(this.rain.lines, ...this.spotMarks)
    this.buildGarden()
    this.siegeView = new SiegeView(this.scene)
    this.life.spawnZombie = (at, raider) => this.siegeView.spawn(at, raider)
    this.life.spawnVisitor = (def, at) => {
      const v = new Visitor(def, at, this.siegeView.npc(def.model))
      this.scene.add(v.root)
      return v
    }
    this.life.makeActor = (name, model, at) => {
      const a = new Actor(name, '#8a6d4f', '#222222', 1.03, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
      a.model = model
      this.setupActor(a)
      this.dressResident(a)
      return a
    }
    // 接着上次的进度（要在 makeActor 设好以后，住进来的人才能重建）
    loadWorld(this.life)
    this.life.onKnock = () => {
      this.sound.knock()
      if (this.mode === 'home') this.setViewFloor(0)
      this.pushLifeHud()
    }
    this.life.onSiege = (e) => {
      this.siegeView.onEvent(e)
      const vol = (at: { x: number; z: number }) => THREE.MathUtils.clamp(1.25 - Math.hypot(at.x - this.pose.target.x, at.z - this.pose.target.z) / 22, 0.15, 1)
      if (e.kind === 'shot') this.sound.shot(vol(e.at))
      else if (e.kind === 'bash') this.sound.bash(e.layer === 'gate', vol(e.at))
      else if (e.kind === 'broken') this.sound.crash()
      else if (e.kind === 'kill') this.sound.squelch()
      else if (e.kind === 'hit') this.sound.hurt()
      else if (e.kind === 'fire') this.sound.fire()
      if (e.kind === 'start') {
        this.toast(e.crisis ? 'world.toast.crisis' : 'world.toast.siege', 4)
        if (this.mode === 'home') this.setViewFloor(0)
      } else if (e.kind === 'broken') this.toast(`world.log.broken.${e.layer}` as ToastKey, 3)
      else if (e.kind === 'end') this.toast(e.won ? 'world.toast.won' : 'world.toast.lost', 4)
    }

    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.bindInput()
    this.loadVilla()
    this.loop()
    // 调试用：网址带 ?debug 时可以在控制台里看场景
    if (location.search.includes('debug')) (window as unknown as { __world: World }).__world = this
  }

  // --- 场景 -------------------------------------------------------------------

  private buildGround(): void {
    const w = WORLD.x1 - WORLD.x0 + 80
    const d = WORLD.z1 - WORLD.z0 + 80
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(COLORS.grassDark))
    ground.rotation.x = -Math.PI / 2
    ground.position.set((WORLD.x0 + WORLD.x1) / 2, -0.02, (WORLD.z0 + WORLD.z1) / 2)
    ground.receiveShadow = true
    this.groundMesh = ground
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(YARD.x1 - YARD.x0, YARD.z1 - YARD.z0), toon(COLORS.grass))
    yard.rotation.x = -Math.PI / 2
    yard.position.set((YARD.x0 + YARD.x1) / 2, -0.01, (YARD.z0 + YARD.z1) / 2)
    yard.receiveShadow = true
    this.scene.add(ground, yard)
    // 大门到铁门的石板路
    for (let z = HOUSE.z1 + 0.6; z < GATE.z - 0.3; z += 0.85) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 8), toon(COLORS.stone))
      s.position.set(GATE.x + (Math.round(z * 3) % 2 ? 0.12 : -0.12), 0, z)
      s.receiveShadow = true
      this.scene.add(s)
    }
  }

  private buildStreet(): void {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET.x1 - STREET.x0 + 40, STREET.z1 - STREET.z0), toon(COLORS.road))
    road.rotation.x = -Math.PI / 2
    road.position.set((STREET.x0 + STREET.x1) / 2, 0.005, (STREET.z0 + STREET.z1) / 2)
    road.receiveShadow = true
    this.scene.add(road)
    for (const z of [STREET.z0 - 0.6, STREET.z1 + 0.6]) {
      const walk = box(STREET.x1 - STREET.x0 + 40, 0.08, 1.2, COLORS.sidewalk, [(STREET.x0 + STREET.x1) / 2, 0, z])
      this.scene.add(walk)
    }
    for (let x = STREET.x0 - 18; x < STREET.x1 + 18; x += 4) {
      this.scene.add(box(2, 0.02, 0.18, '#e8e2cf', [x, 0.006, (STREET.z0 + STREET.z1) / 2]))
    }
    for (const p of PROPS) {
      const obj = p.kind === 'house' ? neighborHouse(p) : p.kind === 'tree' ? tree() : p.kind === 'car' ? car(p.color ?? '#888') : barrel()
      obj.position.set(p.x, 0, p.z)
      obj.rotation.y = THREE.MathUtils.degToRad(p.rot)
      obj.userData.prop = p.kind
      this.scene.add(obj)
    }
  }

  private async loadVilla(): Promise<void> {
    try {
      const [gltf, paradise, people] = await Promise.all([
        new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/villa_kit.glb`),
        this.style === 'paradise' ? loadParadiseKit(this.renderer) : Promise.resolve(null),
        this.style === 'paradise' ? Promise.all(['heroine', 'mom', 'dad'].map(loadPerson)) : Promise.resolve(null),
      ])
      if (this.disposed) return
      const kit = new Map<string, THREE.Object3D>()
      for (const child of gltf.scene.children) {
        toonify(child)
        kit.set(child.name, child)
      }
      this.assembleVilla(kit)
      if (paradise) this.applyParadise(paradise)
      if (people) {
        people.forEach((m, k) => this.actors[k].setModel(m))
        // 女主霰弹枪、妈妈擀面杖、爸爸撬棍：只在打丧尸时拿出来
        const kit = [shotgun(), rollingPin(), crowbar()]
        kit.forEach((w, k) => {
          w.visible = false
          if (this.actors[k].driver?.attach(w, 'RightHand')) this.weapons.push(w)
        })
      }
      this.addLamps()
      this.collectClickables()
      // 窗玻璃：夜里亮起暖光
      const seen = new Set<THREE.Material>()
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material
        for (const x of m ? (Array.isArray(m) ? m : [m]) : []) if (x.name === 'pal_glass' && !seen.has(x)) { seen.add(x); this.glass.push(x) }
      })
      const gates: THREE.Object3D[] = []
      this.scene.traverse((o) => { if (o.userData.gate || o.userData.slug === 'large_iron_gate') gates.push(o) })
      this.siegeView.bind(gates, this.frontDoor, this.barricade)
      this.setHud({ loading: false })
      // 丧尸、访客、住进来的人的模型不挡开场：别墅出来以后在后台加载，好了再预热着色器
      if (this.style === 'paradise') void this.siegeView.loadModels().then(() => this.afterExtraModels(), () => this.afterExtraModels())
      else this.afterExtraModels()
    } catch (e) {
      this.setHud({ loading: false, error: `模型加载失败：${String(e)}` })
    }
  }

  private buildGarden(): void {
    const w = GARDEN.x1 - GARDEN.x0
    const d = GARDEN.z1 - GARDEN.z0
    const soil = new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 1 })
    const bed = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), soil)
    bed.position.set((GARDEN.x0 + GARDEN.x1) / 2, 0.03, (GARDEN.z0 + GARDEN.z1) / 2)
    bed.receiveShadow = true
    this.gardenObj.add(bed)
    const leaf = new THREE.MeshStandardMaterial({ color: '#5f9a3a', roughness: 0.8 })
    for (let r = 0; r < 2; r++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, 0.08, 0.4), soil)
      ridge.position.set(bed.position.x, 0.1, GARDEN.z0 + 0.55 + r * 0.9)
      this.gardenObj.add(ridge)
      for (let k = 0; k < 4; k++) {
        // 一棵苗：几片叶子（卡通小锥体）
        const plant = new THREE.Group()
        for (let l = 0; l < 4; l++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), leaf)
          blade.position.y = 0.2
          blade.rotation.set(0.5 * Math.cos(l * 1.6), 0, 0.5 * Math.sin(l * 1.6))
          blade.castShadow = true
          plant.add(blade)
        }
        plant.position.set(GARDEN.x0 + 0.45 + k * 0.57, 0.12, GARDEN.z0 + 0.55 + r * 0.9)
        this.sprouts.push(plant)
        this.gardenObj.add(plant)
      }
    }
    this.ripeMark.position.set(bed.position.x, 1.3, bed.position.z)
    this.ripeMark.scale.setScalar(0.6)
    this.gardenObj.add(this.ripeMark)
    this.gardenObj.visible = false
    this.scene.add(this.gardenObj)
  }

  buildGardenPlot(): void {
    if (this.life.buildGarden()) this.toast('world.toast.garden')
    this.pushLifeHud()
  }

  /** 额外模型加载好以后：给住进来的人换上真人模型，再预热一帧（武器、丧尸、特效） */
  private afterExtraModels(): void {
    if (this.disposed) return
    for (const a of this.actors.slice(3)) this.dressResident(a)
    const fighting = !!this.life.siege && !this.life.siege.done
    for (const w of this.weapons) w.visible = true
    this.siegeView.prewarm(() => this.renderer.render(this.scene, this.camera))
    for (const w of this.weapons) w.visible = fighting
  }

  private assembleVilla(kit: Map<string, THREE.Object3D>): void {
    const place = (name: string, x: number, y: number, z: number, rotDeg: number): THREE.Object3D => {
      const src = kit.get(name)
      if (!src) throw new Error(`缺少组件 ${name}`)
      const obj = src.clone()
      obj.position.set(x, y, z)
      obj.rotation.set(0, THREE.MathUtils.degToRad(rotDeg), 0)
      return obj
    }
    const floorGroup = (f: Floor) => (f === 0 ? this.scene : this.floor2)
    // 地板
    const hole = (x: number, z: number) => x > STAIR_HOLE.x0 && x < STAIR_HOLE.x1 && z > STAIR_HOLE.z0 && z < STAIR_HOLE.z1
    for (let i = HOUSE.x0; i < HOUSE.x1; i++)
      for (let j = HOUSE.z0; j < HOUSE.z1; j++) {
        this.scene.add(place('floor_1x1', i + 0.5, 0, j + 0.5, 0))
        if (!hole(i + 0.5, j + 0.5)) this.floor2.add(place('floor_1x1', i + 0.5, FLOOR_H, j + 0.5, 0))
      }
    const w = HOUSE.x1 - HOUSE.x0
    const d = HOUSE.z1 - HOUSE.z0
    // 二楼楼板（楼梯那一块留空）
    const slab = (x0: number, z0: number, x1: number, z1: number) =>
      this.floor2.add(box(x1 - x0, 0.2, z1 - z0, COLORS.wall, [(x0 + x1) / 2, FLOOR_H - 0.3, (z0 + z1) / 2]))
    slab(HOUSE.x0, HOUSE.z0, HOUSE.x1, STAIR_HOLE.z0)
    slab(HOUSE.x0, STAIR_HOLE.z0, STAIR_HOLE.x0, STAIR_HOLE.z1)
    slab(HOUSE.x0, STAIR_HOLE.z1, HOUSE.x1, HOUSE.z1)
    // 墙
    const piece = { wall: 'wall_1m', window: 'wall_window_1m', door: 'wall_door_1m' } as const
    for (const s of WALLS) {
      const obj = place(piece[s.kind], s.x, s.floor * FLOOR_H, s.z, s.axis === 'z' ? 90 : 0)
      if (s.near) this.nearWalls.push(obj)
      floorGroup(s.floor).add(obj)
    }
    // 家具
    for (const p of FURNITURE) floorGroup(p.floor).add(this.furniture(p, kit, place))
    // 大门的门板：外层跟着矮墙一起压低，中间一层是门轴（开门、被砸倒），里面是门板
    const hinge = new THREE.Group()
    hinge.add(box(0.9, 2.05, 0.06, COLORS.woodDark, [0.45, 0, 0]))
    const door = new THREE.Group()
    door.position.set(3.05, 0, 6.0)
    door.add(hinge)
    this.nearWalls.push(door)
    this.frontDoor = door
    this.scene.add(door)
    // 退到楼梯时堆在楼梯口的箱子（平时藏着）
    const pile = new THREE.Group()
    pile.add(
      box(0.55, 0.55, 0.55, COLORS.wood, [4.55, 0, 4.2]),
      box(0.55, 0.55, 0.55, COLORS.wood, [4.6, 0, 4.8]),
      box(0.5, 0.45, 0.5, COLORS.woodDark, [4.58, 0.55, 4.5]),
    )
    pile.children.forEach((c, k) => { c.rotation.y = k * 0.4 })
    pile.visible = false
    this.barricade = pile
    this.scene.add(pile)
    // 围栏和铁门
    for (const s of fenceSegments()) {
      const f = place(s.gate ? 'gate_1m' : 'fence_1m', s.x, 0, s.z, s.axis === 'z' ? 90 : 0)
      if (s.gate) f.userData.gate = true
      this.scene.add(f)
    }
    // 屋顶
    const { root, mats } = villaRoof(w, d, FLOOR_H * 2 - 0.2)
    root.position.set(HOUSE.x0 + w / 2, 0, HOUSE.z0 + d / 2)
    this.roof = root
    this.roofMats = mats
    this.scene.add(this.floor2, root)
  }

  private furniture(p: Placement, kit: Map<string, THREE.Object3D>,
    place: (n: string, x: number, y: number, z: number, r: number) => THREE.Object3D): THREE.Object3D {
    const y = p.floor * FLOOR_H
    if (kit.has(p.piece)) {
      const o = place(p.piece, p.x, y, p.z, p.rot)
      o.userData.piece = p.piece
      return o
    }
    const made: Record<string, () => THREE.Object3D> = {
      sofa, counter, fridge, desk, shelf, wall_map: wallMap, stairs: () => stairs(FLOOR_H),
    }
    const obj = made[p.piece]?.() ?? box(0.5, 0.5, 0.5, '#ff00ff')
    obj.userData.piece = p.piece
    obj.position.set(p.x, y, p.z)
    obj.rotation.y = p.piece === 'wall_map' ? 0 : THREE.MathUtils.degToRad(p.rot)
    return obj
  }

  /** 世外桃源画风：换成 Poly Haven 材质，开天空光照和雾，再种草、种樱花、加远山和江 */
  private applyParadise(kit: ParadiseKit): void {
    const mats = new ParadiseMaterials(kit)
    if (this.roof) mats.apply(this.roof, true)
    mats.apply(this.scene, false, this.roof ?? undefined)
    if (this.roof) {
      const own = new Set<THREE.Material>()
      this.roof.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m) for (const x of Array.isArray(m) ? m : [m]) own.add(x)
      })
      this.roofMats = [...own]
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.scene.environment = kit.env
    this.scene.fog = new THREE.FogExp2('#dfe6dd', 0.013)
    // 白天的基准；早晚和夜里由 applySky 按时间调
    this.dayBase = { sky: '#cfe1e8', fog: '#dfe6dd', sun: '#ffe2b8' }
    this.sunBase = 2.8
    this.hemiBase = 0.55
    this.envBase = 0.75
    this.swapToModels(kit)
    // 草、花、蕨、苔石：Poly Haven 植物模型实例化撒在地上
    this.scene.add(
      scatter(kit, 'grass_bermuda_01', 9000, samplers.lawnEdge, [3.0, 4.6], 1),
      scatter(kit, 'grass_bermuda_01', 12000, samplers.wild, [3.2, 5.0], 2),
      scatter(kit, 'grass_bermuda_01', 2500, samplers.lawn, [2.4, 3.4], 9),
      scatter(kit, 'dandelion_01', 320, samplers.lawn, [1.5, 2.1], 3),
      scatter(kit, 'flower_empodium', 220, samplers.lawnEdge, [1.6, 2.3], 4),
      scatter(kit, 'shrub_sorrel_01', 260, samplers.houseFront, [2.2, 3.2], 5),
      scatter(kit, 'periwinkle_plant', 70, samplers.houseFront, [1.3, 1.8], 6),
      scatter(kit, 'fern_02', 60, samplers.wild, [1.0, 1.5], 7),
      scatter(kit, 'rock_moss_set_02', 30, samplers.riverBank, [0.5, 0.9], 8),
    )
    // 樱花种在屋后和两侧，不挡家里视角；外面的树换成 Poly Haven 的老树
    const trees: [number, number, number][] = [[-2.4, -1.6, 0.85], [6, -2.2, 0.8], [-2.6, 9.8, 0.9], [-9, 12.5, 1.0], [17, -5, 0.95], [-15, -3, 0.9]]
    for (const [x, z, sc] of trees) {
      const t = sakuraTree(kit, sc)
      t.position.set(x, 0, z)
      t.rotation.y = x * 1.7
      this.scene.add(t)
    }
    this.petals = new Petals(new THREE.Vector3(-2.8, 0, 9.8), 3.5)
    this.scene.add(this.petals.points)
    const hillMat = mats.textured('grassDark') ?? new THREE.MeshStandardMaterial({ color: '#6f9a55' })
    this.scene.add(hills(hillMat))
    // 地面只铺到江的南岸，江和北岸由 River 自己铺
    if (this.groundMesh) {
      const w = WORLD.x1 - WORLD.x0 + 80
      const z1 = WORLD.z1 + 40
      const geo = new THREE.PlaneGeometry(w, z1 - RIVER.south)
      boxProjectUV(geo)
      this.groundMesh.geometry.dispose()
      this.groundMesh.geometry = geo
      this.groundMesh.position.z = (z1 + RIVER.south) / 2
    }
    this.river = new River(mats)
    this.scene.add(this.river.group)
  }

  /** 世外桃源画风：把代码画的家具、铁门、车、木桶、树换成 Poly Haven 模型 */
  private swapToModels(kit: ParadiseKit): void {
    const subst: Record<string, { slug: string; rot?: number; scale?: number }> = {
      sofa: { slug: 'Sofa_01', rot: 180 },
      table: { slug: 'wooden_table_02' },
      chair: { slug: 'painted_wooden_chair_01', rot: 180 },
      desk: { slug: 'wooden_table_02' },
      shelf: { slug: 'wooden_bookshelf_worn', scale: 0.95 },
      // 冰箱换成囤货的老柜子
      fridge: { slug: 'chinese_cabinet', rot: 0, scale: 0.85 },
    }
    const doomed: THREE.Object3D[] = []
    let crate = 0
    const visit = (root: THREE.Object3D) => root.traverse((o) => {
      const piece = o.userData.piece as string | undefined
      if (o.userData.gate) { doomed.push(o); return }
      if (o.userData.prop === 'car' || o.userData.prop === 'barrel' || o.userData.prop === 'tree') {
        const slug = o.userData.prop === 'car' ? 'covered_car' : o.userData.prop === 'barrel' ? 'wine_barrel_01' : 'island_tree_02'
        const sc = o.userData.prop === 'tree' ? 0.9 + (Math.abs(o.position.x * 7) % 3) * 0.12 : 1
        const m = placeModel(kit, slug, o.position.x, 0, o.position.z, THREE.MathUtils.radToDeg(o.rotation.y) + (o.userData.prop === 'tree' ? o.position.x * 40 : 0), sc)
        o.parent?.add(m)
        doomed.push(o)
        return
      }
      if (!piece) return
      const y = o.position.y
      const rot = THREE.MathUtils.radToDeg(o.rotation.y)
      if (subst[piece]) {
        const s = subst[piece]
        o.parent?.add(placeModel(kit, s.slug, o.position.x, y, o.position.z, rot + (s.rot ?? 0), s.scale ?? 1))
        if (piece === 'desk') {
          // 重生日记：游戏里的道具，先用一本红色的本子占位
          const book = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.32), new THREE.MeshStandardMaterial({ color: '#a83232', roughness: 0.7 }))
          book.position.set(o.position.x + 0.15, y + 0.83, o.position.z + 0.05)
          book.castShadow = true
          book.userData.piece = 'diary'
          o.parent?.add(book)
        }
        doomed.push(o)
      } else if (piece === 'crate') {
        o.parent?.add(placeModel(kit, crate++ % 2 ? 'wooden_crate_02' : 'wooden_crate_01', o.position.x, y, o.position.z, crate * 37))
        doomed.push(o)
      } else if (piece === 'counter') {
        o.parent?.add(
          placeModel(kit, 'painted_wooden_cabinet', o.position.x - 0.7, y, o.position.z, 0),
          placeModel(kit, 'electric_stove', o.position.x + 0.45, y, o.position.z, 0),
          placeModel(kit, 'vintage_electric_kettle', o.position.x + 0.5, y + 0.86, o.position.z - 0.05, 30, 0.8),
        )
        doomed.push(o)
      } else if (piece === 'bed') {
        doomed.push(o)
      }
    })
    visit(this.scene)
    for (const o of doomed) o.removeFromParent()
    // 画风特有的家具（含二楼三张复古坐卧床）和院子里的小物件
    for (const p of PARADISE_EXTRAS) {
      const m = placeModel(kit, p.piece, p.x, p.floor * FLOOR_H + (p.y ?? 0), p.z, p.rot, p.scale ?? 1)
      ;(p.floor === 1 ? this.floor2 : this.scene).add(m)
    }
    // 两米宽的铁门
    this.scene.add(placeModel(kit, 'large_iron_gate', GATE.x, 0, GATE.z, 0, 0.68))
    // 街边的路灯
    for (const x of [-18, -6, 6, 18, 30]) {
      this.scene.add(placeModel(kit, 'street_lamp_01', x, 0, STREET.z0 - 0.7, 0, 0.9))
      this.addBulb(x, 3.05, STREET.z0 - 0.7, Math.abs(x) === 6 ? 9 : 0)
    }
  }

  private spawnActors(): void {
    this.heroine = new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 })
    const mom = new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 })
    const dad = new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 3.8, z: 2.0 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 })
    this.heroine.weapon = 'shotgun'
    this.heroine.model = 'heroine'
    mom.weapon = 'pin'
    mom.model = 'mom'
    dad.weapon = 'crowbar'
    dad.handy = true
    dad.model = 'dad'
    this.actors.push(this.heroine, mom, dad)
    for (const a of this.actors) this.setupActor(a)
    this.selected = this.heroine
    this.life = new Household(this.actors, this.navs, this.style)
  }

  /** 每个家庭成员都有：出门回来抱着的纸箱，放进场景 */
  private setupActor(a: Actor): void {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.34), new THREE.MeshStandardMaterial({ color: '#b98d5a', roughness: 0.85 }))
    crate.position.set(0, 1.0, 0.3)
    crate.castShadow = true
    crate.visible = false
    a.root.userData.crate = crate
    a.root.add(crate)
    this.scene.add(a.root)
  }

  /** 住进来的人：先用卡通小人占位，真人模型加载好了就换上，再给一把砍刀 */
  private dressResident(a: Actor): void {
    if (a.driver) return
    const model = this.siegeView.npc(a.model)
    if (!model) return
    a.setModel(model)
    const blade = crowbar()
    blade.visible = false
    const driver = a.driver as { attach(o: THREE.Object3D, bone: string): boolean } | null
    if (driver?.attach(blade, 'RightHand')) this.weapons.push(blade)
  }

  /** 屋里的暖灯和路灯：一直在场景里，白天亮度为 0（灯的数量不变，免得着色器重新编译） */
  private addLamps(): void {
    const room = (x: number, y: number, z: number, i: number, floor: Floor) => {
      const l = new THREE.PointLight('#ffc27a', 0, 6.5, 1.6)
      l.position.set(x, y, z)
      l.userData.base = i
      l.userData.floor = floor
      this.lamps.push(l)
      this.scene.add(l)
    }
    room(2.4, 1.6, 3.2, 5.5, 0) // 客厅吊灯
    room(6.5, 2.1, 1.6, 3.5, 0) // 厨房
    room(2.0, FLOOR_H + 2.0, 2.8, 4.5, 1) // 二楼卧室
  }

  /** 路灯的灯泡：夜里发光；base > 0 的那两盏还真的照亮地面 */
  private addBulb(x: number, y: number, z: number, base: number): void {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe0a3', transparent: true, opacity: 0 }))
    bulb.position.set(x, y, z)
    this.bulbs.push(bulb)
    this.scene.add(bulb)
    if (base > 0) {
      const l = new THREE.PointLight('#ffd08a', 0, 11, 1.4)
      l.position.set(x, y - 0.2, z)
      l.userData.base = base
      l.userData.floor = 0
      this.lamps.push(l)
      this.scene.add(l)
    }
  }

  /** 能点的家具（点了就让选中的人去用） */
  private collectClickables(): void {
    this.clickables.length = 0
    const visit = (o: THREE.Object3D) => {
      for (const c of o.children) {
        if (c.userData.piece || c.userData.slug) this.clickables.push(c)
        else if (c !== this.floor2 && !c.userData.actor) visit(c)
      }
    }
    visit(this.scene)
    visit(this.floor2)
  }

  private floorOf(o: THREE.Object3D): Floor {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === this.floor2) return 1
    return 0
  }

  /** 按游戏时间调太阳、天色、雾和灯 */
  private applySky(): void {
    const s = skyAt(this.life.clock.hour, this.dayBase)
    const rain = this.life.rain
    this.nightness = s.night
    this.sunDir.copy(s.dir)
    this.sun.color.copy(s.color)
    // 下雨：太阳被云遮住、天和雾变灰、雾更浓
    this.sun.intensity = this.sunBase * s.light * (1 - rain * 0.7)
    this.hemi.intensity = this.hemiBase * s.ambient * (1 - rain * 0.2)
    this.hemi.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, s.night)
    this.scene.environmentIntensity = this.envBase * s.ambient * (1 - rain * 0.35)
    const grey = RAIN_GREY.clone().multiplyScalar(1 - s.night * 0.8)
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(s.sky).lerp(grey, rain * 0.75)
    else this.scene.background = s.sky.clone()
    this.scene.fog?.color.copy(s.fog).lerp(grey, rain * 0.75)
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogBase * (1 + rain * 1.3)
    for (const g of this.glass) (g as THREE.MeshStandardMaterial).emissive?.setRGB(1, 0.72, 0.38).multiplyScalar(s.lamps * 0.55)
    const upstairsHidden = this.mode === 'home' && this.viewFloor === 0
    for (const l of this.lamps) {
      const off = l.userData.floor === 1 && upstairsHidden
      l.intensity = off ? 0 : (l.userData.base as number) * s.lamps
    }
    for (const b of this.bulbs) (b.material as THREE.MeshBasicMaterial).opacity = s.lamps
  }

  // --- 镜头 -------------------------------------------------------------------

  private desiredPose(mode: ViewMode): Pose {
    const h = (mode === 'home' ? this.selected : this.heroine).root.position
    if (mode === 'outside') {
      return { target: new THREE.Vector3(h.x, 0.8, h.z), elev: OUT_VIEW.elev, dist: OUT_VIEW.dist * this.zoom.outside, fov: OUT_VIEW.fov }
    }
    const baseY = this.viewFloor === 1 ? FLOOR_H + 0.8 : 0.8
    const t = new THREE.Vector3(HOUSE_CENTER.x, baseY, HOUSE_CENTER.z)
    t.x += (h.x - HOUSE_CENTER.x) * 0.35
    t.z += (h.z - HOUSE_CENTER.z) * 0.35
    // 打丧尸时镜头对着正在守的那一层
    const layer = this.life?.siege && !this.life.siege.done ? this.life.siege.current : null
    if (layer) {
      const focus = layer.id === 'gate' ? [4, 12] : layer.id === 'door' ? [3.6, 6.2] : [4.8, 4.6]
      t.set(focus[0], baseY, focus[1])
    } else if (this.life?.talking) {
      // 有人在门口说话：镜头看着铁门
      t.set(4.5, 0.8, 15.5)
    }
    t.add(this.pan)
    return { target: t, elev: HOME_VIEW.elev, dist: HOME_VIEW.dist * this.zoom.home, fov: HOME_VIEW.fov }
  }

  private updateCamera(dt: number): void {
    const want = this.desiredPose(this.mode)
    if (this.tweenT < TWEEN_S && this.tweenFrom) {
      this.tweenT += dt
      const k = ease(Math.min(1, this.tweenT / TWEEN_S))
      this.pose.target.lerpVectors(this.tweenFrom.target, want.target, k)
      this.pose.elev = THREE.MathUtils.lerp(this.tweenFrom.elev, want.elev, k)
      this.pose.dist = THREE.MathUtils.lerp(this.tweenFrom.dist, want.dist, k)
      this.pose.fov = THREE.MathUtils.lerp(this.tweenFrom.fov, want.fov, k)
      // 换楼层的过渡只挪镜头，屋顶和墙不跟着变
      this.homeness = this.floorTween ? (this.mode === 'home' ? 1 : 0) : this.mode === 'home' ? k : 1 - k
    } else {
      this.floorTween = false
      const a = 1 - Math.exp(-dt * 6)
      this.pose.target.lerp(want.target, a)
      this.pose.elev += (want.elev - this.pose.elev) * a
      this.pose.dist += (want.dist - this.pose.dist) * a
      this.pose.fov += (want.fov - this.pose.fov) * a
      this.homeness = this.mode === 'home' ? 1 : 0
    }
    const { target, elev, dist, fov } = this.pose
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    this.camera.position.set(
      target.x + Math.sin(YAW) * Math.cos(elev) * dist,
      target.y + Math.sin(elev) * dist,
      target.z + Math.cos(YAW) * Math.cos(elev) * dist,
    )
    this.camera.lookAt(target)
    if (this.siegeView?.shake > 0) {
      const k = this.siegeView.shake * 0.25
      this.camera.position.x += (Math.random() - 0.5) * k
      this.camera.position.y += (Math.random() - 0.5) * k
    }
    this.sun.position.copy(target).addScaledVector(this.sunDir, 26)
    this.sun.target.position.copy(target)
  }

  /** 屋顶淡出、近墙压低、二楼显隐，都跟着镜头过渡走 */
  private updateCutaway(): void {
    const h = this.homeness
    if (this.roof) {
      this.roof.visible = h < 0.98
      for (const m of this.roofMats) {
        m.transparent = h > 0.02
        m.opacity = 1 - h
        m.depthWrite = h < 0.5
      }
    }
    const stub = THREE.MathUtils.lerp(1, STUB, h)
    for (const w of this.nearWalls) w.scale.y = stub
    this.floor2.visible = this.viewFloor === 1 || h < 0.5
  }

  private setMode(mode: ViewMode): void {
    if (mode === this.mode) return
    this.tweenFrom = { target: this.pose.target.clone(), elev: this.pose.elev, dist: this.pose.dist, fov: this.pose.fov }
    this.tweenT = 0
    this.floorTween = false
    this.mode = mode
    if (mode === 'outside') {
      this.selected = this.heroine
      this.viewFloor = 0
      this.pan.set(0, 0, 0)
    } else {
      // 回到家里时，跟在后面的人也一起进门
      const h = this.heroine.pos
      this.actors.filter((a) => a !== this.heroine && !isHome(a.pos.x, a.pos.z, false)).forEach((a, k) => {
        this.life.commandWalk(a, { x: h.x + (k ? -1 : 1), z: h.z - 1.2, floor: 0 })
      })
    }
    this.setHud({ mode, selected: this.selected.name, floor: this.viewFloor })
  }

  setViewFloor(f: Floor): void {
    if (this.mode !== 'home' || f === this.viewFloor) return
    this.tweenFrom = { target: this.pose.target.clone(), elev: this.pose.elev, dist: this.pose.dist, fov: this.pose.fov }
    this.tweenT = TWEEN_S * 0.4
    this.floorTween = true
    this.viewFloor = f
    this.setHud({ floor: f })
  }

  // --- 每帧 -------------------------------------------------------------------

  private loop = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const raw = Math.min(this.clock.getDelta(), 0.25)
    const dt = Math.min(raw, 0.05)
    this.elapsed += dt
    this.petals?.update(dt, this.elapsed)
    this.river?.update(this.elapsed)
    // 游戏时间：暂停时人和钟都停，镜头照常能动
    // 时钟按真实时间走（掉帧时也不变慢），走路按小步算
    const sim = raw * this.life.speed
    this.life.tick(raw, (a) => this.life.isHomeBody(a) && !(this.mode === 'outside' && a !== this.heroine) && !(a === this.heroine && this.keysMoving))
    const fighting = !!this.life.siege && !this.life.siege.done
    const busy = fighting || this.life.onTrip(this.heroine)
    if (!busy) this.updateHeroineKeys(sim)
    else this.keysMoving = false
    if (!busy) this.updateFollowers(dt)
    const upstairsHidden = this.mode === 'home' && this.viewFloor === 0
    for (const z of this.life.siege?.zombies ?? []) {
      let walking = false
      for (let left = sim; left > 1e-6; left -= 0.05) walking = z.follow(Math.min(left, 0.05), z.speed) || walking
      z.animate(Math.min(sim, 0.1), walking)
      z.root.visible = !(upstairsHidden && z.root.position.y > FLOOR_H - 0.4)
    }
    this.siegeView.update(Math.min(sim, 0.1), this.life, this.actors)
    const visitor = this.life.visitor
    if (visitor) {
      let walking = false
      for (let left = sim; left > 1e-6; left -= 0.05) walking = visitor.follow(Math.min(left, 0.05), 1.7) || walking
      visitor.animate(Math.min(sim, 0.1), walking)
    }
    for (const w of this.weapons) w.visible = fighting
    this.bubbles.update(this.actors, fighting, this.mode === 'home', this.elapsed)
    const g = this.life.garden
    this.gardenObj.visible = g.built
    if (g.built) {
      const sc = 0.2 + g.growth * 0.8
      this.sprouts.forEach((p, k) => { p.scale.setScalar(sc * (0.9 + (k % 3) * 0.08)); p.rotation.y = Math.sin(this.elapsed * 0.8 + k) * 0.05 })
      this.ripeMark.visible = g.growth >= 1 && this.mode === 'home'
      this.ripeMark.position.y = 1.3 + Math.sin(this.elapsed * 2) * 0.05
    }
    SCAVENGE.forEach((sp, k) => {
      const m = this.spotMarks[k]
      m.visible = this.mode === 'outside' && this.life.canSearch(sp) === 'ok'
      m.position.y = 1.9 + Math.sin(this.elapsed * 2 + k) * 0.06
    })
    // 丧尸隔几秒低吼一声；环境声跟着昼夜走
    for (const z of this.life.siege?.zombies ?? []) {
      if (!z.alive) continue
      const left = (this.groanT.get(z) ?? 1 + Math.random() * 4) - sim
      if (left <= 0) {
        const d = Math.hypot(z.pos.x - this.pose.target.x, z.pos.z - this.pose.target.z)
        this.sound.groan(THREE.MathUtils.clamp(1.2 - d / 20, 0.1, 1))
        this.groanT.set(z, 4 + Math.random() * 6)
      } else this.groanT.set(z, left)
    }
    const rainNow = this.life.rain
    this.rain.update(Math.min(sim, 0.1), this.pose.target, rainNow)
    this.sound.ambience(this.nightness, !fighting, rainNow)
    for (const a of this.actors) {
      let walking = a === this.heroine && this.keysMoving
      let gliding = false
      for (let left = sim; left > 1e-6; left -= 0.05) {
        const step = Math.min(left, 0.05)
        walking = a.follow(step, WALK_SPEED) || walking
        gliding = a.updateSettle(step) || gliding
      }
      a.animate(Math.min(sim, 0.1), walking || gliding)
      // 只看一楼时，二楼的人藏起来（楼板也藏起来了，不然像飘在空中）；出门在外的人也藏起来
      a.root.visible = !a.away && !(upstairsHidden && a.root.position.y > FLOOR_H - 0.4)
      ;(a.root.userData.crate as THREE.Object3D).visible = a.carrying
      if (a.floorChanged) {
        a.floorChanged = false
        if (a === this.selected && this.mode === 'home') this.setViewFloor(a.floor)
      }
    }
    const heroOut = this.life.onTrip(this.heroine)
    this.setMode(heroOut || isHome(this.heroine.pos.x, this.heroine.pos.z, this.mode === 'home') ? 'home' : 'outside')
    if (this.selected.away) {
      const other = this.actors.find((a) => !a.away)
      if (other) this.select(other)
    }
    this.updateCamera(dt)
    this.updateCutaway()
    this.applySky()
    const sp = this.selected.root.position
    this.ring.position.set(sp.x, sp.y + 0.03, sp.z)
    this.ring.visible = this.mode === 'home' && this.selected.root.visible && this.selected.pose !== 'sleep'
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.25
      this.pushLifeHud()
    }
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.setHud({ toast: '' })
    if ((this.saveTimer -= dt) <= 0) {
      this.saveTimer = 10
      saveWorld(this.life)
    }
    if (this.marker.visible) {
      const m = this.marker.material as THREE.MeshBasicMaterial
      m.opacity -= dt * 1.5
      this.marker.scale.multiplyScalar(1 + dt)
      if (m.opacity <= 0) this.marker.visible = false
    }
    this.renderer.render(this.scene, this.camera)
  }

  private updateHeroineKeys(dt: number): void {
    let fx = 0
    let fz = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) fz -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) fz += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) fx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) fx += 1
    this.keysMoving = fx !== 0 || fz !== 0
    if (!this.keysMoving) return
    // 屏幕上的"上"是远离镜头的方向
    const fwd = new THREE.Vector2(-Math.sin(YAW), -Math.cos(YAW))
    const right = new THREE.Vector2(Math.cos(YAW), -Math.sin(YAW))
    const dir = fwd.multiplyScalar(-fz).add(right.multiplyScalar(fx)).normalize()
    const step = WALK_SPEED * 1.15 * dt
    const a = this.heroine
    this.life.cancelSearch()
    // 坐着/躺着/正在干活时按方向键：先站起来
    if (a.task || a.anchor || a.path.length) this.life.cancel(a)
    a.hold = 0.6
    const nav = this.navs[a.floor]
    const p = a.root.position
    const free = (x: number, z: number) =>
      [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]].every(([ox, oz]) => !nav.isBlockedAt(x + ox, z + oz))
    const nx = p.x + dir.x * step
    const nz = p.z + dir.y * step
    if (free(nx, nz)) { p.x = nx; p.z = nz } else if (free(nx, p.z)) p.x = nx
    else if (free(p.x, nz)) p.z = nz
    a.face(dir.x, dir.y, dt)
    if (this.mode === 'home') this.selected = a
  }

  private updateFollowers(dt: number): void {
    this.followTimer -= dt
    if (this.mode !== 'outside' || this.followTimer > 0) return
    this.followTimer = 0.4
    const h = this.heroine.root
    const back = new THREE.Vector2(-Math.sin(h.rotation.y), -Math.cos(h.rotation.y))
    // 睡着的人不跟出去
    this.actors.filter((a) => a !== this.heroine && a.task?.kind !== 'sleep' && !a.away && !a.runaway && !a.lost).forEach((a, k) => {
      const side = k === 0 ? 1 : -1
      const spot = { x: h.position.x + back.x * 1.3 + back.y * side * 0.8, z: h.position.z + back.y * 1.3 - back.x * side * 0.8, floor: 0 as const }
      const d = Math.hypot(a.pos.x - h.position.x, a.pos.z - h.position.z)
      if (d > 2.2 || a.floor !== 0) this.life.commandWalk(a, spot)
    })
  }

  // --- 输入 -------------------------------------------------------------------

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn)
    this.listeners.push([target, type, fn])
  }

  private bindInput(): void {
    const el = this.renderer.domElement
    this.on(el, 'pointerdown', ((e: PointerEvent) => {
      this.sound.unlock()
      el.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
      if (this.pointers.size === 2) { this.pinchDist = this.pointerSpread(); this.press = null }
    }) as EventListener)
    this.on(el, 'pointermove', ((e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId)
      if (!prev) return
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 2) {
        const spread = this.pointerSpread()
        if (this.pinchDist > 0) this.zoomBy(this.pinchDist / spread)
        this.pinchDist = spread
        return
      }
      if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 8) this.press.moved = true
      if (this.press?.moved && this.mode === 'home') this.panBy(e.clientX - prev.x, e.clientY - prev.y)
    }) as EventListener)
    const up = ((e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
      if (this.press && !this.press.moved && performance.now() - this.press.t < 400) this.tap(e.clientX, e.clientY)
      if (this.pointers.size === 0) this.press = null
    }) as EventListener
    this.on(el, 'pointerup', up)
    this.on(el, 'pointercancel', ((e: PointerEvent) => { this.pointers.delete(e.pointerId); this.press = null }) as EventListener)
    this.on(el, 'wheel', ((e: WheelEvent) => { e.preventDefault(); this.zoomBy(1 + e.deltaY * 0.0012) }) as EventListener)
    this.on(window, 'keydown', ((e: KeyboardEvent) => {
      this.sound.unlock()
      const k = e.key.toLowerCase()
      if (k === 'e' && !e.repeat) this.searchHere()
      this.keys.add(k)
    }) as EventListener)
    this.on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()) }) as EventListener)
    this.on(window, 'blur', (() => this.keys.clear()) as EventListener)
    this.on(window, 'pagehide', (() => saveWorld(this.life)) as EventListener)
    this.on(document, 'visibilitychange', (() => { if (document.hidden) saveWorld(this.life) }) as EventListener)
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y) || 1
  }

  private zoomBy(f: number): void {
    const z = this.zoom[this.mode] * f
    this.zoom[this.mode] = THREE.MathUtils.clamp(z, this.mode === 'home' ? 0.55 : 0.6, this.mode === 'home' ? 1.5 : 1.8)
  }

  private panBy(dx: number, dy: number): void {
    const scale = (this.pose.dist * Math.tan(THREE.MathUtils.degToRad(this.pose.fov / 2)) * 2) / this.host.clientHeight
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW))
    const fwd = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW))
    this.pan.addScaledVector(right, -dx * scale).addScaledVector(fwd, (dy * scale) / Math.sin(this.pose.elev))
    this.pan.clampLength(0, 10)
  }

  private tap(cx: number, cy: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const floor: Floor = this.mode === 'home' ? this.viewFloor : 0
    if (this.mode === 'home' && this.tapPost()) return
    if (this.mode === 'home') {
      const hits = this.raycaster.intersectObjects(this.actors.filter((a) => a.root.visible).map((a) => a.root), true)
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object
        while (o && !o.userData.actor) o = o.parent
        if (o) {
          this.select(o.userData.actor as Actor)
          return
        }
      }
      if (this.life.siege && !this.life.siege.done) {
        this.toast('world.toast.fighting')
        return
      }
      // 书桌上的红本子：打开重生日记
      const hit = this.furnitureUnder(floor)
      if (hit && (hit.userData.piece === 'diary' || hit.userData.piece === 'desk')) { this.onDiary?.(); return }
      if (hit && hit.userData.piece === 'wall_map') { this.onMap?.(); return }
      // 点家具：让选中的人去用（坐沙发、做饭、睡觉…）
      const spot = hit && this.spotNear(hit, floor)
      if (spot) {
        if (this.life.commandSpot(this.selected, spot)) this.flashMarker(spot.ax ?? spot.x, spot.floor * FLOOR_H, spot.az ?? spot.z)
        else this.toast('world.toast.busy')
        return
      }
    }
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floor * FLOOR_H), p)) return
    const who = this.mode === 'home' ? this.selected : this.heroine
    if (who === this.heroine) this.life.cancelSearch()
    const path = this.life.commandWalk(who, { x: p.x, z: p.z, floor })
    if (!path) return
    const end = path[path.length - 1] ?? { ...who.pos, y: who.root.position.y }
    this.flashMarker(end.x, floor * FLOOR_H, end.z)
  }

  /** 打丧尸时点了地上的守位圈（哪怕上面站着人）：把选中的人换过去 */
  private tapPost(): boolean {
    const siege = this.life.siege
    const layer = siege && !siege.done ? siege.current : null
    if (!siege || !layer || this.selected.away) return false
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -layer.posts[0].floor * FLOOR_H), p)) return false
    const k = layer.posts.findIndex((q) => Math.hypot(q.x - p.x, q.z - p.z) < 0.6)
    if (k < 0 || siege.post(this.selected) === k) return false
    siege.assign(this.selected, k)
    this.flashMarker(layer.posts[k].x, layer.posts[k].floor * FLOOR_H, layer.posts[k].z)
    return true
  }

  /** 鼠标下面第一件看得见的家具（只算当前看的这一层） */
  private furnitureUnder(floor: Floor): THREE.Object3D | null {
    const hits = this.raycaster.intersectObjects(this.clickables, true)
    for (const h of hits) {
      let root: THREE.Object3D | null = h.object
      while (root && !this.clickables.includes(root)) root = root.parent
      if (!root || this.floorOf(root) !== floor) continue
      let shown = true
      for (let q: THREE.Object3D | null = root; q; q = q.parent) if (!q.visible) shown = false
      if (shown) return root
    }
    return null
  }

  /** 家具旁边能用的位置 */
  private spotNear(root: THREE.Object3D, floor: Floor): Spot | null {
    const at = root.getWorldPosition(new THREE.Vector3())
    let best: Spot | null = null
    let bestD = 1.4
    for (const s of this.life.allSpots) {
      if (s.floor !== floor || s.kind === 'stroll') continue
      const d = Math.hypot(s.x - at.x, s.z - at.z)
      if (d < bestD) { bestD = d; best = s }
    }
    return best
  }

  /** 界面设置：点了日记本 / 墙上的地图 */
  onDiary: (() => void) | null = null
  onMap: (() => void) | null = null

  tripCheck(id: string): ReturnType<Household['tripCheck']> {
    return this.life.tripCheck(id)
  }

  /** 在家、能出门的人 */
  homeMembers(): { name: string; health: number }[] {
    return this.actors.filter((a) => !a.away && !a.runaway && !a.lost && !this.life.onTrip(a)).map((a) => ({ name: a.name, health: a.health }))
  }

  startTrip(id: string, names: string[]): boolean {
    const members = this.actors.filter((a) => names.includes(a.name))
    const ok = this.life.startTrip(id, members)
    if (ok) this.pushLifeHud()
    return ok
  }

  diaryLog(): LogEntry[] {
    return [...this.life.log]
  }

  private flashMarker(x: number, y: number, z: number): void {
    this.marker.position.set(x, y + 0.04, z)
    this.marker.scale.setScalar(1)
    ;(this.marker.material as THREE.MeshBasicMaterial).opacity = 1
    this.marker.visible = true
  }

  private toast(key: ToastKey, seconds = 2): void {
    this.toastTimer = seconds
    this.setHud({ toast: key })
  }

  /** 原型调试：直接跳到末日第一晚（或月底危机夜）的晚上 8 点 50 */
  debugNight(crisis: boolean): void {
    if (this.life.siege && !this.life.siege.done) return
    this.life.clock = { day: PROLOGUE_DAYS + (crisis ? 3 : 0), hour: 20.85 }
    this.life.resetNight()
    this.pushLifeHud()
  }

  // --- 给界面用 ---------------------------------------------------------------

  select(a: Actor | string): void {
    const actor = typeof a === 'string' ? this.actors.find((x) => x.name === a) : a
    if (!actor) return
    if (this.mode === 'outside' && actor !== this.heroine) return
    this.selected = actor
    if (this.mode === 'home') this.setViewFloor(actor.root.position.y > FLOOR_H - 0.4 ? 1 : 0)
    this.setHud({ selected: actor.name })
  }

  private visitHud(): Hud['visit'] {
    const def = this.life.talking
    if (!def) return null
    const ctx = this.life.visitorCtx()
    // 男主用文字版的名字和身份
    const lead = ['jiangye', 'shenyan'].find((id) => def.id.startsWith(id))
    const npc = lead ? npcs.find((n) => n.id === lead) : null
    return {
      id: def.id, icon: def.icon,
      name: npc ? `${lt(npc.name)} · ${lt(npc.title)}` : t(`world.visit.${def.id}.name` as UiKey),
      textKey: def.id === 'jiangye_care' ? `world.visit.jiangye_care.text${this.life.careVariant}` : `world.visit.${def.id}.text`,
      choices: def.choices.map((c) => ({ id: c.id, ok: !c.need || c.need(ctx) })),
    }
  }

  /** 日记里"认识的人"：男主和好感 */
  diaryPeople(): { icon: string; name: string; title: string; affection: number; met: boolean }[] {
    return Object.entries(this.life.affection).map(([id, v]) => {
      const n = npcs.find((x) => x.id === id)
      const met = id === 'guchen' ? this.life.guchenMet : id === 'xielin' ? this.life.xielinNotes > 0 : this.life.seen[`${id}_meet`] !== undefined
      return { icon: n?.icon ?? '❤', name: n ? lt(n.name) : id, title: n ? lt(n.title) : '', affection: v, met }
    })
  }

  answerVisitor(choice: string): void {
    this.life.answerVisitor(choice)
    this.pushLifeHud()
  }

  /** 原型调试：马上让某个访客来敲门 */
  debugVisitor(id: string): void {
    const def = VISITORS.find((d) => d.id === id)
    if (def) this.life.startVisit(def)
  }

  private searchHud(): Hud['search'] {
    const s = this.life.search
    if (s) return { kind: s.spot.kind, state: 'doing', progress: Math.round((1 - s.left / s.spot.hours) * 100) }
    if (this.mode !== 'outside' || this.life.onTrip(this.heroine)) return null
    const spot = nearestSpot(this.heroine.pos)
    return spot ? { kind: spot.kind, state: this.life.canSearch(spot), progress: null } : null
  }

  /** 屋外按 E 或点按钮：搜身边这个地方 */
  searchHere(): void {
    const spot = nearestSpot(this.heroine.pos)
    if (spot && this.mode === 'outside') this.life.startSearch(spot)
    this.pushLifeHud()
  }

  throwMolotov(): void {
    this.life.throwMolotov()
    this.pushLifeHud()
  }

  moveToSpace(kind: 'food' | 'water', n: number): void {
    this.life.moveToSpace(kind, n)
    this.pushLifeHud()
  }

  upgradeSpace(): void {
    this.life.upgradeSpace()
    this.pushLifeHud()
  }

  clearReport(): void {
    this.life.report = null
    this.pushLifeHud()
  }

  toggleMute(): void {
    this.sound.unlock()
    this.sound.setMuted(!this.sound.muted)
    this.setHud({ muted: this.sound.muted })
  }

  setSpeed(n: number): void {
    this.life.speed = n
    this.pushLifeHud()
  }

  get speed(): number {
    return this.life.speed
  }

  private pushLifeHud(): void {
    const c = this.life.clock
    this.setHud({
      time: calendarLabel(c),
      night: isNight(c.hour),
      rain: this.life.rain,
      crisis: isCrisisNight(c),
      crisisKind: Household.crisisKind(c),
      speed: this.life.speed,
      food: this.life.stock.food,
      water: this.life.stock.water,
      people: this.life.hud(),
      muted: this.sound.muted,
      day: c.day,
      hour: c.hour,
      money: this.life.money,
      medkits: this.life.medkits,
      prologue: c.day < PROLOGUE_DAYS,
      report: this.life.report,
      visit: this.visitHud(),
      space: { ...this.life.space, cap: this.life.spaceCap },
      molotovs: this.life.molotovs,
      search: this.searchHud(),
      garden: { built: this.life.garden.built, growth: this.life.garden.growth },
      ammo: this.life.ammo.n,
      cores: this.life.cores,
      siege: this.siegeHud(),
      log: this.life.log.slice(-6).reverse(),
    })
  }

  private siegeHud(): Hud['siege'] {
    const s = this.life.siege
    if (!s || s.done) return null
    const layer = s.current
    return {
      left: s.alive, layer: layer?.id ?? null, hp: layer ? this.life.barriers[layer.id] : 0,
      max: layer ? this.life.maxOf(layer.id) : LAYERS[0].max, ambush: s.ambush,
    }
  }

  // --- 杂项 -------------------------------------------------------------------

  private fit(): void {
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private setHud(patch: Partial<Hud>): void {
    this.hud = { ...this.hud, ...patch }
    this.onHud(this.hud)
  }

  /** 原型调试：清掉存档从头来 */
  restart(): void {
    this.disposed = true
    clearWorld()
    location.reload()
  }

  dispose(): void {
    if (!this.disposed) saveWorld(this.life)
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resize.disconnect()
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.geometry.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
