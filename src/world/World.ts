// 2.5D 原型的 3D 世界：小别墅 + 门前一条街。
// 家里（院子围栏以内）用固定 45° 视角；出了铁门换成高角度跟拍。两种镜头同一个朝向，
// 切换时用 0.9 秒平滑过渡，同时屋顶淡出、靠近镜头的墙压低。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  AIRCON_IN, AIRCON_OUT, COOP, COURT, FLOOR_H, FRONT_DOOR, GENERATOR_AT, HEARTH, TV, STORE_ROOM, FURNITURE, GATE, WELL, HOUSE, HOUSE_CENTER, PORCH, PARADISE_EXTRAS, PROPS, STAIR_HOLE, STREET, STREET_LAMPS, VAN_PARK, WALLS, WORLD, YARD,
  fenceSegments, isHome, wallPieces, type Floor, type Placement, type Spot,
} from './layout'
import { navFloors, type NavGrid } from './nav'
import { PoseDriver as PoseDriverFor, loadPerson, peopleStyle, setPeopleStyle } from './people'
import { clothesline, decorateHouse, parchmentMap, couplets, StockView, woodStove } from './decor'
import { VanView, buildVan, driveStep, vanPose, vehicleBlocker, type DriveState } from './van'
import { Cat } from './cat'
import {
  ParadiseMaterials, Petals, RIVER, River, boxProjectUV, hills, loadParadiseKit, placeModel, sakuraTree, samplers, scatter, variants, type ArtStyle, type ParadiseKit,
} from './paradise'
import { PantryView } from './pantry'
import { TONE } from './ui'
import { campBed, ironBedBedding, platformBed, treadmill } from './bedroom'
import { FireGlow, TV_STAND_H, TvScreen, acIndoor, crtTv, flue, generatorBox, ironStove, stool, tvStand } from './hearth'
import type { NewsView } from './news'
import { freezer, waterDispenser } from './kitchen'
import { GardenView } from './gardenView'
import { extremeOf } from './climate'
import { CROPS, MAX_PLOTS, PLOT_SLOTS, cropOf, type CropId } from './garden'
import { LOTTERY, STOCKS, marketState, pad2, stockPrice } from './money'
import {
  COLORS, barrel, box, car, counter, crossbowMesh, crowbar, desk, neighborHouse, rollingPin, shelf, shotgun, sofa, stairs,
  flatRoof, toon, toonify, tree,
} from './meshes'
import { Actor, BUILD_WORK, Household, INTERACTIONS, type BuildId, type InteractKind, type LogEntry, type NightReport, type PersonHud, type Trip } from './residents'
import { DISHES, ING_INFO, INGS, PROLOGUE_DAYS, SUNRISE, SUNSET, calendarLabel, dishOf, isCrisisNight, isNight } from './life'
import { LAYERS, MG, SPIKE, SPIKE_ROWS, TRAP, type LayerId, type Zombie, type ZombieKind } from './siege'
import { SiegeView } from './siegeView'
import { Sound } from './sound'
import { npcs } from '../content/npcs'
import { lt, t, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { Rain } from './weather'
import { applyPerks, awardRebirthPoints, clearWorld, currentLife, dayStartClock, hardPref, loadWorld, nextLife, recordDeath, rewindToDayStart, saveDayStart, saveWorld, setHardPref } from './save'
import { Bubbles, bubbleMaterial } from './bubbles'
import { FISHING, SCAVENGE, nearFishing, nearestSpot, type ScavengeSpot } from './scavenge'
import { ForageView } from './forageView'
import { HERBS_PER_MEDKIT, type ForageSpot } from './forage'
import { ONLINE_FEE, ONLINE_SHOP, cartLabel, priceOf, shopFor, type Cart, type SellCart } from './shop'
import type { ShopView } from './TradePanel'
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
  siege: {
    left: number; layer: LayerId | null; hp: number; max: number; ambush: boolean
    /** 场上各种丧尸各几只 */
    kinds: Partial<Record<ZombieKind, number>>
    /** 谁拿着枪 / 弩、还要等几秒（没有人拿就是 null） */
    shooter: { name: string; weapon: 'shotgun' | 'crossbow'; cool: number } | null
    /** 倒下了的人（有急救包可以救） */
    downed: string[]
    /** 点中的那只丧尸是什么（开枪先打它） */
    target: ZombieKind | null
    /** 阳台机枪还要等几秒（没有机枪是 null） */
    mg: number | null
  } | null
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
  /** 攒着的草药（够 3 份捣成急救包） */
  herbs: number
  /** 照现在家里的人数，吃的喝的还够几天 */
  daysLeft: number
  /** 竹子；两排竹尖刺还能扎几只；下一排是第几排（-1 = 都插满了） */
  bamboo: number
  spikes: number[]
  spikeNext: number
  /** 末日前要做的事（做完打勾） */
  goals: { key: string; done: boolean }[] | null
  /** 菜地：开了没有、长到多少 */
  garden: { built: boolean; growth: number; n: number; max: number; plots: { icon: string; name: string; p: number; ripe: boolean }[] }
  /** 正在干的工程：干到百分之几、谁在干、这会儿在不在干 */
  build: { id: string; p: number; worker: string; working: boolean }[]
  /** 江边钓鱼：在钓吗、站在钓鱼点旁边吗、今天钓了几条 */
  fishing: { active: boolean; near: boolean; caught: number }
  /** 全家都睡着了，时间在快进 */
  sleepSkip: boolean
  /** 阳台机枪架好了没有 */
  mg: boolean
  /** 气温：外面、屋里，空调开着没有、火炉在取暖没有 */
  temp: { out: number; in: number; ac: boolean; stove: boolean }
  /** 屋外：女主身边能搜的地方 */
  search: { kind: string; state: string; progress: number | null } | null
  /** 全新开局的片头正在放 */
  intro: boolean
  /** 有人在门口等回话 */
  visit: { id: string; icon: string; face: string | null; name: string; textKey: string; choices: { id: string; ok: boolean }[]; vars: Record<string, string> } | null
}

interface Pose { target: THREE.Vector3; elev: number; dist: number; fov: number }

const YAW = Math.PI / 4
const HOME_VIEW = { elev: THREE.MathUtils.degToRad(40), dist: 38, fov: 24 }
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
/** 手机界面（网购、快递、通讯录） */
export interface PhoneView {
  state: 'ok' | 'closed' | 'nosignal'
  /** 今天是最后一天能网购 */
  lastDay: boolean
  money: number
  day: number
  hour: number
  items: { id: string; name: string; icon: string; desc: string; cat: string; price: number; max: number }[]
  orders: { id: number; what: string; total: number; day: number; hour: number }[]
  contacts: ReturnType<Household['contacts']>
  fee: number
  /** 今天已经请过人了 */
  invited: boolean
  /** 股票：开没开市、三只股票今天的价和昨天的价、手上多少股 */
  market: 'open' | 'closed' | 'gone'
  stocks: { id: string; name: string; code: string; memory: string; clarity: 'clear' | 'half' | 'vague'; price: number; prev: number; shares: number; cost: number }[]
  /** 彩票：号码（后区第二个记不清）、买了没有、开奖了没有、中了多少 */
  lottery: {
    issue: string; front: number[]; back: number; back2Maybe: number[]; price: number; maxMult: number
    drawText: string; canBuy: boolean; ticket: { back2: number; mult: number } | null
    drawn: boolean; real: number | null; prize: number; claimed: boolean; canClaim: boolean
  }
}

/** 点家具 / 点人物弹出的小菜单：家具的选项带 spot（去用它），人物的选项带 act（走过去互动） */
export interface FurnitureMenu {
  x: number; y: number; title: string; who: string
  /** 点的是人：TA 的名字和现在的心情 */
  target?: string
  mood?: number
  options: { label: UiKey; spot?: Spot; act?: InteractKind; cmd?: MenuCmd; dish?: string; text?: string; disabled?: boolean }[]
}

/** 菜地界面 */
export interface PlotView {
  i: number
  who: string
  crop: { icon: string; name: string; p: number; ripe: boolean; watered: boolean } | null
  water: number
  seeds: { id: CropId; icon: string; name: string; days: number; desc: string; have: number; gives: string }[]
}

/** 做饭界面（冰柜 | 这一锅 | 菜谱） */
export interface CookView {
  mouths: number
  ings: { id: string; icon: string; name: string; n: number }[]
  water: number
  herbs: number
  leftovers: { id: string; icon: string; name: string; left: number }[]
  cooking: { who: string; dish: string; p: number } | null
  menu: string
  who: string
  dishes: {
    id: string; icon: string; name: string; hours: number; herbs: number
    need: { icon: string; name: string; per: number; have: number }[]
    fx: { hunger: number; mood: number; energy: number; health: number }
    /** 这一锅能做几人份（不超过家里的人数）；0 = 做不了 */
    servings: number
    short: string[]
  }[]
}

export type MenuCmd = 'feed' | 'hens' | 'bandage' | 'tv' | 'news' | 'cook' | 'eat'
/** 点了能看家当的东西：储藏室的铁架子、木箱、书架（卡通画风） */
function isStorage(o: THREE.Object3D): boolean {
  const id = String(o.userData.slug ?? o.userData.piece ?? '')
  if (/steel_frame_shelves|crate/.test(id)) return true
  return id === 'shelf' && o.position.x > STORE_ROOM.x0 && o.position.z < STORE_ROOM.z1
}

/** 储藏室的家当（点架子弹出来）：一组一组列出来 */
export interface HoldItem { icon: string; name: string; n: string; note?: string; tone?: 'bad' | 'warn' | 'good' }
export interface Holdings { groups: { title: string; items: HoldItem[] }[]; foodDays: number; waterDays: number; mouths: number }

/** 世外桃源画风的火炉（Poly Haven 的芬兰铁皮炉，原大 2.36 米高）缩到多大 */
const HEATER_SCALE = 0.62

