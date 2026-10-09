// 2.5D 原型的 3D 世界：小别墅 + 门前一条街。
// 家里（院子围栏以内）用固定 45° 视角；出了铁门换成高角度跟拍。两种镜头同一个朝向，
// 切换时用 0.9 秒平滑过渡，同时屋顶淡出、靠近镜头的墙压低。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  FLOOR_H, FURNITURE, GARDEN, GATE, HOUSE, HOUSE_CENTER, PARADISE_EXTRAS, PROPS, STAIR_HOLE, STREET, STREET_LAMPS, VAN_PARK, WALLS, WORLD, YARD,
  fenceSegments, isHome, type Floor, type Placement, type Spot,
} from './layout'
import { navFloors, type NavGrid } from './nav'
import { PoseDriver as PoseDriverFor, loadPerson, peopleStyle, setPeopleStyle } from './people'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { clothesline, decorateHouse, parchmentMap } from './decor'
import { VanView, buildVan, driveStep, vanPose, vehicleBlocker, type DriveState } from './van'
import { Cat } from './cat'
import {
  ParadiseMaterials, Petals, RIVER, River, boxProjectUV, hills, loadParadiseKit, placeModel, sakuraTree, samplers, scatter, type ArtStyle, type ParadiseKit,
} from './paradise'
import {
  COLORS, barrel, box, car, counter, crossbowMesh, crowbar, desk, fridge, neighborHouse, rollingPin, shelf, shotgun, sofa, stairs,
  toon, toonify, tree, villaRoof,
} from './meshes'
import { Actor, Household, type LogEntry, type NightReport, type PersonHud } from './residents'
import { PROLOGUE_DAYS, SUNSET, calendarLabel, isCrisisNight, isNight } from './life'
import { LAYERS, TRAP, type LayerId } from './siege'
import { SiegeView } from './siegeView'
import { Sound } from './sound'
import { npcs } from '../content/npcs'
import { lt, t, type UiKey } from '../i18n'
import { Rain } from './weather'
import { applyPerks, awardRebirthPoints, clearWorld, currentLife, hardPref, loadWorld, nextLife, recordDeath, saveWorld, setHardPref } from './save'
import { Bubbles, bubbleMaterial } from './bubbles'
import { FISHING, SCAVENGE, nearFishing, nearestSpot } from './scavenge'
import { Courier, VISITORS, Visitor, isFemaleModel } from './visitors'
import { skyAt, type StyleDay } from './daylight'

export type ViewMode = 'home' | 'outside'
export interface Hud {
  /** 左下角人物卡的头像（名字 → 图片 data URL） */
  portraits: Record<string, string>
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
  /** 提示条里的变量（比如危机夜是哪一种） */
  toastVars: Record<string, string> | null
  ammo: number
  cores: number
  /** 正在打丧尸：还剩几只、守的是哪一层、这一层的耐久 */
  siege: { left: number; layer: LayerId | null; hp: number; max: number; ambush: boolean } | null
  log: LogEntry[]
  muted: boolean
  music: boolean
  day: number
  hour: number
  money: number
  medkits: number
  fuel: number
  prologue: boolean
  report: NightReport | null
  /** 空间异能里放了多少、最多放多少 */
  space: { food: number; water: number; cap: number }
  molotovs: number
  /** 院墙砌了没有 */
  wall: boolean
  /** 第几世 */
  life: number
  /** 末日降临的字幕（显示几秒） */
  doom: boolean
  /** 困难模式 */
  hard: boolean
  /** 女主死了：这一世结束 */
  over: { when: string; cause: string; days: number; points: number; kills: number; mourned: string[] } | null
  /** 钉板耐久（0 = 没有） */
  trap: number
  /** 末日前要做的事（做完打勾） */
  goals: { key: string; done: boolean }[] | null
  /** 菜地：开了没有、长到多少 */
  garden: { built: boolean; growth: number }
  /** 江边钓鱼：在钓吗、站在钓鱼点旁边吗、今天钓了几条 */
  fishing: { active: boolean; near: boolean; caught: number }
  /** 屋外：女主身边能搜的地方 */
  search: { kind: string; state: string; progress: number | null } | null
  /** 全新开局的片头正在放 */
  intro: boolean
  /** 有人在门口等回话 */
  visit: { id: string; icon: string; name: string; textKey: string; choices: { id: string; ok: boolean }[]; vars: Record<string, string> } | null
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
const TMP_FWD = new THREE.Vector3()
/** 坟的位置：房子西边的草地（家里视角看得见，不挡路） */
const GRAVES = [{ x: -2.0, z: 2.0 }, { x: -2.0, z: 3.6 }, { x: -3.1, z: 2.8 }, { x: -3.1, z: 4.4 }]

/** 只出现一次的教学提示（记在本地，换存档也不再出） */
function firstTime(id: string): boolean {
  const key = 'rbte-proto-tips'
  try {
    const seen = new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]') as string[])
    if (seen.has(id)) return false
    seen.add(id)
    localStorage.setItem(key, JSON.stringify([...seen]))
  } catch { /* 存不了就每次都提示 */ }
  return true
}

/** 送东西的人放在铁门外的箱子 / 纸条（共用一份，不用每次新建） */
const DROP = {
  box: new THREE.BoxGeometry(0.5, 0.36, 0.4),
  note: new THREE.BoxGeometry(0.2, 0.01, 0.14),
  card: new THREE.MeshStandardMaterial({ color: '#9a7a4e' }),
  white: new THREE.MeshStandardMaterial({ color: '#e8e8e8' }),
  paper: new THREE.MeshStandardMaterial({ color: '#f4efe4' }),
}

/** 谢临：衣服换成黑色（复制一次材质就缓存起来，不影响别人，也不会每次来都复制） */
const darkCopies = new WeakMap<THREE.Material, THREE.Material>()
/** 点家具弹出的菜单 */
export interface FurnitureMenu { x: number; y: number; title: string; who: string; options: { label: UiKey; spot: Spot }[] }

/** 家具在菜单标题上叫什么 */
const FURNITURE_NAMES: [RegExp, string][] = [
  [/sofa/i, '沙发'], [/bed/i, '床'], [/stove|counter/i, '灶台'], [/kettle|fridge/i, '水壶'], [/cabinet/i, '柜子'],
  [/rocking/i, '摇椅'], [/bench/i, '长椅'], [/chair/i, '椅子'], [/table/i, '桌子'], [/crate/i, '储物箱'],
]
function furnitureName(o: THREE.Object3D): string {
  const id = String(o.userData.slug ?? o.userData.piece ?? '')
  return FURNITURE_NAMES.find(([re]) => re.test(id))?.[1] ?? '家具'
}

function darkCoat(model: THREE.Object3D): void {
  model.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const fix = (mat: THREE.Material) => {
      if (!/suit|shoes/.test(mat.name)) return mat
      const hit = darkCopies.get(mat)
      if (hit) return hit
      const c = mat.clone() as THREE.MeshStandardMaterial
      c.color.set('#2a2a30')
      darkCopies.set(mat, c)
      return c
    }
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material)
  })
}
const TMP_TIP = new THREE.Vector3()

