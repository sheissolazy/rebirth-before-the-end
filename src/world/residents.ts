// 家里的人：走路（会上下楼）、四条需求、像模拟人生那样自己找事做；玩家也可以点家具让 TA 去用。
import * as THREE from 'three'
import { CLOTHESLINE } from './decor'
import { PORCH, FRONT_DOOR, COOP_SPOT, WELL_SPOT, BEDS, FLOOR_H, GARDEN, GARDEN_SPOT, HOUSE, PARADISE_SPOTS, SPOTS, VAN_DOORS, VAN_IN_H, VAN_OUT_H, VAN_PARK, YARD, inRect, wallPieces, type Floor, type Spot, type StairPoint, type VanMove } from './layout'
import { route, type NavGrid, type Pt } from './nav'
import { Walker, type Where } from './walker'
import { PoseDriver, type PoseState } from './people'
import { person } from './meshes'
import {
  DAYS_PER_MONTH, DAY_SECONDS, DEPRESSED, DRINK, MEAL, PROLOGUE_DAYS, dishOf, SUNRISE, advance, chooseWant, decayNeeds, isCrisisNight, isMealTime, isNight, shouldWake,
  type Activity, type Clock, type Needs, type Stock,
} from './life'
import { LAYERS, SPIKE, SPIKE_ROWS, Siege, fullBarriers, type Barriers, type LayerId, type SiegeEvent, type SpikeRow, type Zombie, type ZombieKind } from './siege'
import { TRIPS, canGo, settleTrip, tripCost, tripHours, vanAllowed, type TripDef } from './expedition'
import { locations } from '../content/locations'
import { npcs } from '../content/npcs'
import { events as textEvents } from '../content/events'
import { survivorNames, survivorTraits } from '../content/survivors'
import { memoriesYear1 } from '../content/memories'
import type { CrisisKind } from '../engine/types'
import { rainAt } from './weather'
import { Courier, INVITES, STRANGER_MODELS, VISITORS, Visitor, isFemaleModel, type CourierId, type VisitorCtx, type VisitorDef } from './visitors'
import { FISHING, SCAVENGE_COOLDOWN_DAYS, rollLoot, type ScavengeSpot } from './scavenge'
import { DELIVERY_HOUR, ONLINE_SHOP, capacity, cartGives, cartLabel, cartTotal, orderTotal, sellTotal, shopFor, type Cart, type SellCart, type ShopItem } from './shop'
import { FORAGE, FORAGE_HOURS, HERBS_PER_MEDKIT, harvest, ripe, standAt, type ForageSpot, type ForageYield } from './forage'
import { lt, t, t as t_, type UiKey } from '../i18n'

export type { Where } from './walker'

export type TaskKind = 'walk' | 'cook' | 'eat' | 'drink' | 'sleep' | 'relax' | 'sit' | 'stroll' | 'idle' | 'repair' | 'guard' | 'garden'
  | 'company' | 'tidy' | 'wash' | 'greet' | 'pet' | 'modvan' | 'help' | 'hang' | 'fetch' | 'forage' | 'craft' | 'pump' | 'feed' | 'interact' | 'build' | 'hens' | 'run'

/** 要人去干活的工程：铁门外铺钉板、砌一圈石头院墙、开菜地。BUILD_WORK 是要干几个小时（会修东西的人快三成） */
export type BuildId = 'trap' | 'wall' | 'garden'
export const BUILD_WORK: Record<BuildId, number> = { trap: 1.5, wall: 9, garden: 2 }
/** 价钱：末日前 [元]，末日后 [晶核] */
export const BUILD_COST: Record<BuildId, [number, number]> = { trap: [1500, 2], wall: [6000, 6], garden: [800, 2] }

/** 点人物弹出的互动：选中的人走过去跟 TA 做这件事，两个人心情都会变好（同一天对同一个人做同一件事，效果一次比一次少） */
export type InteractKind = 'chat' | 'comfort' | 'hug' | 'joke' | 'tea'
export const INTERACTIONS: { id: InteractKind; hours: number; self: number; other: number; low?: number; water?: number }[] = [
  { id: 'chat', hours: 0.35, self: 5, other: 8 },
  // 安慰：对方心情不好（低于 40）时多加很多
  { id: 'comfort', hours: 0.3, self: 2, other: 6, low: 16 },
  { id: 'hug', hours: 0.12, self: 6, other: 10 },
  // 讲笑话：看运气，0~12
  { id: 'joke', hours: 0.15, self: 4, other: 6 },
  // 一起喝杯茶：时间长一点、用掉一点水
  { id: 'tea', hours: 0.6, self: 10, other: 12, water: 0.2 },
]

interface Task {
  kind: TaskKind
  spot: Spot | null
  phase: 'go' | 'settle' | 'use'
  /** 还要用多久（游戏小时） */
  hours: number
  manual: boolean
  then?: () => Task | null
  /** 修哪一层防线 */
  layer?: LayerId
  /** 陪谁说话 */
  with?: Actor
  /** 迎接：还要挥手多久（游戏小时）；0 = 挥过了 */
  wave?: number
  /** 迎接：看见人以后再等一会儿才喊（几个人错开，话泡不叠在一起） */
  waitT?: number
  /** 采集：采哪一处（FORAGE 的 id） */
  forage?: string
  /** 互动：做哪一件（跟 with 那个人） */
  act?: InteractKind
  /** 砌墙：正在砌第几段 */
  piece?: number
  /** 做饭 / 吃饭：哪道菜 */
  dish?: string
  /** 玩家亲口下令接着干的工程：天黑也干，只有快累垮、快渴死、快饿死才停 */
  forced?: boolean
}


const SETTLE_S = 0.45
const rad = THREE.MathUtils.degToRad

/** 院子里削竹尖刺的地方（铁门东边的空地上） */
const CRAFT_SPOT = { x: 8.6, z: 11.4 }

/** 飘字里的数：整数就不带小数 */
const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1))

function shortestAngle(from: number, to: number): number {
  const d = to - from
  return from + Math.atan2(Math.sin(d), Math.cos(d))
}

export class Actor extends Walker {
  readonly name: string
  pose: PoseState = 'idle'
  needs: Needs
  /** 健康：被丧尸咬会掉，0 就倒地 */
  health = 100
  task: Task | null = null
  /** 坐下/躺下之前站的位置，起身时回到这里 */
  anchor: StairPoint | null = null
  /** 出门在外（人不在家，模型藏起来） */
  away = false
  /** 扛着箱子回来 */
  carrying = false
  /** 心情低于抑郁线累计了多少游戏小时 */
  lowMood = 0
  /** 体能（0~100）：跑步机上跑步慢慢涨；近战打得更狠、被咬掉的血少一点 */
  fitness = 30
  /** 重伤到什么时候（游戏绝对小时；0 = 没受重伤）：躺着养伤，不能干活、不能出门、不能守夜 */
  injured = 0
  /** 异能者（女主）：精力掉得慢、睡一会儿就满，体能远超常人 */
  esper = false
  /** 正和家人一起歇着/吃饭，聊着天 */
  chatting = false
  /** 头顶冒出来的一句话（迎接、喊人），hours 是还剩多久 */
  line: { text: string; hours: number } | null = null
  /** 没在打丧尸：站着时会换小动作 */
  calm = true
  /** 刚被玩家点中：站着的话挥一下手（秒） */
  ack = 0
  /** 打丧尸用什么 */
  weapon: 'shotgun' | 'crowbar' | 'pin' | 'machete' | 'crossbow' = 'pin'
  /** 戴着顾沉的头盔：被咬伤害减半 */
  helmet = false
  /** 枪没子弹时换的近战武器（江野送的斧子比菜刀好用） */
  sidearm: 'knife' | 'axe' = 'knife'
  /** 白天会去修门的人 */
  handy = false
  /** 用哪个模型（住进来的人存档要用） */
  model = ''
  /** 来做客/帮忙的人，不算家里人（不存档、不分床） */
  guest = false
  /** 住进来的人的特质（文字版 content/survivors.ts 里的 id） */
  trait = ''
  /** 离家出走：什么时候有结果；lost = 再也没回来 */
  runaway: { back: number; persuaded?: boolean } | null = null
  lost = false
  /** 死了（本世永久；lost 也会是 true，各处排除 lost 的逻辑都不用改） */
  dead = false
  /** 玩家下过命令后，这么多游戏小时内不自己找事 */
  hold = 0
  /** 让路：站住等别人先过去（秒） */
  waitT = 0
  private settle: { from: THREE.Vector3; to: THREE.Vector3; r0: number; r1: number; t: number } | null = null
  private walkT = 0
  driver: PoseDriver | null = null
  private inner: THREE.Object3D

  constructor(name: string, shirt: string, hair: string, height: number, at: Pt, needs: Needs) {
    super()
    this.name = name
    this.needs = { ...needs }
    this.inner = person(shirt, hair, height)
    this.root.add(this.inner)
    this.root.position.set(at.x, 0, at.z)
    this.root.userData.actor = this
  }

  get settling(): boolean {
    return this.settle !== null
  }

  /** 现在用的人物模型（拍头像用） */
  get mesh(): THREE.Object3D {
    return this.inner
  }

  /** 换成真人模型（世外桃源画风） */
  setModel(model: THREE.Object3D): void {
    this.root.remove(this.inner)
    this.inner = model
    this.root.add(model)
    this.driver = new PoseDriver(model)
  }

  /** 平滑挪到某个位置（坐进沙发、躺上床、起身） */
  glideTo(x: number, y: number, z: number, faceDeg?: number): void {
    const r0 = this.root.rotation.y
    this.settle = {
      from: this.root.position.clone(),
      to: new THREE.Vector3(x, y, z),
      r0,
      r1: faceDeg === undefined ? r0 : shortestAngle(r0, rad(faceDeg)),
      t: 0,
    }
  }

  /** 立刻回到能走的地方（被打断时用） */
  snapToAnchor(): void {
    if (this.anchor) this.root.position.set(this.anchor.x, this.anchor.y, this.anchor.z)
    this.anchor = null
    this.settle = null
    this.pose = 'idle'
  }

  updateSettle(dt: number): boolean {
    const s = this.settle
    if (!s) return false
    s.t = Math.min(1, s.t + dt / SETTLE_S)
    const k = s.t * s.t * (3 - 2 * s.t)
    this.root.position.lerpVectors(s.from, s.to, k)
    this.root.rotation.y = THREE.MathUtils.lerp(s.r0, s.r1, k)
    if (s.t >= 1) this.settle = null
    return true
  }

  animate(dt: number, walking: boolean): void {
    this.ack = Math.max(0, this.ack - dt)
    const waving = this.ack > 0 && !walking && this.pose === 'idle'
    const state: PoseState = walking ? (this.carrying ? 'carry' : 'walk') : waving ? 'wave' : this.pose
    if (this.driver) {
      this.driver.talking = this.chatting && !walking
      this.driver.fidget = this.calm && !this.away
      this.driver.update(dt, state)
      return
    }
    // 卡通小人：没有骨骼，整体倾斜/躺倒
    const inner = this.inner
    const body = inner.userData.body as THREE.Object3D
    this.walkT = walking ? this.walkT + dt * 11 : 0
    body.position.y = 0.55 + (walking ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0)
    body.rotation.z = walking ? Math.sin(this.walkT) * 0.06 : 0
    const lying = state === 'sleep' || state === 'down'
    inner.rotation.x = lying ? -Math.PI / 2 : state === 'work' || state === 'melee' ? 0.22 : 0
    inner.position.y = lying ? (state === 'down' ? 0.2 : 0.5) : state === 'sit' || state === 'sitEat' ? -0.22 : 0
  }
}

// --- 一家人 -------------------------------------------------------------------

/** 一晚打完的战报 */
export interface NightReport {
  won: boolean
  crisis: boolean
  kills: number
  ammo: number
  cores: number
  /** 每一层防线掉了多少耐久、有没有被破 */
  layers: { id: LayerId; lost: number; broken: boolean }[]
  hurt: { name: string; lost: number }[]
  /** 这一晚没能撑过去的人 */
  died: string[]
  /** 钉板扎死、燃烧瓶烧死的 */
  trapKills: number
  fireKills: number
  /** 打倒的大块头 */
  bruteKills: number
  food: number
  water: number
}

/** 日记里的一条（界面用 i18n key 显示） */
export interface LogEntry {
  day: number
  hour: number
  key: string
  vars?: Record<string, string | number>
}

/** 出门的一趟 */
export interface Trip {
  /** 第几趟（同时可以有好几拨人在外面） */
  id: number
  def: TripDef
  members: Actor[]
  /** out = 正走出门 / 上车；away = 在路上；shop = 到了店里，等你挑东西（游戏暂停）；back = 回到家门口往屋里搬 */
  phase: 'out' | 'away' | 'shop' | 'back'
  /** 什么时候回来（绝对游戏小时 = day*24+hour） */
  back: number
  /** 开面包车去的 */
  van?: boolean
  /** 采购：什么时候到店（绝对游戏小时）；挑完了没有；买的东西（带回家时一次入库）；花了多少 */
  shopAt?: number
  shopped?: boolean
  cargo?: ShopItem['give']
  spent?: number
  /** 卖东西换回来的钱 / 晶核 */
  sold?: number
}

/** 住进来的人叫什么 */
const NEWCOMERS = ['阿杰', '老秦', '小周', '阿梅', '老郑', '小林', '阿彬']
/** 文字版幸存者名字里的女名（门外是姑娘的话从这里挑） */
const FEMALE_NAMES = new Set(['小雨', '阿芳', '晓晓', '小美', '阿花', '小婷', '阿梅'])

const placeName = (id: string) => lt(locations.find((l) => l.id === id)?.name ?? { zh: id })

/** 出门和回来都走街的东头 */
const EXIT: Where = { x: 31, z: 18, floor: 0 }
const HOME_IN: Where = { x: 4, z: 11, floor: 0 }
/** 搜刮回来卸货的地方：客厅西北角储物箱旁边 */
const STORE = [{ x: 10.6, z: 4.6 }, { x: 10.0, z: 5.0 }, { x: 10.6, z: 1.0 }, { x: 10.0, z: 3.4 }]

export interface PersonHud {
  name: string
  /** 住进来的人的特质名（比如"修车工"） */
  trait?: string
  /** 离家出走 / 不在了 */
  gone?: 'runaway' | 'lost' | 'dead' | 'lent'
  /** 出门在外：去哪了、还有几小时回来 */
  trip?: { id: string; left: number; n: number; leaving: boolean }
  fitness: number
  /** 重伤还要躺几个小时（0 = 没有） */
  injured: number
  health: number
  needs: Needs
  doing: TaskKind | 'down'
  going: boolean
  floor: Floor
}

/** 一家人的时钟、存货、自主行动 */
export class Household {
  readonly actors: Actor[]
  readonly navs: Record<Floor, NavGrid>
  clock: Clock = { day: 0, hour: 7.5 }
  speed = 1
  stock: Stock = { food: 12, water: 12 }
  /** 霰弹枪子弹 */
  readonly ammo = { n: 24 }
  /** 打丧尸掉的晶核 */
  cores = 0
  /** 每一层防线现在的耐久（被破了第二天要修） */
  barriers: Barriers = fullBarriers()
  siege: Siege | null = null
  readonly log: LogEntry[] = []
  /** World 提供：生成一只丧尸（带 3D 模型）、战斗特效 */
  spawnZombie: ((at: Pt, raider: boolean, brute?: boolean, kind?: ZombieKind) => Zombie) | null = null
  onSiege: ((e: SiegeEvent) => void) | null = null
  /** 哪一天的晚上已经来过丧尸了 */
  nightDone = -1
  /** 最近一晚的战报（界面看完就清掉） */
  report: NightReport | null = null
  private before: { ammo: number; cores: number; barriers: Barriers; health: number[]; food: number; water: number; crisis: boolean; trapKills: number; fireKills: number; bruteKills: number } | null = null
  /** 序章存款（元）、急救包、加固铁门多出来的耐久 */
  money = 18000
  medkits = 0
  gateBonus = 0
  /** 野外采集：每一处上次采的是哪天；攒着的草药（够 3 份妈妈就捣成急救包） */
  forageDay: Record<string, number> = {}
  herbs = 0
  /** 砍回来的竹子；院子里两排竹尖刺（hits = 还能扎几只，0 = 没有） */
  bamboo = 0
  readonly spikes: SpikeRow[] = SPIKE_ROWS.map((r) => ({ ...r, hits: 0 }))
  /** 正在削的那一排（削好之前别再派人） */
  private crafting = -1
  /** 压水井：今天压了几回（一天最多 PUMP_MAX 回）；鸡今天喂了没有 */
  pumpDay = -1
  pumpCount = 0
  fedDay = -1
  /** 一共捡过几回蛋 */
  eggs = 0
  static readonly PUMP_MAX = 3
  static readonly PUMP_WATER = 0.6
  static readonly EGGS_FOOD = 0.3
  /** 在外面的几拨人 */
  trips: Trip[] = []
  private tripSeq = 0
  /** 新的一趟的编号（读档恢复的也要从这里拿，不然会跟后来出门的重号） */
  nextTripId(): number {
    return ++this.tripSeq
  }
  /** 第一拨在外面的人（老代码和测试用） */
  get trip(): Trip | null {
    return this.trips[0] ?? null
  }
  /** World 提供：有人到了店里（弹出交易界面，游戏暂停）；没有界面（测试）就按默认清单买 */
  onShop: ((t: Trip) => void) | null = null
  /** 这场雨木桶接了多少水 */
  private rainWater = 0
  /** 正在门口的访客 */
  visitor: Visitor | null = null
  /** 这次门外陌生人长什么样（STRANGER_MODELS 之一） */
  visitModel = 'stranger'
  /** 男主正在往铁门送东西 */
  courier: Courier | null = null
  /** 访客到了门口、等玩家回话（界面弹对话框） */
  talking: VisitorDef | null = null
  /** 已经来过的访客（id → 哪天） */
  seen: Record<string, number> = {}
  helpedNeighbor = false
  /** 男主好感（江野是青梅竹马，一开始就有 40） */
  affection: Record<string, number> = { jiangye: 40, guchen: 0, shenyan: 0, xielin: 0, neighbor: 20 }
  /** 谢临塞进来的第几张纸条 */
  xielinNotes = 0
  /** 院子砌了石头院墙：铁门更结实，隔着栏杆被抓伤的事也没了 */
  wall = false
  /** 铁门外的钉板（耐久 0~100；0 = 没铺或者踩烂了） */
  readonly trap = { hp: 0 }
  /** 第一个尸潮危机夜街尽头那个人（阿寂的伏笔），看过就不再出现 */
  cameoSeen = false
  /** 菜地：开了没有、长到多少（1 = 能收）、哪天浇过水 */
  garden: { built: boolean; growth: number; watered: number } = { built: false, growth: 0, watered: -1 }
  /** 末日前去军区门口见过顾沉 */
  guchenMet = false
  /** 顾沉送的头盔：女主被咬伤害减半 */
  helmet = false
  /** 顾沉的对讲机提醒过：今晚少来几只 */
  fewerTonight = false
  careDay = -1
  warnedJiangye = false
  /** 这次江野来送的是哪一样（0 罐头 / 1 斧子 / 2 焊铁门） */
  careVariant = 0
  /** 拒绝了黑鸦：今晚他们来抢 */
  raidTonight = false
  /** 白天当场打起来的那一场（不会因为"天亮了"就结束） */
  private dayRaid = false
  /** 陌生人透露的线索：下次去那里搜刮翻倍 */
  tip: string | null = null
  /** 女主的空间异能：放进去的吃喝不会被抢、被淹、被打翻（文字版的设定：用空间不涨暴露） */
  space: Stock = { food: 0, water: 0 }
  /** 燃烧瓶（酒精 + 布条），打丧尸时可以扔 */
  molotovs = 2
  /** 汽油（桶）：开面包车出门一趟烧一桶 */
  fuel = 3
  /** 面包车开出去了，车位上没车 */
  vanAway = false
  /** 车正在开出去 / 开回来 */
  vanMove: VanMove | null = null
  /** 改装面包车的材料带回来了（等爸爸动手） */
  vanKit = false
  /** 面包车改装过了：铁栏、防撞杠、钢板 */
  vanArmor = false
  /** 末日后哪天开过车（发动机的动静会把丧尸引过来，当晚多来一只） */
  noiseDay = -1
  /** 女主自己把车开到别处停着（null = 停在院子里的车位上） */
  vanAt: { x: number; z: number; rot: number } | null = null
  /** 院子西边晾着衣服 */
  laundryOut = false
  /** 哪天晾过了（一天晾一次） */
  laundryDay = -1
  /** 女主正在街上搜东西 */
  search: { spot: ScavengeSpot; left: number } | null = null
  /** 每个地方哪天搜过 */
  searched: Record<string, number> = {}
  /** 女主在江边钓鱼：还要等多久下一条咬钩 */
  fishing: { left: number } | null = null
  fishCaught = 0
  spaceCap = 6
  /** 哪一天晚上是气候危机的暴雨夜 */
  storm = -1
  flooded = -1
  spawnVisitor: ((def: VisitorDef, at: Pt, model: string) => Visitor) | null = null
  spawnCourier: ((who: CourierId, at: Pt) => Courier) | null = null
  /** 末日降临的那一刻 */
  onDoomsday: (() => void) | null = null
  /** 送东西的人在铁门外放下了东西 / 走了 */
  onCourier: ((c: Courier, phase: 'drop' | 'gone') => void) | null = null
  /** World 提供：做一个新的家庭成员（带 3D 模型） */
  makeActor: ((name: string, model: string, at: Pt) => Actor) | null = null
  onKnock: (() => void) | null = null
  private visitCheck = -1
  /** 今天已经来过访客了 */
  visitDay = -1
  private readonly spots: Spot[]
  private readonly beds: Spot[]
  private readonly taken = new Map<Spot, Actor>()
  private seed = 20261009