/** 家具在菜单标题上叫什么 */
const FURNITURE_NAMES: [RegExp, string][] = [
  [/^plot$/, '菜地'], [/fire_stove|heater/i, '火炉'], [/^tv$|television/i, '电视'], [/stool/i, '小板凳'],
  [/sofa/i, '沙发'], [/bed/i, '床'], [/stove|counter/i, '灶台'], [/fridge/i, '大冰柜'], [/dispenser/i, '饮水机'], [/kettle/i, '水壶'], [/cabinet/i, '柜子'],
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

type ToastKey = `world.plot.${string}` | `world.tv.${string}` | `world.cook.${string}` | `world.eat.${string}` | `world.forage.${string}` | `world.mg.${string}` | `world.dish.${string}` | `world.bandage.${string}` | `world.fire.${string}` | `world.toast.newKind.${string}` | `world.coop.${string}` | 'world.toast.goPet' | 'world.toast.tripCancel' | `world.act.r.${string}` | `world.build.${string}` | `world.phone.${string}` | 'world.courier.express' | 'world.toast.pickCard' | `world.chore.${string}` | `world.search.${string}` | `world.spikes.${string}` | 'world.toast.taken' | 'world.toast.cat' | 'world.toast.parked' | 'world.toast.nightExit' | 'world.toast.noExit' | 'world.toast.drive' | 'world.toast.driveHint' | 'world.toast.stopFirst' | 'world.toast.noDrive' | 'world.toast.moveIn' | 'world.toast.duskRaid' | 'world.toast.siegeTip' | 'world.toast.downTip' | 'world.toast.lowWater' | 'world.toast.lowFood' | 'world.toast.crisisDay' | 'world.toast.dusk' | 'world.toast.duskLowAmmo' | 'world.toast.brute' | 'world.toast.dying' | 'world.toast.died' | 'world.toast.trap' | 'world.courier.guchen' | 'world.courier.shenyan' | 'world.courier.xielin' | 'world.toast.busy' | 'world.toast.fighting' | 'world.toast.noMedkit' | 'world.toast.wall' | 'world.toast.garden' | 'world.toast.guest' | 'world.toast.fish' | 'world.toast.siege' | 'world.toast.crisis' | 'world.toast.won'
  | 'world.toast.lost' | 'world.log.broken.gate' | 'world.log.broken.door' | 'world.log.broken.stairs'

const HEAT_TINT = new THREE.Color('#f3c98a')
const HEAT_SUN = new THREE.Color('#ffd27a')
const COLD_TINT = new THREE.Color('#dde7f1')

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export const EMPTY_HUD: Hud = {
  portraits: {},
  loading: true, mode: 'home', floor: 0, selected: '林知夏', time: '', night: false, rain: 0, crisis: false, crisisKind: null, speed: 1,
  food: 0, water: 0, people: [], toast: '', toastVars: null, ammo: 0, cores: 0, siege: null, log: [], muted: false, music: true, day: 0, hour: 0, money: 0, medkits: 0, fuel: 0, prologue: true, report: null, visit: null, intro: false, space: { food: 0, water: 0, cap: 6 }, molotovs: 0, search: null, garden: { built: false, growth: 0, n: 0, max: 4, plots: [] }, build: [], goals: null, wall: false, hard: false, doom: false, life: 1, over: null, trap: 0, herbs: 0, daysLeft: 0, bamboo: 0, spikes: [0, 0], spikeNext: 0, fishing: { active: false, near: false, caught: 0 }, sleepSkip: false, mg: false, temp: { out: 20, in: 20, ac: false, stove: false },
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
  /** 檐廊的四根柱子 */
  private readonly porchCols: THREE.Object3D[] = []
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
  private purred = false
  /** 跑步机跑带的贴图（有人跑时滚动） */
  private treadmillBelt: THREE.Texture | null = null
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
  /** 菜园：四块地（开了才显示），种什么长什么样，地头有木牌 */
  private readonly gardenView = new GardenView()
  /** 街上能搜的地方头顶的放大镜 */
  private readonly spotMarks: THREE.Sprite[] = SCAVENGE.map((sp) => {
    const m = new THREE.Sprite(bubbleMaterial('🔍'))
    m.position.set(sp.at.x, 1.9, sp.at.z)
    m.scale.setScalar(0.6)
    m.visible = false
    return m
  })
  private frontDoor: THREE.Object3D | null = null
  /** 只在屋外视角显示的东西（贴在前墙上的对联：家里视角前墙压低了） */
  private outsideOnly: THREE.Object3D[] = []
  /** 储藏室里按存货堆的米袋、水、罐头 */
  private stockView: StockView | null = null
  private pantry: PantryView | null = null
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
  private yardMesh: THREE.Mesh | null = null

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
    this.scene.add(this.rain.lines, this.rain.flakes, ...this.spotMarks, this.torch, this.torch.target, this.flies.pts, this.birds.g)
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
    this.scene.add(this.gardenView.group)
    this.forage = new ForageView(this.scene)
    this.buildScavengeHits()
    this.buildWellCoop()
    this.life.onShop = (t) => this.openShop(t)
    this.life.onForage = (s, y, medkit) => {
      this.sound.pluck()
      if (y.sting) { this.sound.buzz(); this.sound.hurt() }
      const vars = { what: s.name, food: y.food.toFixed(1), n: String(this.life.herbs), max: String(HERBS_PER_MEDKIT), have: String(this.life.bamboo) }
      if (medkit) this.toast('world.forage.medkit', 4, vars)
      else this.toast(`world.forage.${y.key}`, 3.5, vars)
    }
    this.siegeView = new SiegeView(this.scene)
    this.life.spawnZombie = (at, raider, brute, kind) => this.siegeView.spawn(at, raider, brute, kind)
    this.life.spawnVisitor = (def, at, model) => {
      const m = this.siegeView.npc(model) ?? this.siegeView.npc(def.model)
      if (m && model === 'xielin') darkCoat(m)
      const v = new Visitor(def, at, m, isFemaleModel(model))
      v.modelId = model || def.model
      this.scene.add(v.root)
      return v
    }
    this.life.spawnCourier = (who, at) => {
      // 快递小哥借用"陌生人"的模型
      const model = this.siegeView.npc(who === 'express' ? 'stranger' : who)
      if (model && who === 'xielin') darkCoat(model)
      const c = new Courier(who, at, model)
      this.scene.add(c.root)
      return c
    }
    this.life.onRemind = (key) => this.toast(key as ToastKey, 6)
    this.life.onGain = (text, who, at) => this.popText(text, who, at)
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
      a.fitness = 45
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
      else if (e.kind === 'trapBroken' || e.kind === 'spikeBroken') this.sound.crash()
      else if (e.kind === 'spike') this.sound.squelch()
      else if (e.kind === 'brute') { this.toast('world.toast.brute', 4); this.sound.groan(1, 0.55) }
      else if (e.kind === 'newKind') { this.toast(`world.toast.newKind.${e.zombie}`, 5); this.sound.groan(1, 0.8) }
      else if (e.kind === 'spit') this.sound.squelch()
      else if (e.kind === 'boom') { this.sound.crash(); this.sound.squelch() }
      else if (e.kind === 'burst') { for (let k = 0; k < 3; k++) setTimeout(() => this.sound.shot(0.8), k * 90) }
      else if (e.kind === 'end') { this.onLinePanel?.(false); this.lineTarget = null }
      else if (e.kind === 'down' && firstTime('down')) this.toast('world.toast.downTip', 6)
      // 守的人在哪一层，镜头就看哪一层（大门破了大家退上二楼守楼梯口；只看一楼的话楼上的人和丧尸都藏起来了）
      // （开打的事件在 Siege 构造时就发了，那时 life.siege 还没赋值，所以看防线耐久）
      // 铁门那一层：拿枪的在二楼阳台上，看二楼（院子在外面，照样看得见）；大门那一层看一楼；楼梯口看二楼
      const fightFloor = () => (this.life.barriers.gate > 0 ? 1 : this.life.barriers.door > 0 ? 0 : 1)
      if (e.kind === 'start') {
        // 第一次打丧尸：顺便教一下能做什么
        if (!e.ambush && firstTime('siege')) this.toast('world.toast.siegeTip', 7)
        else this.toast(e.crisis ? 'world.toast.crisis' : 'world.toast.siege', 4)
        if (this.mode === 'home' && !e.ambush) this.setViewFloor(fightFloor())
      } else if (e.kind === 'broken') {
        this.toast(`world.log.broken.${e.layer}` as ToastKey, 3)
        if (this.mode === 'home' && e.layer === 'gate') this.setViewFloor(0)
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
    this.yardMesh = yard
    this.scene.add(ground, yard)
    // 门前的水泥院坝：从檐廊一直铺到铁门里
    const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.x1 - COURT.x0, COURT.z1 - COURT.z0), toon('#c4beb2', { name: 'concrete' }))
    court.rotation.x = -Math.PI / 2
    court.position.set((COURT.x0 + COURT.x1) / 2, 0.006, (COURT.z0 + COURT.z1) / 2)
    court.receiveShadow = true
    this.scene.add(court)
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
      if (paradise) { this.applyParadise(paradise); this.forage?.useKit(paradise) }
      // 让屋里像个家：地毯、窗帘、画、桌上的花（花瓶放在餐桌桌面上：往下打一条射线找桌面）
      try {
        this.scene.updateMatrixWorld(true)
        const ray = new THREE.Raycaster(new THREE.Vector3(6, 1.4, 2.6), new THREE.Vector3(0, -1, 0), 0, 1.4)
        ray.camera = this.camera // 场景里有精灵（头顶的气泡），没有相机会报错
        const meshes: THREE.Object3D[] = []
        this.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o) })
        const hit = ray.intersectObjects(meshes, false).find((h) => h.point.y > 0.4 && h.point.y < 1.2)
        decorateHouse(this.scene, this.floor2, hit ? hit.point.y : 0.76)
        // 堂屋门口的对联和横批（只在屋外看得见：家里视角下前墙压低了）
        const cp = couplets(FRONT_DOOR.x, FRONT_DOOR.z + 0.13)
        this.scene.add(cp)
        this.outsideOnly.push(cp)
        // 世外桃源画风用分类的铁架子（applyParadise 里摆好了），卡通画风还是码在地上
        if (!this.pantry) this.stockView = new StockView(this.scene, STORE_ROOM)
      } catch (e) {
        // 装饰出问题也不能挡住后面加载人物
        console.warn('decor', e)
      }
      // 江面倒影只画江边的东西（场景都搭好了再标）
      this.river?.limitReflection(this.scene)
      if (people) {
        people.forEach((m, k) => this.actors[k].setModel(m))
        // 女主霰弹枪、妈妈擀面杖、爸爸撬棍：只在打丧尸时拿出来
        const kit = [shotgun(), rollingPin(), crowbar()]
        kit.forEach((w, k) => {
          w.visible = false
          if (this.actors[k].driver?.attach(w, 'RightHand')) { this.weapons.push(w); this.kitOf.set(this.actors[k], w) }
        })
      }
      this.addHearth(paradise)
      this.addLamps()
      this.collectClickables()
      // 大橘：不挡开场，后台加载好了再放到客厅地毯上
      void new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/cat_toon.glb`).then((g) => {
        if (this.disposed) return
        this.cat = new Cat(g.scene, { x: 7.3, z: 3.8, floor: 0 })
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



  /** 两个人走得太近就让一让——只让一个人让：
   *  以前两个人同时往各自右手边让，在桌子和楼梯中间这种窄地方会绕着对方转圈、谁也过不去。
   *  现在按先后（女主 > 你派了事的人 > 有正事的人 > 闲逛的人）定谁让：让的人站一下、往空着的那边挪一步；
   *  两边都没地方挪，就干脆擦身而过（叠一下也比原地跳舞好）。坐着、躺着、正在挪位置的人不动。 */
  private makeWay(): void {
    const R = 0.55
    const list = this.actors.filter((a) => !a.away && !a.settling && a.pose !== 'sleep')
    const heading = (a: Actor) => {
      const n = a.path[0]
      if (!n) return null
      const dx = n.x - a.root.position.x
      const dz = n.z - a.root.position.z
      const d = Math.hypot(dx, dz)
      return d > 1e-3 ? { x: dx / d, z: dz / d } : null
    }
    const rank = (a: Actor) => (a === this.heroine ? 4 : 0) + (a.task?.manual ? 2 : 0)
      + (a.task && a.task.kind !== 'stroll' && a.task.kind !== 'idle' && a.task.kind !== 'relax' ? 1 : 0)
    const free = (a: Actor, x: number, z: number) => !this.navs[a.floor].isBlockedAt(a.root.position.x + x, a.root.position.z + z)
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
        // 一前一后往同一个方向走（比如一起上楼睡觉）：后面的人等一下，排着队走，不往旁边挤
        if (fa && fb && fa.x * fb.x + fa.z * fb.z > 0.5) {
          const behind = (pb.x - pa.x) * fa.x + (pb.z - pa.z) * fa.z > 0 ? a : b
          if (behind.waitT <= 0) behind.waitT = 0.15
          continue
        }
        // 谁让：只有一个人在走，就是走的人绕开站着的人；两个人都在走，排位低的让
        const aYields = !fb ? true : !fa ? false : rank(a) !== rank(b) ? rank(a) < rank(b) : i > j
        const me = aYields ? a : b
        const other = aYields ? b : a
        const f = (aYields ? fa : fb)!
        // 快走到地方了（最后一个路点就在眼前）：不推，不然会绕着站着的人打转、永远到不了
        const last = me.path[me.path.length - 1]
        if (me.path.length === 1 && last && Math.hypot(last.x - me.root.position.x, last.z - me.root.position.z) < R + 0.15) continue
        // 往"离对方远"的那一侧横着挪一步（垂直于自己走的方向）
        const px = -f.z
        const pz = f.x
        const side = Math.sign((me.root.position.x - other.root.position.x) * px + (me.root.position.z - other.root.position.z) * pz) || 1
        const k = (R - d) * 0.6
        const moved = free(me, px * side * k, pz * side * k) ? side : free(me, -px * side * k, -pz * side * k) ? -side : 0
        if (moved) { me.root.position.x += px * moved * k; me.root.position.z += pz * moved * k }
        // 迎面撞上：让的人还要站一下，等对方先过去（两边都挪不开就不等了，直接擦身而过）
        const otherF = aYields ? fb : fa
        if (moved && otherF && f.x * otherF.x + f.z * otherF.z < -0.3 && me.waitT <= 0) me.waitT = 0.35
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
  /** 正在砌 / 已经砌好的石头院墙：一段 1 米，按 wallPieces 的顺序一段一段出现，砌好一段就拆掉那一段围栏 */
  private wallBits: { mesh: THREE.Object3D; fence: THREE.Object3D | null }[] = []
  private wallShown = -1
  /** 每个工地头顶一个进度条 */
  private buildBars = new Map<BuildId, { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; shown: number }>()

  private updateConstruction(): void {
    if (this.hud.loading) return
    const ps = this.life.projects
    const wallJob = ps.find((p) => p.id === 'wall')
    if ((this.life.wall || wallJob) && !this.wallBits.length) this.makeWallPieces()
    if (this.wallBits.length) {
      const n = this.life.wall ? this.wallBits.length : wallJob ? Math.floor(wallJob.done * this.wallBits.length) : 0
      if (n !== this.wallShown) {
        this.wallShown = n
        this.wallBits.forEach((w, k) => {
          w.mesh.visible = k < n
          if (w.fence) w.fence.visible = k >= n
        })
      }
    }
    // 进度条：每个工地一个，跟着工地走（院墙是正在砌的那一段）
    for (const [id, bar] of this.buildBars) bar.sprite.visible = ps.some((p) => p.id === id)
    for (const p of ps) {
      let bar = this.buildBars.get(p.id)
      if (!bar) { bar = this.makeBuildBar(); this.buildBars.set(p.id, bar) }
      bar.sprite.visible = true
      const pct = Math.floor(p.done * 100)
      if (pct !== bar.shown) {
        bar.shown = pct
        const c = bar.ctx
        c.clearRect(0, 0, 256, 64)
        c.fillStyle = 'rgba(20,16,12,0.82)'
        c.beginPath(); c.roundRect(2, 2, 252, 60, 14); c.fill()
        c.fillStyle = 'rgba(255,255,255,0.15)'
        c.fillRect(16, 38, 224, 12)
        c.fillStyle = TONE[pct < 34 ? 'bad' : pct < 67 ? 'warn' : 'good']
        c.fillRect(16, 38, (224 * pct) / 100, 12)
        c.fillStyle = '#f4ecdc'
        c.font = 'bold 22px "Songti SC", serif'
        c.textAlign = 'center'
        c.fillText(`${t(`world.build.name.${p.id}` as UiKey)} ${pct}%`, 128, 28)
        bar.tex.needsUpdate = true
      }
      let at: THREE.Vector3
      if (p.id === 'garden') { const g = PLOT_SLOTS[Math.max(0, this.life.nextPlot)]; at = new THREE.Vector3((g.x0 + g.x1) / 2, 1.6, (g.z0 + g.z1) / 2) }
      else if (p.id === 'trap') at = new THREE.Vector3(4, 1.7, 14.6)
      else {
        const all = wallPieces()
        const w = all[Math.min(all.length - 1, Math.floor(p.done * all.length))]
        at = new THREE.Vector3(w.x, 2.6, w.z)
      }
      bar.sprite.position.copy(at)
    }
  }

  private makeBuildBar(): { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; shown: number } {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    sprite.scale.set(2.2, 0.55, 1)
    sprite.renderOrder = 10
    this.scene.add(sprite)
    return { sprite, ctx, tex, shown: -1 }
  }

  private makeWallPieces(): void {
    const mat = this.pmats?.textured('stone') ?? toon(COLORS.stone)
    const cap = this.pmats?.textured('trim') ?? toon(COLORS.wall)
    const H = 1.9
    const body = new THREE.BoxGeometry(1.02, H, 0.3)
    body.translate(0, H / 2, 0)
    const top = new THREE.BoxGeometry(1.08, 0.1, 0.4)
    top.translate(0, H + 0.05, 0)
    for (const g of [body, top]) boxProjectUV(g)
    const fenceAt = new Map(this.fences.map((f) => [`${f.position.x.toFixed(2)},${f.position.z.toFixed(2)}`, f]))
    for (const w of wallPieces()) {
      const holder = new THREE.Group()
      holder.position.set(w.x, 0, w.z)
      if (w.axis === 'z') holder.rotation.y = Math.PI / 2
      const a = new THREE.Mesh(body, mat)
      const b = new THREE.Mesh(top, cap)
      for (const m of [a, b]) { m.castShadow = true; m.receiveShadow = true }
      holder.add(a, b)
      holder.visible = false
      // 靠近镜头的南墙、东墙在家里视角下跟着矮墙压低
      if (w.stand.face === 0 || w.stand.face === 90) this.nearWalls.push(holder)
      this.scene.add(holder)
      this.wallBits.push({ mesh: holder, fence: fenceAt.get(`${w.x.toFixed(2)},${w.z.toFixed(2)}`) ?? null })
    }
  }

  private spikeMeshes: THREE.Group[] = []

  /** 两排削尖的竹子：一根横竹竿绑着一排斜插的尖竹，像拒马（游戏镜头很高，做粗一点、颜色亮一点才看得见） */
  private makeSpikes(): THREE.Group[] {
    const cane = new THREE.MeshStandardMaterial({ color: '#e0c77e', roughness: 0.7, flatShading: true })
    const rope = new THREE.MeshStandardMaterial({ color: '#7a5a34', roughness: 0.9 })
    const stake = new THREE.ConeGeometry(0.065, 1.0, 6)
    stake.translate(0, 0.5, 0)
    return SPIKE_ROWS.map((r, k) => {
      const g = new THREE.Group()
      const len = r.x1 - r.x0
      const cols = Math.round(len / 0.28)
      const mz = (r.z0 + r.z1) / 2
      for (let i = 0; i < cols; i++) {
        const m = new THREE.Mesh(stake, cane)
        m.position.set(r.x0 + 0.14 + i * ((len - 0.28) / Math.max(1, cols - 1)), 0, mz + (i % 2 ? 0.12 : -0.12))
        // 尖朝南（朝着冲进来的丧尸）斜着，左右稍微错开
        m.rotation.set(0.45 + (i % 3) * 0.05, 0, ((i % 3) - 1) * 0.07)
        m.castShadow = true
        g.add(m)
      }
      // 横着绑的竹竿（最后加，不算在"还立着几根"里）
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6), cane)
      pole.rotation.z = Math.PI / 2
      pole.position.set((r.x0 + r.x1) / 2, 0.32, mz + 0.1)
      pole.castShadow = true
      pole.userData.keep = true
      g.add(pole)
      for (let i = 0; i < 4; i++) {
        const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), rope)
        tie.rotation.z = Math.PI / 2
        tie.position.set(r.x0 + 0.3 + i * ((len - 0.6) / 3), 0.32, mz + 0.1)
        tie.userData.keep = true
        g.add(tie)
      }
      g.name = `spikes${k}`
      this.scene.add(g)
      return g
    })
  }

  craftSpikes(): void {
    const r = this.life.craftSpikes()
    const who = this.actors.find((a) => a.task?.kind === 'craft')?.name ?? ''
    this.toast(`world.spikes.${r}`, 3.5, { n: String(Household.SPIKE_BAMBOO), have: String(this.life.bamboo), who })
    this.pushLifeHud()
  }

  /** 建设：付钱、派选中的人（干不了就换家里会修东西的人）走过去真的干活 */
  startBuild(id: BuildId): void {
    const r = this.life.startBuild(id, this.selected)
    const who = this.life.projects.find((p) => p.id === id)?.worker ?? this.selected.name
    this.toast(`world.build.r.${r}`, 4, { who, what: t(`world.build.name.${id}` as UiKey), h: String(BUILD_WORK[id]) })
    this.pushLifeHud()
  }

  /** 工程停了：让选中的人接着干 */
  continueBuild(id: BuildId): void {
    const r = this.life.continueBuild(id, this.selected)
    if (r !== 'none') this.toast(`world.build.r.resume.${r}`, 3, { who: this.selected.name })
    this.pushLifeHud()
  }

  buildGateTrap(): void { this.startBuild('trap') }
  buildYardWall(): void { this.startBuild('wall') }
  buildGardenPlot(): void { this.startBuild('garden') }
  buildMachineGun(): void { this.startBuild('mg') }

  /** 防线面板里点"机枪扫射" */
  machineGun(): void {
    const s = this.life.siege
    if (!s || s.done) return
    const r = s.machineGun()
    if (r.r !== 'ok') this.toast(`world.mg.r.${r.r}`, 2.5)
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
      const m = this.siegeView.npc(c.who === 'express' ? 'stranger' : c.who)
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
    // 地砖：一层一个实例化网格（两百多块砖一块一次绘制太费）
    const tiles0: [number, number][] = []
    const tiles1: [number, number][] = []
    for (let i = HOUSE.x0; i < HOUSE.x1; i++)
      for (let j = HOUSE.z0; j < HOUSE.z1; j++) {
        tiles0.push([i + 0.5, j + 0.5])
        if (!hole(i + 0.5, j + 0.5)) tiles1.push([i + 0.5, j + 0.5])
      }
    for (let i = PORCH.x0; i < PORCH.x1; i++)
      for (let j = PORCH.z0; j < PORCH.z1; j++) { tiles0.push([i + 0.5, j + 0.5]); tiles1.push([i + 0.5, j + 0.5]) }
    this.scene.add(...this.tileFloor(kit, tiles0, 0))
    this.floor2.add(...this.tileFloor(kit, tiles1, FLOOR_H))
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
    // 堂屋双开门：两扇门板各有自己的门轴（左边那扇往里开时转负角，右边那扇转正角）
    const door = new THREE.Group()
    door.position.set(FRONT_DOOR.x, 0, FRONT_DOOR.z)
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group()
      hinge.position.x = side * 0.95
      hinge.add(box(0.92, 2.05, 0.06, COLORS.woodDark, [-side * 0.46, 0, 0]))
      hinge.userData.sign = side
      door.add(hinge)
    }
    this.nearWalls.push(door)
    this.frontDoor = door
    this.scene.add(door)
    // 退到楼梯时堆在楼梯口的箱子（平时藏着）
    const pile = new THREE.Group()
    pile.add(
      box(0.5, 0.55, 0.45, COLORS.wood, [4.62, 0, -0.75]),
      box(0.5, 0.55, 0.45, COLORS.wood, [4.62, 0, -0.25]),
      box(0.45, 0.45, 0.45, COLORS.woodDark, [4.62, 0.55, -0.5]),
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
    // 檐廊：地砖、四根柱子；二楼阳台：楼板、地砖、栏杆（柱子和栏杆在家里视角下跟着矮墙压低）
    slab(PORCH.x0, PORCH.z0, PORCH.x1, PORCH.z1)
    for (const x of [PORCH.x0 + 0.15, (PORCH.x0 + PORCH.x1) / 2 - 2, (PORCH.x0 + PORCH.x1) / 2 + 2, PORCH.x1 - 0.15]) {
      // 家里视角看一楼时整根藏起来（压低成矮桩会变成檐廊边上一排白方块）；看二楼、在外面时照常立着撑阳台
      const col = box(0.24, FLOOR_H - 0.3, 0.24, COLORS.wall, [x, 0, PORCH.z1 - 0.15])
      this.porchCols.push(col)
      this.scene.add(col)
    }
    const rail = new THREE.Group()
    rail.add(
      box(PORCH.x1 - PORCH.x0, 0.07, 0.08, COLORS.woodDark, [(PORCH.x0 + PORCH.x1) / 2, 0.98, PORCH.z1 - 0.1]),
      box(0.08, 0.07, PORCH.z1 - PORCH.z0, COLORS.woodDark, [PORCH.x0 + 0.05, 0.98, (PORCH.z0 + PORCH.z1) / 2]),
      box(0.08, 0.07, PORCH.z1 - PORCH.z0, COLORS.woodDark, [PORCH.x1 - 0.05, 0.98, (PORCH.z0 + PORCH.z1) / 2]),
    )
    for (let x = PORCH.x0 + 0.05; x <= PORCH.x1; x += 0.5) rail.add(box(0.05, 0.98, 0.05, COLORS.woodDark, [x, 0, PORCH.z1 - 0.1]))
    for (let z = PORCH.z0 + 0.5; z < PORCH.z1; z += 0.5) {
      rail.add(box(0.05, 0.98, 0.05, COLORS.woodDark, [PORCH.x0 + 0.05, 0, z]), box(0.05, 0.98, 0.05, COLORS.woodDark, [PORCH.x1 - 0.05, 0, z]))
    }
    rail.position.y = FLOOR_H
    this.nearWalls.push(rail)
    this.floor2.add(rail)
    // 平顶（女儿墙、水塔）
    const { root, mats } = flatRoof(w, d, FLOOR_H * 2 - 0.2)
    root.position.set(HOUSE.x0 + w / 2, 0, HOUSE.z0 + d / 2)
    this.roof = root
    this.roofMats = mats
    this.scene.add(this.floor2, root)
  }

  /** 一层的地砖：把 floor_1x1 组件里的每个网格做成一个实例化网格，摆到每一格上 */
  /** 一层楼的地砖：每块地砖并成一个网格（一次绘制）。不用实例化：换成 Poly Haven 木地板时
   * 贴图按世界坐标铺（米为单位），并成一块才是连着的木纹；实例化的每块都会贴同一小片，看着像瓷砖 */
  private tileFloor(kit: Map<string, THREE.Object3D>, cells: [number, number][], y: number): THREE.Mesh[] {
    const src = kit.get('floor_1x1')
    if (!src || !cells.length) return []
    src.updateMatrixWorld(true)
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert()
    const out: THREE.Mesh[] = []
    src.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const local = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)
      const at = new THREE.Matrix4()
      const geos = cells.map(([x, z]) => m.geometry.clone().applyMatrix4(at.makeTranslation(x, y, z).multiply(local)))
      const merged = mergeGeometries(geos, false)
      for (const g of geos) g.dispose()
      if (!merged) return
      const mesh = new THREE.Mesh(merged, m.material)
      mesh.receiveShadow = true
      mesh.name = m.name
      out.push(mesh)
    })
    return out
  }

  private furniture(p: Placement, kit: Map<string, THREE.Object3D>,
    place: (n: string, x: number, y: number, z: number, r: number) => THREE.Object3D): THREE.Object3D {
    const y = p.floor * FLOOR_H
    if (kit.has(p.piece)) {
      const o = place(p.piece, p.x, y, p.z, p.rot)
      o.userData.piece = p.piece
      if (p.toonOnly) o.userData.toonOnly = true
      return o
    }
    const made: Record<string, () => THREE.Object3D> = {
      sofa, counter, fridge: freezer, desk, shelf, wall_map: parchmentMap, stairs: () => stairs(FLOOR_H), treadmill,
      fire_stove: ironStove, stool, dispenser: waterDispenser,
      tv: () => {
        const g = new THREE.Group()
        const crt = crtTv()
        crt.position.y = TV_STAND_H
        g.add(tvStand(), crt)
        g.userData.crt = crt
        return g
      },
    }
    const obj = made[p.piece]?.() ?? box(0.5, 0.5, 0.5, '#ff00ff')
    obj.userData.piece = p.piece
    if (obj.userData.lid) this.freezerLid = obj.userData.lid as THREE.Object3D
    if (obj.userData.belt) this.treadmillBelt = obj.userData.belt as THREE.Texture
    if (p.toonOnly) obj.userData.toonOnly = true
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
    const trees: [number, number, number][] = [[-2.4, -1.6, 0.85], [6, -5.6, 0.8], [-2.6, 9.8, 0.9], [-9, 12.5, 1.0], [17.2, -6.3, 0.95], [-15, -3, 0.9]]
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
      // 卡通画风才有的（储藏室的木箱和书架、几张卡通床）：这边换成了别的家具
      if (o.userData.toonOnly) { doomed.push(o); return }
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
        // 乡下的厨房：左边碗柜，右边一口砖砌的土灶（大铁锅、烟囱顺着墙上去），灶台上一把老水壶
        const stove = woodStove(this.pmats)
        stove.position.set(o.position.x + 0.55, y, o.position.z)
        // 灶台点得到（点了弹出菜单选做什么菜）
        stove.userData.slug = 'wood_stove'
        o.parent?.add(
          placeModel(kit, 'painted_wooden_cabinet', o.position.x - 0.7, y, o.position.z, 0),
          stove,
          placeModel(kit, 'vintage_electric_kettle', o.position.x - 0.35, y + 0.86, o.position.z - 0.05, 30, 0.8),
        )
        doomed.push(o)
      } else if (piece === 'bed') {
        doomed.push(o)
      } else if (piece === 'tv') {
        // 电视柜留着，上面换成真的老电视
        const crt = o.userData.crt as THREE.Object3D | undefined
        if (crt) doomed.push(crt)
        o.add(placeModel(kit, 'television_02', 0, TV_STAND_H, 0, 0, 1.25))
      } else if (piece === 'fire_stove') {
        const m = placeModel(kit, 'scandinavian_masonry_heater', o.position.x, y, o.position.z, rot, HEATER_SCALE)
        m.userData.slug = 'fire_stove'
        o.parent?.add(m)
        doomed.push(o)
      } else if (piece === 'stool') {
        // 原模型是个 27 厘米宽、18 厘米高的小矮凳：放大到 44 厘米高能坐，宽窄少放大一点（不然成了长条凳）
        const m = placeModel(kit, 'wooden_stool_02', o.position.x, y, o.position.z, rot)
        m.scale.set(1.9, 2.4, 1.9)
        o.parent?.add(m)
        doomed.push(o)
      }
    })
    visit(this.scene)
    for (const o of doomed) o.removeFromParent()
    // 画风特有的家具（含二楼三张复古坐卧床）和院子里的小物件
    const proc: Record<string, () => THREE.Object3D> = { platform_bed: platformBed, camp_bed: campBed, iron_bedding: ironBedBedding, blocker: () => new THREE.Group() }
    for (const p of PARADISE_EXTRAS) {
      const y = p.floor * FLOOR_H + (p.y ?? 0)
      let m: THREE.Object3D
      if (proc[p.piece]) {
        m = proc[p.piece]()
        m.position.set(p.x, y, p.z)
        m.rotation.y = THREE.MathUtils.degToRad(p.rot)
        if (p.piece !== 'blocker') m.userData.slug = p.piece
      } else if (p.variant !== undefined) {
        // 模型里并排的几个品种只要一个
        const v = variants(kit.models.get(p.piece)!)[p.variant]
        m = new THREE.Group()
        for (const part of v.parts) {
          const mesh = new THREE.Mesh(part.geo, part.mat)
          mesh.castShadow = true
          mesh.receiveShadow = true
          m.add(mesh)
        }
        m.position.set(p.x, y, p.z)
        m.rotation.y = THREE.MathUtils.degToRad(p.rot)
        m.scale.setScalar(p.scale ?? 1)
        m.userData.slug = p.piece
      } else m = placeModel(kit, p.piece, p.x, y, p.z, p.rot, p.scale ?? 1)
      ;(p.floor === 1 ? this.floor2 : this.scene).add(m)
    }
    // 储藏室：东西按种类摆在铁架子上（代替满地的小方块）
    try {
      this.pantry = new PantryView(this.scene, kit)
    } catch (e) {
      console.warn('pantry', e)
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
    this.heroine = new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 6.5, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 })
    const mom = new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 5.3, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 })
    const dad = new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 7.0, z: 1.5 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 })
    this.heroine.weapon = 'shotgun'
    // 女主是异能者：精力、体能都远超常人
    this.heroine.esper = true
    this.heroine.fitness = 80
    this.heroine.model = 'heroine'
    mom.weapon = 'pin'
    mom.model = 'mom'
    dad.weapon = 'crowbar'
    dad.handy = true
    dad.model = 'dad'
    // 体能：爸爸干惯了体力活，妈妈弱一点
    mom.fitness = 25
    dad.fitness = 40
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

  // --- 电视、火炉、发电机、空调 ----------------------------------------------------

  private tvScreen: TvScreen | null = null
  private fireGlow: FireGlow | null = null
  private readonly appliances = { generator: [] as THREE.Object3D[], aircon: [] as THREE.Object3D[] }

  /** 电视屏幕、炉门的火光、烟囱；买回来才露出来的发电机和空调（先摆好藏着） */
  private addHearth(kit: ParadiseKit | null): void {
    const real = !!kit
    // 屏幕：贴在电视屏幕前面一点（真模型的屏幕偏上、外壳更深）
    const scr = new TvScreen(real ? 0.34 : 0.36, real ? 0.26 : 0.28)
    scr.mesh.position.set(TV.x + (real ? -0.012 : -0.03), TV_STAND_H + (real ? 0.31 : 0.21), TV.z + (real ? 0.226 : 0.202))
    scr.light.position.set(TV.x, TV_STAND_H + 0.35, TV.z + 0.7)
    this.scene.add(scr.mesh, scr.light)
    this.tvScreen = scr
    // 火炉：炉门朝西南（对着镜头和两个小板凳）
    const a = THREE.MathUtils.degToRad(-45)
    const r = real ? 0.37 : 0.325
    const glow = new FireGlow(0.2, real ? 0.17 : 0.16)
    glow.group.position.set(HEARTH.x + Math.sin(a) * r, 0.42, HEARTH.z + Math.cos(a) * r)
    glow.group.rotation.y = a
    this.scene.add(glow.group)
    this.fireGlow = glow
    const pipe = flue(real ? 2.36 * HEATER_SCALE - 0.04 : 1.12, FLOOR_H - 0.4)
    pipe.position.set(HEARTH.x, 0, HEARTH.z)
    this.scene.add(pipe)
    // 发电机放在储藏室东墙外；空调外机贴着东墙，室内机挂在堂屋东墙上
    const gen = real ? placeModel(kit, 'portable_generator', GENERATOR_AT.x, 0, GENERATOR_AT.z, 90) : generatorBox()
    if (!real) { gen.position.set(GENERATOR_AT.x, 0, GENERATOR_AT.z); gen.rotation.y = Math.PI / 2 }
    let out: THREE.Object3D
    if (real) {
      out = new THREE.Group()
      for (const part of variants(kit.models.get('exterior_aircon_unit')!)[0].parts) {
        const mesh = new THREE.Mesh(part.geo, part.mat)
        mesh.castShadow = true
        mesh.receiveShadow = true
        out.add(mesh)
      }
    } else out = box(0.8, 0.6, 0.3, '#d9d9d4', [0, 0.3, 0])
    out.position.set(AIRCON_OUT.x, 0, AIRCON_OUT.z)
    out.rotation.y = Math.PI / 2
    const inner = acIndoor()
    inner.position.set(AIRCON_IN.x, AIRCON_IN.y, AIRCON_IN.z)
    inner.rotation.y = -Math.PI / 2
    for (const o of [gen, out, inner]) { o.visible = false; this.scene.add(o) }
    this.appliances.generator.push(gen)
    this.appliances.aircon.push(out, inner)
  }

  /** 大冰柜的盖子：有人在冰柜前拿东西时掀开 */
  private freezerLid: THREE.Object3D | null = null
  private lidOpen = 0

  private updateHearth(dt: number): void {
    const l = this.life
    if (this.freezerLid) {
      const using = this.actors.some((a) => a.task?.kind === 'plate' && a.task.phase !== 'go')
      this.lidOpen = THREE.MathUtils.damp(this.lidOpen, using ? 1 : 0, 6, dt)
      this.freezerLid.rotation.x = -this.lidOpen * 1.15
    }
    this.tvScreen?.update(dt, l.tvOn ? (l.clock.day < PROLOGUE_DAYS ? 'tv' : 'radio') : 'off')
    this.fireGlow?.update(dt, l.fireLit)
    // 发电机开着（末日后看电视、开空调）：机身一直轻轻地抖
    const running = l.generator && l.clock.day >= PROLOGUE_DAYS && l.fuel > 0 && (l.tvOn || l.acOn)
    for (const o of this.appliances.generator) {
      o.visible = l.generator
      o.position.y = running ? Math.abs(Math.sin(this.elapsed * 47)) * 0.008 : 0
      o.rotation.z = running ? Math.sin(this.elapsed * 31) * 0.006 : 0
    }
    for (const o of this.appliances.aircon) o.visible = l.aircon
  }

  /** 做饭界面要的东西：冰柜里的食材和做好的饭菜、菜谱（每道够做几份、缺什么）、谁在做 */
  cookView(): CookView {
    this.onFurnitureMenu?.(null)
    const l = this.life
    const mouths = l.mouths
    const cook = l.cooking
    const dname = (id: string) => t(`world.dish.${id}` as UiKey)
    return {
      mouths,
      ings: INGS.map((k) => ({ id: k, icon: ING_INFO[k].icon, name: ING_INFO[k].name, n: l.ingHave(k) })),
      water: l.available.water,
      herbs: l.herbs,
      leftovers: l.fridge.map((p) => ({ id: p.dish, icon: dishOf(p.dish).icon, name: dname(p.dish), left: p.left })),
      cooking: cook ? { who: cook.name, dish: dname(cook.task?.dish ?? 'rice'), p: cook.task?.phase === 'use' ? 1 - Math.max(0, cook.task.hours) / Math.max(0.01, dishOf(cook.task.dish).hours * (0.7 + 0.1 * (cook.task.servings ?? mouths))) : 0 } : null,
      menu: l.menu,
      who: this.selected.name,
      dishes: DISHES.map((d) => {
        const max = l.maxServings(d.id)
        const need = [
          ...(d.any ? [{ icon: '🧺', name: '剩下的随便什么', per: d.any, have: INGS.reduce((m, k) => m + l.ingHave(k), 0) }] : []),
          ...INGS.filter((k) => d.use[k]).map((k) => ({ icon: ING_INFO[k].icon, name: ING_INFO[k].name, per: d.use[k]!, have: l.ingHave(k) })),
          ...(d.water ? [{ icon: '💧', name: '水', per: d.water, have: l.available.water }] : []),
        ]
        const short = need.filter((x) => x.have + 1e-6 < x.per).map((x) => x.name)
        if (d.herbs && l.herbs < d.herbs) short.push('草药')
        return {
          id: d.id, icon: d.icon, name: dname(d.id), need, herbs: d.herbs, hours: +(d.hours * (0.7 + 0.1 * Math.min(mouths, Math.max(1, max)))).toFixed(1),
          fx: { hunger: d.hunger, mood: d.mood, energy: d.energy, health: d.health },
          servings: Math.min(mouths, max), short,
        }
      }),
    }
  }

  /** 储藏室里都有什么（点铁架子看） */
  holdings(): Holdings {
    const l = this.life
    const f1 = (n: number) => (Math.round(n * 10) / 10).toString()
    const mouths = l.mouths
    const foodDays = (l.stock.food + l.fridgeLeft + l.space.food) / mouths
    const waterDays = (l.stock.water + l.space.water) / mouths
    const tone = (d: number): HoldItem['tone'] => (d < 3 ? 'bad' : d < 7 ? 'warn' : 'good')
    const own = (has: boolean, icon: string, name: string, note: string): HoldItem[] => (has ? [{ icon, name, n: '✓', note }] : [])
    l.syncLarder()
    return {
      mouths, foodDays, waterDays,
      groups: [
        {
          title: `吃的（大冰柜）· 够全家吃 ${Math.floor(foodDays)} 天`,
          items: [
            ...INGS.map((k) => ({ icon: ING_INFO[k].icon, name: ING_INFO[k].name, n: f1(l.larder[k]) })),
            ...l.fridge.map((p) => ({ icon: dishOf(p.dish).icon, name: `做好的${t(`world.dish.${p.dish}` as UiKey)}`, n: `${Math.floor(p.left)} 份` })),
          ],
        },
        { title: `喝的 · 够全家喝 ${Math.floor(waterDays)} 天`, items: [{ icon: '💧', name: '饮用水（水桶、水缸）', n: f1(l.stock.water), tone: tone(waterDays) }] },
        {
          title: '药',
          items: [
            { icon: '🩹', name: '急救包', n: String(l.medkits), tone: l.medkits < 1 ? 'bad' : l.medkits < 2 ? 'warn' : 'good' },
            { icon: '🌿', name: '草药', n: String(l.herbs), note: '3 份草药能做一个急救包' },
          ],
        },
        {
          title: '防身',
          items: [
            { icon: '🔫', name: '霰弹', n: `${l.ammo.n} 发`, tone: l.ammo.n < 6 ? 'bad' : l.ammo.n < 12 ? 'warn' : 'good' },
            { icon: '🍾', name: '燃烧瓶', n: String(l.molotovs) },
            { icon: '🎋', name: '竹竿', n: String(l.bamboo), note: '爸爸能削成竹尖刺' },
            ...own(l.crossbow, '🏹', '复合弩', '没声音，箭能捡回来'),
            ...own(l.helmet, '⛑️', '防暴头盔', '被咬少掉一半血'),
            ...own(l.trap.hp > 0, '🪤', '铁门外的钉板', `还剩 ${Math.round(l.trap.hp)}%`),
            ...own(l.mg, '🔥', '阳台机枪', '打仗时点防线扫射'),
          ],
        },
        {
          title: '车和家电',
          items: [
            { icon: '⛽', name: '汽油', n: `${f1(l.fuel)} 桶`, note: '开车出门一趟 0.2 桶', tone: l.fuel < 0.2 ? 'bad' : l.fuel < 1 ? 'warn' : 'good' },
            ...own(l.generator, '🔌', '汽油发电机', '末日后电视、空调靠它'),
            ...own(l.aircon, '❄️', '空调', '高温天用'),
          ],
        },
        { title: '钱', items: [{ icon: '💰', name: '存款', n: `${l.money.toLocaleString()} 元` }, { icon: '💎', name: '晶核', n: String(l.cores) }] },
        { title: `空间里（女主的异能，只放主食和水，能放 ${l.spaceCap} 份）`, items: [{ icon: '🍚', name: '吃的', n: f1(l.space.food) }, { icon: '💧', name: '水', n: f1(l.space.water) }] },
      ],
    }
  }

  /** 点了一块菜地：种的什么、长到哪了、能干什么、家里有哪些种子 */
  plotView(i: number): PlotView {
    const l = this.life
    const p = l.plots[i]
    const c = cropOf(p.crop)
    return {
      i, who: (this.mode === 'home' ? this.selected : this.heroine).name,
      crop: c ? { icon: c.icon, name: c.name, p: Math.round(p.growth * 100), ripe: p.growth >= 1, watered: p.watered === l.clock.day } : null,
      water: l.available.water,
      seeds: CROPS.map((x) => ({ id: x.id, icon: x.icon, name: x.name, days: x.days, desc: x.desc, have: l.seeds[x.id] ?? 0,
        gives: [x.gives.veg ? `菜 ${x.gives.veg}` : '', x.gives.grain ? `主食 ${x.gives.grain}` : '', x.gives.herbs ? `草药 ${x.gives.herbs}` : ''].filter(Boolean).join('、') })),
    }
  }

  /** 菜地界面点了：种什么 / 浇水 / 收菜 / 拔掉 */
  plotCommand(i: number, act: 'plant' | 'water' | 'harvest' | 'clear', crop?: CropId): string {
    const who = this.mode === 'home' ? this.selected : this.heroine
    const r = this.life.commandPlot(who, i, act, crop)
    if (r !== 'ok' || act !== 'clear') this.toast(`world.plot.r.${r}`, 3, { who: who.name })
    this.pushLifeHud()
    return r
  }

  /** 做饭界面点了"开始做" */
  cookAction(id: string): string {
    const r = this.life.cookPot(this.mode === 'home' ? this.selected : this.heroine, id)
    const who = this.life.cooking
    if (r === 'ok' && who) this.toast(`world.cook.r.${r}`, 3, { who: who.name, dish: t(`world.dish.${id}` as UiKey) })
    this.pushLifeHud()
    return r
  }

  /** 电视里在说什么（点电视选"听新闻"） */
  newsView(): NewsView {
    this.onFurnitureMenu?.(null)
    return this.life.news()
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
    room(6, 1.6, 2.6, 5.5, 0) // 堂屋吊灯
    room(2.0, 2.1, -1.0, 3.5, 0) // 厨房
    room(2.0, 2.1, 4.2, 2.5, 0) // 爸妈卧室
    room(6.0, FLOOR_H + 2.0, 3.0, 3.5, 1) // 二楼小客厅
    room(2.0, FLOOR_H + 2.0, 3.8, 4.0, 1) // 林知夏的房间
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
    // 高温：天和雾泛黄、太阳更毒；寒潮、极寒：天发白发蓝、太阳没劲
    const ext = extremeOf(this.life.clock.day)
    if (ext) {
      const tint = ext === 'heat' ? HEAT_TINT : COLD_TINT
      const k = (ext === 'frost' ? 0.5 : ext === 'heat' ? 0.5 : 0.35) * (1 - s.night * 0.7)
      if (this.scene.background instanceof THREE.Color) this.scene.background.lerp(tint, k)
      this.scene.fog?.color.lerp(tint, k)
      this.sun.intensity *= ext === 'heat' ? 1.15 : 0.75
      if (ext === 'heat') this.sun.color.lerp(HEAT_SUN, 0.4 * (1 - s.night))
    }
    // 寒潮、极寒：地上结霜（草地泛白）；白天亮一点，夜里不发光
    const frost = ext === 'frost' ? 0.42 : ext === 'cold' ? 0.22 : 0
    for (const m of [this.groundMesh, this.yardMesh]) {
      const mat = m?.material as THREE.MeshStandardMaterial | undefined
      if (mat?.emissive) mat.emissive.setRGB(0.62, 0.68, 0.74).multiplyScalar(frost * (1 - s.night * 0.85))
    }
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
    // 家里的镜头固定看着房子（WASD 自己挪），不再跟着选中的人晃——一家人走来走去、互相让路时整个画面会跟着抖
    const t = new THREE.Vector3(HOUSE_CENTER.x, baseY, HOUSE_CENTER.z)
    // 打丧尸时镜头对着正在守的那一层
    const layer = this.life?.siege && !this.life.siege.done ? this.life.siege.current : null
    if (layer) {
      const focus = layer.id === 'gate' ? [4, 12] : layer.id === 'door' ? [6, 6.8] : [5.4, -0.4]
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
    for (const o of this.outsideOnly) o.visible = h < 0.5
    if (this.roof) {
      this.roof.visible = h < 0.98
      for (const m of this.roofMats) {
        m.transparent = h > 0.02
        m.opacity = 1 - h
        m.depthWrite = h < 0.5
      }
    }
    const stub = THREE.MathUtils.lerp(1, STUB, h)
    // 看二楼时一楼的墙不压低（不然从二楼楼板边上能斜着看进一楼，看见一楼的架子、人）
    for (const w of this.nearWalls) w.scale.y = this.viewFloor === 1 && this.floorOf(w) === 0 ? 1 : stub
    for (const c of this.porchCols) c.visible = h < 0.5 || this.viewFloor === 1
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
    this.life.tick(raw, (a) => this.life.isHomeBody(a) && !(a === this.heroine && (this.keysMoving || !!this.driving)))
    this.updateSleepSkip()
    const fighting = !!this.life.siege && !this.life.siege.done
    // 打起来了还在车上：先下车
    if (this.driving && (fighting || this.life.onTrip(this.heroine))) this.exitVan(true)
    if (this.driving) this.updateDriving(Math.min(sim, dt * 1.5))
    else { this.keysMoving = false; this.updateCameraKeys(dt) }
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
    this.updateConstruction()
    this.updateMgNest()
    this.updateHearth(dt)
    this.updateTargetRing()
    this.updatePops(dt)
    // 菜园：开地的时候先翻土再围木板；种的菜跟着长势长高
    const digging = this.life.projects.find((p) => p.id === 'garden')?.done ?? -1
    this.gardenView.update(this.life.plots, this.life.nextPlot, digging, this.life.clock.day, this.elapsed)
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
    const laying = this.life.projects.find((p) => p.id === 'trap')?.done ?? -1
    if ((this.life.trap.hp > 0 || laying >= 0) && !this.trapMesh && !this.hud.loading) {
      this.trapMesh = this.makeTrap()
      this.scene.add(this.trapMesh)
    }
    if (this.trapMesh) {
      this.trapMesh.visible = this.life.trap.hp > 0 || laying >= 0
      // 铺的时候一块一块出现：五块钉板、钉子、两根木桩、最后拉上铁丝网
      const kids = this.trapMesh.children
      kids.forEach((c, k) => { c.visible = this.life.trap.hp > 0 || laying >= (k + 1) / (kids.length + 1) })
    }
    // 竹尖刺：每一排按还能扎几只，显示还立着的几根
    if (!this.spikeMeshes.length && !this.hud.loading) this.spikeMeshes = this.makeSpikes()
    this.life.spikes.forEach((r, k) => {
      const g = this.spikeMeshes[k]
      if (!g) return
      const stakes = g.children.filter((c) => !c.userData.keep)
      const n = Math.ceil((r.hits / SPIKE.hits) * stakes.length)
      stakes.forEach((c, i) => { c.visible = i < n })
      g.visible = r.hits > 0
    })
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
    this.rain.update(Math.min(sim, 0.1), this.pose.target, rainNow, this.life.outTemp < 0)
    this.sound.ambience(this.nightness, !fighting, rainNow)
    this.updateLooks()
    for (const a of this.actors) {
      let walking = a === this.heroine && this.keysMoving
      let gliding = false
      for (let left = sim; left > 1e-6; left -= 0.05) {
        const step = Math.min(left, 0.05)
        // 正在给别人让路：站一下再走
        if (a.waitT > 0) a.waitT -= step
        else walking = a.follow(step, WALK_SPEED) || walking
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
        else if (p.task.phase === 'use') {
          cat.hearts = Math.max(cat.hearts, 0.3)
          cat.stay(3)
          // 摸上了：呼噜呼噜
          if (!this.purred) { this.purred = true; this.sound.purr() }
        }
      }
      // 跑步机：有人在上面跑，跑带往后滚
      const belt = this.treadmillBelt
      if (belt && this.actors.some((a) => a.task?.kind === 'run' && a.task.phase === 'use')) belt.offset.y += sim * 0.9
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
    this.forage?.sync(this.life.forageDay, this.life.clock.day)
    // 读档回来时有人正在店里：把交易界面弹出来
    const inShop = this.life.trips.find((x) => x.phase === 'shop')
    if (inShop && inShop.id !== this.shopOpenFor && this.onShop && !this.hud.loading) this.openShop(inShop)
    this.updateChickens(dt * (this.life.speed || 0))
    this.arriveScavenge()
    this.forage?.update(dt, !this.life.siege || this.life.siege.done)
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.25
      this.pushLifeHud()
      this.stockView?.sync(this.life.stock.food, this.life.stock.water)
      this.pantry?.sync({ food: this.life.stock.food, water: this.life.stock.water, medkits: this.life.medkits, ammo: this.life.ammo.n, fuel: this.life.fuel })
    }
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.setHud({ toast: '' })
    if ((this.saveTimer -= dt) <= 0) {
      this.saveTimer = 10
      saveWorld(this.life)
    }
    // 每天早上存一份"今早"的档（刚开局、或者老存档还没有这一份时，马上存一份）
    const dc = this.life.clock
    if (!this.hud.loading && dc.day !== this.dayStartSaved && dc.hour >= SUNRISE && dc.hour < 21 && !(this.life.siege && !this.life.siege.done) && !this.life.over) {
      this.dayStartSaved = dc.day
      saveDayStart(this.life)
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
    return !l.vanAway && !l.vanMove && !l.trips.some((t) => t.van) && !l.siege && !l.nightPending && !l.onTrip(this.heroine)
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
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.builtPlotRects())
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
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.builtPlotRects())
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
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.builtPlotRects())
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
    this.carBlocked ??= vehicleBlocker(this.style === 'paradise' ? PARADISE_EXTRAS : [], () => this.life.builtPlotRects())
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
    // 选中的人走过去蹲下撸它（猫坐着等）；走不过去就还是隔空喵一声
    const who = this.mode === 'home' ? this.selected : this.heroine
    if (this.life.petCat(who, cat.pos, true)) {
      this.petting = who
      this.purred = false
      cat.stay(30)
      this.toast('world.toast.goPet', 2, { who: who.name })
      return
    }
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
    // 打丧尸时：点丧尸 = 盯住它（开枪先打它）并打开防线面板；点正在被砸的防线也打开面板
    // 先看是不是点了守位（换站位），再看是不是点了防线 / 丧尸
    if (this.mode === 'home' && this.tapPost()) return
    if (this.tapSiege()) return
    // 点大橘：喵一声、呼噜呼噜，身边的人心情好一点
    if (this.cat?.root.visible && this.raycaster.intersectObject(this.cat.inner, true).length) {
      this.petCat()
      return
    }
    this.pendingScav = null
    // 点野外的野菜、草药、蘑菇、蜂窝……：女主走过去采
    const fs = floor === 0 ? this.forage?.pick(this.raycaster) ?? null : null
    if (fs) { this.tapForage(fs); return }
    // 点压水井 / 鸡圈：选中的人去压水、喂鸡
    const chore = floor === 0 ? this.choreUnder() : null
    if (chore) { this.tapChore(chore, cx, cy); return }
    // 点邻居家、街上盖着车罩的车、接雨水的桶：女主走过去搜（末日以后）
    const sc = floor === 0 ? this.scavengeUnder() : null
    if (sc) { this.tapScavenge(sc); return }
    if (this.mode === 'home') {
      const hits = this.raycaster.intersectObjects(this.actors.filter((a) => a.root.visible).map((a) => a.root), true)
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object
        while (o && !o.userData.actor) o = o.parent
        // 点人物 = 跟 TA 互动（换人只能点下面的卡片）
        if (o) {
          const target = o.userData.actor as Actor
          if (target === this.selected) { this.toast('world.toast.pickCard'); return }
          if (this.life.siege && !this.life.siege.done) { this.toast('world.toast.fighting'); return }
          this.onFurnitureMenu?.({
            x: cx, y: cy, title: target.name, who: this.selected.name, target: target.name, mood: target.needs.mood,
            options: [
              ...(this.life.isInjured(target) ? [{ label: 'world.act.bandage' as UiKey, cmd: 'bandage' as const }] : []),
              ...INTERACTIONS.map((d) => ({ label: `world.act.${d.id}` as UiKey, act: d.id })),
            ],
          })
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
      // 菜地：选种什么、浇水、收菜
      if (hit && hit.userData.slug === 'plot') { this.onPlot?.(hit.userData.plot as number); return }
      // 储藏室的铁架子、木箱：看看家里有什么
      if (hit && isStorage(hit)) { this.onStock?.(); return }
      if (hit && (hit.userData.slug === 'large_iron_gate' || hit.userData.gate)) { this.onMap?.(); return }
      // 点家具：弹出一个小菜单（坐着歇会儿 / 做饭吃 / 喝口水 / 睡一觉…），选了以后让选中的人去
      const options = hit ? this.furnitureOptions(hit, floor) : []
      if (hit && options.length) {
        this.onFurnitureMenu?.({ x: cx, y: cy, title: furnitureName(hit), who: this.selected.name, options })
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
      || (floor === 0 && (!!this.forage?.pick(this.raycaster) || !!this.scavengeUnder() || !!this.choreUnder()))
    el.style.cursor = over ? 'pointer' : ''
  }

  private forage: ForageView | null = null

  /** 邻居家、车、水桶上面一块看不见的"点击区"（射线打得到看不见的物体） */
  private scavHits: THREE.Mesh[] = []
  /** 点了要搜的地方，女主正走过去 */
  private pendingScav: ScavengeSpot | null = null

  private buildScavengeHits(): void {
    const mat = new THREE.MeshBasicMaterial()
    for (const s of SCAVENGE) {
      // 找离这个搜索点最近的同类道具（房子 / 车 / 桶），点击区盖住它
      let prop = PROPS[0]
      let best = Infinity
      for (const p of PROPS) {
        if (p.kind !== s.kind) continue
        const d = Math.hypot(p.x - s.at.x, p.z - s.at.z)
        if (d < best) { best = d; prop = p }
      }
      const h = s.kind === 'house' ? 5 : s.kind === 'car' ? 1.6 : 1.1
      const swap = Math.abs(prop.rot) % 180 >= 45 && Math.abs(prop.rot) % 180 <= 135
      const box = new THREE.Mesh(new THREE.BoxGeometry(swap ? prop.d : prop.w, h, swap ? prop.w : prop.d), mat)
      box.position.set(prop.x, h / 2, prop.z)
      if (s.kind === 'barrel') box.scale.set(2.2, 1, 2.2)
      box.visible = false
      box.userData.scav = s.id
      this.scene.add(box)
      this.scavHits.push(box)
    }
  }

  private wellHit: THREE.Mesh | null = null
  private coopHit: THREE.Mesh | null = null
  private chickens: { g: THREE.Group; head: THREE.Object3D; x: number; z: number; tx: number; tz: number; t: number; peck: number }[] = []

  /** 屋子东边：压水井（石头井台 + 铸铁压水泵）和鸡圈（木桩篱笆、小鸡舍、几只鸡） */
  private buildWellCoop(): void {
    const stone = this.pmats?.textured('stone') ?? toon('#8d8a84')
    const iron = new THREE.MeshStandardMaterial({ color: '#2f3336', metalness: 0.6, roughness: 0.5 })
    const wood = this.pmats?.textured('wood') ?? toon('#7a5c3c')
    const roofM = toon('#8a4a32')
    const well = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.45, 10), stone)
    base.position.y = 0.225
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 8), iron)
    post.position.set(0, 0.9, 0)
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6), iron)
    spout.rotation.x = Math.PI / 2
    spout.position.set(0, 1.0, 0.18)
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.75), iron)
    lever.position.set(0, 1.42, -0.22)
    lever.rotation.x = -0.35
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 10), wood)
    bucket.position.set(0, 0.58, 0.3)
    for (const m of [base, post, spout, lever, bucket]) { m.castShadow = true; well.add(m) }
    well.position.set(WELL.x, 0, WELL.z)
    this.scene.add(well)

    const coop = new THREE.Group()
    const w = COOP.x1 - COOP.x0
    const d = COOP.z1 - COOP.z0
    const postGeo = new THREE.BoxGeometry(0.08, 0.7, 0.08)
    const railX = new THREE.BoxGeometry(w, 0.05, 0.04)
    const railZ = new THREE.BoxGeometry(0.04, 0.05, d)
    for (const [x, z] of [[COOP.x0, COOP.z0], [COOP.x1, COOP.z0], [COOP.x0, COOP.z1], [COOP.x1, COOP.z1], [COOP.x0, (COOP.z0 + COOP.z1) / 2], [COOP.x1, (COOP.z0 + COOP.z1) / 2]]) {
      const p = new THREE.Mesh(postGeo, wood)
      p.position.set(x, 0.35, z)
      coop.add(p)
    }
    for (const y of [0.25, 0.55]) {
      for (const z of [COOP.z0, COOP.z1]) { const r = new THREE.Mesh(railX, wood); r.position.set((COOP.x0 + COOP.x1) / 2, y, z); coop.add(r) }
      for (const x of [COOP.x0, COOP.x1]) { const r = new THREE.Mesh(railZ, wood); r.position.set(x, y, (COOP.z0 + COOP.z1) / 2); coop.add(r) }
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), wood)
    hut.position.set(COOP.x1 - 0.55, 0.3, COOP.z0 + 0.45)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.9), roofM)
    roof.position.set(COOP.x1 - 0.55, 0.66, COOP.z0 + 0.45)
    roof.rotation.x = 0.25
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.02), toon('#2a1f17'))
    hole.position.set(COOP.x1 - 0.55, 0.16, COOP.z0 + 0.81)
    coop.add(hut, roof, hole)
    coop.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    this.scene.add(coop)

    // 几只鸡：白身子、红鸡冠、黄嘴；在鸡圈里溜达、低头啄食
    const white = toon('#f3efe6')
    const brown = toon('#b0743f')
    const red = toon('#d2392b')
    const beakM = toon('#e6b13a')
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), i === 3 ? brown : white)
      body.scale.set(0.9, 0.85, 1.2)
      body.position.y = 0.17
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), i === 3 ? brown : white)
      tail.position.set(0, 0.25, -0.14)
      tail.rotation.x = -0.7
      const head = new THREE.Group()
      head.position.set(0, 0.3, 0.12)
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), i === 3 ? brown : white)
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.07), red)
      comb.position.set(0, 0.07, 0)
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), beakM)
      beak.rotation.x = Math.PI / 2
      beak.position.set(0, 0, 0.08)
      head.add(skull, comb, beak)
      g.add(body, tail, head)
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
      const x = COOP.x0 + 0.3 + Math.random() * (w - 1.3)
      const z = COOP.z0 + 1.0 + Math.random() * (d - 1.3)
      g.position.set(x, 0, z)
      this.scene.add(g)
      this.chickens.push({ g, head, x, z, tx: x, tz: z, t: Math.random() * 2, peck: 0 })
    }

    const hitM = new THREE.MeshBasicMaterial()
    this.wellHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 1.0), hitM)
    this.wellHit.position.set(WELL.x, 0.8, WELL.z)
    this.coopHit = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), hitM)
    this.coopHit.position.set((COOP.x0 + COOP.x1) / 2, 0.45, (COOP.z0 + COOP.z1) / 2)
    for (const h of [this.wellHit, this.coopHit]) { h.visible = false; this.scene.add(h) }
  }

  /** 鸡：走两步、停下啄几下，再换个地方（游戏暂停时也停） */
  private updateChickens(dt: number): void {
    if (dt <= 0) return
    // 有人蹲在鸡圈边逗小鸡（或者喂鸡）：小鸡都跑到栏杆这边围着 TA
    const friend = this.actors.find((a) => (a.task?.kind === 'hens' || a.task?.kind === 'feed') && a.task.phase === 'use')
    for (const [k, c] of this.chickens.entries()) {
      if (friend && c.t <= 0) {
        const ang = k * 1.7
        c.tx = Math.max(COOP.x0 + 0.25, Math.min(COOP.x1 - 0.25, friend.pos.x + Math.cos(ang) * 0.45))
        c.tz = Math.max(COOP.z0 + 0.25, Math.min(COOP.z1 - 0.25, COOP.z1 - 0.35 + Math.sin(ang) * 0.2))
        c.t = 0.8 + Math.random()
      }
      c.t -= dt
      const dx = c.tx - c.x
      const dz = c.tz - c.z
      const d = Math.hypot(dx, dz)
      if (d > 0.03) {
        const step = Math.min(d, dt * 0.45)
        c.x += (dx / d) * step
        c.z += (dz / d) * step
        c.g.rotation.y = Math.atan2(dx, dz)
        c.peck = 0
      } else if (c.t <= 0) {
        c.tx = COOP.x0 + 0.3 + Math.random() * (COOP.x1 - COOP.x0 - 1.3)
        c.tz = COOP.z0 + 1.0 + Math.random() * (COOP.z1 - COOP.z0 - 1.3)
        c.t = 1.5 + Math.random() * 3
      } else c.peck += dt
      c.g.position.set(c.x, 0, c.z)
      // 停下来的时候一下一下低头啄
      c.head.rotation.x = d > 0.03 ? 0 : Math.max(0, Math.sin(c.peck * 9)) * 0.9
      c.head.position.y = 0.3 - c.head.rotation.x * 0.08
    }
  }

  private choreUnder(): 'pump' | 'feed' | null {
    const hits = this.raycaster.intersectObjects([this.wellHit, this.coopHit].filter((h): h is THREE.Mesh => !!h), false)
    if (!hits.length) return null
    return hits[0].object === this.wellHit ? 'pump' : 'feed'
  }

  private tapChore(what: 'pump' | 'feed', cx = 0, cy = 0): void {
    const who = this.mode === 'home' ? this.selected : this.heroine
    // 鸡圈：喂鸡捡蛋，或者蹲下逗逗小鸡
    if (what === 'feed') {
      this.onFurnitureMenu?.({ x: cx, y: cy, title: t('world.coop.title'), who: who.name, options: [
        { label: 'world.coop.feed', cmd: 'feed' }, { label: 'world.coop.hens', cmd: 'hens' },
      ] })
      return
    }
    const r = this.life.commandChore(who, what)
    this.toast(`world.chore.${what}.${r}`, 3, { who: who.name, n: String(this.life.pumpsLeft() - (r === 'ok' && what === 'pump' ? 1 : 0)) })
  }

  private scavengeUnder(): ScavengeSpot | null {
    const id = this.raycaster.intersectObjects(this.scavHits, false)[0]?.object.userData.scav as string | undefined
    return id ? SCAVENGE.find((s) => s.id === id) ?? null : null
  }

  private tapScavenge(s: ScavengeSpot): void {
    if (this.life.siege && !this.life.siege.done) { this.toast('world.toast.fighting'); return }
    const h = this.heroine
    if (h.dead || this.life.onTrip(h)) return
    this.life.cancelSearch()
    this.life.stopFishing()
    const state = this.life.canSearch(s)
    if (state !== 'ok') { this.toast(`world.search.${state}`, 3); return }
    if (this.selected !== h) this.select(h)
    const path = this.life.commandWalk(h, { x: s.at.x, z: s.at.z, floor: 0 })
    if (!path) return
    this.pendingScav = s
    this.flashMarker(s.at.x, 0, s.at.z)
  }

  /** 女主走到了要搜的地方：开始搜 */
  private arriveScavenge(): void {
    const s = this.pendingScav
    const h = this.heroine
    if (!s || h.path.length) return
    this.pendingScav = null
    if (Math.hypot(h.pos.x - s.at.x, h.pos.z - s.at.z) < 1.3 && this.life.startSearch(s)) this.pushLifeHud()
  }

  /** 一个人一天大概吃 1 份、喝 1 份：按在家的人数算还够几天 */
  daysLeft(): number {
    const n = Math.max(1, this.actors.filter((a) => !a.dead && !a.lost && !a.runaway).length)
    const av = this.life.available
    return Math.floor(Math.min(av.food, av.water) / n)
  }

  private tapForage(s: ForageSpot): void {
    if (this.life.siege && !this.life.siege.done) { this.toast('world.toast.fighting'); return }
    const h = this.heroine
    if (h.dead || this.life.isOut(h)) { this.toast('world.forage.no', 2.5, { what: s.name }); return }
    if (this.selected !== h) this.select(h)
    this.life.cancelSearch()
    this.life.stopFishing()
    const r = this.life.commandForage(h, s.id)
    if (r === 'picked') this.toast('world.forage.picked', 2.5, { what: s.name })
    else if (r === 'no') this.toast('world.forage.no', 2.5, { what: s.name })
    else this.flashMarker(s.at.x, 0, s.at.z)
  }

  /** 打丧尸时点了地上的守位圈（哪怕上面站着人）：把选中的人换过去 */
  private tapPost(): boolean {
    const siege = this.life.siege
    const layer = siege && !siege.done ? siege.current : null
    if (!siege || !layer || this.selected.away) return false
    // 守位可能在不同楼层（铁门那一层拿枪的在二楼阳台）：每个守位按它自己那层的地面算
    const p = new THREE.Vector3()
    const k = layer.posts.findIndex((q) => this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -q.floor * FLOOR_H), p) !== null
      && Math.hypot(q.x - p.x, q.z - p.z) < 0.6)
    if (k < 0 || siege.post(this.selected) === k) return false
    siege.assign(this.selected, k)
    this.flashMarker(layer.posts[k].x, layer.posts[k].floor * FLOOR_H, layer.posts[k].z)
    return true
  }

  /** 防线面板（开枪、扔燃烧瓶、救人）要不要显示 */
  onLinePanel: ((open: boolean) => void) | null = null
  /** 玩家点中的丧尸（开枪先打它） */
  private lineTarget: Zombie | null = null
  private targetRing: THREE.Mesh | null = null

  private tapSiege(): boolean {
    const siege = this.life.siege
    if (!siege || siege.done) return false
    const roots = siege.zombies.filter((z) => z.alive && z.state !== 'leave' && z.root.visible).map((z) => z.root)
    const hits = this.raycaster.intersectObjects(roots, true)
    if (hits.length) {
      let o: THREE.Object3D | null = hits[0].object
      while (o && !o.userData.zombie) o = o.parent
      if (o) {
        this.lineTarget = o.userData.zombie as Zombie
        this.onLinePanel?.(true)
        this.pushLifeHud()
        return true
      }
    }
    const layer = siege.current
    if (!layer) return false
    const floor = layer.bash[0].floor
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -floor * FLOOR_H), p)) return false
    const cx = layer.bash.reduce((v, b) => v + b.x, 0) / layer.bash.length
    const cz = layer.bash.reduce((v, b) => v + b.z, 0) / layer.bash.length
    if (Math.hypot(p.x - cx, p.z - cz) > 2.6) return false
    this.onLinePanel?.(true)
    this.pushLifeHud()
    return true
  }

  /** 防线面板里点"开枪"：拿枪 / 弩的人打一下（先打盯住的那只） */
  fire(): void {
    const siege = this.life.siege
    if (!siege || siege.done) return
    const r = siege.fire(this.lineTarget)
    if (r.r !== 'ok') this.toast(`world.fire.${r.r}`, 2.5, { who: r.who ?? '' })
    this.pushLifeHud()
  }

  /** 防线面板里点"救起 XX" */
  rescueByName(name: string): void {
    const a = this.actors.find((x) => x.name === name)
    if (!a) return
    if (this.life.rescue(a)) { this.sound.squelch(); this.pushLifeHud() }
    else this.toast('world.toast.noMedkit')
  }

  /** 头顶飘的字（进账：💧+0.6、🥚+2、💎+1……）：往上飘一米、慢慢淡掉 */
  private pops: { sprite: THREE.Sprite; t: number; y0: number }[] = []
  private popText(text: string, who: Actor | null, at?: { x: number; z: number }): void {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 64
    const g = c.getContext('2d')!
    g.font = 'bold 34px "PingFang SC", "Songti SC", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 6
    g.strokeStyle = 'rgba(20,14,8,0.85)'
    g.strokeText(text, 128, 34)
    g.fillStyle = '#fff3c4'
    g.fillText(text, 128, 34)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    sprite.scale.set(1.6, 0.4, 1)
    sprite.renderOrder = 11
    const p = who ? who.root.position : new THREE.Vector3(at?.x ?? 0, 0, at?.z ?? 0)
    const y0 = p.y + 2.1
    sprite.position.set(p.x, y0, p.z)
    // 好几条一起冒出来时错开一点
    sprite.position.x += (this.pops.length % 3) * 0.25 - 0.25
    this.scene.add(sprite)
    this.pops.push({ sprite, t: 0, y0 })
  }

  private updatePops(dt: number): void {
    for (let k = this.pops.length - 1; k >= 0; k--) {
      const p = this.pops[k]
      p.t += dt
      p.sprite.position.y = p.y0 + Math.min(1, p.t / 1.6) * 0.9
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = p.t < 1.2 ? 1 : Math.max(0, 1 - (p.t - 1.2) / 0.8)
      if (p.t > 2) {
        p.sprite.removeFromParent()
        ;(p.sprite.material as THREE.SpriteMaterial).map?.dispose()
        p.sprite.material.dispose()
        this.pops.splice(k, 1)
      }
    }
  }

  /** 全家都睡着了：时间自动快进，有人醒了（或者打起来了）就回到原来的速度 */
  static readonly SLEEP_SKIP = 40
  private sleepSkip: { prev: number } | null = null
  private sleepOptOut = false
  private updateSleepSkip(): void {
    const L = this.life
    const fighting = !!L.siege && !L.siege.done
    const home = this.actors.filter((a) => !a.dead && !L.isOut(a))
    // 女主在开车：她醒着
    const asleep = !this.driving && home.length > 0 && home.every((a) => a.task?.kind === 'sleep' && a.task.phase === 'use')
    // 玩家在快进时自己调了速度：这一觉不再快进，等有人醒了再说
    if (!asleep) this.sleepOptOut = false
    // 面板暂停过、回来时速度被恢复成快进的速度：接着当作快进处理
    if (!this.sleepSkip && L.speed === World.SLEEP_SKIP) this.sleepSkip = { prev: 1 }
    if (this.sleepSkip) {
      // 玩家自己调了速度、或者有面板把游戏停了：听玩家的（面板关了以后上面那句会接回来）
      if (L.speed !== World.SLEEP_SKIP) { if (L.speed > 0) { this.sleepSkip = null; this.sleepOptOut = true; this.setHud({ sleepSkip: false }) } return }
      if (!asleep || fighting) {
        L.speed = fighting ? 1 : this.sleepSkip.prev
        this.sleepSkip = null
        this.setHud({ sleepSkip: false })
        this.pushLifeHud()
      }
    } else if (asleep && !fighting && !this.sleepOptOut && L.speed > 0 && L.speed <= 3) {
      this.sleepSkip = { prev: L.speed }
      L.speed = World.SLEEP_SKIP
      this.setHud({ sleepSkip: true })
      this.pushLifeHud()
    }
  }

  /** 阳台机枪位：一圈沙袋 + 三脚架上一挺机枪（架的时候沙袋一个个垒起来，最后放枪） */
  private mgNest: THREE.Group | null = null
  private updateMgNest(): void {
    const job = this.life.projects.find((p) => p.id === 'mg')
    if (!this.life.mg && !job) { if (this.mgNest) this.mgNest.visible = false; return }
    if (!this.mgNest) this.mgNest = this.makeMgNest()
    this.mgNest.visible = true
    const kids = this.mgNest.children
    const done = this.life.mg ? 1 : job!.done
    kids.forEach((c, k) => { c.visible = done >= 1 || (c.userData.bag ? done >= (k + 1) / (kids.length + 1) : false) })
  }

  private makeMgNest(): THREE.Group {
    const g = new THREE.Group()
    const bag = new THREE.MeshStandardMaterial({ color: '#b39a6c', roughness: 0.95 })
    const metal = new THREE.MeshStandardMaterial({ color: '#2f3230', roughness: 0.45, metalness: 0.7 })
    // 半圈沙袋，开口朝屋里
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (0.1 + (k / 6) * 0.8)
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.36, 4, 8), bag)
        m.rotation.z = Math.PI / 2
        m.rotation.y = -a + Math.PI / 2
        m.position.set(Math.cos(a) * 0.75, 0.14 + row * 0.24, Math.sin(a) * 0.55)
        m.castShadow = true
        m.userData.bag = true
        g.add(m)
      }
    }
    // 三脚架和枪身、枪管，枪口朝南（院子、铁门那边）
    const gun = new THREE.Group()
    for (const a of [0, 2.1, 4.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 6), metal)
      leg.position.set(Math.cos(a) * 0.16, 0.28, Math.sin(a) * 0.16 - 0.05)
      leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3)
      gun.add(leg)
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.6), metal)
    body.position.set(0, 0.62, 0.05)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 8), metal)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.64, 0.6)
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), new THREE.MeshStandardMaterial({ color: '#4d5a3a', roughness: 0.8 }))
    box.position.set(0.14, 0.58, -0.05)
    gun.add(body, barrel, box)
    gun.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
    g.add(gun)
    g.position.set(MG.x, FLOOR_H, MG.z - 0.25)
    this.floor2.add(g)
    return g
  }

  /** 盯住的丧尸脚下一圈红圈 */
  private updateTargetRing(): void {
    const z = this.lineTarget
    if (!this.targetRing) {
      this.targetRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28), new THREE.MeshBasicMaterial({ color: '#ff4b3a', transparent: true, opacity: 0.85, depthTest: false }))
      this.targetRing.rotation.x = -Math.PI / 2
      this.targetRing.renderOrder = 9
      this.scene.add(this.targetRing)
    }
    const show = !!z && z.alive && z.root.visible
    this.targetRing.visible = show
    if (show) this.targetRing.position.set(z!.root.position.x, z!.root.position.y + 0.04, z!.root.position.z)
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

  private furnitureOptions(root: THREE.Object3D, floor: Floor): FurnitureMenu['options'] {
    const id = String(root.userData.slug ?? root.userData.piece ?? '')
    // 电视：去看一会儿（坐到八仙桌边）/ 听听新闻里说什么
    if (/^tv$|television/.test(id)) {
      const on = this.life.tvPowered
      return [
        { label: 'world.use.tv', cmd: 'tv', disabled: !on, text: on ? undefined : t('world.tv.noPower') },
        { label: 'world.use.news', cmd: 'news' },
      ]
    }
    const box = new THREE.Box3().setFromObject(root)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // 火炉：两个小板凳都算（一个在炉子西南、一个在南边）
    const reach = Math.max(1.0, Math.max(size.x, size.z) / 2 + 0.7) + (/fire_stove/.test(id) ? 0.4 : 0)
    const best = new Map<Spot['kind'], { spot: Spot; d: number; free: boolean }>()
    for (const s of this.life.allSpots) {
      if (s.floor !== floor || s.kind === 'stroll') continue
      const d = Math.hypot(s.x - c.x, s.z - c.z)
      // 灶台边的柜子、水壶点了也能选做饭（镜头里灶台常被高柜子挡住一半）
      if (d > reach + (s.kind === 'cook' ? 0.7 : 0)) continue
      const who = this.life.whoUses(s)
      const free = !who || who === this.selected
      const cur = best.get(s.kind)
      if (!cur || (free && !cur.free) || (free === cur.free && d < cur.d)) best.set(s.kind, { spot: s, d, free })
    }
    const order: Spot['kind'][] = ['cook', 'fridge', 'drink', 'dine', 'relax', 'sleep', 'run']
    const out: FurnitureMenu['options'] = []
    // 灶台、冰箱：打开做饭界面（选这一锅做什么）；冰箱里有做好的就能直接去拿一份吃
    let kitchen = /fridge/.test(id)
    for (const k of order) {
      if (!best.has(k)) continue
      const spot = best.get(k)!.spot
      if (k === 'cook' || k === 'fridge') { kitchen = true; continue }
      out.push({ label: spot.near === 'fire' ? 'world.use.fire' : `world.use.${k}` as UiKey, spot })
    }
    if (kitchen) {
      const left = this.life.fridgeLeft
      out.unshift(
        { label: 'world.use.cookpanel', cmd: 'cook' },
        ...(left > 0 ? [{ label: 'world.use.eatnow' as UiKey, cmd: 'eat' as const, text: `${t('world.use.eatnow')}（还有 ${Math.floor(left)} 份）` }] : []),
      )
    }
    return out
  }

  /** 手机界面要的东西：网购能不能下单、货架（今天的价格）、钱、在路上的快递、通讯录 */
  phoneView(): PhoneView {
    const l = this.life
    const day = l.clock.day
    return {
      state: l.orderState(),
      lastDay: day === PROLOGUE_DAYS - 2,
      money: l.money,
      day,
      hour: l.clock.hour,
      items: ONLINE_SHOP.items.map((it) => ({ id: it.id, name: it.name, icon: it.icon, desc: it.desc, cat: it.cat, price: priceOf(it, ONLINE_SHOP, day), max: it.stock })),
      orders: l.orders.map((o) => ({ id: o.id, what: cartLabel(ONLINE_SHOP, o.cart), total: o.total, day: Math.floor(o.arrive / 24), hour: Math.floor(o.arrive % 24) })),
      contacts: l.contacts(),
      fee: ONLINE_FEE,
      invited: l.inviteDay === day || !!l.invited,
      market: marketState(day, l.clock.hour),
      stocks: STOCKS.map((st) => ({
        id: st.id, name: st.name, code: st.code, memory: st.memory, clarity: st.clarity,
        price: stockPrice(st.id, day, l.stockFate), prev: day > 0 ? stockPrice(st.id, day - 1, l.stockFate) : stockPrice(st.id, 0, l.stockFate),
        shares: l.shares[st.id] ?? 0, cost: l.costBasis[st.id] ?? 0,
      })),
      lottery: {
        issue: LOTTERY.issue, front: [...LOTTERY.front], back: LOTTERY.back, back2Maybe: [...LOTTERY.back2Maybe], price: LOTTERY.price, maxMult: LOTTERY.maxMult,
        drawText: `末日前 ${PROLOGUE_DAYS - LOTTERY.drawDay} 天晚上 ${Math.floor(LOTTERY.drawHour)}:${pad2(Math.round((LOTTERY.drawHour % 1) * 60))} 开奖`,
        canBuy: !l.ticket && !l.lotteryDrawn && !(day === LOTTERY.drawDay && l.clock.hour >= LOTTERY.drawHour - 0.5),
        ticket: l.ticket ? { ...l.ticket } : null,
        drawn: l.lotteryDrawn, real: l.lotteryDrawn ? l.lotteryBack2 : null,
        prize: l.lotteryPrize, claimed: l.lotteryClaimed, canClaim: !!l.lotteryPrize && !l.lotteryClaimed && day < PROLOGUE_DAYS,
      },
    }
  }

  tradeStock(id: string, lots: number): string {
    const r = this.life.tradeStock(id, lots)
    this.pushLifeHud()
    return r
  }

  buyTicket(back2: number, mult: number): string {
    const r = this.life.buyTicket(back2, mult)
    this.pushLifeHud()
    return r
  }

  claimLottery(): number {
    const n = this.life.claimLottery()
    this.pushLifeHud()
    return n
  }

  placeOrder(cart: Cart): string {
    const r = this.life.placeOrder(cart)
    this.pushLifeHud()
    return r
  }

  inviteContact(id: string): string {
    const r = this.life.invite(id)
    this.pushLifeHud()
    return r
  }

  callContact(id: string): { r: string; line?: string } {
    const r = this.life.call(id)
    this.pushLifeHud()
    return r
  }

  /** 鸡圈菜单里选了一项 */
  menuCommand(cmd: MenuCmd, target?: string): void {
    this.onFurnitureMenu?.(null)
    const who = this.mode === 'home' ? this.selected : this.heroine
    if (cmd === 'news' || cmd === 'cook') return
    if (cmd === 'eat') {
      const r = this.life.eatNow(who)
      if (r !== 'ok') this.toast(`world.eat.r.${r}`, 3, { who: who.name })
      return
    }
    if (cmd === 'tv') {
      const r = this.life.watchTv(who)
      if (r !== 'ok') this.toast(`world.tv.${r}`, 3, { who: who.name })
      return
    }
    if (cmd === 'bandage') {
      const a = this.actors.find((x) => x.name === target)
      if (!a) return
      const r = this.life.bandage(a)
      this.toast(`world.bandage.${r}`, 3, { who: a.name })
      this.pushLifeHud()
      return
    }
    if (cmd === 'feed') {
      const r = this.life.commandChore(who, 'feed')
      this.toast(`world.chore.feed.${r}`, 3, { who: who.name, n: '0' })
    } else {
      const r = this.life.playHens(who)
      this.toast(`world.coop.r.${r}`, 3, { who: who.name })
    }
  }

  /** 还没走出去的那一趟：叫回来（退钱退油） */
  cancelTrip(n: number): void {
    if (this.life.cancelTrip(n)) this.toast('world.toast.tripCancel', 3)
    this.pushLifeHud()
  }

  /** 人物菜单里选了一项：选中的人走过去跟 TA 互动 */
  interactWith(name: string, act: InteractKind): void {
    this.onFurnitureMenu?.(null)
    const target = this.actors.find((a) => a.name === name)
    if (!target) return
    const r = this.life.interact(this.selected, target, act)
    if (r !== 'ok') this.toast(`world.act.r.${r}`, 3, { who: this.selected.name, whom: target.name })
  }

  /** 菜单里选了一项：让选中的人去用 */
  useFurniture(spot: Spot): void {
    this.onFurnitureMenu?.(null)
    if (this.life.siege && !this.life.siege.done) return
    if (this.life.commandSpot(this.selected, spot)) this.flashMarker(spot.ax ?? spot.x, spot.floor * FLOOR_H, spot.az ?? spot.z)
    else this.toast(this.life.whoUses(spot) ? 'world.toast.taken' : 'world.toast.busy')
  }

  /** 界面设置：点了日记本 / 墙上的地图 / 储藏室的架子 */
  onDiary: (() => void) | null = null
  onStock: (() => void) | null = null
  onPlot: ((i: number) => void) | null = null
  onMap: (() => void) | null = null
  /** 有人到了店里：弹出交易界面 */
  onShop: ((v: ShopView) => void) | null = null
  /** 交易界面开着的是哪一趟（读档回来时还在店里的，要重新弹出来） */
  private shopOpenFor = -1

  tripCheck(id: string, van = false): ReturnType<Household['tripCheck']> {
    return this.life.tripCheck(id, van)
  }

  /** 地图上"开面包车去"要用：还剩几桶油、车在不在家 */
  vanInfo(): { fuel: number; home: boolean; armored: boolean; parkedOut: boolean } {
    const l = this.life
    return { fuel: Math.round(l.fuel * 10) / 10, home: !l.vanAway && !l.vanMove && !l.vanAt, armored: l.vanArmor, parkedOut: !!l.vanAt && !l.vanAway && !l.vanMove }
  }

  /** 地图上"在外面的人" */
  awayTrips(): { who: string; where: string; left: number; van: boolean; shopping: boolean }[] {
    return this.life.trips.map((t) => ({
      who: t.members.map((m) => m.name).join('、'),
      where: lt(locations.find((x) => x.id === t.def.id)?.name ?? { zh: t.def.id }),
      left: Math.max(0, t.back - this.life.absHour), van: !!t.van, shopping: t.phase === 'shop',
    }))
  }

  /** 在家、能出门的人 */
  homeMembers(): { name: string; health: number }[] {
    return this.actors.filter((a) => !this.life.isOut(a) && !a.guest).map((a) => ({ name: a.name, health: a.health }))
  }

  /** 交易界面要的数据：店、钱、能带多少、家里的存货 */
  shopView(t: Trip): ShopView | null {
    const l = this.life
    const prologue = l.clock.day < PROLOGUE_DAYS
    const shop = shopFor(t.def.id, prologue)
    if (!shop) return null
    const people = this.actors.filter((a) => !a.dead && !a.lost && !a.runaway).length
    const av = l.available
    return {
      tripId: t.id, shopId: shop.id, day: l.clock.day,
      name: lt(locations.find((x) => x.id === t.def.id)?.name ?? { zh: t.def.id }),
      who: t.members.map((m) => m.name).join('、'), van: !!t.van,
      currency: shop.currency, wallet: shop.currency === 'money' ? l.money : l.cores,
      capacity: l.tripCapacity(t),
      items: shop.items.map((it) => ({ ...it, unit: priceOf(it, shop, l.clock.day), owned: l.owns(it) })),
      buys: shop.buys ?? [],
      home: {
        food: av.food, water: av.water, medkits: l.medkits, ammo: l.ammo.n, fuel: Math.round(l.fuel * 10) / 10, molotovs: l.molotovs, people,
        daysToDoom: Math.max(0, PROLOGUE_DAYS - l.clock.day), gateBonus: l.gateBonus, trap: l.trap.hp > 0, crossbow: l.crossbow,
      },
    }
  }

  private openShop(t: Trip): void {
    const v = this.shopView(t)
    if (!v || !this.onShop) { this.life.checkout(t.id, this.life.defaultCart(t)); return }
    this.shopOpenFor = t.id
    // 暂停交给界面（跟日记、地图一样：所有面板都关了才恢复原来的速度）
    this.sound.knock()
    this.onShop(v)
    this.pushLifeHud()
  }

  /** 交易界面点了结账（或者"不买了"）：成功就恢复时间 */
  checkout(tripId: number, cart: Cart, sell: SellCart = {}): string {
    const r = this.life.checkout(tripId, cart, sell)
    if (r === 'ok') this.pushLifeHud()
    return r
  }

  startTrip(id: string, names: string[], van = false): boolean {
    const members = this.actors.filter((a) => names.includes(a.name))
    const ok = this.life.startTrip(id, members, van)
    if (ok) this.pushLifeHud()
    return ok
  }

  /** 最新一条日记的标识（日记本上的红点用） */
  latestLogKey(): string {
    const l = this.life.log[this.life.log.length - 1]
    return l ? `${l.day}-${l.hour}-${l.key}` : ''
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

  /** 原型调试：跳到高温（第 7 个月）/ 寒潮（第 11 个月）/ 极寒（第 12 个月）的第一天上午（只往后跳；打着仗不跳） */
  debugClimate(kind: 'heat' | 'cold' | 'frost'): void {
    if (this.life.siege && !this.life.siege.done) { this.toast('world.toast.fighting'); return }
    const m = kind === 'heat' ? 6 : kind === 'cold' ? 10 : 11
    let day = PROLOGUE_DAYS + m * 4
    while (day < this.life.clock.day) day += 48
    this.life.clock = { day, hour: 9 }
    this.life.resetNight()
    this.applySky()
    this.pushLifeHud()
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

  /** 点下面的人物卡：选中 TA，镜头挪过去对准 TA（只挪一次，不一直跟着——一家人走来走去时画面会抖） */
  focus(name: string): void {
    const actor = this.actors.find((x) => x.name === name)
    if (!actor) return
    this.select(actor)
    if (this.mode !== 'home' || this.selected !== actor || actor.away || this.life.isOut(actor)) return
    const base = this.desiredPose('home').target.sub(this.pan)
    const p = actor.root.position
    this.pan.set(p.x - base.x, 0, p.z - base.z).clampLength(0, 10)
  }

  private visitHud(): Hud['visit'] {
    const def = this.life.talking
    if (!def) return null
    const ctx = this.life.visitorCtx()
    // 男主用文字版的名字和身份
    const lead = ['jiangye', 'shenyan', 'guchen', 'xielin'].find((id) => def.id.startsWith(id) || def.id === `invite_${id}`)
    const npc = lead ? npcs.find((n) => n.id === lead) : null
    const vars = this.life.visitVars()
    return {
      id: def.id, icon: def.id === 'beggar' && vars.ta === '她' ? '👩' : def.icon, vars, face: this.visitorFace(),
      name: npc ? `${lt(npc.name)} · ${lt(npc.title)}` : t(`world.visit.${def.id}.name` as UiKey),
      textKey: def.id === 'jiangye_care' ? `world.visit.jiangye_care.text${this.life.careVariant}` : `world.visit.${def.id}.text`,
      choices: def.choices.map((c) => ({ id: c.id, ok: !c.need || c.need(ctx) })),
    }
  }

  /** 日记里"认识的人"：男主和好感 */
  diaryPeople(): { icon: string; name: string; title: string; affection: number; met: boolean; home: boolean; canStay: boolean }[] {
    return Object.entries(this.life.affection).filter(([id]) => npcs.some((x) => x.id === id)).map(([id, v]) => {
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

  /** 人物卡的图：public/portraits/<模型>.jpg（现在是 Blender 拍的 Q 版占位图，以后换成画好的立绘，文件名不变） */
  private portraitUrl(model: string): string {
    return `${import.meta.env.BASE_URL}portraits/${model}.jpg`
  }

  private portraits(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const a of this.actors) if (a.model) out[a.name] = this.portraitUrl(a.model)
    return out
  }

  /** 敲门的人的图 */
  private visitorFace(): string | null {
    const id = this.life.visitor?.modelId
    return id ? this.portraitUrl(id) : null
  }

  private pushLifeHud(): void {
    const c = this.life.clock
    // 新住进来的人也要有卡片图
    if (this.actors.some((a) => a.model && !this.hud.portraits[a.name])) this.setHud({ portraits: this.portraits() })
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
      // 冰箱里做好的饭也算吃的（一份顶一份粮）
      food: this.life.stock.food + this.life.fridgeLeft,
      water: this.life.stock.water,
      people: this.life.hud(),
      muted: this.sound.muted,
      music: this.sound.music,
      day: c.day,
      hour: c.hour,
      money: this.life.money,
      medkits: this.life.medkits,
      fuel: Math.round(this.life.fuel * 10) / 10,
      prologue: c.day < PROLOGUE_DAYS,
      report: this.life.report,
      visit: this.visitHud(),
      space: { ...this.life.space, cap: this.life.spaceCap },
      molotovs: this.life.molotovs,
      search: this.searchHud(),
      garden: { built: this.life.garden.built, growth: this.life.garden.growth, n: this.life.plots.filter((p) => p.built).length, max: MAX_PLOTS, plots: this.life.plots.filter((p) => p.built).map((p) => ({ icon: cropOf(p.crop)?.icon ?? '🟫', name: cropOf(p.crop)?.name ?? '空地', p: Math.round(p.growth * 100), ripe: !!p.crop && p.growth >= 1 })) },
      mg: this.life.mg,
      temp: { out: this.life.outTemp, in: this.life.inTemp, ac: this.life.acOn, stove: this.life.stoveHeat },
      build: this.life.projects.map((p) => ({
        id: p.id, p: Math.floor(p.done * 100), worker: p.worker,
        working: this.actors.some((a) => a.name === p.worker && a.task?.kind === 'build'),
      })),
      goals: c.day < PROLOGUE_DAYS ? this.goals() : null,
      wall: this.life.wall,
      trap: Math.ceil(this.life.trap.hp),
      herbs: this.life.herbs,
      daysLeft: this.daysLeft(),
      bamboo: this.life.bamboo,
      spikes: this.life.spikes.map((r) => r.hits),
      spikeNext: this.life.nextSpikeRow(),
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
    const kinds: Partial<Record<ZombieKind, number>> = {}
    for (const z of s.zombies) if (z.alive && z.state !== 'leave') kinds[z.kind] = (kinds[z.kind] ?? 0) + 1
    if (this.lineTarget && !this.lineTarget.alive) this.lineTarget = null
    return {
      left: s.alive, layer: layer?.id ?? null, hp: layer ? this.life.barriers[layer.id] : 0,
      max: layer ? this.life.maxOf(layer.id) : LAYERS[0].max, ambush: s.ambush,
      kinds, shooter: s.shooter(), downed: this.actors.filter((a) => s.isDown(a)).map((a) => a.name),
      target: this.lineTarget?.kind ?? null,
      mg: s.mgState(),
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

  /** "今早"的档已经存到哪一天了 */
  private dayStartSaved = dayStartClock()?.day ?? -1

  /** "重过今天"会回到几点（菜单上显示）；还没有就是 null */
  dayStartLabel(): string | null {
    const c = dayStartClock()
    return c ? calendarLabel(c) : null
  }

  /** 重过今天：回到今早存的那一刻 */
  rewindDay(): void {
    if (!rewindToDayStart()) return
    this.disposed = true
    location.reload()
  }

  /** 清掉存档从头来 */
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