type ToastKey = 'world.toast.taken' | 'world.toast.cat' | 'world.toast.parked' | 'world.toast.nightExit' | 'world.toast.noExit' | 'world.toast.drive' | 'world.toast.driveHint' | 'world.toast.stopFirst' | 'world.toast.noDrive' | 'world.toast.moveIn' | 'world.toast.duskRaid' | 'world.toast.siegeTip' | 'world.toast.downTip' | 'world.toast.lowWater' | 'world.toast.lowFood' | 'world.toast.crisisDay' | 'world.toast.dusk' | 'world.toast.duskLowAmmo' | 'world.toast.brute' | 'world.toast.dying' | 'world.toast.died' | 'world.toast.trap' | 'world.courier.guchen' | 'world.courier.shenyan' | 'world.courier.xielin' | 'world.toast.busy' | 'world.toast.fighting' | 'world.toast.noMedkit' | 'world.toast.wall' | 'world.toast.garden' | 'world.toast.guest' | 'world.toast.fish' | 'world.toast.siege' | 'world.toast.crisis' | 'world.toast.won'
  | 'world.toast.lost' | 'world.log.broken.gate' | 'world.log.broken.door' | 'world.log.broken.stairs'

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const EMPTY_HUD: Hud = {
  portraits: {},
  loading: true, mode: 'home', floor: 0, selected: '林知夏', time: '', night: false, rain: 0, crisis: false, crisisKind: null, speed: 1,
  food: 0, water: 0, people: [], toast: '', toastVars: null, ammo: 0, cores: 0, siege: null, log: [], muted: false, music: true, day: 0, hour: 0, money: 0, medkits: 0, fuel: 0, prologue: true, report: null, visit: null, intro: false, space: { food: 0, water: 0, cap: 6 }, molotovs: 0, search: null, garden: { built: false, growth: 0 }, goals: null, wall: false, hard: false, doom: false, life: 1, over: null, trap: 0, fishing: { active: false, near: false, caught: 0 },
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
  /** 家里的旧面包车 */
  private van = new VanView(buildVan())
  /** 女主自己在开面包车（null = 没在开） */
  private driving: DriveState | null = null
  private carBlocked: ((x: number, z: number) => boolean) | null = null
  /** 走到车边时提示过"按 F 上车"了（走开再回来才再提示） */
  private driveHinted = false
  /** 院子西边的晾衣绳 */
  private line = clothesline()
  /** 外婆家的橘猫大橘（模型加载好以后才有） */
  private cat: Cat | null = null
  private catLove = bubbleMaterial('💕')
  private catAngry = bubbleMaterial('😾')
  private catHeart = new THREE.Sprite(this.catLove)
  private petT = 20
  private petting: Actor | null = null
  /** 铁门的两扇门（绕门轴转）：车进出时全开，有人走过时开一半 */
  private gateDoors: { pivot: THREE.Object3D; sign: number }[] = []
  private gateAngle = 0
  private lastGateWant = 0
  private honked = false
  private readonly rain = new Rain()
  private readonly glass: THREE.Material[] = []
  private fogBase = 0.013
  private saveTimer = 10
  private hadGuest = false
  /** 帧率自适应：连续几秒太卡就把渲染分辨率降一档 */
  private slowT = 0
  private dprSteps = 0
  /** 院子的木围栏（砌了院墙就藏起来）、院墙、世外桃源的材质 */
  private readonly fences: THREE.Object3D[] = []
  private stoneWall: THREE.Group | null = null
  private pmats: ParadiseMaterials | null = null
  /** 白天天上慢慢飞过的一小群鸟（扇翅膀的折线） */
  private readonly birds = (() => {
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({ color: '#2f2f33', side: THREE.DoubleSide })
    const list: { obj: THREE.Mesh; off: THREE.Vector3; ph: number }[] = []
    for (let i = 0; i < 7; i++) {
      // 两片三角形翅膀：0 左翼尖，1 身子前，2 身子后，3 右翼尖
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.6, 0, 0.05, 0, 0, 0.18, 0, 0, -0.12, 0.6, 0, 0.05]), 3))
      geo.setIndex([0, 1, 2, 1, 3, 2])
      const obj = new THREE.Mesh(geo, mat)
      const off = new THREE.Vector3((i % 3) * 1.4 - 1.4 + (i > 3 ? 0.7 : 0), Math.sin(i) * 0.5, -Math.floor(i / 2) * 1.2)
      g.add(obj)
      list.push({ obj, off, ph: i * 0.9 })
    }
    g.visible = false
    return { g, list }
  })()
  /** 平静的夜里院子里飞的萤火虫 */
  private readonly flies = (() => {
    const n = 70
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const home: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(YARD.x0 + Math.random() * (YARD.x1 - YARD.x0), 0.4 + Math.random() * 1.4, YARD.z0 + Math.random() * (YARD.z1 - YARD.z0))
      if (p.x > HOUSE.x0 - 0.5 && p.x < HOUSE.x1 + 0.5 && p.z > HOUSE.z0 - 0.5 && p.z < HOUSE.z1 + 0.5) p.z = HOUSE.z1 + 1 + Math.random() * 5
      home.push(p)
      pos.set([p.x, p.y, p.z], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    pts.frustumCulled = false
    pts.visible = false
    return { pts, home, phase: home.map(() => Math.random() * 10) }
  })()
  /** 全新开局的片头：镜头从江面上空慢慢滑到老宅（秒；<0 表示没有片头） */
  private introT = -1
  static readonly INTRO_S = 7
  /** 片头被跳过后还没转回来的角度、雾的淡化系数（慢慢回到 1） */
  private yawOffset = 0
  private fogK = 1
  /** 钓鱼竿、鱼线、浮漂 */
  private readonly rod = new THREE.Group()
  private readonly rodTip = new THREE.Object3D()
  private readonly fishLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: '#f4f4f4', transparent: true, opacity: 0.8 }))
  private readonly bobber = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: '#e0412f', roughness: 0.5 }))
  private bite = 0
  /** 街尽头那个脸色苍白的人（阿寂的伏笔） */
  private cameo: { obj: THREE.Object3D; until: number } | null = null
  private trapMesh: THREE.Group | null = null
  private readonly graves = new Map<string, THREE.Object3D>()
  /** 一家三口各自手里的武器模型（拿到弩以后把爸爸的撬棍藏起来） */
  private readonly kitOf = new Map<Actor, THREE.Object3D>()
  private bow: THREE.Object3D | null = null
  /** 末日字幕还显示几秒 */
  private doomT = 0
  /** 今天已经提醒过的（第几天） */
  private readonly warned = { crisis: -1, dusk: -1, stock: -1 }
  /** 上一帧看到的最后一条日记（undefined = 还没看过，刚读档的旧记录不弹提示） */
  private lastLog: LogEntry | null | undefined = undefined
  /** 送东西的人放在铁门外的箱子 / 纸条 */
  private dropped: THREE.Object3D | null = null
  /** 女主夜里在屋外的手电筒（一直在场景里，白天亮度 0，免得灯数变化重编译着色器） */
  private readonly torch = new THREE.SpotLight('#fff1cf', 0, 20, 0.5, 0.45, 1.4)
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
    // 江面的透射要把整个场景再画一遍：用一半分辨率画，看不出区别，省不少
    this.renderer.transmissionResolutionScale = 0.5
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
    this.scene.add(this.van.parts.root, this.line.group)
    this.spawnActors()
    this.scene.add(this.rain.lines, ...this.spotMarks, this.torch, this.torch.target, this.flies.pts, this.birds.g)
    // 钓鱼竿：挂在女主身上（人物空间），竿尖往前上方翘
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 2.0, 6), new THREE.MeshStandardMaterial({ color: '#4b3a2a', roughness: 0.6 }))
    pole.position.y = 1.0
    this.rodTip.position.y = 2.0
    this.rod.add(pole, this.rodTip)
    this.rod.position.set(0.12, 0.95, 0.3)
    this.rod.rotation.x = 0.95
    this.rod.visible = false
    this.heroine.root.add(this.rod)
    this.fishLine.visible = false
    this.bobber.visible = false
    this.fishLine.frustumCulled = false
    this.scene.add(this.fishLine, this.bobber)
    this.life.onFish = (caught) => {
      this.bite = 0.6
      this.siegeView.splash(this.bobber.position)
      this.sound.splash()
      if (caught) this.toast('world.toast.fish', 1.5)
    }
    this.buildGarden()
    this.siegeView = new SiegeView(this.scene)
    this.life.spawnZombie = (at, raider, brute) => this.siegeView.spawn(at, raider, brute)
    this.life.spawnVisitor = (def, at, model) => {
      const m = this.siegeView.npc(model) ?? this.siegeView.npc(def.model)
      if (m && model === 'xielin') darkCoat(m)
      const v = new Visitor(def, at, m, isFemaleModel(model))
      this.scene.add(v.root)
      return v
    }
    this.life.spawnCourier = (who, at) => {
      const model = this.siegeView.npc(who)
      if (model && who === 'xielin') darkCoat(model)
      const c = new Courier(who, at, model)
      this.scene.add(c.root)
      return c
    }
    this.life.onCourier = (c, phase) => {
      if (phase === 'drop') {
        this.sound.knock()
        this.toast(`world.courier.${c.who}`, 4)
        // 铁门外留下一箱东西（谢临只是一张纸条）
        const g = new THREE.Mesh(c.who === 'xielin' ? DROP.note : DROP.box, c.who === 'xielin' ? DROP.paper : c.who === 'shenyan' ? DROP.white : DROP.card)
        // 纸条从门缝塞进院子里；箱子放在他脚边（铁门外）
        if (c.who === 'xielin') g.position.set(c.pos.x, 0.02, c.pos.z - 0.6)
        else g.position.set(c.pos.x + 0.55, 0.18, c.pos.z + 0.05)
        g.castShadow = true
        this.dropped?.removeFromParent()
        this.dropped = g
        this.scene.add(g)
      } else {
        // 走远了，东西也被家里人收进去了；复制出来的骨骼也释放掉
        this.dropped?.removeFromParent()
        this.dropped = null
        c.root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) (o as THREE.SkinnedMesh).skeleton.dispose() })
      }
    }
    this.life.makeActor = (name, model, at) => {
      const a = new Actor(name, '#8a6d4f', '#222222', 1.03, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
      a.model = model
      this.setupActor(a)
      this.dressResident(a)
      return a
    }
    // 接着上次的进度（要在 makeActor 设好以后，住进来的人才能重建）
    // 没有存档 = 全新开局：先放一段片头
    if (!loadWorld(this.life)) {
      this.introT = 0
      // 日记第一条：重生醒来的那一刻
      this.life.logNote(currentLife() > 1 ? 'world.log.rebornAgain' : 'world.log.reborn', { n: currentLife() })
      // 困难模式是跨存档的设置
      this.life.hard = hardPref()
      this.applyHardAmmo()
      // 上一世用重生点买的开局加成
      const perks = applyPerks(this.life)
      if (perks.length) this.life.logNote('world.log.perks', { list: perks.map((p) => t(`world.perk.${p}` as UiKey)).join('、') })
    }
    // 开着车的时候存的档：女主的位置就在车里，读档后让她站到车门边
    const va = this.life.vanAt
    if (va && Math.hypot(this.heroine.pos.x - va.x, this.heroine.pos.z - va.z) < 0.3) {
      const p = this.exitSpot(va, true)
      if (p) this.heroine.root.position.set(p.x, 0, p.z)
    }
    this.life.onDoomsday = () => {
      this.sound.siren()
      this.sound.eerie()
      this.setHud({ doom: true })
      this.doomT = 8
    }
    this.life.onKnock = () => {
      this.sound.knock()
      if (this.mode === 'home') this.setViewFloor(0)
      this.pushLifeHud()
    }
    this.life.onSiege = (e) => {
      this.siegeView.onEvent(e)
      const vol = (at: { x: number; z: number }) => THREE.MathUtils.clamp(1.25 - Math.hypot(at.x - this.pose.target.x, at.z - this.pose.target.z) / 22, 0.15, 1)
      if (e.kind === 'shot') this.sound.shot(vol(e.at))
      else if (e.kind === 'bolt') this.sound.twang(vol(e.at))
      else if (e.kind === 'bash') this.sound.bash(e.layer === 'gate', vol(e.at))
      else if (e.kind === 'broken') this.sound.crash()
      else if (e.kind === 'kill') this.sound.squelch()
      else if (e.kind === 'hit') this.sound.hurt()
      else if (e.kind === 'fire') this.sound.fire()
      else if (e.kind === 'trapBroken') this.sound.crash()
      else if (e.kind === 'brute') { this.toast('world.toast.brute', 4); this.sound.groan(1, 0.55) }
      else if (e.kind === 'down' && firstTime('down')) this.toast('world.toast.downTip', 6)
      // 守的人在哪一层，镜头就看哪一层（大门破了大家退上二楼守楼梯口；只看一楼的话楼上的人和丧尸都藏起来了）
      // （开打的事件在 Siege 构造时就发了，那时 life.siege 还没赋值，所以看防线耐久）
      const fightFloor = () => (this.life.barriers.gate > 0 || this.life.barriers.door > 0 ? 0 : 1)
      if (e.kind === 'start') {
        // 第一次打丧尸：顺便教一下能做什么
        if (!e.ambush && firstTime('siege')) this.toast('world.toast.siegeTip', 7)
        else this.toast(e.crisis ? 'world.toast.crisis' : 'world.toast.siege', 4)
        if (this.mode === 'home' && !e.ambush) this.setViewFloor(fightFloor())
      } else if (e.kind === 'broken') {
        this.toast(`world.log.broken.${e.layer}` as ToastKey, 3)
        if (this.mode === 'home' && e.layer === 'door') this.setViewFloor(1)
      }
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
        // 卡通画风一律用 Blender 捏的 Q 版人物；世外桃源画风按"人物"按钮选真人或 Q 版
        Promise.all(['heroine', 'mom', 'dad'].map((n) => loadPerson(this.toonPeople ? `${n}_toon` : n))),
      ])
      if (this.disposed) return
      const kit = new Map<string, THREE.Object3D>()
      for (const child of gltf.scene.children) {
        toonify(child)
        kit.set(child.name, child)
      }
      this.assembleVilla(kit)
      if (paradise) this.applyParadise(paradise)
      // 让屋里像个家：地毯、窗帘、画、桌上的花（花瓶放在餐桌桌面上：往下打一条射线找桌面）
      try {
        this.scene.updateMatrixWorld(true)
        const ray = new THREE.Raycaster(new THREE.Vector3(2.5, 1.4, 3.0), new THREE.Vector3(0, -1, 0), 0, 1.4)
        ray.camera = this.camera // 场景里有精灵（头顶的气泡），没有相机会报错
        const meshes: THREE.Object3D[] = []
        this.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o) })
        const hit = ray.intersectObjects(meshes, false).find((h) => h.point.y > 0.4 && h.point.y < 1.2)
        decorateHouse(this.scene, this.floor2, hit ? hit.point.y : 0.76)
      } catch (e) {
        // 装饰出问题也不能挡住后面加载人物
        console.warn('decor', e)
      }
      if (people) {
        people.forEach((m, k) => this.actors[k].setModel(m))
        // 女主霰弹枪、妈妈擀面杖、爸爸撬棍：只在打丧尸时拿出来
        const kit = [shotgun(), rollingPin(), crowbar()]
        kit.forEach((w, k) => {
          w.visible = false
          if (this.actors[k].driver?.attach(w, 'RightHand')) { this.weapons.push(w); this.kitOf.set(this.actors[k], w) }
        })
      }
      this.addLamps()
      this.collectClickables()
      // 大橘：不挡开场，后台加载好了再放到客厅地毯上
      void new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cat_toon.glb`).then((g) => {
        if (this.disposed) return
        this.cat = new Cat(g.scene, { x: 1.3, z: 4.45, floor: 0 })
        this.catHeart.scale.setScalar(0.32)
        this.catHeart.position.y = 0.62
        this.catHeart.renderOrder = 11
        this.catHeart.visible = false
        this.cat.root.add(this.catHeart)
        this.scene.add(this.cat.root)
      }, (e) => console.warn('cat', e))
      // 窗玻璃：夜里亮起暖光
      const seen = new Set<THREE.Material>()
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material
        for (const x of m ? (Array.isArray(m) ? m : [m]) : []) if (x.name === 'pal_glass' && !seen.has(x)) { seen.add(x); this.glass.push(x) }
      })
      const gates: THREE.Object3D[] = []
      this.scene.traverse((o) => { if (o.userData.gate || o.userData.slug === 'large_iron_gate') gates.push(o) })
      this.siegeView.bind(gates, this.frontDoor, this.barricade)
      this.hingeGate(gates)
      this.setHud({ loading: false, intro: this.introT >= 0 })
      // 人物模型好了就给人物卡拍头像（不等第一帧）
      this.setHud({ portraits: this.portraits() })
      // 丧尸、访客、住进来的人的模型不挡开场：别墅出来以后在后台加载，好了再预热着色器
      void this.siegeView.loadModels(this.toonPeople).then(() => this.afterExtraModels(), () => this.afterExtraModels())
    } catch (e) {
      this.setHud({ loading: false, error: `模型加载失败：${String(e)}` })
    }
  }

  /** 铁门模型里左右两扇门各套一个门轴，好让它们往街那边推开 */
  private hingeGate(gates: THREE.Object3D[]): void {
    this.gateDoors = []
    for (const g of gates) {
      // 卡通画风：两块 1 米宽的门板，门轴在外侧（x=3 / x=5）
      if (g.userData.gate && g.parent) {
        const left = g.position.x < GATE.x
        const pivot = new THREE.Group()
        pivot.position.set(GATE.x + (left ? -1 : 1), 0, g.position.z)
        g.parent.add(pivot)
        pivot.attach(g)
        this.gateDoors.push({ pivot, sign: left ? -1 : 1 })
        continue
      }
      const find = (n: string) => { let f: THREE.Object3D | undefined; g.traverse((o) => { if (o.name === n) f = o }); return f }
      for (const side of ['left', 'right'] as const) {
        const door = find(`large_iron_gate_${side}_door`) as THREE.Mesh | undefined
        if (!door?.parent) continue
        door.geometry.computeBoundingBox()
        const bb = door.geometry.boundingBox!
        const hinge = new THREE.Vector3(side === 'left' ? bb.min.x : bb.max.x, 0, (bb.min.z + bb.max.z) / 2)
        const pivot = new THREE.Group()
        pivot.position.copy(door.localToWorld(hinge.clone()))
        door.parent.worldToLocal(pivot.position)
        door.parent.add(pivot)
        pivot.attach(door)
        if (side === 'right') { const bolt = find('large_iron_gate_bolt'); if (bolt) pivot.attach(bolt) }
        // 往外（+z，街那边）推开：左扇顺时针、右扇逆时针
        this.gateDoors.push({ pivot, sign: side === 'left' ? -1 : 1 })
      }
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

  /** 两个人走得太近就让一让（不再穿身而过）：走路的人往旁边让、不往回退，
   *  迎面走来的两个人各自靠右；坐着、躺着、正在挪位置的人不动 */
  private makeWay(): void {
    const R = 0.55
    const list = this.actors.filter((a) => !a.away && !a.settling && a.pose !== 'sleep')
    const step = (a: Actor, x: number, z: number) => {
      const p = a.root.position
      if (!this.navs[a.floor].isBlockedAt(p.x + x, p.z + z)) { p.x += x; p.z += z }
    }
    const heading = (a: Actor) => {
      const n = a.path[0]
      if (!n) return null
      const dx = n.x - a.root.position.x
      const dz = n.z - a.root.position.z
      const d = Math.hypot(dx, dz)
      return d > 1e-3 ? { x: dx / d, z: dz / d } : null
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const pa = a.root.position
        const pb = b.root.position
        if (a.floor !== b.floor || Math.abs(pa.y - pb.y) > 0.3) continue
        const d = Math.hypot(pb.x - pa.x, pb.z - pa.z)
        if (d >= R) continue
        const fa = heading(a)
        const fb = heading(b)
        if (!fa && !fb) continue // 都站着（面对面说话）不推
        const push = (R - d) * 0.5
        for (const [me, other, f] of [[a, b, fa], [b, a, fb]] as const) {
          if (!f) continue
          // 快走到地方了（最后一个路点就在眼前）：不推，不然会绕着站着的人打转、永远到不了
          const last = me.path[me.path.length - 1]
          if (me.path.length === 1 && last && Math.hypot(last.x - me.root.position.x, last.z - me.root.position.z) < R + 0.15) continue
          // 从对方指向自己的方向，去掉往回退的那部分；正对着撞上就往右手边让
          let nx = me.root.position.x - other.root.position.x
          let nz = me.root.position.z - other.root.position.z
          const back = nx * f.x + nz * f.z
          if (back < 0) { nx -= back * f.x; nz -= back * f.z }
          let len = Math.hypot(nx, nz)
          const headOn = fa && fb && fa.x * fb.x + fa.z * fb.z < -0.3
          if (len < 0.05 || headOn) { nx += -f.z * 0.6; nz += f.x * 0.6; len = Math.hypot(nx, nz) }
          const k = (fa && fb ? push : push * 2) / Math.max(len, 1e-3)
          step(me, nx * k, nz * k)
        }
      }
    }
  }

  /** 人会看人：门外有人走过来就看过去，不然看身边最近的家人（3 米内、同一层） */
  private updateLooks(): void {
    const others: { x: number; z: number; floor: number; far: boolean }[] = []
    const v = this.life.visitor
    if (v) others.push({ x: v.pos.x, z: v.pos.z, floor: 0, far: true })
    const c = this.life.courier
    if (c) others.push({ x: c.pos.x, z: c.pos.z, floor: 0, far: true })
    for (const a of this.actors) {
      const d = a.driver
      if (!d) continue
      let best: { x: number; z: number } | null = null
      let bd = Infinity
      for (const o of others) {
        const dist = Math.hypot(o.x - a.pos.x, o.z - a.pos.z)
        if (o.floor === a.floor && dist < 14 && dist < bd) { bd = dist; best = o }
      }
      if (!best) {
        for (const b of this.actors) {
          if (b === a || b.away || b.floor !== a.floor) continue
          const dist = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z)
          if (dist < 3.2 && dist < bd) { bd = dist; best = b.pos }
        }
      }
      let yaw = 0
      if (best) {
        yaw = Math.atan2(best.x - a.pos.x, best.z - a.pos.z) - a.root.rotation.y
        yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
        // 在身后的就不硬转头了
        yaw = Math.abs(yaw) > 1.9 ? 0 : THREE.MathUtils.clamp(yaw, -1.1, 1.1)
      }
      d.lookYaw = yaw
    }
  }

  /** 一座小坟：土堆 + 石碑 */
  private makeGrave(): THREE.Group {
    const g = new THREE.Group()
    const soil = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8), new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 1 }))
    soil.scale.set(1, 0.32, 1.45)
    soil.receiveShadow = true
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.08), new THREE.MeshStandardMaterial({ color: '#9a9893', roughness: 0.75 }))
    stone.position.set(0, 0.28, -0.72)
    stone.castShadow = true
    g.add(soil, stone)
    return g
  }

  /** 铁门外的钉板（几块钉满钉子的木板）和一卷螺旋铁丝网 */
  private makeTrap(): THREE.Group {
    const g = new THREE.Group()
    const wood = this.pmats?.textured('wood') ?? toon('#6b5236')
    const metal = new THREE.MeshStandardMaterial({ color: '#9a9ea4', metalness: 0.7, roughness: 0.4 })
    const boards = [[2.7, 14.15, 0.2], [3.75, 14.75, -0.12], [4.85, 14.2, 0.08], [5.2, 15.05, 0.3], [3.0, 15.2, -0.25]] as const
    const nails = new THREE.InstancedMesh(new THREE.ConeGeometry(0.016, 0.08, 4), metal, boards.length * 10)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    let n = 0
    for (const [x, z, r] of boards) {
      // 人行道（z < 15）比马路高 8 厘米
      const y0 = z < STREET.z0 ? 0.08 : 0
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.3), wood)
      b.position.set(x, y0 + 0.018, z)
      b.rotation.y = r
      b.receiveShadow = true
      g.add(b)
      for (let k = 0; k < 10; k++) {
        const lx = -0.28 + (k % 5) * 0.14
        const lz = k < 5 ? -0.07 : 0.07
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r)
        const off = new THREE.Vector3(lx, 0, lz).applyQuaternion(q)
        m.compose(new THREE.Vector3(x + off.x, y0 + 0.075, z + off.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1))
        nails.setMatrixAt(n++, m)
      }
    }
    g.add(nails)
    // 螺旋铁丝网：横在钉板外面，两头各一根木桩
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 260; i++) {
      const u = i / 260
      const a = u * Math.PI * 2 * 22
      pts.push(new THREE.Vector3(2.2 + u * 3.6, 0.3 + Math.sin(a) * 0.26, 15.75 + Math.cos(a) * 0.26))
    }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 520, 0.009, 4), metal)
    wire.castShadow = true
    g.add(wire)
    for (const x of [2.15, 5.85]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 6), wood)
      post.position.set(x, 0.37, 15.75)
      g.add(post)
    }
    return g
  }

  /** 砌一圈石头院墙（铁门那两米留着），靠近镜头的南墙、东墙在家里视角下压低 */
  private raiseStoneWall(): void {
    const mat = this.pmats?.textured('stone') ?? toon(COLORS.stone)
    const cap = this.pmats?.textured('trim') ?? toon(COLORS.wall)
    const H = 1.9
    const g = new THREE.Group()
    const seg = (x0: number, z0: number, x1: number, z1: number, near: boolean) => {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const along = x1 - x0 !== 0
      const holder = new THREE.Group()
      holder.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2)
      const body = new THREE.Mesh(new THREE.BoxGeometry(along ? len : 0.3, H, along ? 0.3 : len), mat)
      body.position.y = H / 2
      const top = new THREE.Mesh(new THREE.BoxGeometry(along ? len + 0.1 : 0.4, 0.1, along ? 0.4 : len + 0.1), cap)
      top.position.y = H + 0.05
      for (const m of [body, top]) { boxProjectUV(m.geometry); m.castShadow = true; m.receiveShadow = true }
      holder.add(body, top)
      if (near) this.nearWalls.push(holder)
      g.add(holder)
    }
    seg(YARD.x0, YARD.z0, YARD.x1, YARD.z0, false) // 北
    seg(YARD.x0, YARD.z0, YARD.x0, YARD.z1, false) // 西
    seg(YARD.x1, YARD.z0, YARD.x1, YARD.z1, true) // 东
    seg(YARD.x0, YARD.z1, GATE.x - 1, YARD.z1, true) // 南（铁门西边）
    seg(GATE.x + 1, YARD.z1, YARD.x1, YARD.z1, true) // 南（铁门东边）
    for (const f of this.fences) f.visible = false
    this.stoneWall = g
    this.scene.add(g)
    this.collectClickables()
  }

  buildGateTrap(): void {
    if (this.life.buildTrap()) this.toast('world.toast.trap', 3)
    this.pushLifeHud()
  }

  buildYardWall(): void {
    if (this.life.buildWall()) this.toast('world.toast.wall', 3)
    this.pushLifeHud()
  }

  buildGardenPlot(): void {
    if (this.life.buildGarden()) this.toast('world.toast.garden')
    this.pushLifeHud()
  }

  /** 额外模型加载好以后：给住进来的人换上真人模型，再预热一帧（武器、丧尸、特效） */
  private afterExtraModels(): void {
    if (this.disposed) return
    for (const a of this.actors.slice(3)) this.dressResident(a)
    // 模型还没好时就来了的访客 / 送东西的人：换上真人模型
    const v = this.life.visitor
    if (v?.placeholder) {
      const m = this.siegeView.npc(this.life.visitModel) ?? this.siegeView.npc(v.def.model)
      if (m) { if (this.life.visitModel === 'xielin') darkCoat(m); v.setModel(m) }
    }
    const c = this.life.courier
    if (c?.placeholder) {
      const m = this.siegeView.npc(c.who)
      if (m) { if (c.who === 'xielin') darkCoat(m); c.setModel(m) }
    }
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
      else this.fences.push(f)
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
      sofa, counter, fridge, desk, shelf, wall_map: parchmentMap, stairs: () => stairs(FLOOR_H),
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
    this.pmats = mats
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
    // Neutral（Khronos PBR Neutral）保留原本的颜色；ACES 会把颜色压灰，看着"糊"
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.0
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
      // 院子里是修剪过的草坪：草丛少很多（以前密密麻麻，从高处看一片"麻麻赖赖"），院子外面才是野草
      scatter(kit, 'grass_bermuda_01', 3200, samplers.lawnEdge, [3.0, 4.6], 1),
      scatter(kit, 'grass_bermuda_01', 12000, samplers.wild, [3.2, 5.0], 2),
      scatter(kit, 'grass_bermuda_01', 700, samplers.lawn, [2.4, 3.4], 9),
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
        // 马路对面的行道树（每棵 8 万个三角形）不投影子：影子落在对面人行道上几乎看不见，阴影那一遍能省一半
        if (o.userData.prop === 'tree' && o.position.z > STREET.z1 - 3) m.traverse((c) => { c.castShadow = false })
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
    for (const { x } of STREET_LAMPS) {
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
    if (driver?.attach(blade, 'RightHand')) { this.weapons.push(blade); this.kitOf.set(a, blade) }
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
    // 片头的高空镜头离得远，雾先淡一点，降下来以后恢复
    const introK = this.introT >= 0 ? 0.35 + 0.65 * Math.min(1, this.introT / World.INTRO_S) : 1
    this.fogK = this.introT >= 0 ? introK : this.fogK + (1 - this.fogK) * 0.04
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogBase * (1 + rain * 1.3) * this.fogK
    else if (this.scene.fog instanceof THREE.Fog) { this.scene.fog.near = 55 / this.fogK; this.scene.fog.far = 110 / this.fogK }
    for (const g of this.glass) (g as THREE.MeshStandardMaterial).emissive?.setRGB(1, 0.72, 0.38).multiplyScalar(s.lamps * 0.55)
    const upstairsHidden = this.mode === 'home' && this.viewFloor === 0
    for (const l of this.lamps) {
      const off = l.userData.floor === 1 && upstairsHidden
      // 白天屋里也留一点暖光（像阳光照进来、屋里开着小灯），屋子不会显得冷冰冰
      l.intensity = off ? 0 : (l.userData.base as number) * Math.max(s.lamps, 0.32)
    }
    for (const b of this.bulbs) (b.material as THREE.MeshBasicMaterial).opacity = s.lamps
  }

  // --- 镜头 -------------------------------------------------------------------

  private desiredPose(mode: ViewMode): Pose {
    const h = (mode === 'home' ? this.selected : this.heroine).root.position
    if (mode === 'outside') {
      return { target: new THREE.Vector3(h.x, 0.8, h.z).add(this.pan), elev: OUT_VIEW.elev, dist: OUT_VIEW.dist * this.zoom.outside, fov: OUT_VIEW.fov }
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
    // 片头：从高空转着降到平常的 45° 视角
    if (this.introT >= 0 && !this.hud.loading) {
      this.introT += dt
      const k = ease(Math.min(1, this.introT / World.INTRO_S))
      // 从西南方的高空俯瞰整条街和屋后的江，一边转一边降下来（不从北边来：远山会挡住镜头）
      const from = { target: new THREE.Vector3(4, 0, 4), elev: THREE.MathUtils.degToRad(58), dist: 72, fov: 30 }
      this.pose.target.lerpVectors(from.target, want.target, k)
      this.pose.elev = THREE.MathUtils.lerp(from.elev, want.elev, k)
      this.pose.dist = THREE.MathUtils.lerp(from.dist, want.dist, k)
      this.pose.fov = THREE.MathUtils.lerp(from.fov, want.fov, k)
      const yaw = YAW - (1 - k) * 1.3
      this.yawOffset = yaw - YAW
      this.applyPose(yaw)
      if (this.introT >= World.INTRO_S) this.endIntro()
      return
    }
    // 片头被跳过时剩下的转角，慢慢转回来
    this.yawOffset *= Math.exp(-dt * 2.5)
    if (Math.abs(this.yawOffset) < 1e-4) this.yawOffset = 0
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
    this.applyPose(YAW + this.yawOffset)
  }

  private applyPose(yaw: number): void {
    const { target, elev, dist, fov } = this.pose
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    this.camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(elev) * dist,
      target.y + Math.sin(elev) * dist,
      target.z + Math.cos(yaw) * Math.cos(elev) * dist,
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
      // 女主从外面回来：家里离得最近的人招呼一声
      const greeter = this.actors.filter((a) => a !== this.heroine && !this.life.isOut(a) && a.pose !== 'sleep')
        .sort((a, b) => Math.hypot(a.pos.x - this.heroine.pos.x, a.pos.z - this.heroine.pos.z) - Math.hypot(b.pos.x - this.heroine.pos.x, b.pos.z - this.heroine.pos.z))[0]
      if (greeter && !this.life.onTrip(this.heroine) && !(this.life.siege && !this.life.siege.done)) this.life.say(greeter, 'home')
      // 回到家里时，跟在后面的人也一起进门
      const h = this.heroine.pos
      this.actors.filter((a) => a !== this.heroine && !this.life.isOut(a)
        && !isHome(a.pos.x, a.pos.z, false)).forEach((a, k) => {
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
    const frame = this.clock.getDelta()
    const raw = Math.min(frame, 0.25)
    // 连续 4 秒低于约 28 帧（又不是在后台被暂停）：分辨率降一档，最多降两档
    if (frame > 0.036 && frame < 0.5 && !this.hud.loading) this.slowT += frame
    else this.slowT = Math.max(0, this.slowT - frame * 0.5)
    if (this.slowT > 4 && this.dprSteps < 2) {
      this.slowT = 0
      this.dprSteps++
      this.renderer.setPixelRatio(Math.max(0.75, this.renderer.getPixelRatio() * 0.7))
      this.fit()
    }
    const dt = Math.min(raw, 0.05)
    this.elapsed += dt
    this.petals?.update(dt, this.elapsed)
    this.river?.update(this.elapsed)
    // 游戏时间：暂停时人和钟都停，镜头照常能动
    // 时钟按真实时间走（掉帧时也不变慢），走路按小步算
    const sim = raw * this.life.speed
    // 天黑前（末日后 20:45，丧尸要来了）还在开车：先下车回家守着
    if (this.driving && this.life.nightPending) {
      this.exitVan(true)
      this.toast('world.toast.nightExit', 3)
    }
    this.life.heroDriving = !!this.driving
    this.life.tick(raw, (a) => this.life.isHomeBody(a) && !(this.mode === 'outside' && a !== this.heroine) && !(a === this.heroine && (this.keysMoving || !!this.driving)))
    const fighting = !!this.life.siege && !this.life.siege.done
    const busy = fighting || this.life.onTrip(this.heroine)
    // 打起来了还在车上：先下车
    if (this.driving && (fighting || this.life.onTrip(this.heroine))) this.exitVan(true)
    if (this.driving) this.updateDriving(Math.min(sim, dt * 1.5))
    else { this.keysMoving = false; this.updateCameraKeys(dt) }
    if (!busy && !this.driving) this.updateFollowers(dt)
    const upstairsHidden = this.mode === 'home' && this.viewFloor === 0
    for (const z of this.life.siege?.zombies ?? []) {
      let walking = false
      if (z.brute && z.root.scale.x < 1.3) z.root.scale.setScalar(1.36)
      for (let left = sim; left > 1e-6; left -= 0.05) walking = z.follow(Math.min(left, 0.05), z.speed * (z.slowed ? TRAP.slow : 1)) || walking
      z.animate(Math.min(sim, 0.1), walking)
      z.root.visible = !(upstairsHidden && z.root.position.y > FLOOR_H - 0.4)
    }
    this.siegeView.update(Math.min(sim, 0.1), this.life, this.actors)
    const vp = vanPose(this.life.vanMove, this.life.vanAway, this.life.absHour, this.life.vanAt)
    if (this.driving) vp.speed = this.driving.speed
    this.van.update(Math.min(sim, 0.1), vp, this.nightness, this.life.vanArmor)
    // 发动机声：离家越远越小（开出去上了街、开回来刚进街口时听得见）
    const vanFar = Math.hypot(vp.x - VAN_PARK.x, vp.z - VAN_PARK.z)
    // 铁门：车要过就全开，家里人走到门口开一半，过去了再关上（打丧尸时不开）
    const vanAtGate = (!!this.life.vanMove || !!this.driving) && vp.visible && Math.hypot(vp.x - GATE.x, vp.z - GATE.z) < (this.driving ? 5 : 6.5)
    const walker = !fighting && this.actors.some((a) => !a.away && a.floor === 0 && Math.abs(a.pos.x - GATE.x) < 1.3 && Math.abs(a.pos.z - GATE.z) < 1.5)
    const gateWant = vanAtGate ? 1.5 : walker ? 1.0 : 0
    // 门刚要开：吱呀一声（离镜头远就小声点）
    if (gateWant > 0 && this.gateAngle < 0.05 && this.lastGateWant === 0) {
      this.sound.creak(THREE.MathUtils.clamp(1.3 - Math.hypot(GATE.x - this.pose.target.x, GATE.z - this.pose.target.z) / 20, 0.15, 1))
    }
    this.lastGateWant = gateWant
    // 车开回来停在门口：按两下喇叭
    const honkNow = this.life.vanMove?.dir === 'in' && vp.visible && Math.abs(vp.speed) < 0.2 && vp.loaded
    if (honkNow && !this.honked) this.sound.honk(THREE.MathUtils.clamp(1.3 - Math.hypot(vp.x - this.pose.target.x, vp.z - this.pose.target.z) / 25, 0.2, 1))
    this.honked = this.life.vanMove?.dir === 'in' ? this.honked || !!honkNow : false
    this.gateAngle += (gateWant - this.gateAngle) * Math.min(1, dt * (gateWant > this.gateAngle ? 4 : 2))
    for (const d of this.gateDoors) d.pivot.rotation.y = d.sign * this.gateAngle
    this.sound.engine(this.driving && this.life.speed > 0 ? 0.85
      : this.life.vanMove && vp.visible && this.life.speed > 0 ? Math.max(0, 1 - vanFar / 34) : 0,
    Math.min(1, Math.abs(vp.speed) / (this.driving ? 7 : 2)))
    // 鸟：白天、不下雨时，一群鸟从西边慢慢飞到东边，循环
    const dayCalm = this.nightness < 0.3 && this.life.rain < 0.05
    this.birds.g.visible = dayCalm
    if (dayCalm) {
      const cycle = (this.elapsed * 1.6) % 140
      // 在屋后江面上空、离镜头远一点，看起来是小小的一群
      this.birds.g.position.set(-50 + cycle, 10, -2.5 + Math.sin(this.elapsed * 0.05) * 3)
      this.birds.g.rotation.y = -Math.PI / 2
      this.birds.g.scale.setScalar(0.4)
      for (const b of this.birds.list) {
        const flap = Math.sin(this.elapsed * 6 + b.ph) * 0.3
        const p = b.obj.geometry.attributes.position as THREE.BufferAttribute
        p.setY(0, flap)
        p.setY(3, flap)
        p.needsUpdate = true
        b.obj.position.copy(b.off)
      }
    }
    // 萤火虫：世外桃源画风、夜里、不下雨、没在打仗时才有
    const calmNight = this.style === 'paradise' && this.nightness > 0.6 && this.life.rain < 0.05 && !fighting
    this.flies.pts.visible = calmNight
    if (calmNight) {
      const fp = this.flies.pts.geometry.attributes.position as THREE.BufferAttribute
      const fc = this.flies.pts.geometry.attributes.color as THREE.BufferAttribute
      const tt = this.elapsed
      this.flies.home.forEach((h, i) => {
        const ph = this.flies.phase[i]
        fp.setXYZ(i, h.x + Math.sin(tt * 0.3 + ph) * 0.8, h.y + Math.sin(tt * 0.7 + ph * 2) * 0.25, h.z + Math.cos(tt * 0.25 + ph) * 0.8)
        const glow = Math.max(0, Math.sin(tt * 1.7 + ph * 3)) ** 3
        fc.setXYZ(i, 0.75 * glow, 1.0 * glow, 0.35 * glow)
      })
      fp.needsUpdate = true
      fc.needsUpdate = true
    }
    // 钓鱼：竿、线、浮漂（咬钩时浮漂往下一沉）
    const fishing = !!this.life.fishing
    this.rod.visible = fishing
    this.fishLine.visible = fishing
    this.bobber.visible = fishing
    if (fishing) {
      const hr = this.heroine.root
      const f = TMP_FWD.set(Math.sin(hr.rotation.y), 0, Math.cos(hr.rotation.y))
      this.bite = Math.max(0, this.bite - dt)
      this.bobber.position.set(hr.position.x + f.x * 3.4, -0.12 + Math.sin(this.elapsed * 2.2) * 0.015 - (this.bite > 0 ? 0.08 : 0), hr.position.z + f.z * 3.4)
      const tip = this.rodTip.getWorldPosition(TMP_TIP)
      const pts = this.fishLine.geometry.attributes.position as THREE.BufferAttribute
      pts.setXYZ(0, tip.x, tip.y, tip.z)
      pts.setXYZ(1, this.bobber.position.x, this.bobber.position.y + 0.04, this.bobber.position.z)
      pts.needsUpdate = true
    }
    // 手电筒：夜里在屋外，照向女主前方
    const hp = this.heroine.root.position
    const fwd = new THREE.Vector3(Math.sin(this.heroine.root.rotation.y), 0, Math.cos(this.heroine.root.rotation.y))
    this.torch.position.set(hp.x + fwd.x * 0.3, hp.y + 1.3, hp.z + fwd.z * 0.3)
    this.torch.target.position.set(hp.x + fwd.x * 6, hp.y, hp.z + fwd.z * 6)
    const wantTorch = this.mode === 'outside' && this.nightness > 0.5 && !this.heroine.away ? 60 : 0
    this.torch.intensity += (wantTorch - this.torch.intensity) * Math.min(1, dt * 4)
    // 第一个尸潮危机夜 22:20 以后：街尽头站着一个脸色苍白的人，过一会儿就不见了
    const sg = this.life.siege
    if (!this.life.cameoSeen && sg && !sg.done && !sg.ambush && Household.crisisKind(this.life.clock) === 'horde' && this.life.clock.hour >= 22.3) {
      this.life.cameoSeen = true
      const model = this.siegeView.npc('stranger')
      const fig = new THREE.Group()
      if (model) {
        model.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          const fix = (mat: THREE.Material) => {
            const c = mat.clone() as THREE.MeshStandardMaterial
            // 眼睛：暗红色、在夜里发光（普通丧尸是黄的）
            if (c.name.endsWith('low-poly')) { c.color.set('#3a0d0d'); c.emissive = new THREE.Color('#d0281e'); c.emissiveIntensity = 1.4; return c }
            c.color.set(c.name.endsWith('.body') ? '#e4e2de' : /short|hair|eyebrow/.test(c.name) ? '#111111' : '#1c1c20')
            return c
          }
          m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material)
        })
        fig.add(model)
        new PoseDriverFor(model).update(0.5, 'idle')
      } else fig.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.2, 4, 8), new THREE.MeshStandardMaterial({ color: '#1c1c20' })))
      // 铁门正对面的街边（打丧尸时镜头对着铁门，正好看得见）
      fig.position.set(1.5, 0, 20.8)
      fig.rotation.y = Math.PI
      this.scene.add(fig)
      this.cameo = { obj: fig, until: this.life.absHour + 0.7 }
      this.life.logNote('world.log.aji')
      this.sound.eerie()
    }
    if (this.cameo && this.life.absHour > this.cameo.until) {
      this.cameo.obj.removeFromParent()
      this.cameo = null
    }
    // 江野来帮忙守夜：提示一下
    if (!!this.life.guest !== this.hadGuest) {
      this.hadGuest = !!this.life.guest
      if (this.hadGuest) { this.toast('world.toast.guest', 4); this.sound.knock() }
    }
    const visitor = this.life.visitor
    if (visitor) {
      let walking = false
      for (let left = sim; left > 1e-6; left -= 0.05) walking = visitor.follow(Math.min(left, 0.05), 1.7) || walking
      visitor.animate(Math.min(sim, 0.1), walking)
    }
    // 送东西的男主（谢临走得快）
    const courier = this.life.courier
    if (courier) {
      let walking = false
      const v = courier.who === 'xielin' ? 2.6 : 1.8
      for (let left = sim; left > 1e-6; left -= 0.05) walking = courier.follow(Math.min(left, 0.05), v) || walking
      courier.animate(Math.min(sim, 0.1), walking)
    }
    for (const w of this.weapons) w.visible = fighting
    // 弩：挂在拿弩的人手上（打仗时才拿出来），他原来的武器收起来
    const archer = this.life.crossbow ? this.actors.find((a) => a.weapon === 'crossbow' && a.driver && !a.dead) : undefined
    if (archer) {
      if (!this.bow) { this.bow = crossbowMesh(); this.weapons.push(this.bow) }
      if (this.bow.userData.owner !== archer) {
        const ok = (archer.driver as { attach(o: THREE.Object3D, bone: string): boolean } | null)?.attach(this.bow, 'RightHand')
        if (ok) this.bow.userData.owner = archer
      }
      this.bow.visible = fighting
      const old = this.kitOf.get(archer)
      if (old) old.visible = false
    }
    this.bubbles.update(this.actors, fighting, this.mode === 'home', this.elapsed, this.life.clock.day >= PROLOGUE_DAYS, this.life.speed === 0)
    if (this.life.wall && !this.stoneWall && !this.hud.loading) this.raiseStoneWall()
    const g = this.life.garden
    this.gardenObj.visible = g.built
    if (g.built) {
      const sc = 0.2 + g.growth * 0.8
      this.sprouts.forEach((p, k) => { p.scale.setScalar(sc * (0.9 + (k % 3) * 0.08)); p.rotation.y = Math.sin(this.elapsed * 0.8 + k) * 0.05 })
      this.ripeMark.visible = g.growth >= 1 && this.mode === 'home'
      this.ripeMark.position.y = 1.3 + Math.sin(this.elapsed * 2) * 0.05
    }
    if (this.doomT > 0 && (this.doomT -= dt) <= 0) this.setHud({ doom: false })
    // 末日后：危机夜当天早上提醒一次；每天傍晚提醒丧尸要来了
    const ck = this.life.clock
    if (ck.day >= PROLOGUE_DAYS && !this.life.siege && this.introT < 0 && this.life.speed > 0) {
      const left = this.life.available
      if (ck.hour >= 8 && ck.hour < SUNSET && this.warned.crisis !== ck.day && isCrisisNight({ day: ck.day, hour: 21 })) {
        this.warned.crisis = ck.day
        const kind = Household.crisisKind({ day: ck.day, hour: 21 })
        this.toast('world.toast.crisisDay', 6, { kind: kind ? t(`crisisKind.${kind}` as UiKey) : '' })
      } else if (this.toastTimer <= 0 && ck.hour >= 9 && ck.hour < 10 && this.warned.stock !== ck.day && (left.water < 3 || left.food < 3)) {
        // 早上看一眼存货：快没水 / 没吃的了就提醒（饿死渴死是会死人的）
        this.warned.stock = ck.day
        this.toast(left.water < 3 ? 'world.toast.lowWater' : 'world.toast.lowFood', 6)
      } else if (this.toastTimer <= 0 && ck.hour >= 19.5 && ck.hour < 20.5 && this.warned.dusk !== ck.day) {
        this.warned.dusk = ck.day
        this.toast(this.life.raidTonight ? 'world.toast.duskRaid' : this.life.ammo.n < 8 ? 'world.toast.duskLowAmmo' : 'world.toast.dusk', 5)
      }
    }
    // 有人快饿死、有人走了：日记里新出现这种记录就弹提示（只看新的）
    const last = this.life.log.at(-1) ?? null
    if (last !== this.lastLog) {
      if (this.lastLog !== undefined) {
        // 同一帧可能记了好几条：从后往前看到上次看过的那条为止
        const fresh: LogEntry[] = []
        for (let i = this.life.log.length - 1; i >= 0 && this.life.log[i] !== this.lastLog && fresh.length < 12; i--) fresh.push(this.life.log[i])
        if (fresh.some((l) => l.key.startsWith('world.log.died.'))) { this.toast('world.toast.died', 5); this.sound.eerie() }
        else if (fresh.some((l) => l.key === 'world.log.dying')) this.toast('world.toast.dying', 5)
        else if (fresh.some((l) => l.key === 'world.visit.jiangye_care.log.stay')) this.toast('world.toast.moveIn', 5, { who: '江野' })
        else if (fresh.some((l) => l.key === 'world.visit.shenyan_meet.log.stay')) this.toast('world.toast.moveIn', 5, { who: '沈砚' })
      }
      this.lastLog = last
    }
    // 走了的家人：院子西边多一个小土堆和一块石碑
    for (const a of this.actors) {
      if (!a.dead || a === this.heroine || this.graves.has(a.name) || this.hud.loading) continue
      const at = GRAVES[this.graves.size % GRAVES.length]
      const g = this.makeGrave()
      g.position.set(at.x, 0, at.z)
      g.rotation.y = YAW // 石碑正面朝着家里视角的镜头
      this.graves.set(a.name, g)
      this.scene.add(g)
    }
    // 钉板：铺了才出现，踩烂了就收起来
    if (this.life.trap.hp > 0 && !this.trapMesh && !this.hud.loading) {
      this.trapMesh = this.makeTrap()
      this.scene.add(this.trapMesh)
    }
    if (this.trapMesh) this.trapMesh.visible = this.life.trap.hp > 0
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
        this.sound.groan(THREE.MathUtils.clamp(1.2 - d / 20, 0.1, 1), z.brute ? 0.55 : 1)
        this.groanT.set(z, 4 + Math.random() * 6)
      } else this.groanT.set(z, left)
    }
    const rainNow = this.life.rain
    this.rain.update(Math.min(sim, 0.1), this.pose.target, rainNow)
    this.sound.ambience(this.nightness, !fighting, rainNow)
    this.updateLooks()
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
    if (this.cat) {
      const cat = this.cat
      // 天黑前半小时，今晚要来丧尸（或者来抢的人）：猫先察觉
      const ck = this.life.clock
      const danger = !fighting && ck.day >= PROLOGUE_DAYS && ck.hour >= 20.4 && ck.hour < 21
        && (Household.nightCount(ck).count > 0 || this.life.raidTonight || !!Household.crisisKind(ck))
      const hissing = cat.hiss > 0
      cat.update(sim, { navs: this.navs, hero: this.heroine, family: this.actors, hour: ck.hour, siege: fighting, rain: this.life.rain > 0.1, danger, heroDriving: !!this.driving })
      if (!hissing && cat.hiss > 0) {
        this.sound.hiss()
        // 日记只在第一次、或者今晚格外凶险（危机夜、黑鸦、白天开过车）时记，不然每晚一条刷屏
        const special = !!Household.crisisKind(ck) || this.life.raidTonight || this.life.noiseDay === ck.day
        if (special || firstTime('catHiss')) this.life.logNote('world.log.catHiss')
      }
      this.catHeart.material = cat.hiss > 0 ? this.catAngry : this.catLove
      cat.root.visible = !(upstairsHidden && cat.root.position.y > FLOOR_H - 0.4)
      this.catHeart.visible = (cat.hearts > 0 || cat.hiss > 0) && cat.root.visible
      this.catHeart.position.y = 0.62 + Math.sin(this.elapsed * 3) * 0.03
      // 猫趴着 / 坐着的时候，隔一会儿有个闲着的家里人过去蹲下摸摸它
      this.petT -= sim
      if (this.petT <= 0 && sim > 0) {
        this.petT = 25 + Math.random() * 35
        const resting = !cat.path.length && (cat.pose === 'loaf' || cat.pose === 'sit') && cat.plan !== 'hide' && cat.plan !== 'bed'
        const near = this.actors.filter((a) => a !== this.heroine || !this.keysMoving)
          .filter((a) => a.floor === cat.floor && Math.hypot(a.pos.x - cat.pos.x, a.pos.z - cat.pos.z) < 7)
        const who = near[Math.floor(Math.random() * near.length)]
        if (resting && who && this.life.petCat(who, cat.pos)) this.petting = who
      }
      if (this.petting) {
        const p = this.petting
        if (p.task?.kind !== 'pet') this.petting = null
        else if (p.task.phase === 'use') { cat.hearts = Math.max(cat.hearts, 0.3); cat.stay(3) }
      }
      // 猫挨着的人（1.3 米内、同一层）心情慢慢变好
      if (sim > 0) {
        for (const a of this.actors) {
          if (a.away || a.floor !== cat.floor || Math.hypot(a.pos.x - cat.pos.x, a.pos.z - cat.pos.z) > 1.3) continue
          a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + sim * 0.12) }
        }
      }
    }
    // 开车时女主坐在车里（藏起来）；走到车边提示一次"按 F 上车"
    if (this.driving) this.heroine.root.visible = false
    else {
      const near = this.canDrive() && Math.hypot(this.heroine.pos.x - vp.x, this.heroine.pos.z - vp.z) < 2.6
      if (near && !this.driveHinted) this.toast('world.toast.driveHint', 3)
      this.driveHinted = near
    }
    // 晾着的衣服随风摆（下雨风大）
    this.line.clothes.visible = this.life.laundryOut
    this.line.update(this.elapsed, this.life.rain > 0.1 ? 2 : 1)
    if (sim > 0) this.makeWay()
    const heroOut = this.life.onTrip(this.heroine)
    this.setMode(heroOut || isHome(this.heroine.pos.x, this.heroine.pos.z, this.mode === 'home') ? 'home' : 'outside')
    // 选中的人出门了、走了（客人离开、离家出走）就换一个在家的人
    if (this.selected.away || !this.actors.includes(this.selected)) {
      const other = this.actors.find((a) => !this.life.isOut(a))
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

  /** WASD / 方向键：平移镜头（人都用鼠标点着走） */
  private updateCameraKeys(dt: number): void {
    let fx = 0
    let fz = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) fz -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) fz += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) fx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) fx += 1
    if (!fx && !fz) return
    const fwd = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW))
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW))
    const speed = 7 * (this.mode === 'home' ? this.zoom.home : this.zoom.outside)
    this.pan.addScaledVector(fwd, -fz * speed * dt).addScaledVector(right, fx * speed * dt)
    this.pan.clampLength(0, this.mode === 'home' ? 10 : 14)
  }

  private updateFollowers(dt: number): void {
    this.followTimer -= dt
    if (this.mode !== 'outside' || this.followTimer > 0) return
    this.followTimer = 0.4
    const h = this.heroine.root
    const back = new THREE.Vector2(-Math.sin(h.rotation.y), -Math.cos(h.rotation.y))
    // 睡着的人不跟出去
    this.actors.filter((a) => a !== this.heroine && a.task?.kind !== 'sleep' && !this.life.isOut(a)).forEach((a, k) => {
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
      if (this.life.over) return
      el.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
      if (this.pointers.size === 2) { this.pinchDist = this.pointerSpread(); this.press = null }
    }) as EventListener)
    this.on(el, 'pointermove', ((e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId)
      if (!prev) { this.hover(e.clientX, e.clientY); return }
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
      if (this.life.over) return
      const k = e.key.toLowerCase()
      if (k === 'e' && !e.repeat) this.searchHere()
      this.keys.add(k)
    }) as EventListener)
    this.on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()) }) as EventListener)
    this.on(window, 'blur', (() => this.keys.clear()) as EventListener)
    this.on(window, 'pagehide', (() => { if (!this.disposed) saveWorld(this.life) }) as EventListener)
    this.on(document, 'visibilitychange', (() => { if (document.hidden && !this.disposed) saveWorld(this.life) }) as EventListener)
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y) || 1
  }

  private zoomBy(f: number): void {
    const z = this.zoom[this.mode] * f
    this.zoom[this.mode] = THREE.MathUtils.clamp(z, this.mode === 'home' ? 0.55 : 0.6, this.mode === 'home' ? 1.5 : 1.8)
  }

  /** 现在能不能上车：车在、没出门、没打丧尸、女主在一楼 */
  private canDrive(): boolean {
    const l = this.life
    return !l.vanAway && !l.vanMove && !l.trip?.van && !l.siege && !l.nightPending && !l.onTrip(this.heroine)
      && this.heroine.floor === 0 && !this.heroine.away && l.speed > 0
  }

  /** F：走到车边上车，开着车停稳了再按一次下车 */
  toggleDrive(): void {
    if (this.driving) { this.exitVan(false); return }
    const vp = vanPose(this.life.vanMove, this.life.vanAway, this.life.absHour, this.life.vanAt)
    if (!this.canDrive() || Math.hypot(this.heroine.pos.x - vp.x, this.heroine.pos.z - vp.z) > 3) {
      if (Math.hypot(this.heroine.pos.x - vp.x, this.heroine.pos.z - vp.z) <= 3) this.toast('world.toast.noDrive', 2)
      return
    }
    this.life.cancel(this.heroine)
    this.life.cancelSearch()
    this.life.stopFishing()
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.garden.built)
    // 停的地方在这个画风里被东西压住了（换过画风）：先挪回院子车位
    if (this.life.vanAt && this.vanStuck(this.life.vanAt)) {
      this.life.vanAt = null
      vp.x = VAN_PARK.x; vp.z = VAN_PARK.z; vp.rot = VAN_PARK.rot
    }
    this.driving = { x: vp.x, z: vp.z, rot: vp.rot, speed: 0 }
    this.life.heroDriving = true
    this.life.vanAt = { x: vp.x, z: vp.z, rot: vp.rot }
    this.selected = this.heroine
    this.toast('world.toast.drive', 4)
  }

  /** 下车：站到车门边（左边不行就右边、后面）；车停回院子车位附近就算停好了 */
  private exitVan(force: boolean): void {
    const d = this.driving
    if (!d) return
    if (!force && Math.abs(d.speed) > 0.6) { this.toast('world.toast.stopFirst', 1.5); return }
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.garden.built)
    // 车卡死了（比如菜地开在车底下）也让她下来
    const at = this.exitSpot(d, force || this.vanStuck(d))
    if (!at) { this.toast('world.toast.noExit', 1.5); return }
    this.heroine.root.position.set(at.x, 0, at.z)
    this.heroine.floor = 0
    this.driving = null
    this.life.heroDriving = false
    this.keysMoving = false
    // 停回自家车位附近（两米多以内、车头大致朝东或朝西）：自动摆正停好，可以再派车出门
    const dr = Math.atan2(Math.sin(d.rot - VAN_PARK.rot), Math.cos(d.rot - VAN_PARK.rot))
    const aligned = Math.abs(dr) < 0.7 || Math.abs(dr) > Math.PI - 0.7
    if (Math.hypot(d.x - VAN_PARK.x, d.z - VAN_PARK.z) < 2.5 && aligned) {
      this.life.vanAt = null
      this.toast('world.toast.parked', 2)
    }
    else this.life.vanAt = { x: d.x, z: d.z, rot: d.rot }
  }

  /** 下车站哪：车门边一个走得到的点（不隔着围栏、墙，跟车在院子同一边）；force 时找不到就找最近的空格子 */
  private exitSpot(d: { x: number; z: number; rot: number }, force: boolean): { x: number; z: number } | null {
    const nav = this.navs[0]
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.garden.built)
    const wall = this.carBlocked
    const fx = Math.sin(d.rot)
    const fz = Math.cos(d.rot)
    const home = isHome(d.x, d.z, false)
    const reach = (p: { x: number; z: number }) => {
      if (nav.isBlockedAt(p.x, p.z) || isHome(p.x, p.z, false) !== home) return false
      for (let k = 1; k <= 8; k++) if (wall(d.x + (p.x - d.x) * k / 8, d.z + (p.z - d.z) * k / 8)) return false
      return true
    }
    const spots = [[fz * 1.25, -fx * 1.25], [-fz * 1.25, fx * 1.25], [-fx * 2.6, -fz * 2.6], [fx * 2.6, fz * 2.6]]
    const at = spots.map(([ox, oz]) => ({ x: d.x + ox, z: d.z + oz })).find(reach)
    if (at || !force) return at ?? null
    const c = nav.nearestFree(d.x + fz * 1.25, d.z - fx * 1.25)
    return c ? nav.centerOf(c[0], c[1]) : { x: d.x, z: d.z }
  }

  /** 车停的地方压着东西（换了画风以后可能）：一点都挪不动 */
  private vanStuck(at: { x: number; z: number; rot: number }): boolean {
    const blocked = this.carBlocked!
    return [[1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].every(([t, st]) => {
      const n = driveStep({ ...at, speed: 0 }, t, st, 0.25, blocked)
      return Math.hypot(n.x - at.x, n.z - at.z) < 0.01 && Math.abs(n.rot - at.rot) < 0.001
    })
  }

  /** 开车：W/S 油门刹车（倒车），A/D 转向；撞墙就停；女主跟着车走（镜头、家里/屋外的切换都照常） */
  private updateDriving(dt: number): void {
    const d = this.driving!
    const k = this.keys
    const throttle = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
    const steer = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0)
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.garden.built)
    const next = driveStep(d, throttle, steer, dt, this.carBlocked)
    this.driving = next
    this.life.vanAt = { x: next.x, z: next.z, rot: next.rot }
    const h = this.heroine
    h.root.position.set(next.x, 0, next.z)
    h.root.rotation.y = next.rot
    h.floor = 0
    this.keysMoving = true
  }

  private petCat(): void {
    const cat = this.cat
    if (!cat) return
    cat.poke()
    this.sound.meow()
    this.sound.purr()
    this.toast('world.toast.cat', 2)
    for (const a of this.actors) {
      if (a.away || Math.hypot(a.pos.x - cat.pos.x, a.pos.z - cat.pos.z) > 4) continue
      a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 3) }
    }
  }

  private panBy(dx: number, dy: number): void {
    const scale = (this.pose.dist * Math.tan(THREE.MathUtils.degToRad(this.pose.fov / 2)) * 2) / this.host.clientHeight
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW))
    const fwd = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW))
    this.pan.addScaledVector(right, -dx * scale).addScaledVector(fwd, (dy * scale) / Math.sin(this.pose.elev))
    this.pan.clampLength(0, 10)
  }

  private tap(cx: number, cy: number): void {
    // 开车时点地面不让女主下车走过去（F 下车）
    if (this.driving) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const floor: Floor = this.mode === 'home' ? this.viewFloor : 0
    if (this.mode === 'home' && this.tapPost()) return
    // 点大橘：喵一声、呼噜呼噜，身边的人心情好一点
    if (this.cat?.root.visible && this.raycaster.intersectObject(this.cat.inner, true).length) {
      this.petCat()
      return
    }
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
      // 点院门或者面包车：出门（打开地图，选地方、选人、要不要开车）
      if (this.van.parts.root.visible && this.raycaster.intersectObject(this.van.parts.root, true).length) { this.onMap?.(); return }
      // 书桌上的红本子：打开重生日记
      const hit = this.furnitureUnder(floor)
      if (hit && (hit.userData.piece === 'diary' || hit.userData.piece === 'desk')) { this.onDiary?.(); return }
      if (hit && hit.userData.piece === 'wall_map') { this.onMap?.(); return }
      if (hit && (hit.userData.slug === 'large_iron_gate' || hit.userData.gate)) { this.onMap?.(); return }
      // 点家具：弹出一个小菜单（坐着歇会儿 / 做饭吃 / 喝口水 / 睡一觉…），选了以后让选中的人去
      const options = hit ? this.furnitureOptions(hit, floor) : []
      if (hit && options.length) {
        this.onFurnitureMenu?.({ x: cx, y: cy, title: furnitureName(hit), who: this.selected.name, options: options.map((o) => ({ label: o.label, spot: o.spot })) })
        return
      }
    }
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floor * FLOOR_H), p)) return
    const who = this.mode === 'home' ? this.selected : this.heroine
    if (who === this.heroine) { this.life.cancelSearch(); this.life.stopFishing() }
    const path = this.life.commandWalk(who, { x: p.x, z: p.z, floor })
    if (!path) return
    const end = path[path.length - 1] ?? { ...who.pos, y: who.root.position.y }
    this.flashMarker(end.x, floor * FLOOR_H, end.z)
  }

  /** 鼠标停在能点的东西上（人、家具、面包车、猫）：变成小手 */
  private hoverT = 0
  private hover(cx: number, cy: number): void {
    const now = performance.now()
    if (now - this.hoverT < 80) return
    this.hoverT = now
    const el = this.renderer.domElement
    const rect = el.getBoundingClientRect()
    this.raycaster.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), this.camera)
    const floor: Floor = this.mode === 'home' ? this.viewFloor : 0
    const people = this.actors.filter((a) => a.root.visible).map((a) => a.root)
    const over = this.raycaster.intersectObjects(people, true).length > 0
      || (!!this.cat?.root.visible && this.raycaster.intersectObject(this.cat.inner, true).length > 0)
      || (this.mode === 'home' && (this.raycaster.intersectObject(this.van.parts.root, true).length > 0 || !!this.furnitureUnder(floor)))
    el.style.cursor = over ? 'pointer' : ''
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

  /** 点家具弹出的菜单：这件家具旁边能干的事（每种挑一个空着的位置） */
  onFurnitureMenu: ((menu: FurnitureMenu | null) => void) | null = null

  private furnitureOptions(root: THREE.Object3D, floor: Floor): { label: UiKey; spot: Spot }[] {
    const box = new THREE.Box3().setFromObject(root)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const reach = Math.max(1.0, Math.max(size.x, size.z) / 2 + 0.7)
    const best = new Map<Spot['kind'], { spot: Spot; d: number; free: boolean }>()
    for (const s of this.life.allSpots) {
      if (s.floor !== floor || s.kind === 'stroll') continue
      const d = Math.hypot(s.x - c.x, s.z - c.z)
      if (d > reach) continue
      const who = this.life.whoUses(s)
      const free = !who || who === this.selected
      const cur = best.get(s.kind)
      if (!cur || (free && !cur.free) || (free === cur.free && d < cur.d)) best.set(s.kind, { spot: s, d, free })
    }
    const order: Spot['kind'][] = ['cook', 'drink', 'dine', 'relax', 'sleep']
    return order.filter((k) => best.has(k)).map((k) => ({ label: `world.use.${k}` as UiKey, spot: best.get(k)!.spot }))
  }

  /** 菜单里选了一项：让选中的人去用 */
  useFurniture(spot: Spot): void {
    this.onFurnitureMenu?.(null)
    if (this.life.siege && !this.life.siege.done) return
    if (this.life.commandSpot(this.selected, spot)) this.flashMarker(spot.ax ?? spot.x, spot.floor * FLOOR_H, spot.az ?? spot.z)
    else this.toast(this.life.whoUses(spot) ? 'world.toast.taken' : 'world.toast.busy')
  }

  /** 界面设置：点了日记本 / 墙上的地图 */
  onDiary: (() => void) | null = null
  onMap: (() => void) | null = null

  tripCheck(id: string, van = false): ReturnType<Household['tripCheck']> {
    return this.life.tripCheck(id, van)
  }

  /** 地图上"开面包车去"要用：还剩几桶油、车在不在家 */
  vanInfo(): { fuel: number; home: boolean; armored: boolean; parkedOut: boolean } {
    const l = this.life
    return { fuel: l.fuel, home: !l.vanAway && !l.vanMove && !l.vanAt, armored: l.vanArmor, parkedOut: !!l.vanAt && !l.vanAway && !l.vanMove }
  }

  /** 在家、能出门的人 */
  homeMembers(): { name: string; health: number }[] {
    return this.actors.filter((a) => !this.life.isOut(a) && !a.guest).map((a) => ({ name: a.name, health: a.health }))
  }

  startTrip(id: string, names: string[], van = false): boolean {
    const members = this.actors.filter((a) => names.includes(a.name))
    const ok = this.life.startTrip(id, members, van)
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

  private toast(key: ToastKey, seconds = 2, vars?: Record<string, string>): void {
    this.toastTimer = seconds
    this.setHud({ toast: key, toastVars: vars ?? null })
  }

  /** 原型调试：直接跳到末日第一晚（或月底危机夜）的晚上 8 点 50 */
  debugNight(crisis: boolean): void {
    if (this.life.siege) return
    // 只往后跳，不倒回去（倒回去的话出门、访客、菜地这些按时间算的东西都会乱）
    const wasPrologue = this.life.clock.day < PROLOGUE_DAYS
    this.life.clock = { day: Household.nextNightDay(this.life.clock, crisis), hour: 20.85 }
    // 从序章直接跳过去：末日降临的警报和字幕也补上
    if (wasPrologue && this.life.clock.day >= PROLOGUE_DAYS) {
      this.life.logNote('world.log.doomday')
      this.life.onDoomsday?.()
    }
    this.life.resetNight()
    this.pushLifeHud()
  }

  // --- 给界面用 ---------------------------------------------------------------

  select(a: Actor | string): void {
    const actor = typeof a === 'string' ? this.actors.find((x) => x.name === a) : a
    if (!actor) return
    // 打丧尸时点了倒下的人：有急救包就当场救起来
    if (this.life.siege?.isDown(actor)) {
      if (this.life.rescue(actor)) { this.sound.squelch(); this.pushLifeHud() }
      else this.toast('world.toast.noMedkit')
    }
    if (this.mode === 'outside' && actor !== this.heroine) return
    // 点了一个站着没事的人：TA 冲你挥挥手（打丧尸时不挥）
    if (actor !== this.selected && this.life.speed > 0 && !(this.life.siege && !this.life.siege.done)) actor.ack = 1.3
    this.selected = actor
    if (this.mode === 'home') this.setViewFloor(actor.root.position.y > FLOOR_H - 0.4 ? 1 : 0)
    this.setHud({ selected: actor.name })
  }

  private visitHud(): Hud['visit'] {
    const def = this.life.talking
    if (!def) return null
    const ctx = this.life.visitorCtx()
    // 男主用文字版的名字和身份
    const lead = ['jiangye', 'shenyan', 'guchen', 'xielin'].find((id) => def.id.startsWith(id))
    const npc = lead ? npcs.find((n) => n.id === lead) : null
    const vars = this.life.visitVars()
    return {
      id: def.id, icon: def.id === 'beggar' && vars.ta === '她' ? '👩' : def.icon, vars,
      name: npc ? `${lt(npc.name)} · ${lt(npc.title)}` : t(`world.visit.${def.id}.name` as UiKey),
      textKey: def.id === 'jiangye_care' ? `world.visit.jiangye_care.text${this.life.careVariant}` : `world.visit.${def.id}.text`,
      choices: def.choices.map((c) => ({ id: c.id, ok: !c.need || c.need(ctx) })),
    }
  }

  /** 日记里"认识的人"：男主和好感 */
  diaryPeople(): { icon: string; name: string; title: string; affection: number; met: boolean; home: boolean; canStay: boolean }[] {
    return Object.entries(this.life.affection).map(([id, v]) => {
      const n = npcs.find((x) => x.id === id)
      const met = id === 'guchen' ? this.life.guchenMet : id === 'xielin' ? this.life.xielinNotes > 0 : this.life.seen[`${id}_meet`] !== undefined
      const home = (id === 'jiangye' && this.life.jiangyeHome) || (id === 'shenyan' && this.life.shenyanHome)
      // 好感够了、家里还有位置：下次他来时可以请他住下来
      const canStay = (id === 'jiangye' || id === 'shenyan') && !home && v >= 70 && this.life.residents < Household.MAX_RESIDENTS
      return { icon: n?.icon ?? '❤', name: n ? lt(n.name) : id, title: n ? lt(n.title) : '', affection: v, met, home, canStay }
    })
  }

  answerVisitor(choice: string): void {
    this.life.answerVisitor(choice)
    this.pushLifeHud()
  }

  /** 原型调试：一家人换成 Q 版 / 真人（重新加载页面） */
  /** 人物用不用 Q 版：卡通画风总是用，世外桃源画风看设置 */
  private get toonPeople(): boolean {
    return this.style === 'toon' || peopleStyle() === 'toon'
  }

  togglePeople(): void {
    const next = peopleStyle() === 'toon' ? 'real' : 'toon'
    setPeopleStyle(next)
    saveWorld(this.life)
    // 网址里带了 ?people= 的话，网址里的优先：一起改掉
    const url = new URL(location.href)
    if (url.searchParams.has('people')) {
      url.searchParams.set('people', next)
      location.replace(url.toString())
    } else location.reload()
  }

  /** 原型调试：普通 / 困难切换（切到困难时子弹减半） */
  toggleHard(): void {
    // 打仗的时候不能切（这一场的丧尸已经按原来的难度来了）
    if (this.life.siege && !this.life.siege.done) return
    this.life.hard = !this.life.hard
    setHardPref(this.life.hard)
    this.applyHardAmmo()
    saveWorld(this.life)
    this.setHud({ hard: this.life.hard })
  }

  /** 困难模式开局子弹减半：每一局只减一次 */
  private applyHardAmmo(): void {
    if (!this.life.hard || this.life.hardHalved) return
    this.life.hardHalved = true
    this.life.ammo.n = Math.ceil(this.life.ammo.n / 2)
  }

  /** 原型调试：看看"你又死了一次"那一屏 */
  debugDie(): void {
    // 正在打仗就先收场（不然存不了档，重生点也对不上）
    const sg = this.life.siege
    if (sg) { for (const z of sg.zombies) z.root.removeFromParent(); this.life.siege = null }
    this.life.die(this.actors[0], 'crisis')
    this.pushLifeHud()
  }

  /** 原型调试：顾沉 / 谢临马上送东西来 */
  debugCourier(who: 'guchen' | 'xielin'): void {
    if (this.life.clock.day < PROLOGUE_DAYS) this.life.clock = { day: PROLOGUE_DAYS, hour: 9 }
    this.life.giveCare(who)
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

  /** 序章清单：都是看得见的状态，不用另外记 */
  private goals(): Hud['goals'] {
    const l = this.life
    const total = l.available
    return [
      { key: 'world.goal.food', done: total.food >= 20 },
      { key: 'world.goal.water', done: total.water >= 20 },
      { key: 'world.goal.medkit', done: l.medkits >= 2 },
      { key: 'world.goal.gate', done: l.gateBonus > 0 },
      { key: 'world.goal.ammo', done: l.ammo.n >= 30 },
      { key: 'world.goal.fuel', done: l.fuel >= 6 },
      { key: 'world.goal.jiangye', done: l.warnedJiangye },
    ]
  }

  /** 屋外按 E 或点按钮：江边就钓鱼，别处搜身边这个地方 */
  searchHere(): void {
    if (this.driving) return
    if (this.mode === 'outside' && nearFishing(this.heroine.pos)) {
      if (this.life.fishing) this.life.stopFishing()
      else if (this.life.startFishing()) {
        // 能钓才站到钓鱼点上，面朝江
        this.heroine.root.position.set(FISHING.at.x, 0, FISHING.at.z)
      }
      this.pushLifeHud()
      return
    }
    const spot = nearestSpot(this.heroine.pos)
    if (spot && this.mode === 'outside') this.life.startSearch(spot)
    this.pushLifeHud()
  }

  throwMolotov(): void {
    this.life.throwMolotov()
    this.pushLifeHud()
  }

  moveToSpace(kind: 'food' | 'water', n: number): void {
    if (this.life.moveToSpace(kind, n)) {
      this.siegeView.sparkle(this.heroine.root.position)
      this.sound.squelch()
    }
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

  /** 片头放完（或者被点掉）：从当前镜头平滑过渡到平常的视角 */
  endIntro(): void {
    if (this.introT < 0) return
    this.introT = -1
    this.tweenFrom = { target: this.pose.target.clone(), elev: this.pose.elev, dist: this.pose.dist, fov: this.pose.fov }
    this.tweenT = 0
    this.floorTween = true
    this.setHud({ intro: false })
  }

  /** 拍照：用当前镜头重新渲染一帧，存成 PNG（界面是 HTML，不会出现在照片里） */
  snapshot(): void {
    this.renderer.render(this.scene, this.camera)
    const url = this.renderer.domElement.toDataURL('image/png')
    const a = document.createElement('a')
    const c = this.life.clock
    a.href = url
    a.download = `重生末日之前-第${c.day + 1}天-${String(Math.floor(c.hour)).padStart(2, '0')}点.png`
    a.click()
    this.sound.splash()
  }

  toggleMusic(): void {
    this.sound.unlock()
    this.sound.setMusic(!this.sound.music)
    this.setHud({ music: this.sound.music })
  }

  toggleMute(): void {
    this.sound.unlock()
    this.sound.setMuted(!this.sound.muted)
    this.setHud({ muted: this.sound.muted })
  }

  setSpeed(n: number): void {
    if (this.life.over) return
    this.life.speed = n
    this.pushLifeHud()
  }

  get speed(): number {
    return this.life.speed
  }

  /** 头像缓存：每个人拍一次 */
  private portraitCache = new Map<Actor, string>()

  /** 给人物卡拍头像：把这个人的模型复制一份放进小摄影棚（暖色侧光、深色背景），摆站姿，拍胸像 */
  private portraitOf(a: Actor): string | null {
    if (!a.driver) return null
    const model = cloneSkinned(a.mesh)
    model.position.set(0, 0, 0)
    model.rotation.set(0, -0.3, 0)
    model.scale.copy(a.mesh.scale)
    const studio = new THREE.Scene()
    studio.background = new THREE.Color('#3a332c')
    const key = new THREE.DirectionalLight('#ffe4c4', 2.6)
    key.position.set(-1.4, 2.4, 2.2)
    const rim = new THREE.DirectionalLight('#a9c4e0', 1.2)
    rim.position.set(1.8, 1.6, -1.5)
    studio.add(key, rim, new THREE.HemisphereLight('#b8c4cc', '#2a221a', 0.9), model)
    new PoseDriverFor(model).update(0, 'idle')
    model.updateMatrixWorld(true)
    const head = new THREE.Vector3(0, 1.45, 0)
    model.traverse((o) => { if ((o as THREE.Bone).isBone && /Head$/.test(o.name.replace(/[^A-Za-z]/g, ''))) o.getWorldPosition(head) })
    const cam = new THREE.PerspectiveCamera(26, 0.75, 0.05, 30)
    cam.position.set(head.x + 0.25, head.y + 0.02, head.z + 1.75)
    cam.lookAt(head.x, head.y - 0.2, head.z)
    const W = 240
    const H = 320
    const rt = new THREE.WebGLRenderTarget(W, H)
    rt.texture.colorSpace = THREE.SRGBColorSpace
    const prev = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(rt)
    this.renderer.render(studio, cam)
    this.renderer.setRenderTarget(prev)
    const px = new Uint8Array(W * H * 4)
    this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px)
    rt.dispose()
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!
    const img = g.createImageData(W, H)
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
    g.putImageData(img, 0, 0)
    return c.toDataURL('image/jpeg', 0.86)
  }

  private portraits(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const a of this.actors) {
      let p = this.portraitCache.get(a)
      if (!p) {
        try { p = this.portraitOf(a) ?? undefined } catch (e) { console.warn('portrait', e) }
        if (p) this.portraitCache.set(a, p)
      }
      if (p) out[a.name] = p
    }
    return out
  }

  private pushLifeHud(): void {
    const c = this.life.clock
    // 新来的人（住进来的、换了模型的）补拍头像；只在有人还没头像时才更新这一项
    const needShot = this.actors.some((a) => a.driver && !this.portraitCache.has(a))
    if (needShot && !this.hud.loading) this.setHud({ portraits: this.portraits() })
    this.setHud({
      time: calendarLabel(c),
      life: currentLife(),
      hard: this.life.hard,
      over: this.life.over ? this.overHud(this.life.over) : null,
      night: isNight(c.hour),
      rain: this.life.rain,
      crisis: isCrisisNight(c),
      crisisKind: Household.crisisKind(c),
      speed: this.life.speed,
      food: this.life.stock.food,
      water: this.life.stock.water,
      people: this.life.hud(),
      muted: this.sound.muted,
      music: this.sound.music,
      day: c.day,
      hour: c.hour,
      money: this.life.money,
      medkits: this.life.medkits,
      fuel: this.life.fuel,
      prologue: c.day < PROLOGUE_DAYS,
      report: this.life.report,
      visit: this.visitHud(),
      space: { ...this.life.space, cap: this.life.spaceCap },
      molotovs: this.life.molotovs,
      search: this.searchHud(),
      garden: { built: this.life.garden.built, growth: this.life.garden.growth },
      goals: c.day < PROLOGUE_DAYS ? this.goals() : null,
      wall: this.life.wall,
      trap: Math.ceil(this.life.trap.hp),
      fishing: { active: !!this.life.fishing, near: this.mode === 'outside' && nearFishing(this.heroine.pos), caught: this.life.fishCaught },
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

  /** 这一世结束的那一屏；顺便发重生点（撑过的天数 + 每打倒 5 只 1 点，至少 1 点；同一世只发一次） */
  private overHud(o: NonNullable<Household['over']>): Hud['over'] {
    const days = Math.max(0, o.day - PROLOGUE_DAYS + 1)
    const points = awardRebirthPoints(Math.max(1, days + Math.floor(this.life.kills / 5)))
    const mourned = this.actors.filter((a) => a.dead && a !== this.heroine).map((a) => a.name)
    return { when: calendarLabel({ day: o.day, hour: o.hour }), cause: o.cause, days, points, kills: this.life.kills, mourned }
  }

  /** 女主死了：带着记忆进入下一世（新开局，第几世 +1） */
  rebirth(): void {
    const o = this.life.over
    if (o) recordDeath(Math.max(0, o.day - PROLOGUE_DAYS + 1), o.cause)
    this.disposed = true
    nextLife()
    location.reload()
  }

  dispose(): void {
    // 还在加载就被卸掉（比如开发模式的 StrictMode）：别把空白新局存下来
    if (!this.disposed && !this.hud.loading) saveWorld(this.life)
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