  constructor(actors: Actor[], navs: Record<Floor, NavGrid>, style: 'toon' | 'paradise') {
    this.actors = actors
    this.navs = navs
    this.beds = BEDS[style]
    this.spots = [...SPOTS, ...(style === 'paradise' ? PARADISE_SPOTS : []), ...this.beds]
  }

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }

  /** 这个位置现在谁在用（或者正走过去） */
  whoUses(spot: Spot): Actor | undefined {
    return this.taken.get(spot)
  }

  get allSpots(): readonly Spot[] {
    return this.spots
  }

  /** 每帧调用。dt 是现实秒数（已经限过最大值） */
  tick(dt: number, autonomous: (a: Actor) => boolean): void {
    if (this.speed <= 0 || this.over) return
    const wasPrologue = this.clock.day < PROLOGUE_DAYS
    this.clock = advance(this.clock, dt, this.speed)
    // 跨进末日第一天：记一笔，World 那边放警报和字幕
    if (wasPrologue && this.clock.day >= PROLOGUE_DAYS) {
      this.note('world.log.doomday')
      this.onDoomsday?.()
    }
    const hours = (dt * this.speed * 24) / DAY_SECONDS
    this.siegeTick(dt * this.speed)
    const fighting = !!this.siege && !this.siege.done
    const nurse = this.hasTrait('trait_nurse')
    this.tripTick()
    this.careTick()
    this.runawayTick()
    this.lentTick()
    this.rainTick(hours)
    this.gardenGrow(hours)
    this.searchTick(hours)
    this.fishingTick(hours)
    this.streetTick()
    this.chatTick(hours)
    this.visitorTick()
    this.courierTick(hours)
    this.orderTick()
    this.healTick()
    for (const a of this.actors) {
      if (a.dead) continue
      // 出门在外（去公司、去店里、借给顾沉……画面上看不见的时候）：吃的喝的不掉，回来还是走的时候那样
      if (!(a.away && (this.onTrip(a) || this.lent?.name === a.name))) {
        const e0 = a.needs.energy
        a.needs = decayNeeds(a.needs, hours, this.activity(a), this.isInjured(a))
        // 异能者：醒着精力只掉四成，睡觉恢复快一倍半
        if (a.esper) {
          const d = a.needs.energy - e0
          a.needs = { ...a.needs, energy: Math.max(0, Math.min(100, e0 + (d < 0 ? d * 0.4 : d * 1.6))) }
        }
      }
      // 伤慢慢好：睡觉时好得快；伤得重又有急救包就用掉一个
      a.health = Math.min(100, a.health + hours * (a.task?.kind === 'sleep' ? 2.5 : 0.6) * (nurse ? 2 : 1))
      if (!fighting && !a.away && a.health < 45 && this.medkits > 0) {
        this.medkits -= 1
        a.health = Math.min(100, a.health + 40)
        this.note('world.log.medkit', { who: a.name })
      }
      if (fighting || this.onTrip(a) || a.runaway || a.lost || this.lent?.name === a.name) continue
      this.consequences(a, hours)
      // 刚刚死了或者离家出走了：别再给 TA 派活（不然会一直占着床、占着位置）
      if (a.lost || a.dead || a.runaway) continue
      if (a.task) this.runTask(a, hours)
      else {
        a.hold = Math.max(0, a.hold - hours)
        if (a.hold <= 0 && !a.path.length && !a.settling && autonomous(a)) this.think(a)
      }
    }
  }

  // --- 来敲门的人 -------------------------------------------------------------

  visitorCtx(): VisitorCtx {
    const c = this.clock
    return {
      day: c.day, hour: c.hour, prologue: c.day < PROLOGUE_DAYS,
      month: c.day < PROLOGUE_DAYS ? 0 : Math.floor((c.day - PROLOGUE_DAYS) / 4) + 1,
      food: this.stock.food, water: this.stock.water, ammo: this.ammo.n, seen: this.seen, helpedNeighbor: this.helpedNeighbor, residents: this.residents,
      affection: this.affection, warnedJiangye: this.warnedJiangye, guchenMet: this.guchenMet, lendable: this.lendable().length, xielinNotes: this.xielinNotes, jiangyeHome: this.jiangyeHome, shenyanHome: this.shenyanHome,
      worstHealth: Math.min(...this.actors.filter((a) => !a.away && !a.lost).map((a) => a.health)), medkits: this.medkits,
    }
  }

  private visitorTick(): void {
    const v = this.visitor
    // 请来做客的人到点了：上门（打丧尸时、门口有别人时等一等）
    const inv = this.invited
    if (!v && inv && this.absHour >= inv.at && this.spawnVisitor && !(this.siege && !this.siege.done)) {
      const def = INVITES.find((d) => d.id === `invite_${inv.id}`)
      this.invited = null
      if (def) { this.startVisit(def); return }
    }
    if (!v) {
      // 每个游戏小时掷一次：一天最多来一个
      const hour = Math.floor(this.absHour)
      if (hour === this.visitCheck || !this.spawnVisitor || (this.siege && !this.siege.done)) return
      this.visitCheck = hour
      if (this.visitDay === this.clock.day) return
      const ctx = this.visitorCtx()
      const def = VISITORS.find((d) => d.when(ctx) && this.rand() < d.chance)
      if (def) this.startVisit(def)
      return
    }
    if (v.phase === 'walk' && !v.path.length) {
      v.phase = 'talk'
      v.face(0, -1, 1)
      this.talking = v.def
      this.onKnock?.()
    } else if (v.phase === 'leave' && !v.path.length) {
      v.root.removeFromParent()
      this.visitor = null
    }
  }

  /** 让某个访客现在就来（也给原型调试用） */
  startVisit(def: VisitorDef): void {
    if (this.visitor || !this.spawnVisitor) return
    const east = this.rand() < 0.5
    const at = { x: east ? 30 : -20, z: 18 }
    if (def.id === 'jiangye_care') this.careVariant = Math.floor(this.rand() * 3)
    // 讨饭的陌生人每次长得不一样（男女老少），黑鸦的人还是那个年轻男人
    this.visitModel = def.id === 'beggar' ? STRANGER_MODELS[Math.floor(this.rand() * STRANGER_MODELS.length)] : def.model
    const v = this.spawnVisitor(def, at, this.visitModel)
    v.setPath(route(this.navs, { ...at, floor: 0 }, { x: 4 + (this.rand() - 0.5) * 0.6, z: 14.1, floor: 0 }) ?? [])
    this.visitor = v
    // 一天最多来一个；"来过"等回完话再记（路上刷新网页的话，这个访客以后还会来）
    this.visitDay = this.clock.day
  }

  /** 困难模式（给设计者对比用：丧尸多一半、更狠、大块头更多、开局子弹减半） */
  hard = false

  /** 从五金店带回来的弩（给爸爸；爸爸不在就给家里别的人） */
  crossbow = false

  /** 把弩交给爸爸（不在了就交给家里最健康的人，女主自己用霰弹枪） */
  equipCrossbow(): void {
    if (!this.crossbow) return
    // 原来拿弩的人不在了：先收回来
    for (const a of this.actors) if (a.weapon === 'crossbow' && (a.dead || a.lost)) a.weapon = 'pin'
    if (this.actors.some((a) => a.weapon === 'crossbow')) return
    const dad = this.actors[2]
    const holder = dad && !dad.dead && !dad.lost ? dad
      : this.actors.filter((a) => a !== this.actors[0] && !a.guest && !a.dead && !a.lost).sort((x, y) => y.health - x.health)[0]
    if (holder) holder.weapon = 'crossbow'
  }

  /** 江野住进来了（不再来访、危机夜也不用"来帮忙"了） */
  jiangyeHome = false
  /** 沈砚住进来了（不再上门、也不再送药，他就在家里） */
  shenyanHome = false

  /** 这一局已经因为困难模式减过一次子弹（来回切换不会一直减） */
  hardHalved = false

  /** 疫病夜以后沈砚哪天来送药（-1 = 不来） */
  medicTomorrow = -1

  /** 这一世一共打倒了多少（算重生点用） */
  kills = 0

  /** 借给顾沉守防线的家人：什么时候回来 */
  lent: { name: string; back: number } | null = null
  static readonly LEND_HOURS = 48

  /** 不在家（出门、出走、死了、借给顾沉——包括还在往外走的路上） */
  isOut(a: Actor): boolean {
    return a.away || a.lost || a.dead || !!a.runaway || this.onTrip(a) || this.lent?.name === a.name
      || (this.heroDriving && a === this.actors[0])
  }

  /** 女主正坐在面包车里自己开（这段时间不派活、不能派出门、别人不来找她） */
  heroDriving = false

  /** 今晚的丧尸夜快到了还没打（末日后 20:45 起，到打完为止） */
  get nightPending(): boolean {
    return this.clock.day >= PROLOGUE_DAYS && this.clock.hour >= 20.75 && this.nightDone !== this.clock.day
  }

  /** 能借出去的家人：不算女主、来帮忙的客人、不在家的；已经借出去一个就不能再借 */
  lendable(): Actor[] {
    if (this.lent) return []
    return this.actors.filter((a) => a !== this.actors[0] && !a.guest && !this.isOut(a))
  }

  /** 借出去的人：走出街口就不见了；两天后带着子弹和吃的回来 */
  private lentTick(): void {
    const l = this.lent
    if (!l) return
    const a = this.actors.find((x) => x.name === l.name)
    if (!a || a.dead) { this.lent = null; return }
    // 走到街口才消失；路被打断了（打仗、被点了）就接着往街口走
    if (!a.away && !a.path.length) {
      if (Math.hypot(a.pos.x - EXIT.x, a.pos.z - EXIT.z) < 1.5) a.away = true
      else if (!this.siege || this.siege.done) a.setPath(route(this.navs, a.pos, EXIT) ?? [])
    }
    if (a.away && this.absHour >= l.back && !(this.siege && !this.siege.done)) {
      this.lent = null
      a.away = false
      a.floor = 0
      a.root.position.set(EXIT.x, 0, EXIT.z)
      a.needs = { hunger: 60, thirst: 60, energy: 45, mood: 60 }
      a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
      this.ammo.n += 10
      this.stock = { ...this.stock, food: this.stock.food + 3 }
      this.affection.guchen = Math.min(100, (this.affection.guchen ?? 0) + 5)
      this.note('world.guchen.back', { who: a.name })
    }
  }

  /** 对话里的代词：门外是姑娘就用"她" */
  visitVars(): Record<string, string> {
    return { ta: isFemaleModel(this.visitModel) ? '她' : '他' }
  }

  /** 男主送东西上门。有 3D 就真的走到铁门外放下再走，日志等放下了再记；没有（测试、卡通版没模型）就直接记 */
  private sendCourier(who: CourierId, key: string, vars: Record<string, string | number>): Courier | null {
    if (!this.spawnCourier || this.courier) { this.note(key, vars); return null }
    const east = this.rand() < 0.5
    const at = { x: east ? 30 : -20, z: 18 }
    const c = this.spawnCourier(who, at)
    c.pending = { key, vars }
    c.setPath(route(this.navs, { ...at, floor: 0 }, { x: 4.6 + (this.rand() - 0.5) * 0.8, z: 14.3, floor: 0 }) ?? [])
    this.courier = c
    return c
  }

  private courierTick(hours: number): void {
    const c = this.courier
    if (!c) return
    if (c.phase === 'walk' && !c.path.length) {
      c.phase = 'drop'
      c.wait = 0.2
      c.face(0, -1, 1)
      if (c.pending) this.note(c.pending.key, c.pending.vars)
      c.pending = null
      if (c.order) { this.applyGives(cartGives(ONLINE_SHOP, c.order.cart)); c.order = null }
      this.onCourier?.(c, 'drop')
    } else if (c.phase === 'drop' && (c.wait -= hours) <= 0) {
      c.phase = 'leave'
      c.setPath(route(this.navs, { ...c.pos, floor: 0 }, { ...c.home, floor: 0 }) ?? [])
    } else if (c.phase === 'leave' && !c.path.length) {
      c.root.removeFromParent()
      this.courier = null
      this.onCourier?.(c, 'gone')
    }
  }

  // --- 手机：网购、打电话 -----------------------------------------------------

  /** 网购的单子：送到的时刻（游戏小时）到了，快递小哥就送到铁门外 */
  orders: { id: number; cart: Cart; total: number; arrive: number }[] = []
  private orderSeq = 0
  /** 打过电话：联系人 → 哪天（一天一次） */
  calls: Record<string, number> = {}
  /** "今天是最后一天能网购"提醒过的那天 */
  phoneReminded = -1
  /** 要在界面上弹一句提醒（World 接成小字条） */
  onRemind: ((key: UiKey) => void) | null = null
  /** 有进账：在这个人（或者这个地方）头顶飘一行字，比如"💧+0.6" */
  onGain: ((text: string, who: Actor | null, at?: Pt) => void) | null = null

  /** 末日后没信号；末日前一天快递停运（第二天就是末日，送不到了） */
  orderState(): 'ok' | 'closed' | 'nosignal' {
    if (this.clock.day >= PROLOGUE_DAYS) return 'nosignal'
    if (this.clock.day >= PROLOGUE_DAYS - 1) return 'closed'
    return 'ok'
  }

  placeOrder(cart: Cart): 'ok' | 'money' | 'empty' | 'closed' | 'nosignal' | 'stock' {
    const st = this.orderState()
    if (st !== 'ok') return st
    const total = orderTotal(cart, this.clock.day)
    if (total <= 0) return 'empty'
    if (ONLINE_SHOP.items.some((it) => (cart[it.id] ?? 0) > it.stock)) return 'stock'
    if (total > this.money) return 'money'
    this.money -= total
    const arrive = (this.clock.day + 1) * 24 + DELIVERY_HOUR + this.rand() * 0.8
    this.orders.push({ id: ++this.orderSeq, cart: { ...cart }, total, arrive })
    this.note('world.phone.ordered', { what: cartLabel(ONLINE_SHOP, cart), n: total })
    return 'ok'
  }

  private orderTick(): void {
    // 最后一天能网购：早上提醒一次（明天下单就赶不上了）
    if (this.clock.day === PROLOGUE_DAYS - 2 && this.clock.hour >= 8 && this.phoneReminded !== this.clock.day) {
      this.phoneReminded = this.clock.day
      this.note('world.phone.lastDay')
      this.onRemind?.('world.phone.lastDayToast')
    }
    const due = this.orders.find((o) => this.absHour >= o.arrive)
    if (!due || (this.siege && !this.siege.done)) return
    // 铁门外有人在送东西：等他走了再来
    if (this.spawnCourier && this.courier) return
    this.orders = this.orders.filter((o) => o !== due)
    const what = cartLabel(ONLINE_SHOP, due.cart)
    const c = this.sendCourier('express', 'world.phone.delivered', { what })
    if (c) c.order = { cart: due.cart }
    else this.applyGives(cartGives(ONLINE_SHOP, due.cart))
  }

  /** 手机通讯录：江野、王阿姨一开始就有；别的男主见过才有；出门在外、离家出走的家人 */
  contacts(): { id: string; name: string; icon: string; status: string; can: 'ok' | 'done' | 'nosignal' | 'home'; aff?: number }[] {
    const signal = this.clock.day < PROLOGUE_DAYS
    const can = (id: string) => (!signal ? 'nosignal' : this.calls[id] === this.clock.day ? 'done' : 'ok') as 'ok' | 'done' | 'nosignal'
    const out: ReturnType<Household['contacts']> = []
    for (const a of this.actors.slice(1)) {
      if (a.dead || a.lost) continue
      if (a.runaway) out.push({ id: `fam:${a.name}`, name: a.name, icon: '💔', status: t_('world.phone.st.runaway'), can: can(`fam:${a.name}`) })
      else if (this.onTrip(a)) {
        const trip = this.trips.find((x) => x.members.includes(a))!
        out.push({ id: `fam:${a.name}`, name: a.name, icon: '🚶', status: t_('world.phone.st.trip', { h: Math.max(0, trip.back - this.absHour).toFixed(1) }), can: can(`fam:${a.name}`) })
      }
    }
    const lead = (id: string, name: string, icon: string, known: boolean) => {
      if (!known) return
      const home = this.actors.some((a) => a.model === id && !a.dead && !a.lost)
      out.push({ id, name, icon, status: t_(home ? 'world.phone.st.home' : `world.phone.st.${id}` as UiKey), can: home ? 'home' : can(id), aff: Math.round(this.affection[id] ?? 0) })
    }
    lead('jiangye', '江野', '🔥', true)
    lead('neighbor', '王阿姨', '👵', true)
    lead('shenyan', '沈砚', '🩺', this.seen.shenyan_meet !== undefined)
    lead('guchen', '顾沉', '⚡', this.seen.guchen_visit !== undefined)
    lead('xielin', '谢临', '⏳', this.seen.xielin_meet !== undefined)
    return out
  }

  /** 打电话：一天一次。女主心情变好；男主加好感；出门的家人报个平安；离家出走的人有一半机会劝得回来 */
  call(id: string): { r: 'ok' | 'done' | 'nosignal' | 'home'; line?: string } {
    const c = this.contacts().find((x) => x.id === id)
    if (!c) return { r: 'nosignal' }
    if (c.can !== 'ok') return { r: c.can }
    this.calls[id] = this.clock.day
    const hero = this.actors[0]
    const cheer = (v: number) => { hero.needs = { ...hero.needs, mood: Math.min(100, hero.needs.mood + v) } }
    const n = Math.floor(this.rand() * 3)
    if (id.startsWith('fam:')) {
      const a = this.actors.find((x) => x.name === id.slice(4))!
      if (a.runaway) {
        if (this.rand() < 0.5 && a.runaway.back > this.absHour) {
          a.runaway.persuaded = true
          a.runaway.back = Math.min(a.runaway.back, this.absHour + 2)
          cheer(10)
          return { r: 'ok', line: t_('world.phone.persuaded', { who: a.name }) }
        }
        return { r: 'ok', line: t_('world.phone.noAnswer', { who: a.name }) }
      }
      cheer(5)
      a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 5) }
      return { r: 'ok', line: t_(`world.phone.line.trip${n}` as UiKey) }
    }
    cheer(6)
    // 打电话聊聊天：感情涨一点
    this.affection[id] = Math.min(100, (this.affection[id] ?? 0) + 4)
    return { r: 'ok', line: t_(`world.phone.line.${id}${n}` as UiKey) }
  }

  /** 今天请过人了（一天只能请一个） */
  inviteDay = -1
  /** 请了谁、什么时候到（游戏绝对小时） */
  invited: { id: string; at: number } | null = null

  /** 手机上请人来家里做客：一两个小时后到（太晚了就明天上午来）；末日后没信号 */
  invite(id: string): 'ok' | 'done' | 'nosignal' | 'home' | 'none' {
    const c = this.contacts().find((x) => x.id === id)
    if (!c || id.startsWith('fam:')) return 'none'
    if (c.can === 'nosignal') return 'nosignal'
    if (c.can === 'home') return 'home'
    if (this.inviteDay === this.clock.day || this.invited) return 'done'
    this.inviteDay = this.clock.day
    const h = this.clock.hour
    // 白天 9 点到下午 4 点半才上门
    const at = h < 8 ? this.clock.day * 24 + 9.5 : h < 15 ? this.absHour + 1 + this.rand() : (this.clock.day + 1) * 24 + 9.5
    this.invited = { id, at }
    this.note('world.invite.log', { who: c.name })
    return 'ok'
  }

  /** 最多住 5 个人 */
  static readonly MAX_RESIDENTS = 5

  get residents(): number {
    return this.actors.filter((a) => !a.lost && !a.guest).length
  }

  // --- 上街搜东西 -------------------------------------------------------------

  /** 这个地方现在能不能搜：'ok' / 'prologue'（末日前邻居还住着）/ 'empty'（刚搜过）/ 'busy' */
  canSearch(spot: ScavengeSpot): 'ok' | 'prologue' | 'empty' | 'busy' {
    if (this.clock.day < PROLOGUE_DAYS) return 'prologue'
    if (this.siege || this.search || this.fishing) return 'busy'
    const last = this.searched[spot.id]
    if (last !== undefined && this.clock.day - last < SCAVENGE_COOLDOWN_DAYS) return 'empty'
    return 'ok'
  }

  startSearch(spot: ScavengeSpot): boolean {
    if (this.canSearch(spot) !== 'ok') return false
    const hero = this.actors[0]
    hero.path = []
    hero.pose = 'work'
    this.search = { spot, left: spot.hours }
    return true
  }

  cancelSearch(): void {
    if (!this.search) return
    this.search = null
    this.actors[0].pose = 'idle'
  }

  private searchTick(hours: number): void {
    const s = this.search
    if (!s) return
    s.left -= hours
    if (s.left > 0) return
    this.search = null
    this.actors[0].pose = 'idle'
    this.searched[s.spot.id] = this.clock.day
    const loot = rollLoot(s.spot.kind, () => this.rand())
    this.stock = { food: this.stock.food + loot.food, water: this.stock.water + loot.water }
    this.ammo.n += loot.ammo
    this.medkits += loot.medkits
    const parts = (Object.entries(loot) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => t(`world.unit.${k}` as UiKey, { n: v }))
    this.note('world.log.scavenged', { what: parts.join('、') || t('world.unit.nothing'), where: t(`world.spot.${s.spot.kind}` as UiKey) })
    // 末日后搜东西动静大，可能把附近的丧尸引过来（夜里更危险）
    const night = isNight(this.clock.hour)
    if (this.rand() < s.spot.danger * (night ? 2 : 1)) this.ambush(s.spot)
  }

  /** 开始钓鱼（要站在江边钓鱼点附近） */
  startFishing(): boolean {
    if (this.fishing || this.search || this.siege) return false
    const hero = this.actors[0]
    hero.path = []
    hero.pose = 'fish'
    hero.root.rotation.y = THREE.MathUtils.degToRad(FISHING.face)
    this.fishing = { left: this.biteWait() }
    return true
  }

  stopFishing(): void {
    if (!this.fishing) return
    this.fishing = null
    this.actors[0].pose = 'idle'
  }

  /** 等多久才咬钩（游戏小时）；清早和傍晚鱼最欢 */
  private biteWait(): number {
    const h = this.clock.hour
    const good = (h > 5 && h < 8) || (h > 17 && h < 20)
    return (good ? 0.15 : 0.3) + this.rand() * (good ? 0.25 : 0.5)
  }

  /** 每条鱼算半份吃的；末日后夜里钓鱼，水边可能爬上来丧尸 */
  private fishingTick(hours: number): void {
    const f = this.fishing
    if (!f) return
    f.left -= hours
    if (f.left > 0) return
    f.left = this.biteWait()
    if (this.rand() < 0.65) {
      this.stock = { ...this.stock, food: this.stock.food + 0.5 }
      this.fishCaught++
      this.onFish?.(true)
      if (this.fishCaught === 1 || this.fishCaught % 4 === 0) this.note('world.log.fish', { n: this.fishCaught })
    } else if (this.clock.day >= PROLOGUE_DAYS && this.rand() < 0.12) {
      // 末日后偶尔钩上一个顺江漂下来的背包（上游有人没逃掉）
      const ammo = this.rand() < 0.6
      if (ammo) this.ammo.n += 3
      else this.medkits += 1
      this.onFish?.(true)
      this.note(ammo ? 'world.log.fishBagAmmo' : 'world.log.fishBagMedkit')
    } else this.onFish?.(false)
    if (this.clock.day >= PROLOGUE_DAYS && isNight(this.clock.hour) && this.rand() < 0.2) {
      this.stopFishing()
      this.ambush({ id: 'river', kind: 'barrel', at: FISHING.at, hours: 0, danger: 1 })
    }
  }

  /** 末日后女主在外面晃：偶尔有一只丧尸从街那头晃过来（每个游戏小时掷一次） */
  private streetCheck = -1
  private streetTick(): void {
    const hero = this.actors[0]
    // 女主在车里开着：不算在街上走（不会被围）
    if (this.clock.day < PROLOGUE_DAYS || this.siege || hero.away || this.heroDriving || this.isHomeBody(hero)) return
    const hour = Math.floor(this.absHour)
    if (hour === this.streetCheck) return
    this.streetCheck = hour
    const chance = isNight(this.clock.hour) ? 0.35 : 0.12
    if (this.rand() > chance) return
    const side = this.rand() < 0.5 ? -1 : 1
    // 在屋后江边就从江边那头来，在街上就从街那头来
    const z = hero.pos.z < YARD.z0 ? -7.5 : Math.min(19, Math.max(15.5, hero.pos.z))
    const x = Math.min(30, Math.max(-22, hero.pos.x + (hero.pos.x + side * 8 > 30 || hero.pos.x + side * 8 < -22 ? -side : side) * 8))
    this.ambush({ id: 'street', kind: 'car', at: { x, z }, hours: 0, danger: 1 }, 1)
  }

  /** World 提供：钓到/跑了（画面上浮漂一沉、溅水花） */
  onFish: ((caught: boolean) => void) | null = null
  /** 采到东西了（界面弹提示、出声音）；medkit = 这次草药凑够捣成了急救包 */
  onForage: ((s: ForageSpot, y: ForageYield, medkit: boolean) => void) | null = null

  /** 街上遇袭：一两只丧尸从附近冒出来扑向女主和跟着的人 */
  private ambush(spot: ScavengeSpot, count?: number): void {
    if (!this.spawnZombie || this.siege) return
    const n = count ?? (this.rand() < 0.4 ? 2 : 1)
    const at = Array.from({ length: n }, (_, k) => ({ x: spot.at.x + (k ? -5 : 6), z: spot.at.z + (k ? 1.5 : 2) }))
    const party = this.actors.filter((a) => !this.isOut(a) && !this.isHomeBody(a))
    // 女主不在外面（比如被派出门了）就不会遇袭
    if (!party.length) return
    this.cancelSearch()
    this.stopFishing()
    this.siege = new Siege({
      count: n, crisis: false, navs: this.navs, defenders: party,
      barriers: { gate: 0, door: 0, stairs: 0 }, ammo: this.ammo, ambushAt: at,
      spawn: this.spawnZombie, emit: (e) => this.onSiegeEvent(e),
    })
  }

  /** 打丧尸时用急救包把倒下的人救起来 */
  rescue(a: Actor): boolean {
    const s = this.siege
    if (!s || this.medkits <= 0 || !s.rescue(a)) return false
    this.medkits -= 1
    this.note('world.log.rescue', { who: a.name })
    return true
  }

  /** 打丧尸时扔一个燃烧瓶 */
  throwMolotov(): boolean {
    const s = this.siege
    if (!s || s.done || this.molotovs <= 0) return false
    if (!s.molotov()) return false
    this.molotovs -= 1
    return true
  }

  /** 有人住进来（trait 不给就随机一个） */
  addResident(name: string, model: string, at: Pt, trait?: string): Actor | null {
    if (!this.makeActor || this.residents >= Household.MAX_RESIDENTS) return null
    const a = this.makeActor(name, model, at)
    a.model = model
    // 沈砚是医生，拿擀面杖那种轻家伙；其他住进来的人拿砍刀
    a.weapon = model === 'shenyan' ? 'pin' : 'machete'
    a.trait = trait ?? survivorTraits[Math.floor(this.rand() * survivorTraits.length)].id
    if (a.trait === 'trait_mechanic') a.handy = true
    this.actors.push(a)
    return a
  }

  /** 家里（在家的人里）有没有这个特质 */
  hasTrait(id: string): boolean {
    return this.actors.some((a) => a.trait === id && !a.away && !a.lost && !a.runaway)
  }

  /** 玩家在对话框里选了 */
  answerVisitor(choice: string): void {
    const v = this.visitor
    const def = this.talking
    if (!v || !def) return
    this.seen[def.id] = this.clock.day
    const all = (d: number) => { for (const a of this.actors) a.needs = { ...a.needs, mood: Math.max(0, Math.min(100, a.needs.mood + d)) } }
    const food = (d: number) => { this.stock = { ...this.stock, food: Math.max(0, this.stock.food + d) } }
    if (def.id === 'neighbor_rice') {
      if (choice === 'give') { food(-1); all(6); this.helpedNeighbor = true } else this.actors[0].needs.mood = Math.max(0, this.actors[0].needs.mood - 3)
    } else if (def.id === 'neighbor_thanks') {
      this.stock = { ...this.stock, water: this.stock.water + 3 }
      this.medkits += 1
      all(4)
    } else if (def.id === 'beggar') {
      if (choice === 'give') { food(-1); all(5); this.tip = 'ruin_market' }
      else if (choice === 'invite') {
        // 让他住进来：门口的人直接变成家里人，走进院子
        const taken = (n: string) => this.actors.some((a) => a.name === n)
        const female = isFemaleModel(this.visitModel)
        const fits = (n: string) => !taken(n) && FEMALE_NAMES.has(n) === female
        const pool = survivorNames.map((n) => lt(n)).filter(fits)
        let name = pool[Math.floor(this.rand() * pool.length)] ?? NEWCOMERS.find(fits) ?? '新来的人'
        for (let k = 2; taken(name); k++) name = `新来的人${k}`
        const a = this.addResident(name, this.visitModel, { x: v.pos.x, z: v.pos.z })
        if (a) {
          a.health = 70
          a.needs = { hunger: 25, thirst: 40, energy: 50, mood: 70 }
          a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
          const tr = survivorTraits.find((x) => x.id === a.trait)
          this.note('world.visit.beggar.log.invite', { who: name, trait: tr ? `${lt(tr.name)}——${lt(tr.desc)}` : '', ...this.visitVars() })
          this.talking = null
          v.root.removeFromParent()
          this.visitor = null
          return
        }
      } else all(-4)
    } else if (def.id === 'scout') {
      // 给了水 = 让他把院子看清楚了：六成今晚带人来抢；亮出猎枪就吓退了；隔着门撵他走，一半当场翻墙打起来
      let outcome = choice
      if (choice === 'water') {
        this.stock = { ...this.stock, water: Math.max(0, this.stock.water - 1) }
        outcome = this.rand() < 0.6 ? 'marked' : 'thanks'
        if (outcome === 'marked') this.raidTonight = true
      } else if (choice === 'shut') outcome = this.rand() < 0.5 ? 'fight' : 'leave'
      else this.actors[0].needs.mood = Math.min(100, this.actors[0].needs.mood + 2)
      this.note(`world.visit.scout.log.${outcome}`, this.visitVars())
      this.talking = null
      v.phase = 'leave'
      v.setPath(route(this.navs, v.pos, { ...v.home, floor: 0 }) ?? [])
      if (outcome === 'fight') {
        // 大白天打起来：别让"天亮了丧尸散了"把这场架提前结束
        this.dayRaid = true
        this.startSiege(2 + Math.max(0, Math.floor((this.clock.day - PROLOGUE_DAYS) / 4)), false, true)
      }
      return
    } else if (def.id === 'crow_tax') {
      if (choice === 'pay') food(-3)
      else this.raidTonight = true
    } else if (def.id === 'jiangye_meet') {
      const love = (n: number) => { this.affection.jiangye = Math.min(100, (this.affection.jiangye ?? 0) + n) }
      if (choice === 'warn') { love(15); this.warnedJiangye = true; this.ammo.n += 6 }
      else if (choice === 'weld') {
        love(6)
        this.gateBonus = Math.min(120, this.gateBonus + 40)
        this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + 40)
      } else { love(10); all(8) }
    } else if (def.id === 'shenyan_meet') {
      const love = (n: number) => { this.affection.shenyan = Math.min(100, (this.affection.shenyan ?? 0) + n) }
      if (choice === 'treat') { love(10); for (const a of this.actors) if (!a.away) a.health = Math.min(100, a.health + 35) }
      else if (choice === 'medkit') { love(18); this.medkits -= 1; all(5) }
      else if (choice === 'stay') {
        // 留下来当家里的医生：先给大家治伤，再走进院子（护士特质：在家时大家伤好得快一倍）
        for (const a of this.actors) if (!a.away) a.health = Math.min(100, a.health + 35)
        const a = this.addResident('沈砚', 'shenyan', { x: v.pos.x, z: v.pos.z }, 'trait_nurse')
        if (a) {
          a.needs = { hunger: 60, thirst: 60, energy: 50, mood: 80 }
          a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
          this.shenyanHome = true
          love(10)
          this.note('world.visit.shenyan_meet.log.stay')
          this.talking = null
          v.root.removeFromParent()
          this.visitor = null
          return
        }
      }
    } else if (def.id === 'xielin_meet') {
      const love = (n: number) => { this.affection.xielin = Math.max(0, Math.min(100, (this.affection.xielin ?? 0) + n)) }
      if (choice === 'ask') { love(8); this.cores += 2 }
      else if (choice === 'dinner') { love(15); food(-1); all(5); this.barriers.stairs = this.maxOf('stairs') }
      else love(-5)
    } else if (def.id === 'guchen_visit') {
      const love = (n: number) => { this.affection.guchen = Math.max(0, Math.min(100, (this.affection.guchen ?? 0) + n)) }
      if (choice === 'lend') {
        // 挑一个能打的（壮实的优先，其次最健康的），跟着顾沉走出铁门
        const pick = this.lendable().sort((x, y) => (y.trait === 'trait_strong' ? 1 : 0) - (x.trait === 'trait_strong' ? 1 : 0) || y.health - x.health)[0]
        this.talking = null
        v.phase = 'leave'
        v.setPath(route(this.navs, v.pos, { ...v.home, floor: 0 }) ?? [])
        // 没人能借（比如调试按钮连按）：顾沉就这么走了
        if (!pick) return
        this.cancel(pick)
        pick.setPath(route(this.navs, pick.pos, EXIT) ?? [])
        this.lent = { name: pick.name, back: this.absHour + Household.LEND_HOURS }
        love(10)
        this.note('world.visit.guchen_visit.log.lend', { who: pick.name })
        return
      } else if (choice === 'ammo') { food(-4); this.ammo.n += 6; love(5) }
      else love(-2)
    } else if (def.id === 'jiangye_care') {
      this.affection.jiangye = Math.min(100, (this.affection.jiangye ?? 0) + 5)
      if (this.careVariant === 0) this.stock = { ...this.stock, food: this.stock.food + 4 }
      else if (this.careVariant === 1) this.actors[0].sidearm = 'axe'
      else this.barriers.gate = this.maxOf('gate')
      this.note(`world.visit.jiangye_care.log${this.careVariant}`)
      this.talking = null
      // 请他住下来：门口的江野直接变成家里人，走进院子
      if (choice === 'stay') {
        const a = this.addResident('江野', 'jiangye', { x: v.pos.x, z: v.pos.z }, 'trait_strong')
        if (a) {
          a.health = 100
          a.needs = { hunger: 80, thirst: 80, energy: 85, mood: 90 }
          a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
          this.jiangyeHome = true
          this.affection.jiangye = Math.min(100, (this.affection.jiangye ?? 0) + 10)
          this.note('world.visit.jiangye_care.log.stay')
          v.root.removeFromParent()
          this.visitor = null
          return
        }
      }
      v.phase = 'leave'
      v.setPath(route(this.navs, v.pos, { ...v.home, floor: 0 }) ?? [])
      return
    }
    if (def.id.startsWith('invite_')) this.answerInvite(def.id.slice(7), choice)
    this.note(`world.visit.${def.id}.log.${choice}`, this.visitVars())
    this.talking = null
    v.phase = 'leave'
    v.setPath(route(this.navs, v.pos, { ...v.home, floor: 0 }) ?? [])
  }

  /** 请来做客的人：一起做一件小事（各有各的收获），或者坐着聊聊天（感情涨得多、全家心情好） */
  private answerInvite(id: string, choice: string): void {
    const love = (n: number) => { this.affection[id] = Math.min(100, (this.affection[id] ?? 0) + n) }
    const gate = { x: 4, z: 13.2 }
    if (choice === 'chat') {
      love(8)
      for (const a of this.actors) if (!this.isOut(a) && !a.dead) a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 6) }
      this.onGain?.('❤+8', null, gate)
      return
    }
    love(5)
    if (id === 'jiangye') {
      // 帮忙把铁门再加固一遍
      this.gateBonus = Math.min(120, this.gateBonus + 30)
      this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + 30)
      this.onGain?.('🔩 铁门+30', null, gate)
    } else if (id === 'shenyan') {
      // 给全家检查身体：伤好一点，重伤的少躺一天，还留下几味草药
      for (const a of this.actors) {
        if (this.isOut(a) || a.dead) continue
        a.health = Math.min(100, a.health + 25)
        if (this.isInjured(a)) a.injured = Math.max(this.absHour + 1, a.injured - 24)
      }
      this.herbs += 2
      this.onGain?.('✚+25 🌿+2', null, gate)
    } else if (id === 'guchen') {
      // 带来一盒子弹，顺便教大家几招格斗
      this.ammo.n += 8
      for (const a of this.actors) if (!this.isOut(a) && !a.dead) a.fitness = Math.min(100, a.fitness + 2)
      this.onGain?.('🔫+8 💪+2', null, gate)
    } else if (id === 'xielin') {
      // 说一句"未来"的话：下一个危机夜是什么；再给一颗晶核
      this.cores += 1
      const next = PROLOGUE_DAYS + DAYS_PER_MONTH - 1 + Math.max(0, Math.floor((this.clock.day - PROLOGUE_DAYS) / DAYS_PER_MONTH)) * DAYS_PER_MONTH
      const kind = Household.crisisKind({ day: next, hour: 21 })
      this.note('world.invite.xielinHint', { day: next + 1, what: t_(`crisisKind.${kind ?? 'horde'}` as UiKey) })
      this.onGain?.('💎+1', null, gate)
    } else if (id === 'neighbor') {
      // 送来一大盘饺子
      this.stock = { ...this.stock, food: this.stock.food + 1.5 }
      this.onGain?.('🥟+1.5', null, gate)
    }
  }

  // --- 空间异能 ---------------------------------------------------------------

  /** 家里能吃能喝的（仓库 + 空间） */
  get available(): Stock {
    return { food: this.stock.food + this.space.food, water: this.stock.water + this.space.water }
  }

  /** 先用仓库里的，不够再从空间里拿 */
  private take(kind: keyof Stock, n: number): void {
    const fromStock = Math.min(this.stock[kind], n)
    this.stock = { ...this.stock, [kind]: this.stock[kind] - fromStock }
    const rest = n - fromStock
    if (rest > 0) this.space = { ...this.space, [kind]: Math.max(0, this.space[kind] - rest) }
  }

  /** 往空间里放（正数）或拿出来（负数），一次一份 */
  moveToSpace(kind: keyof Stock, n: number): boolean {
    const used = this.space.food + this.space.water
    if (n > 0 && (this.stock[kind] < n || used + n > this.spaceCap + 1e-6)) return false
    if (n < 0 && this.space[kind] < -n) return false
    this.stock = { ...this.stock, [kind]: this.stock[kind] - n }
    this.space = { ...this.space, [kind]: this.space[kind] + n }
    return true
  }

  static readonly SPACE_UPGRADE = 3

  /** 用晶核把空间扩大 */
  upgradeSpace(): boolean {
    if (this.cores < Household.SPACE_UPGRADE) return false
    this.cores -= Household.SPACE_UPGRADE
    this.spaceCap += 6
    this.note('world.log.spaceUp', { n: this.spaceCap })
    return true
  }

  // --- 一家人聊天 -------------------------------------------------------------

  /** 一起坐着歇、一起吃饭的人会聊起来：心情慢慢变好 */
  private chatTick(hours: number): void {
    const social = (a: Actor) => !!a.task && a.task.phase === 'use' && (a.task.kind === 'relax' || a.task.kind === 'sit' || a.task.kind === 'eat' || a.task.kind === 'company' || a.task.kind === 'interact') && !a.away
    const calm = !this.siege || this.siege.done
    for (const a of this.actors) {
      a.calm = calm
      if (a.line && (a.line.hours -= hours) <= 0) a.line = null
      // 帮忙搬的箱子放下了（或者被别的事打断了）
      if (a.carrying && a.task?.kind !== 'help' && !this.onTrip(a)) a.carrying = false
      a.chatting = social(a) && this.actors.some((b) => b !== a && social(b) && b.floor === a.floor
        && Math.hypot(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z) < 2.4)
      if (a.chatting) a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + hours * 5) }
    }
  }

  // --- 天气 -----------------------------------------------------------------

  get rain(): number {
    // 气候危机夜：从傍晚下到天亮的暴雨
    const c = this.clock
    if ((this.storm === c.day && c.hour >= 17) || (this.storm === c.day - 1 && c.hour < 7)) return 1
    return rainAt(c.day, c.hour)
  }

  private wasRaining = false

  /** 院子里的木桶接雨水；雨停了在日记里记一笔；刚下起雨来，院子里的人赶紧回屋 */
  private rainTick(hours: number): void {
    const r = this.rain
    const raining = r > 0.1
    if (raining && !this.wasRaining) {
      // 打丧尸（或者女主在街上被围）时先不管，打完了还在下就再叫大家回屋
      if (!this.siege || this.siege.done) { this.runInside(); this.wasRaining = true }
    } else this.wasRaining = raining
    if (r > 0) {
      const got = r * 0.3 * hours
      this.rainWater += got
      this.stock = { ...this.stock, water: this.stock.water + got }
    } else if (this.rainWater > 0) {
      if (this.rainWater >= 0.1) this.note('world.log.rainWater', { n: this.rainWater.toFixed(1) })
      this.rainWater = 0
    }
  }

  /** 下雨了：在院子里溜达、种地、擦车、撸猫、迎人的放下手里的事回屋（第一个人喊一声） */
  private runInside(): void {
    const outdoor = ['stroll', 'garden', 'wash', 'pet', 'company', 'idle', 'relax', 'tidy', 'greet', 'modvan', 'hang']
    let shouted = false
    for (const a of this.actors) {
      // 檐廊上面有阳台挡着，也算屋檐下
      if (this.isOut(a) || a.dead || a.floor !== 0 || a.settling || inRect(HOUSE, a.pos.x, a.pos.z) || inRect(PORCH, a.pos.x, a.pos.z)) continue
      if (!inRect(YARD, a.pos.x, a.pos.z)) continue
      if (a.task && (a.task.manual || !outdoor.includes(a.task.kind))) continue
      if (!a.task && a.path.length) continue
      this.release(a)
      a.task = null
      // 先走到屋檐下（大门里面一点），之后自己再想干什么（下雨天不会再去院子）；坐着的先从起身的位置走
      this.assign(a, { kind: 'idle', spot: null, phase: 'use', hours: 0.15, manual: false })
      const p = this.routeFor(a, { x: FRONT_DOOR.x - 0.4 + (shouted ? 0.8 : 0), z: FRONT_DOOR.z - 0.8, floor: 0 })
      if (p) a.setPath(p)
      if (!shouted) { a.line = { text: t_('world.say.rain'), hours: 0.2 }; shouted = true }
    }
    // 衣服还晾在外面：离得最近的闲人冒雨去收
    if (this.laundryOut && !this.actors.some((o) => o.task?.kind === 'fetch')) {
      const free = ['idle', 'stroll', 'relax', 'tidy', 'company', 'pet', 'wash', 'hang']
      // 楼上的人下楼要多走一段：按距离 + 楼层挑最近的
      const midZ = (CLOTHESLINE.z0 + CLOTHESLINE.z1) / 2
      const dist = (o: Actor) => Math.hypot(o.pos.x - CLOTHESLINE.x, o.pos.z - midZ) + o.floor * 8
      const cand = this.actors
        .filter((o) => o !== this.actors[0] && !o.guest && !this.isOut(o) && !o.dead && !o.settling && this.isHomeBody(o) && (!o.task || (!o.task.manual && free.includes(o.task.kind))))
        .sort((p, q) => dist(p) - dist(q))[0]
      const task = cand && this.laundryTask('fetch')
      if (cand && task) {
        this.release(cand)
        cand.task = null
        this.assign(cand, task)
        cand.line = { text: t_('world.say.laundry'), hours: 0.22 }
      }
    }
  }

  // --- 需求归零的后果 ---------------------------------------------------------

  private warned = new Map<string, number>()

  /** 每种警告一天只记一次 */
  private noteOnce(a: Actor, what: string, key: string): void {
    const k = `${a.name}:${what}`
    if (this.warned.get(k) === this.clock.day) return
    this.warned.set(k, this.clock.day)
    // 读档后"今天记过没有"的记忆没了：看一眼日记里今天是不是已经写过同一句
    if (this.log.some((l) => l.day === this.clock.day && l.key === key && l.vars?.who === a.name)) return
    this.note(key, { who: a.name })
  }

  private consequences(a: Actor, hours: number): void {
    const n = a.needs
    // 饿到、渴到底：掉健康；掉到底就死了（本世永久）
    if (n.hunger <= 0 || n.thirst <= 0) {
      // 又饿又渴约 25 个游戏小时（1 倍速 5 分钟）会死，只是饿或只是渴要两倍时间；急救包能吊住命
      a.health = Math.max(0, a.health - hours * (n.hunger <= 0 && n.thirst <= 0 ? 4 : 2))
      this.noteOnce(a, 'starve', n.thirst <= 0 ? 'world.log.thirsty' : 'world.log.starving')
      if (a.health < 30) this.noteOnce(a, 'dying', 'world.log.dying')
      if (a.health <= 0) { this.die(a, n.thirst <= 0 ? 'thirst' : 'starve'); return }
    }
    // 累到底：就地倒下睡着
    if (n.energy <= 0 && a.task?.kind !== 'sleep') {
      if (a === this.actors[0]) { this.stopFishing(); this.cancelSearch() }
      this.cancel(a)
      a.task = { kind: 'sleep', spot: null, phase: 'use', hours: 0, manual: false }
      a.pose = 'down'
      this.noteOnce(a, 'collapse', 'world.log.collapse')
    }
    // 抑郁：心情低于抑郁线累计一天，就会留张纸条离家出走（女主是玩家自己，不会走）
    a.lowMood = n.mood < DEPRESSED ? a.lowMood + hours : Math.max(0, a.lowMood - hours * 2)
    if (a.lowMood >= 24 && a !== this.actors[0]) this.runAway(a)
  }

  isInjured(a: Actor): boolean {
    return a.injured > this.absHour
  }

  /** 重伤：躺 48~72 个游戏小时，血压到 20 以下 */
  injure(a: Actor): void {
    a.injured = this.absHour + 48 + this.rand() * 24
    a.health = Math.min(a.health, 20)
    this.cancel(a)
    this.note('world.log.injured', { who: a.name, d: Math.round((a.injured - this.absHour) / 24) })
  }

  /** 用一个急救包给重伤的人换药包扎：少躺一天 */
  bandage(a: Actor): 'ok' | 'none' | 'fine' {
    if (!this.isInjured(a)) return 'fine'
    if (this.medkits < 1) return 'none'
    this.medkits -= 1
    a.injured = Math.max(this.absHour + 1, a.injured - 24)
    a.health = Math.min(100, a.health + 15)
    return 'ok'
  }

  /** 伤好了：记一笔 */
  private healTick(): void {
    for (const a of this.actors) {
      if (a.injured && a.injured <= this.absHour && !a.dead) {
        a.injured = 0
        a.health = Math.max(a.health, 50)
        this.note('world.log.healed', { who: a.name })
      }
    }
  }

  /** 女主死了：这一世结束（界面弹"再重生一次"） */
  over: { day: number; hour: number; cause: string } | null = null

  /** 有人死了。女主死了这一世就结束；家人死了本世永久不在，全家心情大跌 */
  die(a: Actor, cause: 'starve' | 'thirst' | 'crisis'): void {
    if (a.dead) return
    this.cancel(a)
    a.health = 0
    a.dead = true
    a.runaway = null
    a.path = []
    if (a === this.actors[0]) {
      // 女主倒在原地（不藏起来），游戏停在这一刻（先收竿、停下搜东西，它们会把姿势改回站着）
      this.stopFishing()
      this.cancelSearch()
      a.pose = 'down'
      this.over = { day: this.clock.day, hour: this.clock.hour, cause }
      this.note('world.log.heroDied')
      this.speed = 0
      return
    }
    a.lost = true
    a.away = true
    this.note(`world.log.died.${cause}`, { who: a.name })
    // 弩传给家里别的人
    if (a.weapon === 'crossbow') this.equipCrossbow()
    for (const b of this.actors) if (!b.dead) b.needs = { ...b.needs, mood: Math.max(0, b.needs.mood - 25) }
  }

  private runAway(a: Actor): void {
    this.cancel(a)
    a.runaway = { back: this.absHour + 24 + this.rand() * 24 }
    a.setPath(route(this.navs, a.pos, EXIT) ?? [])
    this.note('world.log.runaway', { who: a.name })
  }

  /** 离家出走的人：走到街头消失；到时候大概率再也不回来，小概率带着奇遇回来 */
  private runawayTick(): void {
    for (const a of this.actors) {
      const r = a.runaway
      if (!r || a.guest) continue
      if (!a.away && !a.path.length) a.away = true
      if (a.away && this.absHour >= r.back) {
        a.runaway = null
        // 打电话劝回来了：自己走回家（没有奇遇，心情回到一般）
        if (r.persuaded) {
          a.away = false
          a.lowMood = 0
          a.needs = { ...a.needs, mood: 55 }
          a.root.position.set(EXIT.x, 0, EXIT.z)
          a.floor = 0
          a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
          this.note('world.phone.cameBack', { who: a.name })
          continue
        }
        if (this.rand() < 0.2) {
          a.away = false
          a.lowMood = 0
          a.needs = { ...a.needs, mood: 65 }
          a.root.position.set(EXIT.x, 0, EXIT.z)
          a.floor = 0
          a.setPath(route(this.navs, a.pos, HOME_IN) ?? [])
          this.cores += 2
          this.stock = { ...this.stock, food: this.stock.food + 3 }
          this.note('world.log.adventure', { who: a.name })
        } else {
          a.lost = true
          this.note('world.log.lost1', { who: a.name })
          if (a.weapon === 'crossbow') this.equipCrossbow()
        }
      }
    }
  }

  // --- 出门 -----------------------------------------------------------------

  get absHour(): number {
    return this.clock.day * 24 + this.clock.hour
  }

  onTrip(a: Actor): boolean {
    return this.trips.some((t) => t.members.includes(a))
  }

  tripOf(a: Actor): Trip | undefined {
    return this.trips.find((t) => t.members.includes(a))
  }

  /** 这一层防线的耐久上限（铁门可以加固） */
  maxOf(id: LayerId): number {
    return LAYERS.find((l) => l.id === id)!.max + (id === 'gate' ? this.gateBonus + (this.wall ? 100 : 0) : 0)
  }

  static readonly TRAP_COST = 1500
  static readonly TRAP_CORES = 2

  /** 铁门外铺钉板、拉铁丝网（末日前花钱买，末日后用晶核换）；踩烂了可以重新铺 */
  buildTrap(): boolean {
    if (this.trap.hp > 0 || (this.siege && !this.siege.done)) return false
    if (this.clock.day < PROLOGUE_DAYS) {
      if (this.money < Household.TRAP_COST) return false
      this.money -= Household.TRAP_COST
    } else {
      if (this.cores < Household.TRAP_CORES) return false
      this.cores -= Household.TRAP_CORES
    }
    this.trap.hp = 100
    this.note('world.log.trap')
    return true
  }

  static readonly WALL_COST = 6000
  static readonly WALL_CORES = 6

  /** 砌院墙：末日前花钱请人砌，末日后用晶核换砖和水泥 */
  buildWall(): boolean {
    if (this.wall || this.siege) return false
    if (this.clock.day < PROLOGUE_DAYS) {
      if (this.money < Household.WALL_COST) return false
      this.money -= Household.WALL_COST
    } else {
      if (this.cores < Household.WALL_CORES) return false
      this.cores -= Household.WALL_CORES
    }
    this.wall = true
    this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + 100)
    this.note('world.log.wall')
    return true
  }

  /** 末日后去军区基地换东西要几颗晶核 */
  static readonly ARMY_PRICE = 5

  tripCheck(id: string, van = false): ReturnType<typeof canGo> | 'busy' | 'cores' | 'fuel' {
    // 有人在外面不耽误别人出门；只有打丧尸的时候不行
    if (this.siege && !this.siege.done) return 'busy'
    // 上班只有一份工：一次只能去一个人
    if (id === 'office' && this.trips.some((t) => t.def.id === 'office')) return 'busy'
    if (van && !this.vanReady(id)) return 'fuel'
    const ok = canGo(TRIPS.find((t) => t.id === id)!, this.clock.day < PROLOGUE_DAYS, this.money, this.clock.hour, van)
    if (ok === 'ok' && id === 'armygate' && this.clock.day >= PROLOGUE_DAYS && this.cores < 1) return 'cores'
    return ok
  }

  /** 从文字版这个地点的事件里挑一段，当作这一趟的见闻写进日记（只取文字） */
  private tripScene(locationId: string): void {
    const prologue = this.clock.day < PROLOGUE_DAYS
    const pool = textEvents.filter((e) => e.locationId === locationId && e.kind !== 'story'
      && !e.conditions?.some((c) => c.type === 'phase' && c.phase !== (prologue ? 'prologue' : 'apocalypse')))
    const ev = pool[Math.floor(this.rand() * pool.length)]
    if (!ev) return
    const outs = Object.values(ev.outcomes ?? {}).filter(Boolean)
    const out = outs[Math.min(outs.length - 1, 1 + Math.floor(this.rand() * Math.max(1, outs.length - 1)))]
    this.note('world.log.scene', {
      title: lt(ev.title),
      text: lt(ev.text),
      end: out?.text ? lt(out.text) : '',
    })
  }

  /** 军区门口/基地：不走通用的搜刮结算 */
  private settleArmy(t: Trip): void {
    const who = t.members.map((m) => m.name).join('、')
    if (this.clock.day < PROLOGUE_DAYS || t.back < PROLOGUE_DAYS * 24) {
      this.affection.guchen = Math.min(100, (this.affection.guchen ?? 0) + (this.guchenMet ? 3 : 8))
      this.note(this.guchenMet ? 'world.army.again' : 'world.army.meet', { who })
      this.guchenMet = true
      return
    }
    // 军区收编以后：交晶核换子弹和急救包；示警过的话顾沉多给一些
    this.cores = Math.max(0, this.cores - Household.ARMY_PRICE)
    const ammo = this.guchenMet ? 18 : 12
    this.ammo.n += ammo
    this.medkits += 1
    this.note(this.guchenMet ? 'world.army.tradeFriend' : 'world.army.trade', { who, ammo, cores: Household.ARMY_PRICE })
  }

  /** 末日后的早上：男主们偶尔送东西到门口（台词用文字版 content/npcs.ts 里的"关心"）。一天最多一件 */
  private careTick(): void {
    const c = this.clock
    if (c.day < PROLOGUE_DAYS || c.hour < 8 || this.careDay === c.day) return
    this.careDay = c.day
    // 疫病夜的第二天：沈砚送药来，全家健康 +15
    if (this.medicTomorrow === c.day) { this.medicTomorrow = -1; this.giveCare('shenyan', 1); return }
    // 谢临：同为重生者。第一张纸条一定是"下个月比你记得的更糟"
    if (this.xielinNotes === 0 || this.rand() < 0.15) this.giveCare('xielin')
    // 顾沉：末日前去军区门口见过他的话
    else if (this.guchenMet && this.rand() < 0.35) this.giveCare('guchen')
    // 沈砚：让他治过伤或送过他急救包的话
    else if ((this.affection.shenyan ?? 0) >= 10 && !this.shenyanHome && this.rand() < 0.3) this.giveCare('shenyan')
  }

  /** 男主送来的东西（东西马上到账；有 3D 的话人会走到铁门外放下） */
  giveCare(who: CourierId, pick?: number): void {
    const careText = (k: number) => {
      const npc = npcs.find((n) => n.id === who)
      return npc?.care?.[k] ? lt(npc.care[k].text) : ''
    }
    const love = (n: number) => { this.affection[who] = Math.min(100, (this.affection[who] ?? 0) + n) }
    if (who === 'xielin') {
      const k = this.xielinNotes === 0 ? 0 : 1 + Math.floor(this.rand() * 2)
      this.xielinNotes++
      if (k === 1) this.molotovs += 2
      else if (k === 2) this.cores += 1
      love(4)
      this.sendCourier('xielin', `world.xielin.note${k}`, { text: careText(k) })
    } else if (who === 'guchen') {
      const k = Math.floor(this.rand() * 3)
      if (k === 0) this.stock = { ...this.stock, food: this.stock.food + 3 }
      else if (k === 1) this.fewerTonight = true
      else { this.helmet = true; this.actors[0].helmet = true }
      love(3)
      this.sendCourier('guchen', `world.army.care${k}`, { text: careText(k) })
    } else {
      const k = pick ?? Math.floor(this.rand() * 3)
      if (k === 0) this.medkits += 2
      else if (k === 1) for (const a of this.actors) if (!a.away) a.health = Math.min(100, a.health + 15)
      else this.stock = { ...this.stock, water: this.stock.water + 4 }
      love(3)
      this.sendCourier('shenyan', `world.shenyan.care${k}`, { text: careText(k) })
    }
  }

  /** 派人出门：先走出铁门，到街东头消失，过几个小时扛着东西回来 */
  /** 面包车在家、有油，这趟能开车去 */
  vanReady(id: string): boolean {
    // 车已经派给别的一拨人了（哪怕他们还在走去上车）也不行
    return this.fuel >= Household.VAN_FUEL - 1e-6 && !this.vanAway && !this.vanMove && !this.vanAt && !this.trips.some((t) => t.van) && vanAllowed(id)
  }

  startTrip(id: string, members: Actor[], van = false): boolean {
    // 来帮忙的客人、出走的人不能派出去
    members = members.filter((a) => !a.guest && !this.isOut(a) && !this.isInjured(a))
    if (!members.length || this.tripCheck(id, van) !== 'ok') return false
    if (members.includes(this.actors[0])) { this.cancelSearch(); this.stopFishing() }
    const def = TRIPS.find((t) => t.id === id)!
    this.money -= tripCost(def, this.clock.day < PROLOGUE_DAYS)
    // 开一趟车烧 0.2 桶油（老板：一次一桶用太快了）
    if (van) this.fuel = Math.max(0, Math.round((this.fuel - Household.VAN_FUEL) * 10) / 10)
    // 开车：先走到车门边上车；走路：从街东头出去
    members.forEach((a, k) => {
      this.cancel(a)
      a.setPath(route(this.navs, a.pos, van ? { ...VAN_DOORS[k % VAN_DOORS.length], floor: 0 } : EXIT) ?? [])
    })
    this.trips.push({ id: this.nextTripId(), def, members, phase: 'out', back: this.absHour + tripHours(def, van), van })
    this.note('world.log.tripOut', { who: members.map((m) => m.name).join('、'), where: placeName(id) })
    return true
  }

  private tripTick(): void {
    for (const t of [...this.trips]) this.tripStep(t)
  }

  /** 到了店里：有界面就弹出来等你挑；没有界面（测试、自动跑）就按默认清单买 */
  private arriveShop(t: Trip): void {
    t.phase = 'shop'
    if (this.onShop) this.onShop(t)
    else this.checkout(t.id, this.defaultCart(t))
  }

  /** 这一趟能带回来几件 */
  tripCapacity(t: Trip): number {
    return capacity(t.members.length, !!t.van)
  }

  /** 没有界面时的默认清单：从上往下，每样买到钱或背包不够为止（留一点钱） */
  defaultCart(t: Trip): Cart {
    const shop = shopFor(t.def.id, this.clock.day < PROLOGUE_DAYS)
    const cart: Cart = {}
    if (!shop) return cart
    const wallet = shop.currency === 'money' ? this.money * 0.6 : this.cores
    const cap = this.tripCapacity(t)
    for (let round = 0; round < 20; round++) {
      let added = false
      for (const it of shop.items) {
        if (it.once || (cart[it.id] ?? 0) >= it.stock) continue
        const next = { ...cart, [it.id]: (cart[it.id] ?? 0) + 1 }
        const tot = cartTotal(shop, next, this.clock.day)
        if (tot.cost <= wallet && tot.weight <= cap) { cart[it.id] = next[it.id]; added = true }
      }
      if (!added) break
    }
    return cart
  }

  /** 在店里结账：钱（或晶核）马上扣，东西跟着人带回家。cart 为空 = 什么也不买，直接回家 */
  /** 家里某样东西有多少（卖东西用） */
  private have(key: keyof SellCart): number {
    if (key === 'food' || key === 'water') return this.stock[key]
    if (key === 'ammo') return this.ammo.n
    return this[key]
  }

  checkout(tripId: number, cart: Cart, sell: SellCart = {}): 'ok' | 'money' | 'heavy' | 'stock' | 'no' | 'short' {
    const t = this.trips.find((x) => x.id === tripId)
    if (!t || t.phase !== 'shop') return 'no'
    const shop = shopFor(t.def.id, this.clock.day < PROLOGUE_DAYS)
    const tot = shop ? cartTotal(shop, cart, this.clock.day) : { cost: 0, weight: 0 }
    if (shop) {
      // 先把卖的东西算进钱包（家里得真有这么多）
      for (const b of shop.buys ?? []) if ((sell[b.key] ?? 0) * b.lot > this.have(b.key) + 1e-6) return 'short'
      const proceeds = sellTotal(shop, sell)
      const wallet = (shop.currency === 'money' ? this.money : this.cores) + proceeds
      if (tot.cost > wallet) return 'money'
      if (tot.weight > this.tripCapacity(t)) return 'heavy'
      for (const it of shop.items) {
        const n = cart[it.id] ?? 0
        if (n > it.stock || (it.once && n > 0 && this.owns(it))) return 'stock'
      }
      for (const b of shop.buys ?? []) {
        const n = (sell[b.key] ?? 0) * b.lot
        if (!n) continue
        if (b.key === 'food' || b.key === 'water') this.stock = { ...this.stock, [b.key]: this.stock[b.key] - n }
        else if (b.key === 'ammo') this.ammo.n -= n
        else this[b.key] -= n
      }
      if (shop.currency === 'money') this.money += proceeds - tot.cost
      else this.cores += proceeds - tot.cost
      t.cargo = cartGives(shop, cart)
      t.sold = proceeds
    }
    t.spent = tot.cost
    t.shopped = true
    t.phase = 'away'
    t.back = Math.max(t.back, this.absHour + 0.25)
    return 'ok'
  }

  /** "只能买一次"的东西家里已经有了 */
  owns(it: ShopItem): boolean {
    // 别的一拨人已经买了、还在路上带回来的，也算有了
    const coming = (k: 'crossbow' | 'helmet') => this.trips.some((t) => !!t.cargo?.[k])
    return (!!it.give.crossbow && (this.crossbow || coming('crossbow'))) || (!!it.give.helmet && (this.helmet || coming('helmet')))
  }

  /** 买回来的东西入库 */
  private unloadCargo(t: Trip): string[] {
    return this.applyGives(t.cargo ?? {})
  }

  /** 买回来 / 送到的东西加进家里，返回"大米 3 份"这样的清单 */
  private applyGives(g: ShopItem['give']): string[] {
    const what: string[] = []
    const add = (k: 'food' | 'water' | 'ammo' | 'medkits' | 'molotovs' | 'fuel' | 'cores', n: number | undefined) => {
      if (!n) return
      if (k === 'food' || k === 'water') this.stock = { ...this.stock, [k]: this.stock[k] + n }
      else if (k === 'ammo') this.ammo.n += n
      else this[k] += n
      what.push(t_(`world.unit.${k}` as UiKey, { n }))
    }
    add('food', g.food)
    add('water', g.water)
    add('ammo', g.ammo)
    add('medkits', g.medkits)
    add('molotovs', g.molotovs)
    add('fuel', g.fuel)
    if (g.gate) {
      this.gateBonus = Math.min(120, this.gateBonus + g.gate)
      this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + g.gate)
      what.push(t_('world.unit.gate', { n: g.gate }))
    }
    if (g.trap) { this.trap.hp = Math.max(this.trap.hp, g.trap); what.push(t_('world.unit.trap')) }
    if (g.bamboo) { this.bamboo += g.bamboo; what.push(t_('world.unit.bamboo', { n: g.bamboo })) }
    if (g.crossbow && !this.crossbow) {
      this.crossbow = true
      this.equipCrossbow()
      what.push(t_('world.unit.crossbow'))
      this.note('world.log.crossbow', { who: this.actors.find((a) => a.weapon === 'crossbow')?.name ?? '爸爸' })
    }
    if (g.helmet && !this.helmet) { this.helmet = true; this.actors[0].helmet = true; what.push(t_('world.unit.helmet')) }
    return what
  }

  private tripStep(t: Trip): void {
    if (t.phase === 'out' && t.members.every((a) => !a.path.length)) {
      // 都上车了（或者走出街口了）
      for (const a of t.members) a.away = true
      t.phase = 'away'
      // 采购：路上走一半的时间到店
      // （按出发时定好的来回时间：去程一半到店，在店里挑东西时游戏是停着的，所以回家的时间不变）
      if (shopFor(t.def.id, this.clock.day < PROLOGUE_DAYS) && !t.shopped) t.shopAt = Math.max(this.absHour, t.back - tripHours(t.def, !!t.van) / 2)
      if (t.van) {
        this.vanMove = { dir: 'out', t0: this.absHour }
        if (this.clock.day >= PROLOGUE_DAYS) this.noiseDay = this.clock.day
      }
    } else if (t.phase === 'away' && t.van && this.vanMove?.dir === 'out') {
      if (this.absHour >= this.vanMove.t0 + VAN_OUT_H) { this.vanMove = null; this.vanAway = true }
    } else if (t.phase === 'away' && t.shopAt !== undefined && !t.shopped && this.absHour >= t.shopAt) {
      this.arriveShop(t)
    } else if (t.phase === 'away' && this.absHour >= t.back) {
      // 开车回来：先等车倒进车位停稳，人再下车
      if (t.van) {
        if (!this.vanMove) { this.vanAway = false; this.vanMove = { dir: 'in', t0: this.absHour }; this.greetArrivals(t); return }
        if (this.absHour < this.vanMove.t0 + VAN_IN_H) return
        this.vanMove = null
      }
      t.phase = 'back'
      if (!t.van) this.greetArrivals(t)
      t.members[0].line = { text: t_('world.greet.back'), hours: 0.25 }
      t.members.forEach((a, k) => {
        a.away = false
        a.carrying = true
        const at = t.van ? VAN_DOORS[k % VAN_DOORS.length] : { x: EXIT.x - k * 0.8, z: EXIT.z + (k % 2) * 0.6 }
        a.root.position.set(at.x, 0, at.z)
        a.floor = 0
        // 扛着箱子一直走进客厅，放到墙角那几个储物箱边上
        a.setPath(route(this.navs, a.pos, { ...STORE[k % STORE.length], floor: 0 }) ?? route(this.navs, a.pos, HOME_IN) ?? [])
      })
    } else if (t.phase === 'back' && t.members.every((a) => !a.path.length) && t.shopped) {
      // 采购回来：买的东西入库
      const hadBow = this.crossbow
      const what = this.unloadCargo(t)
      const who = t.members.map((m) => m.name).join('、')
      if (t.def.id === 'armygate') {
        this.affection.guchen = Math.min(100, (this.affection.guchen ?? 0) + 2)
        // 末日前去示警过：顾沉认出你，多塞一盒子弹
        if (this.guchenMet) { this.ammo.n += 6; this.note('world.army.friendBonus', { who }) }
      }
      // 改装面包车的材料：末日前第二次去五金店（第一次多半买了弩）
      if (t.def.id === 'hardware' && hadBow && !this.vanKit && !this.vanArmor) { this.vanKit = true; this.note('world.log.vanKit', { where: placeName(t.def.id) }) }
      this.tripScene(t.def.id)
      const cur = shopFor(t.def.id, t.def.phase === 'prologue')?.currency === 'cores' ? 'cores' : 'money'
      this.note(what.length ? 'world.trip.bought' : 'world.trip.boughtNothing', { who, where: placeName(t.def.id), what: what.join('、'), cost: t_(`world.unit.${cur}` as UiKey, { n: t.spent ?? 0 }) })
      t.members.forEach((a) => { a.carrying = false; a.hold = 0.3 })
      this.trips = this.trips.filter((x) => x !== t)
    } else if (t.phase === 'back' && t.members.every((a) => !a.path.length) && t.def.id === 'armygate') {
      this.tripScene('armygate')
      this.settleArmy(t)
      t.members.forEach((a) => { a.carrying = false; a.hold = 0.3 })
      this.trips = this.trips.filter((x) => x !== t)
    } else if (t.phase === 'back' && t.members.every((a) => !a.path.length)) {
      const armed = t.members.includes(this.actors[0]) && this.ammo.n > 0
      const r = settleTrip(t.def.id, t.members.length, armed, () => this.rand(), !!t.van, this.clock.day < PROLOGUE_DAYS, !!t.van && this.vanArmor)
      const hadBow = this.crossbow
      const g = r.gain
      // 拾荒老手跟着去：多带回一份吃的一份水
      if (t.members.some((m) => m.trait === 'trait_scavenger')) { g.food = (g.food ?? 0) + 1; g.water = (g.water ?? 0) + 1 }
      // 陌生人说的地下室：吃的喝的翻倍
      if (this.tip === t.def.id) {
        g.food = (g.food ?? 0) * 2 + 2
        g.water = (g.water ?? 0) * 2
        this.tip = null
        this.note('world.log.tipFound', { where: placeName(t.def.id) })
      }
      this.money += g.money ?? 0
      this.stock = { food: this.stock.food + (g.food ?? 0), water: this.stock.water + (g.water ?? 0) }
      this.ammo.n += g.ammo ?? 0
      this.medkits += g.medkits ?? 0
      this.cores += g.cores ?? 0
      this.molotovs += g.molotovs ?? 0
      this.fuel += g.fuel ?? 0
      // 第一次去五金店：顺手带回一把弩
      if (t.def.id === 'hardware' && !this.crossbow) {
        this.crossbow = true
        this.equipCrossbow()
        this.note('world.log.crossbow', { who: this.actors.find((a) => a.weapon === 'crossbow')?.name ?? '爸爸' })
      }
      // 改装面包车的材料：末日后第一次去工厂，或者末日前第二次去五金店（第一次拿了弩）
      if ((t.def.id === 'factory' || (t.def.id === 'hardware' && hadBow)) && !this.vanKit && !this.vanArmor) {
        this.vanKit = true
        this.note('world.log.vanKit', { where: placeName(t.def.id) })
      }
      if (r.gateBonus) {
        this.gateBonus = Math.min(120, this.gateBonus + r.gateBonus)
        this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + r.gateBonus)
      }
      t.members.forEach((a, k) => {
        a.carrying = false
        a.health = Math.max(5, a.health - r.hurt[k])
        a.hold = 0.3
      })
      this.tripScene(t.def.id)
      this.note(r.key, { ...r.vars, who: t.members.map((m) => m.name).join('、'), where: placeName(t.def.id) })
      this.trips = this.trips.filter((x) => x !== t)
    }
  }

  // --- 丧尸夜 ---------------------------------------------------------------

  /** 今晚来几只：末日前没有；平时两三只、越往后越多；月底危机夜一大群 */
  /** 月底危机夜是哪一种（跟重生日记里的前世记忆一致） */
  static crisisKind(c: Clock): CrisisKind | null {
    if (!isCrisisNight({ ...c, hour: 21 })) return null
    const month = Math.floor((c.day - PROLOGUE_DAYS) / 4)
    return memoriesYear1[month % 12].crisisKind
  }

  static nightCount(c: Clock): { count: number; crisis: boolean } {
    if (c.day < PROLOGUE_DAYS) return { count: 0, crisis: false }
    const month = Math.floor((c.day - PROLOGUE_DAYS) / 4)
    if (isCrisisNight({ ...c, hour: 21 })) return { count: 10 + month * 3 + (month >= 1 ? 2 : 0), crisis: true }
    return { count: 2 + month + (c.day % 2), crisis: false }
  }

  /** 来帮忙守夜的江野（危机夜傍晚进门，天亮走） */
  guest: Actor | null = null
  private guestNight = -1

  /** 月底危机夜，江野好感够高就会来帮忙 */
  private guestTick(): void {
    const c = this.clock
    const g = this.guest
    if (!g && !this.jiangyeHome && this.makeActor && c.hour >= 19.5 && c.hour < 21 && this.guestNight !== c.day
      && Household.crisisKind(c) && (this.affection.jiangye ?? 0) >= 60) {
      this.guestNight = c.day
      const a = this.makeActor('江野', 'jiangye', { x: 30, z: 18 })
      a.model = 'jiangye'
      a.weapon = 'machete'
      a.guest = true
      a.health = 100
      a.needs = { hunger: 90, thirst: 90, energy: 95, mood: 80 }
      a.setPath(route(this.navs, a.pos, { ...HOME_IN, x: HOME_IN.x + 1 }) ?? [])
      this.actors.push(a)
      this.guest = a
      this.note('world.log.guestCome')
    }
    // 天亮了、仗也打完了：他摆摆手走了
    if (g && !g.runaway && !this.onTrip(g) && c.hour >= 6.5 && c.hour < 12 && !this.siege) {
      this.cancel(g)
      g.runaway = { back: Infinity }
      g.setPath(route(this.navs, g.pos, EXIT) ?? [])
      this.note('world.log.guestLeave')
    }
    if (g?.runaway && !g.path.length) {
      g.root.removeFromParent()
      this.actors.splice(this.actors.indexOf(g), 1)
      this.guest = null
      this.affection.jiangye = Math.min(100, (this.affection.jiangye ?? 0) + 5)
    }
  }

  /** 白天开车出去过：发动机的动静今晚多引来一只（记一笔日记） */
  private noiseExtra(day: number): number {
    if (this.noiseDay !== day) return 0
    this.note('world.log.vanNoise')
    return 1
  }

  private siegeTick(simSeconds: number): void {
    const c = this.clock
    this.guestTick()
    this.checkCraft()
    if (!this.siege && this.spawnZombie && c.hour >= 21 && this.nightDone !== c.day) {
      const { count, crisis } = Household.nightCount(c)
      this.nightDone = c.day
      // 白天拒绝了黑鸦，今晚是他们来抢（丧尸被他们的动静引开了）
      const month = Math.floor((c.day - PROLOGUE_DAYS) / 4)
      const kind = Household.crisisKind(c)
      if (this.raidTonight) {
        this.raidTonight = false
        this.startSiege(4 + month, false, true)
      } else if (kind === 'scarcity' || kind === 'human') {
        // 匮乏：饿疯了的人成群来抢粮；人祸：黑鸦带人来扫荡
        this.note(kind === 'scarcity' ? 'world.log.looters' : 'world.log.crowRaid')
        this.startSiege(6 + month * 2, true, true)
      } else if (kind === 'climate') {
        // 气候：暴雨夜，丧尸少，但天亮时一楼会进水
        this.storm = c.day
        this.note('world.log.storm')
        this.startSiege(2 + this.noiseExtra(c.day), false)
      } else if (kind === 'plague') {
        // 疫病：有人病倒（急救包能顶一下），丧尸也来了几只
        const sick = this.actors.filter((a) => !a.away && !a.lost)
        const who = sick[Math.floor(this.rand() * sick.length)]
        if (who) {
          who.health = Math.max(5, who.health - (this.medkits > 0 ? 15 : 40))
          if (this.medkits > 0) this.medkits -= 1
          this.note('world.log.plague', { who: who.name })
          // 跟沈砚有交情的话，他第二天一早会送药来
          if ((this.affection.shenyan ?? 0) >= 10 && !this.shenyanHome) this.medicTomorrow = c.day + 1
        }
        this.startSiege(3 + this.noiseExtra(c.day), false)
      } else if (count > 0) {
        // 顾沉的对讲机提醒过东门有尸群：提前堵好了，少来两只
        let n = this.fewerTonight ? Math.max(1, count - 2) : count
        this.fewerTonight = false
        n += this.noiseExtra(c.day)
        this.startSiege(n, crisis)
      }
    }
    // 暴雨夜过后：一楼进水，泡坏一部分囤货
    if (this.storm === c.day - 1 && c.hour >= 7 && this.flooded !== this.storm) {
      this.flooded = this.storm
      const food = this.stock.food * 0.2
      this.stock = { ...this.stock, food: this.stock.food - food }
      this.note('world.log.flood', { food: food.toFixed(1) })
    }
    const s = this.siege
    if (!s) return
    s.tick(simSeconds)
    if (!s.done && !s.ambush && !this.dayRaid && c.hour >= SUNRISE && c.hour < 12) s.dawn()
    if (s.finished) { this.siege = null; this.dayRaid = false }
  }

  /** 原型调试用：下一个（危机）夜是哪一天——只往后，不倒回去 */
  static nextNightDay(c: Clock, crisis: boolean): number {
    let d = Math.max(c.day, PROLOGUE_DAYS)
    if (d === c.day && c.hour > 20.8) d++
    if (crisis) while ((d - PROLOGUE_DAYS) % DAYS_PER_MONTH !== DAYS_PER_MONTH - 1) d++
    return d
  }

  /** 原型调试：重新允许今晚来丧尸 */
  resetNight(): void {
    this.nightDone = -1
  }

  /** 原型调试用：马上来一波 */
  startSiege(count: number, crisis: boolean, raid = false): void {
    if (!this.spawnZombie || this.siege) return
    // 困难模式：每晚来的多一半（街上遇袭不走这里）
    if (this.hard) count = Math.round(count * 1.5)
    this.cancelSearch()
    this.stopFishing()
    for (const a of this.actors) {
      if (this.isOut(a)) continue
      this.cancel(a)
      a.hold = 0
    }
    if (this.speed > 1) this.speed = 1
    this.before = {
      ammo: this.ammo.n, cores: this.cores, barriers: { ...this.barriers }, health: this.actors.map((a) => a.health),
      food: this.stock.food, water: this.stock.water, crisis, trapKills: 0, fireKills: 0, bruteKills: 0,
    }
    this.siege = new Siege({
      count, crisis, raid, solidWall: this.wall, hard: this.hard, month: Math.max(0, Math.floor((this.clock.day - PROLOGUE_DAYS) / 4)),
      navs: this.navs, defenders: this.actors.filter((a) => !this.isOut(a) && !this.isInjured(a)), barriers: this.barriers, ammo: this.ammo,
      maxOf: (id) => this.maxOf(id), trap: this.trap, spikes: this.spikes,
      spawn: this.spawnZombie,
      emit: (e) => this.onSiegeEvent(e),
    })
  }

  /** 给 World 用：记一条日记 */
  logNote(key: string, vars?: Record<string, string | number>): void {
    this.note(key, vars)
  }

  private note(key: string, vars?: Record<string, string | number>): void {
    this.log.push({ day: this.clock.day, hour: this.clock.hour, key, vars })
    if (this.log.length > 40) this.log.shift()
  }

  private onSiegeEvent(e: SiegeEvent): void {
    if (e.kind === 'trapBroken') { this.note('world.log.trapGone'); this.onSiege?.(e); return }
    if (e.kind === 'spikeBroken') { this.note('world.log.spikeGone'); this.onSiege?.(e); return }
    if (e.kind === 'spike') { this.onSiege?.(e); return }
    if (e.kind === 'spit' || e.kind === 'boom') { this.onSiege?.(e); return }
    // 第一次见到一种新丧尸：记一笔
    if (e.kind === 'newKind') { this.note(`world.log.newKind.${e.zombie}`); this.onSiege?.(e); return }
    if (e.kind === 'start') this.note(e.ambush ? 'world.log.ambush' : e.raid ? 'world.log.raid' : e.crisis ? 'world.log.crisis' : 'world.log.start', { n: e.count })
    else if (e.kind === 'broken') {
      this.note(`world.log.broken.${e.layer}`)
      // 大门一破，丧尸冲进一楼把囤货柜打翻了
      if (e.layer === 'door') {
        const food = this.stock.food * 0.25
        const water = this.stock.water * 0.25
        this.stock = { food: this.stock.food - food, water: this.stock.water - water }
        this.note('world.log.spilled', { food: food.toFixed(1), water: water.toFixed(1) })
      }
    }
    else if (e.kind === 'down') this.note('world.log.down', { who: e.who })
    else if (e.kind === 'kill') {
      // 丧尸掉晶核；黑鸦的人身上能搜出子弹
      if (e.raider) { this.ammo.n += 2; this.onGain?.('🔫+2', null, e.at) }
      else { this.cores += e.brute ? 3 : 1; this.onGain?.(`💎+${e.brute ? 3 : 1}`, null, e.at) }
      this.kills++
      if (this.before && e.by === 'trap') this.before.trapKills++
      if (this.before && e.by === 'fire') this.before.fireKills++
      if (this.before && e.brute) this.before.bruteKills++
    }
    if (e.kind === 'end') {
      // 打完了：还站着的人放下武器（屋外的女主没人管她的姿势，不然会一直端着枪）
      for (const a of this.actors) if (a.pose === 'shoot' || a.pose === 'melee') a.pose = 'idle'
    }
    if (e.kind === 'end' && e.ambush) {
      // 街上遇袭：打跑了就继续；被扑倒了，缓过来自己爬起来（没有拿家里的东西）
      this.siege?.revive()
      this.note(e.won ? 'world.log.ambushWon' : 'world.log.ambushLost', { kills: e.kills })
    }
    else if (e.kind === 'end') {
      this.siege?.revive()
      if (e.won) {
        this.note('world.log.won', { kills: e.kills })
        for (const a of this.actors) a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 6) }
      } else {
        // 没守住：丧尸把屋里翻了一遍，吃的喝的丢了一半，大家都吓坏了
        const food = this.stock.food * 0.5
        const water = this.stock.water * 0.4
        this.stock = { food: this.stock.food - food, water: this.stock.water - water }
        this.note('world.log.lost', { food: food.toFixed(1), water: water.toFixed(1) })
        for (const a of this.actors) a.needs = { ...a.needs, mood: Math.max(0, a.needs.mood - 20) }
        // 月底危机夜没守住：倒下的家人里有一个没能撑过去；家里只剩女主一个的话，就是她
        // 危机夜输了：倒下的人里有一个重伤（躺两三天，不能干活）——以前是直接死一个，老板觉得太狠
        if (this.before?.crisis) {
          const fallen = this.actors.filter((a) => !a.guest && !a.dead && e.downed.includes(a.name))
          if (fallen.length) this.injure(fallen[Math.floor(this.rand() * fallen.length)])
        }
      }
    }
    if (e.kind === 'end' && e.ambush) { this.before = null; this.onSiege?.(e); return }
    if (e.kind === 'end' && this.before) {
      const b = this.before
      this.report = {
        won: e.won, crisis: b.crisis, kills: e.kills, ammo: b.ammo - this.ammo.n, cores: this.cores - b.cores,
        layers: LAYERS.map((l) => ({ id: l.id, lost: Math.max(0, b.barriers[l.id] - this.barriers[l.id]), broken: e.broken.includes(l.id) }))
          .filter((l) => l.lost > 0),
        hurt: this.actors.map((a, k) => ({ name: a.name, lost: Math.round(b.health[k] - a.health) })).filter((h) => h.lost > 0 && !this.actors.find((x) => x.name === h.name)?.dead),
        trapKills: b.trapKills, fireKills: b.fireKills, bruteKills: b.bruteKills,
        died: this.actors.filter((a) => a.dead && a.health === 0 && b.health[this.actors.indexOf(a)] > 0).map((a) => a.name),
        food: Math.max(0, b.food - this.stock.food), water: Math.max(0, b.water - this.stock.water),
      }
      this.before = null
    }
    this.onSiege?.(e)
  }

  // --- 种田 -----------------------------------------------------------------

  static readonly GARDEN_COST = 800
  static readonly GARDEN_CORES = 2

  /** 开菜地：末日前花钱买种子和工具，末日后用晶核（跟军区换种子） */
  /** 今天还能压几回水 */
  pumpsLeft(): number {
    if (this.pumpDay !== this.clock.day) { this.pumpDay = this.clock.day; this.pumpCount = 0 }
    return Math.max(0, Household.PUMP_MAX - this.pumpCount)
  }

  /** 去压水井压一桶水（自己找事时只在家里水不多时去；点了压水井就一定去） */
  private pumpTask(manual: boolean): Task | null {
    if (this.pumpsLeft() <= 0 || this.taken.has(WELL_SPOT)) return null
    if (!manual && this.available.water >= 30) return null
    return { kind: 'pump', spot: WELL_SPOT, phase: 'go', hours: 0.35, manual }
  }

  /** 早上 7 点以后去鸡圈喂鸡、捡蛋（一天一回） */
  private feedTask(): Task | null {
    if (this.fedDay === this.clock.day || this.clock.hour < 7 || this.taken.has(COOP_SPOT)) return null
    return { kind: 'feed', spot: COOP_SPOT, phase: 'go', hours: 0.25, manual: false }
  }

  /** 点了压水井 / 鸡圈：让选中的人去 */
  commandChore(a: Actor, what: 'pump' | 'feed'): 'ok' | 'done' | 'busy' {
    if (this.isOut(a) || a.dead || a.floor !== 0 || this.isInjured(a)) return 'busy'
    if (this.siege && !this.siege.done) return 'busy'
    const task = what === 'pump' ? this.pumpTask(true) : this.feedTask()
    if (!task) return what === 'pump' && this.pumpsLeft() <= 0 ? 'done' : what === 'feed' && this.fedDay === this.clock.day ? 'done' : 'busy'
    task.manual = true
    this.cancel(a)
    this.assign(a, task)
    return (a.task as Task | null)?.kind === what ? 'ok' : 'busy'
  }

  static readonly SPIKE_BAMBOO = 3

  /** 下一排要削的竹尖刺（先补烂掉的，按铁门里 → 堂屋门前的顺序）；都好好的就是 -1 */
  nextSpikeRow(): number {
    return this.spikes.findIndex((r) => r.hits <= 0)
  }

  /** 削竹尖刺：3 根竹子，派家里手巧的人（爸爸）在院子里削一个小时，削好插到下一排 */
  /** 削到一半被打断了（打仗、被叫走）：竹子退回来，按钮也不会一直卡在"腾不出人手" */
  private checkCraft(): void {
    if (this.crafting < 0 || this.actors.some((a) => a.task?.kind === 'craft')) return
    this.crafting = -1
    this.bamboo += Household.SPIKE_BAMBOO
  }

  craftSpikes(): 'ok' | 'bamboo' | 'full' | 'busy' {
    this.checkCraft()
    const k = this.nextSpikeRow()
    if (k < 0) return 'full'
    if (this.crafting >= 0 || (this.siege && !this.siege.done)) return 'busy'
    if (this.bamboo < Household.SPIKE_BAMBOO) return 'bamboo'
    const free = (a: Actor) => !this.isOut(a) && !a.dead && !a.guest && a.floor === 0 && a.task?.kind !== 'sleep'
    const who = this.actors.find((a) => a.handy && free(a)) ?? this.actors.slice(1).find(free) ?? (free(this.actors[0]) ? this.actors[0] : undefined)
    if (!who) return 'busy'
    this.bamboo -= Household.SPIKE_BAMBOO
    this.crafting = k
    this.cancel(who)
    this.assign(who, { kind: 'craft', spot: { kind: 'stroll', ...CRAFT_SPOT, floor: 0, face: 180, pose: 'work' }, phase: 'go', hours: 1, manual: true })
    if ((who.task as Task | null)?.kind !== 'craft') {
      this.crafting = -1
      this.bamboo += Household.SPIKE_BAMBOO
      return 'busy'
    }
    return 'ok'
  }

  // --- 撸猫、逗小鸡、跑步机 ---------------------------------------------------

  /** 今天逗过几次小鸡（今天喂鸡时多捡蛋） */
  henJoy = { day: -1, n: 0 }

  /** 点鸡圈选"逗逗小鸡"：选中的人走到鸡圈边蹲下逗一会儿 */
  playHens(a: Actor): 'ok' | 'busy' {
    if (this.isOut(a) || a.dead || (this.siege && !this.siege.done)) return 'busy'
    const who = this.taken.get(COOP_SPOT)
    if (who && who !== a) return 'busy'
    this.cancel(a)
    this.assign(a, { kind: 'hens', spot: COOP_SPOT, phase: 'go', hours: 0.3, manual: true })
    return (a.task as Task | null)?.kind === 'hens' ? 'ok' : 'busy'
  }

  /** 逗完小鸡：心情变好（同一天越逗越没新鲜感）；小鸡高兴了，今天喂鸡多捡蛋，第一次逗还有一半机会当场下个蛋 */
  private finishHens(a: Actor): void {
    const joy = this.henJoy.day === this.clock.day ? this.henJoy.n : 0
    this.henJoy = { day: this.clock.day, n: joy + 1 }
    a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 7 / (1 + joy)) }
    if (joy === 0 && this.rand() < 0.5) {
      this.eggs += 1
      this.stock = { ...this.stock, food: this.stock.food + Household.EGGS_FOOD }
      this.onGain?.('🥚+1', a)
      this.note('world.log.henEgg', { who: a.name })
    }
  }

  /** 今天在跑步机上已经练出了多少体能（一天最多涨 4，越跑越难涨） */
  private runGain = new Map<string, { day: number; got: number }>()

  /** 跑步：每跑一小时体能 +6（当天越往后越少），精力、水掉得比干活还快 */
  private runTick(a: Actor, hours: number): void {
    const g = this.runGain.get(a.name)
    const got = g && g.day === this.clock.day ? g.got : 0
    const add = Math.max(0, Math.min(Household.RUN_MAX - got, hours * 6 * (1 - got / Household.RUN_MAX)))
    a.fitness = Math.min(100, a.fitness + add)
    this.runGain.set(a.name, { day: this.clock.day, got: got + add })
    a.needs = { ...a.needs, energy: Math.max(0, a.needs.energy - hours * 10), thirst: Math.max(0, a.needs.thirst - hours * 8) }
  }

  static readonly RUN_MAX = 4
  /** 开车出门一趟烧几桶油 */
  static readonly VAN_FUEL = 0.2

  /** 干完哪种活心情涨多少（成就感） */
  static readonly PRIDE: Partial<Record<TaskKind, number>> = {
    cook: 4, garden: 4, repair: 5, craft: 5, pump: 2, feed: 2, hang: 2, fetch: 1, modvan: 6, tidy: 2, wash: 2, build: 3,
  }

  /** 还没走出去（在往街口 / 车门走）的那一趟可以叫回来：钱、油都退回来 */
  cancelTrip(tripId: number): boolean {
    const t = this.trips.find((x) => x.id === tripId)
    if (!t || t.phase !== 'out') return false
    this.money += tripCost(t.def, this.clock.day < PROLOGUE_DAYS)
    if (t.van) this.fuel = Math.round((this.fuel + Household.VAN_FUEL) * 10) / 10
    this.trips = this.trips.filter((x) => x !== t)
    for (const a of t.members) {
      a.path = []
      a.away = false
    }
    this.note('world.log.tripCancel', { who: t.members.map((m) => m.name).join('、'), where: placeName(t.def.id) })
    return true
  }

  /** 砌墙时一次站着砌几段 */
  static readonly WALL_STRETCH = 4

  /** 正在干的工程（只要有人，几项可以同时干）：done 0~1，worker 是派去干的人（饿了困了走开，过后会自己回来接着干） */
  projects: { id: BuildId; done: number; worker: string }[] = []

  /** 这个人手上的工程 */
  projectOf(name: string): { id: BuildId; done: number; worker: string } | null {
    return this.projects.find((p) => p.worker === name) ?? null
  }

  /** 这个人能不能接一项新工程（没在干别的工程、能干活） */
  private freeForBuild(a: Actor): boolean {
    return this.canWork(a) && !a.guest && !this.projectOf(a.name)
  }

  private canWork(a: Actor): boolean {
    return !this.isOut(a) && !a.dead && !this.isInjured(a) && a.pose !== 'down' && !(a.task?.kind === 'sleep' && a.task.phase === 'use')
  }

  /** 点"建设"里的按钮：付钱，派人（选中的人能干就是 TA，不然找家里会修东西的大人）走过去干 */
  startBuild(id: BuildId, who: Actor): 'ok' | 'money' | 'cores' | 'busy' | 'done' | 'fight' | 'van' | 'nobody' {
    if (this.siege && !this.siege.done) return 'fight'
    if (this.projects.some((p) => p.id === id)) return 'busy'
    if ((id === 'trap' && this.trap.hp > 0) || (id === 'wall' && this.wall) || (id === 'garden' && this.garden.built)) return 'done'
    const v = this.vanAt
    if (id === 'garden' && v && v.x > GARDEN.x0 - 2 && v.x < GARDEN.x1 + 2 && v.z > GARDEN.z0 - 1.2 && v.z < GARDEN.z1 + 1.2) return 'van'
    // 选中的人有空就派 TA；TA 在干别的工程（或者干不了）就找家里别的有空的人，会修东西的优先
    const worker = this.freeForBuild(who) ? who
      : this.actors.find((a) => a.handy && this.freeForBuild(a)) ?? this.actors.find((a) => this.freeForBuild(a))
    if (!worker) return 'nobody'
    const [money, cores] = BUILD_COST[id]
    if (this.clock.day < PROLOGUE_DAYS) {
      if (this.money < money) return 'money'
      this.money -= money
    } else {
      if (this.cores < cores) return 'cores'
      this.cores -= cores
    }
    this.projects.push({ id, done: 0, worker: worker.name })
    this.note('world.log.buildStart', { who: worker.name, what: t_(`world.build.name.${id}` as UiKey), h: BUILD_WORK[id] })
    this.sendToBuild(worker)
    return 'ok'
  }

  /** 换个人接着干某项工程（或者把走开的人叫回来）；选中的人手上已经有别的工程就不行 */
  continueBuild(id: BuildId, who: Actor): 'ok' | 'none' | 'busy' | 'tired' | 'thirsty' | 'hungry' | 'injured' | 'out' | 'other' {
    const p = this.projects.find((x) => x.id === id)
    if (!p) return 'none'
    if (this.siege && !this.siege.done) return 'busy'
    const why = this.whyNotBuild(who)
    if (why) return why
    const mine = this.projectOf(who.name)
    if (mine && mine !== p) return 'other'
    // 原来在干的人（如果不是 TA）放下手里的
    p.worker = who.name
    const task = this.buildTask(who)
    if (!task) return 'busy'
    task.manual = true
    task.forced = true
    this.cancel(who)
    this.assign(who, task)
    return (who.task as Task | null)?.kind === 'build' ? 'ok' : 'busy'
  }

  private sendToBuild(a: Actor): void {
    const task = this.buildTask(a)
    if (!task) return
    task.manual = true
    this.cancel(a)
    this.assign(a, task)
  }

  /** 干活站的地方：钉板在铁门外、菜地在南边、院墙是正在砌的那一段（院子里面、面朝墙；挡着就往里挪一点） */
  private buildTask(a: Actor): Task | null {
    const p = this.projectOf(a.name)
    if (!p) return null
    let spot: Spot
    let piece: number | undefined
    if (p.id === 'garden') spot = GARDEN_SPOT
    else if (p.id === 'trap') spot = { kind: 'stroll', x: 3.6 + Math.floor(p.done * 3) * 0.7, z: 13.75, floor: 0, face: 0, pose: 'work' }
    else {
      // 一次站在一个地方砌 4 段（4 米），砌完再挪：不然每砌一米都要走一趟，大半天都花在走路上
      const pieces = wallPieces()
      piece = Math.floor(Math.min(pieces.length - 1, Math.floor(p.done * pieces.length)) / Household.WALL_STRETCH)
      const w = pieces[Math.min(pieces.length - 1, piece * Household.WALL_STRETCH + 1)]
      const nav = this.navs[0]
      // 朝院子里面的方向（墙的反方向）挪着找一块能站的地方
      const inX = w.stand.face === 90 ? -1 : w.stand.face === -90 ? 1 : 0
      const inZ = w.stand.face === 0 ? -1 : w.stand.face === 180 ? 1 : 0
      let x = w.stand.x
      let z = w.stand.z
      for (let k = 0; k < 8 && nav.isBlockedAt(x, z); k++) { x += inX * 0.4 + (k % 2 ? 0.5 : -0.5) * Math.abs(inZ); z += inZ * 0.4 + (k % 2 ? 0.5 : -0.5) * Math.abs(inX) }
      if (nav.isBlockedAt(x, z)) return null
      spot = { kind: 'stroll', x, z, floor: 0, face: w.stand.face, pose: 'work' }
    }
    void a
    return { kind: 'build', spot, phase: 'go', hours: 3, manual: true, piece }
  }

  /** 还能接着干吗：天黑了、下大雨、饿了渴了累了就先歇着 */
  private canKeepBuilding(a: Actor, forced = false): boolean {
    const n = a.needs
    if (forced) return n.energy >= 8 && n.hunger >= 10 && n.thirst >= 10
    return !isNight(this.clock.hour) && this.rain <= 0.3 && n.energy >= 20 && n.hunger >= 25 && n.thirst >= 25
  }

  /** 这一段干完了，挪到下一段接着干（条件不允许就先停） */
  private nextStint(a: Actor, forced?: boolean): Task | null {
    if (!this.canKeepBuilding(a, forced)) return null
    const n = this.buildTask(a)
    return n && { ...n, forced }
  }

  /** 叫人接着干但干不了：为什么（界面上说一声） */
  whyNotBuild(a: Actor): 'tired' | 'thirsty' | 'hungry' | 'injured' | 'out' | null {
    if (this.isOut(a)) return 'out'
    if (this.isInjured(a)) return 'injured'
    const n = a.needs
    if (n.energy < 8) return 'tired'
    if (n.thirst < 10) return 'thirsty'
    if (n.hunger < 10) return 'hungry'
    return null
  }

  private buildProgress(a: Actor, t: Task, hours: number): void {
    const p = this.projectOf(a.name)
    if (!p) { t.hours = 0; return }
    p.done = Math.min(1, p.done + (hours / BUILD_WORK[p.id]) * (a.handy ? 1.3 : 1))
    if (p.done >= 1) { this.completeBuild(p); t.hours = 0; return }
    // 砌完这一段：挪到下一段（钉板一样，一块一块挪着铺）
    if (p.id === 'wall') {
      const n = wallPieces().length
      if (Math.floor(Math.min(n - 1, Math.floor(p.done * n)) / Household.WALL_STRETCH) !== t.piece) { const f = t.forced; t.hours = 0; t.then = () => this.nextStint(a, f) }
    } else if (p.id === 'trap') {
      const k = Math.floor(p.done * 3)
      if (t.spot && Math.abs(t.spot.x - (3.6 + k * 0.7)) > 0.01) { const f = t.forced; t.hours = 0; t.then = () => this.nextStint(a, f) }
    }
  }

  private completeBuild(p: { id: BuildId; done: number; worker: string }): void {
    this.projects = this.projects.filter((x) => x !== p)
    // 亲手干完一项工程：很有成就感
    const w = this.actors.find((a) => a.name === p.worker)
    if (w) w.needs = { ...w.needs, mood: Math.min(100, w.needs.mood + 12) }
    if (p.id === 'trap') { this.trap.hp = 100; this.note('world.log.trap') }
    if (p.id === 'wall') {
      this.wall = true
      this.barriers.gate = Math.min(this.maxOf('gate'), this.barriers.gate + 100)
      this.note('world.log.wall')
    }
    if (p.id === 'garden') { this.garden = { built: true, growth: 0, watered: -1 }; this.note('world.log.gardenBuilt') }
    this.onRemind?.(`world.build.done.${p.id}` as UiKey)
  }

  buildGarden(): boolean {
    // 车停在那块地上：先挪车
    const v = this.vanAt
    if (v && v.x > GARDEN.x0 - 2 && v.x < GARDEN.x1 + 2 && v.z > GARDEN.z0 - 1.2 && v.z < GARDEN.z1 + 1.2) return false
    if (this.garden.built) return false
    if (this.clock.day < PROLOGUE_DAYS) {
      if (this.money < Household.GARDEN_COST) return false
      this.money -= Household.GARDEN_COST
    } else {
      if (this.cores < Household.GARDEN_CORES) return false
      this.cores -= Household.GARDEN_CORES
    }
    this.garden = { built: true, growth: 0, watered: -1 }
    this.note('world.log.gardenBuilt')
    return true
  }

  private gardenTask(): Task | null {
    const g = this.garden
    if (!g.built || this.taken.has(GARDEN_SPOT)) return null
    const ripe = g.growth >= 1
    if (!ripe && (g.watered === this.clock.day || this.available.water < 0.4)) return null
    return { kind: 'garden', spot: GARDEN_SPOT, phase: 'go', hours: ripe ? 0.6 : 0.4, manual: false }
  }

  /** 每个游戏小时长一点：浇过水（或者下雨）长得快 */
  private gardenGrow(hours: number): void {
    const g = this.garden
    if (!g.built || g.growth >= 1) return
    if (this.rain > 0.2) g.watered = this.clock.day
    const rate = (g.watered === this.clock.day ? 0.5 : 0.12) * (this.hasTrait('trait_farmer') ? 1.6 : 1) // 每天
    g.growth = Math.min(1, g.growth + (rate * hours) / 24)
  }

  /** 照料菜地做完：熟了就收 3 份吃的，没熟就浇水（用掉一点水） */
  private finishGarden(): void {
    const g = this.garden
    if (g.growth >= 1) {
      g.growth = 0
      this.stock = { ...this.stock, food: this.stock.food + 3 }
      this.onGain?.('🥬+3', null, { x: (GARDEN.x0 + GARDEN.x1) / 2, z: (GARDEN.z0 + GARDEN.z1) / 2 })
      this.note('world.log.harvest')
    } else if (g.watered !== this.clock.day) {
      this.take('water', 0.3)
      g.watered = this.clock.day
    }
  }

  /** 最外面一层坏了的防线（白天爸爸会去修） */
  private damagedLayer(): (typeof LAYERS)[number] | null {
    return LAYERS.find((l) => this.barriers[l.id] < this.maxOf(l.id)) ?? null
  }

  private repairTask(): Task | null {
    const layer = this.damagedLayer()
    if (!layer) return null
    const p = layer.posts[1]
    const spot: Spot = { kind: 'stroll', x: p.x, z: p.z, floor: p.floor, face: 0, pose: 'work' }
    return { kind: 'repair', spot, phase: 'go', hours: 1.5, manual: false, layer: layer.id }
  }

  private activity(a: Actor): Activity {
    if (a.path.length) return 'walk'
    const t = a.task
    if (!t || t.phase !== 'use') return 'idle'
    if (t.kind === 'sit') return 'relax'
    if (t.kind === 'walk' || t.kind === 'guard') return 'idle'
    if (t.kind === 'repair' || t.kind === 'garden') return 'cook'
    // 陪聊算歇着，收拾屋子是轻活（不像做饭那么累）
    if (t.kind === 'company' || t.kind === 'interact') return 'relax'
    if (t.kind === 'tidy' || t.kind === 'wash' || t.kind === 'greet' || t.kind === 'pet') return 'relax'
    if (t.kind === 'help' || t.kind === 'hang' || t.kind === 'fetch') return 'idle'
    if (t.kind === 'forage') return 'stroll'
    if (t.kind === 'craft') return 'cook'
    if (t.kind === 'build') return 'cook'
    if (t.kind === 'hens') return 'relax'
    // 跑步：比干活还累（runTick 里另外扣精力和水）
    if (t.kind === 'run') return 'cook'
    if (t.kind === 'pump') return 'cook'
    if (t.kind === 'feed') return 'stroll'
    if (t.kind === 'modvan') return 'cook'
    return t.kind
  }

  // --- 自己找事 -------------------------------------------------------------

  private freeSpots(kind: Spot['kind'], filter: (s: Spot) => boolean = () => true): Spot[] {
    return this.spots.filter((s) => s.kind === kind && !this.taken.has(s) && filter(s))
  }

  private pick<T>(xs: T[]): T | undefined {
    return xs[Math.floor(this.rand() * xs.length)]
  }

  /** 离人最近的一个 */
  private nearest(a: Actor, xs: Spot[]): Spot | undefined {
    const d = (s: Spot) => Math.hypot(s.x - a.pos.x, s.z - a.pos.z) + (s.floor === a.floor ? 0 : 6)
    return [...xs].sort((p, q) => d(p) - d(q))[0]
  }

  private think(a: Actor): void {
    const want = chooseWant(a.needs, this.clock, this.available, this.rand())
    // 下雨天和夜里一样，不去院子里
    const night = isNight(this.clock.hour) || this.rain > 0.1
    // 重伤：除了吃饭喝水，都躺在床上养着
    if (this.isInjured(a) && want !== 'eat' && want !== 'drink') {
      this.assign(a, this.sleepTask(a, false) ?? { kind: 'idle', spot: null, phase: 'use', hours: 0.5, manual: false })
      return
    }
    const indoor = (s: Spot) => inRect(HOUSE, s.x, s.z)
    let task: Task | null = null
    // 白天爸爸有空就去修被丧尸砸坏的门
    // 会修门的人（爸爸）不在了，就换一个大人（不是女主、不是客人）来修
    const fixer = a.handy || (a !== this.actors[0] && !a.guest && !this.actors.some((x) => x.handy && !x.away && !x.lost && !x.runaway))
    const handy = fixer && !night && (want === 'idle' || want === 'relax' || want === 'stroll')
    if (handy) task = this.repairTask()
    // 手上有没干完的工程（之前派给 TA 的）：白天有空就回去接着干
    // 停着的工程：自己手上的接着干；没人在干的，谁有空谁去接（老板：这种默认谁有空就回去干）
    if (!task && !night && !a.guest && this.canWork(a) && this.canKeepBuilding(a) && (want === 'idle' || want === 'stroll' || want === 'relax')) {
      const mine = this.projectOf(a.name)
      const idle = mine ?? this.projects.find((p) => !this.actors.some((o) => o.name === p.worker && o.task?.kind === 'build') && !this.projectOf(a.name))
      if (idle) {
        idle.worker = a.name
        task = this.buildTask(a)
      }
    }
    // 白天有空的人去照料菜地：没浇水就浇水，熟了就收
    if (!task && !night && (want === 'idle' || want === 'stroll' || want === 'relax')) task = this.gardenTask()
    // 白天有空：喂鸡捡蛋、去压水井压水（家里水不多的时候）
    // 家里有空的人（女主也算）会自己去干：喂鸡捡蛋、压水、种地
    if (!task && !night && !a.guest && (want === 'idle' || want === 'stroll' || want === 'relax')) task = this.feedTask() ?? this.pumpTask(false)
    // 闲着的时候找点事：凑到家人身边说说话，或者收拾收拾屋子（不再一个人原地发呆）
    // （晚上 9 点以后、累了就不折腾了，该准备睡觉）
    const late = this.clock.hour >= 21 || this.clock.hour < 6 || a.needs.energy < 35
    // 晴天上午有空的人去院子西边晾衣服；傍晚收回来
    const freeish = want === 'idle' || want === 'stroll' || want === 'relax'
    if (!task && freeish && a !== this.actors[0] && !a.guest && this.rain < 0.05 && !this.laundryOut && this.laundryDay !== this.clock.day
      && this.clock.hour >= 8 && this.clock.hour < 11) task = this.laundryTask('hang')
    // 下着雨衣服还在外面：谁闲下来谁去收（不等傍晚）
    if (!task && a !== this.actors[0] && !a.guest && this.laundryOut && this.rain > 0.1 && want !== 'sleep' && a.needs.energy > 10) task = this.laundryTask('fetch')
    // 收衣服是轻活：傍晚到睡前，还有点力气就去
    if (!task && freeish && a !== this.actors[0] && !a.guest && this.laundryOut && this.clock.hour >= 17 && this.clock.hour < 22 && a.needs.energy > 15) task = this.laundryTask('fetch')
    // 改装面包车的材料带回来了：会修东西的人（爸爸）一有空就去改装，比歇着、溜达优先
    if (!task && !late && !night && fixer && this.vanKit && !this.vanArmor && (want === 'idle' || want === 'stroll' || want === 'relax')) task = this.modVanTask()
    if (!task && !late && a !== this.actors[0] && (want === 'idle' || (want === 'stroll' && night) || (want === 'relax' && this.rand() < 0.35))) {
      const r = this.rand()
      if (r < 0.5) task = this.companyTask(a)
      // 爸爸闲了爱去擦擦那辆面包车
      if (!task && r < 0.68 && !night && a === this.actors[2]) task = this.washTask()
      if (!task && r < 0.85) task = this.tidyTask(a)
    }
    if (task) { /* 修门 / 种地 */ } else if (want === 'sleep') task = this.sleepTask(a, false)
    else if (want === 'drink') task = this.spotTask(a, this.nearest(a, this.freeSpots('drink')), 'drink', 0.12)
    else if (want === 'eat') task = this.eatTask(a)
    else if (want === 'relax' || (want === 'stroll' && night)) {
      task = this.spotTask(a, this.pick(this.freeSpots('relax', night ? indoor : undefined)), 'relax', 1 + this.rand())
    } else if (want === 'stroll') task = this.spotTask(a, this.pick(this.freeSpots('stroll')), 'stroll', 0.5 + this.rand() * 0.5)
    if (!task) task = { kind: 'idle', spot: null, phase: 'use', hours: 0.25 + this.rand() * 0.4, manual: false }
    this.assign(a, task)
  }

  /** 凑到一个正在歇着 / 吃饭 / 干活的家人身边，面对面说说话 */
  private companyTask(a: Actor): Task | null {
    const busy = (b: Actor) => !!b.task && b.task.phase === 'use' && ['relax', 'sit', 'eat', 'cook', 'garden', 'repair', 'tidy', 'wash'].includes(b.task.kind)
    const pool = this.actors.filter((b) => b !== a && !this.isOut(b) && this.isHomeBody(b)
      && (busy(b) || (b === this.actors[0] && !b.path.length)))
    const b = pool[Math.floor(this.rand() * pool.length)]
    if (!b) return null
    const spot = this.besideSpot(a, b)
    return spot && { kind: 'company', spot, phase: 'go', hours: 0.4 + this.rand() * 0.5, manual: false, with: b }
  }

  /** 站到 b 身边 0.95 米、面朝 TA 的位置：先试从自己这边过去的方向，挡着（墙、桌子、楼梯口）就绕着对方换个方向 */
  private besideSpot(a: Actor, b: Actor): Spot | null {
    let dx = a.pos.x - b.pos.x
    let dz = a.pos.z - b.pos.z
    const len = Math.hypot(dx, dz)
    if (len < 0.2) { dx = Math.sin(b.root.rotation.y); dz = Math.cos(b.root.rotation.y) } else { dx /= len; dz /= len }
    const nav = this.navs[b.floor]
    const base = Math.atan2(dx, dz)
    for (const turn of [0, 0.8, -0.8, 1.6, -1.6, 2.6, -2.6]) {
      const x = b.pos.x + Math.sin(base + turn) * 0.95
      const z = b.pos.z + Math.cos(base + turn) * 0.95
      // 坐着的人从 TA 起身的位置算（沙发、椅子本身是挡路的格子）
      if (nav.isBlockedAt(x, z) || !nav.clearLine(b.anchor ?? b.pos, { x, z })) continue
      if (this.actors.some((o) => o !== a && o.task?.spot && Math.hypot(o.task.spot.x - x, o.task.spot.z - z) < 0.6)) continue
      const face = THREE.MathUtils.radToDeg(Math.atan2(b.pos.x - x, b.pos.z - z))
      return { kind: 'relax', x, z, floor: b.floor, face, pose: 'idle' }
    }
    return null
  }

  /** 今天谁对谁做过几次什么（"妈妈>爸爸:hug" → 次数），效果递减用 */
  private interactions = new Map<string, { day: number; n: number }>()

  /** 点人物的互动：a 走到 b 身边去做 kind */
  interact(a: Actor, b: Actor, kind: InteractKind): 'ok' | 'busy' | 'asleep' | 'away' | 'fight' | 'far' {
    if (this.siege && !this.siege.done) return 'fight'
    if (a === b || a.dead || b.dead || this.isOut(a) || this.isOut(b)) return 'away'
    if (b.task?.kind === 'sleep' && b.task.phase === 'use') return 'asleep'
    if (a.task?.kind === 'sleep' && a.task.phase === 'use') return 'asleep'
    if (a.pose === 'down' || b.pose === 'down') return 'busy'
    const def = INTERACTIONS.find((d) => d.id === kind)!
    if (def.water && this.available.water < def.water) return 'busy'
    const spot = this.besideSpot(a, b)
    if (!spot) return 'far'
    this.cancel(a)
    this.assign(a, { kind: 'interact', spot, phase: 'go', hours: def.hours, manual: true, with: b, act: kind })
    return (a.task as Task | null)?.kind === 'interact' ? 'ok' : 'far'
  }

  /** 走到了：先开口说一句；对方如果只是闲着，就停下来转过身听 */
  private beginInteract(a: Actor, t: Task): void {
    const b = t.with!
    const n = Math.floor(this.rand() * 3)
    a.line = { text: t_(`world.act.${t.act}.say${n}` as UiKey, { name: b.name }), hours: 0.2 }
    const idle = ['idle', 'stroll', 'tidy', 'company', 'pet', 'wash', 'relax']
    if (!b.task || (!b.task.manual && idle.includes(b.task.kind) && !(b.task.kind === 'relax' && b.task.phase === 'use' && b.pose === 'sit'))) {
      if (b.task) this.release(b)
      b.path = []
      b.task = { kind: 'company', spot: null, phase: 'use', hours: t.hours + 0.08, manual: false, with: a }
      b.pose = 'idle'
    }
  }

  /** 做完了：两个人加心情（对方回一句）；男主加好感；对方心情很差时记一笔日记 */
  private endInteract(a: Actor, t: Task): void {
    const b = t.with!
    const def = INTERACTIONS.find((d) => d.id === t.act)!
    const key = `${a.name}>${b.name}:${def.id}`
    const log = this.interactions.get(key)
    const times = log && log.day === this.clock.day ? log.n : 0
    this.interactions.set(key, { day: this.clock.day, n: times + 1 })
    const k = 1 / (1 + times)
    const before = b.needs.mood
    let other = def.other + (def.low && before < 40 ? def.low : 0)
    if (def.id === 'joke') other = Math.floor(this.rand() * 13)
    if (def.water) this.take('water', def.water)
    const add = (x: Actor, v: number) => { x.needs = { ...x.needs, mood: Math.min(100, x.needs.mood + v * k) } }
    add(a, def.self)
    add(b, other)
    // 低落的时间也往回拉一点（陪着说说话，离家出走的念头就淡了）
    if (b.lowMood > 0) b.lowMood = Math.max(0, b.lowMood - 6 * k)
    if (a === this.actors[0] && b.model in this.affection) this.affection[b.model] = Math.min(100, this.affection[b.model] + 3 * k)
    const n = Math.floor(this.rand() * 3)
    const flat = def.id === 'joke' && other < 3
    b.line = { text: t_(`world.act.${def.id}.${flat ? 'flat' : 'reply'}${flat ? '' : n}` as UiKey, { name: a.name }), hours: 0.22 }
    if (before < 40) this.note('world.log.cheered', { who: a.name, whom: b.name })
  }

  /** 收拾屋子：在屋里随便找个地方擦擦、扫扫 */
  private tidyTask(a: Actor): Task | null {
    const floor = (this.rand() < 0.7 ? a.floor : (a.floor === 0 ? 1 : 0)) as Floor
    // 找一块空地（不在家具、楼梯、楼梯口里）；找不到就算了
    let x = 0
    let z = 0
    let ok = false
    for (let k = 0; k < 8 && !ok; k++) {
      x = HOUSE.x0 + 0.8 + this.rand() * (HOUSE.x1 - HOUSE.x0 - 1.6)
      z = HOUSE.z0 + 0.8 + this.rand() * (HOUSE.z1 - HOUSE.z0 - 1.6)
      ok = !this.navs[floor].isBlockedAt(x, z)
    }
    if (!ok) return null
    const spot: Spot = { kind: 'stroll', x, z, floor, face: this.rand() * 360, pose: 'work' }
    return { kind: 'tidy', spot, phase: 'go', hours: 0.25 + this.rand() * 0.35, manual: false }
  }

  /** 家里人听到车开回来 / 出门的人进了街口：没在忙的出来迎一迎（吃饭做饭睡觉的不动） */
  private greetArrivals(t: Trip): void {
    const free = ['idle', 'stroll', 'relax', 'company', 'tidy', 'wash', 'sit']
    // 打丧尸时、下着雨都不出去迎（雨天跟夜里一样待在屋里）
    if ((this.siege && !this.siege.done) || this.rain > 0.1) return
    let k = 0
    for (const a of this.actors) {
      // 在街上的女主（和跟着她的人）不往回叫
      if (t.members.includes(a) || this.isOut(a) || a.dead || a.settling || a.needs.energy < 25 || !this.isHomeBody(a)) continue
      if (a.task ? a.task.manual || !free.includes(a.task.kind) : a.path.length > 0) continue
      if (a === this.actors[0] && (this.search || this.fishing)) continue
      // 站在进屋那条路旁边，面朝人回来的方向
      const at = t.van ? { x: 2.6 + k * 0.75, z: 9.45 - k * 0.2 } : { x: 5.25 + k * 0.7, z: 10.9 - k * 0.15 }
      const look = t.van ? { x: 0.9, z: 10.7 } : { x: 4, z: 13 }
      const face = THREE.MathUtils.radToDeg(Math.atan2(look.x - at.x, look.z - at.z))
      this.release(a)
      a.task = null
      this.assign(a, { kind: 'greet', spot: { kind: 'stroll', x: at.x, z: at.z, floor: 0, face, pose: 'idle' }, phase: 'go', hours: t.van ? 1.2 : 2, manual: false })
      k++
    }
  }

  /** 迎接的人：看见回来的人走近了就挥挥手、喊一声，挥一会儿就站着等他们进屋 */
  private greetTick(a: Actor, t: Task, hours: number): void {
    const trip = this.trips.find((x) => x.phase === 'back') ?? null
    const near = trip?.phase === 'back' ? trip.members.find((m) => !m.away && Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z) < 7) : undefined
    if (near && t.wave === undefined && t.waitT === undefined) {
      // 回来的人先说"我们回来啦"，迎的人一个接一个地喊
      const order = this.actors.filter((o) => o.task?.kind === 'greet').indexOf(a)
      t.waitT = 0.07 + Math.max(0, order) * 0.09
    }
    if (t.waitT !== undefined && t.waitT > 0) t.waitT -= hours
    if (near && t.wave === undefined && t.waitT !== undefined && t.waitT <= 0) {
      t.wave = 0.2
      const prologue = this.clock.day < PROLOGUE_DAYS
      const n = Math.floor(this.rand() * 3)
      a.line = { text: t_(`world.greet.${prologue ? 'calm' : 'doom'}${n}` as UiKey), hours: 0.22 }
    }
    if (t.wave !== undefined && t.wave > 0) {
      t.wave = Math.max(0, t.wave - hours)
      // 挥完手：接过一个箱子，帮着一起搬进客厅
      if (t.wave === 0 && trip?.phase === 'back') {
        t.hours = 0
        const k = this.actors.indexOf(a)
        t.then = () => {
          a.carrying = true
          return { kind: 'help', spot: { kind: 'stroll', ...STORE[(k + 2) % STORE.length], floor: 0, face: 0, pose: 'idle' }, phase: 'go', hours: 0.02, manual: false }
        }
      }
    }
    a.pose = t.wave !== undefined && t.wave > 0 ? 'wave' : 'idle'
    if (near) a.face(near.pos.x - a.pos.x, near.pos.z - a.pos.z, 0.05)
  }

  /** 撸猫：闲着的人走到猫跟前蹲下摸一会儿（World 看到猫趴着、身边有闲人时叫） */
  petCat(a: Actor, cat: { x: number; z: number; floor: Floor }, manual = false): boolean {
    const free = ['idle', 'stroll', 'relax', 'tidy']
    if (this.isOut(a) || a.dead || (!manual && a.settling) || (this.siege && !this.siege.done)) return false
    // 猫溜达到院子外面了：不跟出去（玩家点的除外）
    if (!manual && cat.floor === 0 && !inRect(YARD, cat.x, cat.z)) return false
    if (!manual && (a.task ? a.task.manual || !free.includes(a.task.kind) || (a.task.kind === 'relax' && a.task.phase === 'use') : a.path.length > 0)) return false
    if (manual) this.cancel(a)
    // 站在猫旁边 0.5 米（找一个走得到的方向），面朝猫
    for (const ang of [0, 1.6, -1.6, 3.1]) {
      const x = cat.x + Math.sin(ang) * 0.62
      const z = cat.z + Math.cos(ang) * 0.62
      if (this.navs[cat.floor].isBlockedAt(x, z)) continue
      const face = THREE.MathUtils.radToDeg(Math.atan2(cat.x - x, cat.z - z))
      this.release(a)
      a.task = null
      this.assign(a, { kind: 'pet', spot: { kind: 'stroll', x, z, floor: cat.floor, face, pose: 'work' }, phase: 'go', hours: manual ? 0.3 : 0.12 + this.rand() * 0.1, manual })
      return (a.task as Task | null)?.kind === 'pet'
    }
    return false
  }

  /** 晾衣服 / 收衣服：站到晾衣绳东边，面朝绳子（同一时间只派一个人） */
  private laundryTask(kind: 'hang' | 'fetch'): Task | null {
    if (this.actors.some((o) => o.task?.kind === 'hang' || o.task?.kind === 'fetch')) return null
    const spot: Spot = { kind: 'stroll', x: CLOTHESLINE.x + 0.62, z: (CLOTHESLINE.z0 + CLOTHESLINE.z1) / 2, floor: 0, face: -90, pose: 'work' }
    return { kind, spot, phase: 'go', hours: kind === 'hang' ? 0.35 : 0.2, manual: false }
  }

  /** 改装面包车：蹲在车边焊钢板、装铁栏，干一个多小时 */
  private modVanTask(): Task | null {
    if (this.vanAway || this.vanMove) return null
    if (this.trips.some((x) => x.van && x.phase === 'out') || this.vanAt) return null
    // 一个人改就够了
    if (this.actors.some((o) => o.task?.kind === 'modvan')) return null
    // 站在车头前面装防撞杠（离上车的门远一点，不挡人上车）
    const spot: Spot = { kind: 'stroll', x: VAN_PARK.x + 2.45, z: VAN_PARK.z, floor: 0, face: -90, pose: 'work' }
    return { kind: 'modvan', spot, phase: 'go', hours: 1.2, manual: false }
  }

  /** 擦车：站到车北边，面朝车 */
  private washTask(): Task | null {
    if (this.vanAway || this.vanMove || this.vanAt || this.trips.some((x) => x.van && x.phase === 'out')) return null
    // 擦车头或者车尾（车门那边留给上下车的人）；那一头有人在擦 / 在改装就去另一头，两头都有人就算了
    const busyEnd = (fx: number) => this.actors.some((o) => (o.task?.kind === 'wash' || o.task?.kind === 'modvan') && o.task.spot && Math.abs(o.task.spot.x - fx) < 0.5)
    const fx = VAN_PARK.x + 2.45
    const bx = VAN_PARK.x - 2.45
    if (busyEnd(fx) && busyEnd(bx)) return null
    const front = busyEnd(bx) || (!busyEnd(fx) && this.rand() < 0.5)
    const spot: Spot = front
      ? { kind: 'stroll', x: VAN_PARK.x + 2.45, z: VAN_PARK.z, floor: 0, face: -90, pose: 'work' }
      : { kind: 'stroll', x: VAN_PARK.x - 2.45, z: VAN_PARK.z, floor: 0, face: 90, pose: 'work' }
    return { kind: 'wash', spot, phase: 'go', hours: 0.3 + this.rand() * 0.3, manual: false }
  }

  private spotTask(a: Actor, spot: Spot | undefined, kind: TaskKind, hours: number, manual = false): Task | null {
    if (!spot) return null
    void a
    return { kind, spot, phase: 'go', hours, manual }
  }

  private sleepTask(a: Actor, manual: boolean): Task | null {
    const k = this.actors.indexOf(a)
    const own = this.beds[k]
    const bed = own && !this.taken.has(own) ? own : this.freeSpots('sleep')[0]
    return this.spotTask(a, bed, 'sleep', manual ? 1 : 0, manual)
  }

  /** 做饭再吃：先去灶台，做好了找把椅子坐下吃 */
  /** 今天的菜（灶台边选的）；家里人自己做饭都做这个，东西不够就退回白米饭 */
  menu = 'rice'

  /** 这道菜家里的东西够不够做一份 */
  canCook(id: string): boolean {
    const d = dishOf(id)
    return this.available.food >= d.food && this.available.water >= d.water && this.herbs >= d.herbs
  }

  private eatTask(a: Actor, manual = false, at?: Spot, dishId?: string): Task | null {
    const want = dishId ?? this.menu
    const dish = this.canCook(want) ? dishOf(want) : this.canCook('rice') ? dishOf('rice') : null
    if (!dish) return null
    const stove = at ?? this.nearest(a, this.freeSpots('cook'))
    if (!stove) return null
    const cook = this.spotTask(a, stove, 'cook', dish.hours, manual)
    if (!cook) return null
    cook.dish = dish.id
    // 椅子都有人坐就站在灶台边吃
    cook.then = () => {
      const eat = this.spotTask(a, this.nearest(a, this.freeSpots('dine')), 'eat', 0.5, manual) ?? { kind: 'eat' as const, spot: null, phase: 'use' as const, hours: 0.5, manual }
      eat.dish = dish.id
      return eat
    }
    return cook
  }

  /** 灶台菜单里选了一道菜：选中的人去做（做完自己吃），以后家里人做饭也做这个 */
  cookDish(a: Actor, spot: Spot, id: string): 'ok' | 'short' | 'busy' {
    if (!this.canCook(id)) return 'short'
    if (this.isOut(a)) return 'busy'
    const who = this.taken.get(spot)
    if (who && who !== a) return 'busy'
    this.menu = id
    this.cancel(a)
    const task = this.eatTask(a, true, spot, id)
    if (!task) return 'busy'
    this.assign(a, task)
    return 'ok'
  }

  private assign(a: Actor, task: Task): void {
    // 没人下命令就不出院子（自己找的事只在家里和院子里；守夜打丧尸不算）
    const at = task.spot
    if (at && !task.manual && task.kind !== 'guard' && at.floor === 0 && !inRect(YARD, at.ax ?? at.x, at.az ?? at.z)) {
      task = { kind: 'idle', spot: null, phase: 'use', hours: 0.3, manual: false }
    }
    a.task = task
    if (!task.spot) a.pose = task.kind === 'eat' ? 'drink' : 'idle'
    if (task.spot) {
      this.taken.set(task.spot, a)
      const s = task.spot
      const goal: Where = { x: s.ax ?? s.x, z: s.az ?? s.z, floor: s.floor }
      const path = this.routeFor(a, goal)
      if (!path) {
        this.taken.delete(s)
        a.task = { kind: 'idle', spot: null, phase: 'use', hours: 0.3, manual: false }
        return
      }
      a.setPath(path)
    }
  }

  /** 起身要先回到坐下前的位置，再从那里找路 */
  private routeFor(a: Actor, goal: Where): StairPoint[] | null {
    const from = a.anchor ? { x: a.anchor.x, z: a.anchor.z, floor: a.anchor.floor } : a.pos
    const path = route(this.navs, from, goal)
    if (!path) return null
    if (a.anchor) {
      path.unshift(a.anchor)
      a.anchor = null
      a.pose = 'idle'
    }
    return path
  }

  private runTask(a: Actor, hours: number): void {
    const t = a.task!
    if (t.phase === 'go') {
      if (a.path.length || a.settling) return
      if (!t.spot) { this.finish(a); return }
      const s = t.spot
      a.anchor = { x: a.root.position.x, z: a.root.position.z, y: a.root.position.y, floor: a.floor }
      a.glideTo(s.x, s.floor * FLOOR_H + (s.y ?? 0), s.z, s.face)
      t.phase = 'settle'
      return
    }
    if (t.phase === 'settle') {
      if (a.settling) return
      t.phase = 'use'
      a.pose = t.spot?.pose ?? 'idle'
      // 晚上躺下：说声晚安
      if (t.kind === 'sleep' && (this.clock.hour >= 20 || this.clock.hour < 2)) {
        const night = this.clock.hour < 2 ? this.clock.day - 1 : this.clock.day
        if (this.saidNight !== night || this.rand() < 0.35) this.say(a, 'night')
        this.saidNight = night
      }
      if (t.kind === 'interact' && t.with) this.beginInteract(a, t)
      // 走到工地天已经黑了（或者累了）：今天先不干了
      if (t.kind === 'build' && !this.canKeepBuilding(a, t.forced)) { this.finish(a); return }
      // 坐着吃饭、站着喝水有自己的动作
      if (t.kind === 'eat' && a.pose === 'sit') a.pose = 'sitEat'
      if (t.kind === 'drink') a.pose = 'drink'
      if (t.kind === 'pet' || t.kind === 'hens') a.pose = 'pet'
      if (t.kind === 'run') a.pose = 'walk'
      if (t.kind === 'cook') {
        const d = dishOf(t.dish)
        this.take('food', d.food)
        if (d.water) this.take('water', d.water)
        if (d.herbs) this.herbs = Math.max(0, this.herbs - d.herbs)
      }
      if (t.kind === 'drink') this.take('water', DRINK.water)
      return
    }
    t.hours -= hours
    // 陪聊：一直面朝对方
    if ((t.kind === 'company' || t.kind === 'interact') && t.with) a.face(t.with.pos.x - a.pos.x, t.with.pos.z - a.pos.z, 0.05)
    if (t.kind === 'greet') this.greetTick(a, t, hours)
    if (t.kind === 'build') this.buildProgress(a, t, hours)
    if (t.kind === 'run') this.runTick(a, hours)
    if (t.kind === 'repair' && t.layer) {
      const max = this.maxOf(t.layer)
      this.barriers[t.layer] = Math.min(max, this.barriers[t.layer] + hours * 45)
      if (this.barriers[t.layer] >= max) t.hours = 0
    }
    if (this.isDone(a, t)) this.finish(a)
  }

  private isDone(a: Actor, t: Task): boolean {
    const n = a.needs
    if (t.kind === 'sleep' && !t.spot) return n.energy >= 40
    if (t.kind === 'sleep') return (t.hours <= 0 && shouldWake(n, this.clock)) || n.hunger < 6 || n.thirst < 6
    if (t.hours <= 0) return true
    // 陪着说话的人走开了（或者不歇了），就散了
    if ((t.kind === 'company' || t.kind === 'interact') && t.with) {
      const b = t.with
      if (b.away || b.dead || b.floor !== a.floor || Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > 2.4) return true
    }
    // 放松、溜达、发呆、陪聊、收拾时，饿了渴了困了就不干了
    // 车开走了就不擦了、不改了
    if ((t.kind === 'wash' || t.kind === 'modvan') && (this.vanAway || this.vanMove || this.vanAt || this.trips.some((x) => x.van && x.phase === 'out'))) return true
    if (t.kind === 'modvan' && this.vanArmor) return true
    // 晾到一半下雨了：不晾了
    if (t.kind === 'hang' && this.rain > 0.1) return true
    // 干工程：天黑了、下大雨、饿了渴了累了就先歇着（白天有空会自己回来接着干）
    if (t.kind === 'build' && !this.canKeepBuilding(a, t.forced)) return true
    if (t.kind === 'run' && (a.needs.energy < 12 || a.needs.thirst < 15)) return true
    // 迎接：人都进屋卸完货了（这趟结束了）就散
    if (t.kind === 'greet' && !this.trips.some((x) => x.phase === 'back') && this.vanMove?.dir !== 'in') return true
    if (!t.manual && (t.kind === 'relax' || t.kind === 'stroll' || t.kind === 'idle' || t.kind === 'company' || t.kind === 'tidy' || t.kind === 'wash' || t.kind === 'greet' || t.kind === 'pet')) {
      // 饭点到了、有点饿了：放下手里的事去吃饭（一家人一起吃）
      if (isMealTime(this.clock.hour) && n.hunger < 60 && this.available.food >= MEAL.food && t.kind !== 'greet' && this.freeSpots('cook').length > 0) return true
      return n.energy < 18 || (n.thirst < 30 && this.available.water >= DRINK.water) || (n.hunger < 30 && this.available.food >= MEAL.food)
    }
    return false
  }

  /** 今天（这一晚）谁先说过早安 / 晚安：第一个人一定说，后面的人看心情 */
  private saidNight = -1
  private saidMorning = -1

  /** 头顶冒一句话（同一种话：末日前后各有几句，随机挑一句） */
  say(a: Actor, kind: 'dinner' | 'night' | 'morning' | 'home', hours = 0.22): void {
    const doom = this.clock.day >= PROLOGUE_DAYS
    const n = Math.floor(this.rand() * 3)
    a.line = { text: t_(`world.say.${kind}.${doom ? 'doom' : 'calm'}${n}` as UiKey), hours }
  }

  private finish(a: Actor): void {
    const t = a.task!
    if (t.kind === 'interact' && t.phase === 'use' && t.hours <= 0 && t.with) this.endInteract(a, t)
    const others = this.actors.some((b) => b !== a && !this.isOut(b) && !b.dead)
    // 饭做好了喊一声；早上醒了打个招呼
    if (t.kind === 'cook' && isMealTime(this.clock.hour) && others) this.say(a, 'dinner')
    if (t.kind === 'sleep' && this.clock.hour >= 5 && this.clock.hour < 11 && others && (this.saidMorning !== this.clock.day || this.rand() < 0.35)) {
      this.say(a, 'morning')
      this.saidMorning = this.clock.day
    }
    // 吃饭：按吃的哪道菜加饱腹、心情、精力、健康
    if (t.kind === 'eat') {
      const d = dishOf(t.dish)
      const c = (v: number) => Math.max(0, Math.min(100, v))
      a.needs = { ...a.needs, hunger: c(a.needs.hunger + d.hunger), mood: c(a.needs.mood + 3 + d.mood), energy: c(a.needs.energy + d.energy) }
      if (d.health) a.health = Math.min(100, a.health + d.health)
      const fx = [d.mood ? `♥+${d.mood}` : '', d.energy ? `☾+${d.energy}` : '', d.health ? `✚+${d.health}` : ''].filter(Boolean).join(' ')
      if (fx) this.onGain?.(`${d.icon} ${fx}`, a)
    }
    if (t.kind === 'drink') a.needs = { ...a.needs, thirst: Math.min(100, a.needs.thirst + DRINK.thirst) }
    if (t.kind === 'garden') this.finishGarden()
    if (t.kind === 'forage' && t.hours <= 0 && t.forage) this.pickForage(a, t.forage)
    if (t.kind === 'pump' && t.hours <= 0) {
      this.stock = { ...this.stock, water: this.stock.water + Household.PUMP_WATER }
      this.pumpCount += 1
      this.onGain?.(`💧+${fmt(Household.PUMP_WATER)}`, a)
    }
    // 干完一件正经活有成就感：心情涨一点（做饭、种地、修门、削尖刺、压水、喂鸡、晾收衣服、改车、收拾屋子）
    const pride = Household.PRIDE[t.kind]
    if (pride && t.phase === 'use' && t.hours <= 0) a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + pride) }
    // 撸完猫：心情好一点（玩家叫去的撸得久，涨得多）
    if (t.kind === 'pet' && t.hours <= 0) a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + (t.manual ? 8 : 4)) }
    if (t.kind === 'hens' && t.hours <= 0) this.finishHens(a)
    if (t.kind === 'run' && t.hours <= 0) {
      a.needs = { ...a.needs, mood: Math.min(100, a.needs.mood + 4) }
      if (!this.log.some((l) => l.key === 'world.log.run')) this.note('world.log.run', { who: a.name })
    }
    if (t.kind === 'feed' && t.hours <= 0 && this.fedDay !== this.clock.day) {
      this.fedDay = this.clock.day
      // 今天逗过小鸡：小鸡高兴，多下一两个蛋
      const bonus = this.henJoy.day === this.clock.day ? Math.min(2, this.henJoy.n) : 0
      this.eggs += 1 + bonus
      this.stock = { ...this.stock, food: this.stock.food + Household.EGGS_FOOD * (1 + bonus) }
      this.onGain?.(`🥚+${1 + bonus}`, a)
      if (!this.log.some((l) => l.key === 'world.log.eggs') || this.rand() < 0.25) this.note('world.log.eggs', { who: a.name })
    }
    if (t.kind === 'craft') {
      const k = this.crafting
      this.crafting = -1
      if (t.hours <= 0 && k >= 0) {
        this.spikes[k].hits = SPIKE.hits
        this.note('world.log.spikes', { who: a.name, n: k + 1 })
      } else this.bamboo += Household.SPIKE_BAMBOO
    }
    // 晾的时候下起雨来就不晾了（抱回屋）
    if (t.kind === 'hang' && t.hours <= 0 && this.rain < 0.1) { this.laundryOut = true; this.laundryDay = this.clock.day }
    if (t.kind === 'fetch' && t.hours <= 0) this.laundryOut = false
    if (t.kind === 'modvan' && t.hours <= 0 && !this.vanArmor) {
      this.vanArmor = true
      this.vanKit = false
      this.note('world.log.vanArmor', { who: a.name })
    }
    this.release(a)
    a.task = null
    const next = t.then?.() ?? null
    // 下一件事要走路的话，起身那一步算在路上；否则先站回原地
    if (a.anchor && !next?.spot) {
      a.pose = 'idle'
      a.glideTo(a.anchor.x, a.anchor.y, a.anchor.z)
      a.anchor = null
    }
    if (next) this.assign(a, next)
    else if (t.manual) a.hold = 0.6
  }

  private release(a: Actor): void {
    for (const [s, who] of this.taken) if (who === a) this.taken.delete(s)
  }

  /** 打断：立刻站起来，放下手里的事 */
  cancel(a: Actor): void {
    this.release(a)
    a.task = null
    a.path = []
    a.snapToAnchor()
  }

  // --- 玩家命令 -------------------------------------------------------------

  commandWalk(a: Actor, to: Where): StairPoint[] | null {
    if (this.isOut(a)) return null
    this.cancel(a)
    const path = route(this.navs, a.pos, to)
    if (!path) return null
    a.setPath(path)
    a.task = { kind: 'walk', spot: null, phase: 'go', hours: 0, manual: true }
    return path
  }

  /** 点了野外的一丛野菜 / 草药 / 蜂窝…：走过去蹲下采。'picked' = 刚采过还没长出来 */
  commandForage(a: Actor, id: string): 'ok' | 'picked' | 'no' {
    const s = FORAGE.find((f) => f.id === id)
    if (!s || this.isOut(a) || a.floor !== 0) return 'no'
    if (!ripe(s, this.forageDay, this.clock.day)) return 'picked'
    this.cancel(a)
    const at = standAt(s)
    this.assign(a, {
      kind: 'forage', spot: { kind: 'stroll', x: at.x, z: at.z, floor: 0, face: at.face, pose: 'work' },
      phase: 'go', hours: FORAGE_HOURS[s.kind], manual: true, forage: s.id,
    })
    return (a.task as Task | null)?.kind === 'forage' ? 'ok' : 'no'
  }

  private pickForage(a: Actor, id: string): void {
    const s = FORAGE.find((f) => f.id === id)
    if (!s || !ripe(s, this.forageDay, this.clock.day)) return
    this.forageDay[s.id] = this.clock.day
    const y = harvest(s.kind, () => this.rand())
    this.stock.food += y.food
    a.needs = { ...a.needs, mood: Math.max(0, Math.min(100, a.needs.mood + y.mood)) }
    if (y.family) for (const b of this.actors) if (b !== a && !b.dead && !this.isOut(b)) b.needs = { ...b.needs, mood: Math.min(100, b.needs.mood + y.family) }
    if (y.sting) a.health = Math.max(1, a.health - y.sting)
    this.herbs += y.herbs
    this.bamboo += y.bamboo
    const got = [y.food ? `🍚+${fmt(y.food)}` : '', y.herbs ? `🌿+${y.herbs}` : '', y.bamboo ? `🎋+${y.bamboo}` : ''].filter(Boolean).join(' ')
    if (got) this.onGain?.(got, a)
    let medkit = false
    if (this.herbs >= HERBS_PER_MEDKIT) {
      this.herbs -= HERBS_PER_MEDKIT
      this.medkits += 1
      medkit = true
      this.note('world.log.herbMedkit')
    }
    if (s.kind === 'flowers') this.note('world.log.flowers', { who: a.name, what: s.name })
    if (s.kind === 'honey') this.note(y.sting ? 'world.log.honeySting' : 'world.log.honey', { who: a.name })
    this.onForage?.(s, y, medkit)
    // 末日以后在外面蹲着采东西：可能招来丧尸（夜里更危险）
    if (this.clock.day >= PROLOGUE_DAYS && this.rand() < (isNight(this.clock.hour) ? 0.3 : 0.08)) {
      this.ambush({ id: `forage_${s.id}`, kind: 'barrel', at: s.at, hours: 0, danger: 1 }, 1)
    }
  }

  /** 点了家具：去用它。返回 false 表示用不了（有人在用、没吃的…） */
  commandSpot(a: Actor, spot: Spot): boolean {
    if (this.isOut(a)) return false
    const who = this.taken.get(spot)
    if (who && who !== a) return false
    this.cancel(a)
    let task: Task | null = null
    if (spot.kind === 'cook') task = this.eatTask(a, true, spot)
    else if (spot.kind === 'drink') task = this.available.water >= DRINK.water ? this.spotTask(a, spot, 'drink', 0.12, true) : null
    else if (spot.kind === 'sleep') task = this.spotTask(a, spot, 'sleep', 1, true)
    else if (spot.kind === 'dine') task = this.spotTask(a, spot, 'sit', 1, true)
    else if (spot.kind === 'relax') task = this.spotTask(a, spot, 'relax', 1.5, true)
    else if (spot.kind === 'run') task = a.needs.energy < 15 ? null : this.spotTask(a, spot, 'run', 0.5, true)
    else task = this.spotTask(a, spot, 'stroll', 0.5, true)
    if (!task) return false
    this.assign(a, task)
    return a.task !== null && a.task.kind !== 'idle'
  }

  /** 离家外出（跟女主走）时不再自己找事 */
  isHomeBody(a: Actor): boolean {
    return a.floor === 1 || inRect(YARD, a.pos.x, a.pos.z)
  }

  hud(): PersonHud[] {
    return this.actors.map((a) => ({
      name: a.name,
      health: a.health,
      trait: a.trait ? lt(survivorTraits.find((x) => x.id === a.trait)?.name ?? { zh: '' }) : undefined,
      gone: a.dead ? 'dead' : a.lost ? 'lost' : a.runaway ? 'runaway' : this.lent?.name === a.name ? 'lent' : undefined,
      trip: (() => { const tr = this.tripOf(a); return tr ? { id: tr.def.id, left: Math.max(0, tr.back - this.absHour), n: tr.id, leaving: tr.phase === 'out' } : undefined })(),
      fitness: Math.round(a.fitness),
      injured: this.isInjured(a) ? Math.ceil(a.injured - this.absHour) : 0,
      needs: { ...a.needs },
      doing: this.siege && !this.siege.done ? (a.pose === 'down' ? 'down' : 'guard') : a.task?.kind ?? 'idle',
      going: !!a.task && a.task.phase === 'go' && a.task.kind !== 'walk',
      floor: a.floor,
    }))
  }
}
