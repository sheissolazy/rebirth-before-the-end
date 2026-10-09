// 家里的人：走路（会上下楼）、四条需求、像模拟人生那样自己找事做；玩家也可以点家具让 TA 去用。
import * as THREE from 'three'
import { BEDS, FLOOR_H, GARDEN_SPOT, HOUSE, PARADISE_SPOTS, SPOTS, YARD, inRect, type Floor, type Spot, type StairPoint } from './layout'
import { route, type NavGrid, type Pt } from './nav'
import { Walker, type Where } from './walker'
import { PoseDriver, type PoseState } from './people'
import { person } from './meshes'
import {
  DAYS_PER_MONTH, DAY_SECONDS, DEPRESSED, DRINK, MEAL, PROLOGUE_DAYS, SUNRISE, advance, chooseWant, decayNeeds, isCrisisNight, isNight, shouldWake,
  type Activity, type Clock, type Needs, type Stock,
} from './life'
import { LAYERS, Siege, fullBarriers, type Barriers, type LayerId, type SiegeEvent, type Zombie } from './siege'
import { TRIPS, canGo, settleTrip, type TripDef } from './expedition'
import { locations } from '../content/locations'
import { npcs } from '../content/npcs'
import { events as textEvents } from '../content/events'
import { survivorNames, survivorTraits } from '../content/survivors'
import { memoriesYear1 } from '../content/memories'
import type { CrisisKind } from '../engine/types'
import { rainAt } from './weather'
import { Courier, STRANGER_MODELS, VISITORS, Visitor, isFemaleModel, type CourierId, type VisitorCtx, type VisitorDef } from './visitors'
import { FISHING, SCAVENGE_COOLDOWN_DAYS, rollLoot, type ScavengeSpot } from './scavenge'
import { lt, t, type UiKey } from '../i18n'

export type { Where } from './walker'

export type TaskKind = 'walk' | 'cook' | 'eat' | 'drink' | 'sleep' | 'relax' | 'sit' | 'stroll' | 'idle' | 'repair' | 'guard' | 'garden'

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
}


const SETTLE_S = 0.45
const rad = THREE.MathUtils.degToRad

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
  /** 正和家人一起歇着/吃饭，聊着天 */
  chatting = false
  /** 打丧尸用什么 */
  weapon: 'shotgun' | 'crowbar' | 'pin' | 'machete' = 'pin'
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
  runaway: { back: number } | null = null
  lost = false
  /** 死了（本世永久；lost 也会是 true，各处排除 lost 的逻辑都不用改） */
  dead = false
  /** 玩家下过命令后，这么多游戏小时内不自己找事 */
  hold = 0
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
    const state: PoseState = walking ? (this.carrying ? 'carry' : 'walk') : this.pose
    if (this.driver) {
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
  def: TripDef
  members: Actor[]
  phase: 'out' | 'away' | 'back'
  /** 什么时候回来（绝对游戏小时 = day*24+hour） */
  back: number
}

/** 住进来的人叫什么 */
const NEWCOMERS = ['阿杰', '老秦', '小周', '阿梅', '老郑', '小林', '阿彬']
/** 文字版幸存者名字里的女名（门外是姑娘的话从这里挑） */
const FEMALE_NAMES = new Set(['小雨', '阿芳', '晓晓', '小美', '阿花', '小婷', '阿梅'])

const placeName = (id: string) => lt(locations.find((l) => l.id === id)?.name ?? { zh: id })

/** 出门和回来都走街的东头 */
const EXIT: Where = { x: 31, z: 18, floor: 0 }
const HOME_IN: Where = { x: 4, z: 11, floor: 0 }

export interface PersonHud {
  name: string
  /** 住进来的人的特质名（比如"修车工"） */
  trait?: string
  /** 离家出走 / 不在了 */
  gone?: 'runaway' | 'lost' | 'dead' | 'lent'
  /** 出门在外：去哪了、还有几小时回来 */
  trip?: { id: string; left: number }
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
  spawnZombie: ((at: Pt, raider: boolean, brute?: boolean) => Zombie) | null = null
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
  trip: Trip | null = null
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
  affection: Record<string, number> = { jiangye: 40, guchen: 0, shenyan: 0, xielin: 0 }
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
  /** 陌生人透露的线索：下次去那里搜刮翻倍 */
  tip: string | null = null
  /** 女主的空间异能：放进去的吃喝不会被抢、被淹、被打翻（文字版的设定：用空间不涨暴露） */
  space: Stock = { food: 0, water: 0 }
  /** 燃烧瓶（酒精 + 布条），打丧尸时可以扔 */
  molotovs = 2
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

  get allSpots(): readonly Spot[] {
    return this.spots
  }

  /** 每帧调用。dt 是现实秒数（已经限过最大值） */
  tick(dt: number, autonomous: (a: Actor) => boolean): void {
    if (this.speed <= 0 || this.over) return
    this.clock = advance(this.clock, dt, this.speed)
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
    for (const a of this.actors) {
      if (a.dead) continue
      a.needs = decayNeeds(a.needs, hours, this.activity(a))
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
      food: this.stock.food, seen: this.seen, helpedNeighbor: this.helpedNeighbor, residents: this.residents,
      affection: this.affection, warnedJiangye: this.warnedJiangye, guchenMet: this.guchenMet, lendable: this.lendable().length, xielinNotes: this.xielinNotes, jiangyeHome: this.jiangyeHome, shenyanHome: this.shenyanHome,
      worstHealth: Math.min(...this.actors.filter((a) => !a.away && !a.lost).map((a) => a.health)), medkits: this.medkits,
    }
  }

  private visitorTick(): void {
    const v = this.visitor
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

  /** 江野住进来了（不再来访、危机夜也不用"来帮忙"了） */
  jiangyeHome = false
  /** 沈砚住进来了（不再上门、也不再送药，他就在家里） */
  shenyanHome = false

  /** 这一局已经因为困难模式减过一次子弹（来回切换不会一直减） */
  hardHalved = false
  /** 新开局用上了重生加成（第一次存档后清掉商店里买的） */
  perksApplied = false

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
  private sendCourier(who: CourierId, key: string, vars: Record<string, string | number>): void {
    if (!this.spawnCourier || this.courier) { this.note(key, vars); return }
    const east = this.rand() < 0.5
    const at = { x: east ? 30 : -20, z: 18 }
    const c = this.spawnCourier(who, at)
    c.pending = { key, vars }
    c.setPath(route(this.navs, { ...at, floor: 0 }, { x: 4.6 + (this.rand() - 0.5) * 0.8, z: 14.3, floor: 0 }) ?? [])
    this.courier = c
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
    if (this.clock.day < PROLOGUE_DAYS || this.siege || hero.away || this.isHomeBody(hero)) return
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
    a.weapon = 'machete'
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
          a.weapon = 'pin'
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
    this.note(`world.visit.${def.id}.log.${choice}`, this.visitVars())
    this.talking = null
    v.phase = 'leave'
    v.setPath(route(this.navs, v.pos, { ...v.home, floor: 0 }) ?? [])
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
    const social = (a: Actor) => !!a.task && a.task.phase === 'use' && (a.task.kind === 'relax' || a.task.kind === 'sit' || a.task.kind === 'eat') && !a.away
    for (const a of this.actors) {
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

  /** 院子里的木桶接雨水；雨停了在日记里记一笔 */
  private rainTick(hours: number): void {
    const r = this.rain
    if (r > 0) {
      const got = r * 0.3 * hours
      this.rainWater += got
      this.stock = { ...this.stock, water: this.stock.water + got }
    } else if (this.rainWater > 0) {
      if (this.rainWater >= 0.1) this.note('world.log.rainWater', { n: this.rainWater.toFixed(1) })
      this.rainWater = 0
    }
  }

  // --- 需求归零的后果 ---------------------------------------------------------

  private warned = new Map<string, number>()

  /** 每种警告一天只记一次 */
  private noteOnce(a: Actor, what: string, key: string): void {
    const k = `${a.name}:${what}`
    if (this.warned.get(k) === this.clock.day) return
    this.warned.set(k, this.clock.day)
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
        }
      }
    }
  }

  // --- 出门 -----------------------------------------------------------------

  get absHour(): number {
    return this.clock.day * 24 + this.clock.hour
  }

  onTrip(a: Actor): boolean {
    return !!this.trip?.members.includes(a)
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

  tripCheck(id: string): ReturnType<typeof canGo> | 'busy' | 'cores' {
    if (this.trip || (this.siege && !this.siege.done)) return 'busy'
    const ok = canGo(TRIPS.find((t) => t.id === id)!, this.clock.day < PROLOGUE_DAYS, this.money, this.clock.hour)
    if (ok === 'ok' && id === 'armygate' && this.clock.day >= PROLOGUE_DAYS && this.cores < Household.ARMY_PRICE) return 'cores'
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
  startTrip(id: string, members: Actor[]): boolean {
    // 来帮忙的客人、出走的人不能派出去
    members = members.filter((a) => !a.guest && !this.isOut(a))
    if (!members.length || this.tripCheck(id) !== 'ok') return false
    if (members.includes(this.actors[0])) { this.cancelSearch(); this.stopFishing() }
    const def = TRIPS.find((t) => t.id === id)!
    this.money -= def.cost
    for (const a of members) {
      this.cancel(a)
      a.setPath(route(this.navs, a.pos, EXIT) ?? [])
    }
    this.trip = { def, members, phase: 'out', back: this.absHour + def.hours }
    this.note('world.log.tripOut', { who: members.map((m) => m.name).join('、'), where: placeName(id) })
    return true
  }

  private tripTick(): void {
    const t = this.trip
    if (!t) return
    if (t.phase === 'out' && t.members.every((a) => !a.path.length)) {
      for (const a of t.members) a.away = true
      t.phase = 'away'
    } else if (t.phase === 'away' && this.absHour >= t.back) {
      t.phase = 'back'
      t.members.forEach((a, k) => {
        a.away = false
        a.carrying = true
        a.root.position.set(EXIT.x - k * 0.8, 0, EXIT.z + (k % 2) * 0.6)
        a.floor = 0
        a.setPath(route(this.navs, a.pos, { ...HOME_IN, x: HOME_IN.x + (k - 1) * 0.9 }) ?? [])
      })
    } else if (t.phase === 'back' && t.members.every((a) => !a.path.length) && t.def.id === 'armygate') {
      this.tripScene('armygate')
      this.settleArmy(t)
      t.members.forEach((a) => { a.carrying = false; a.hold = 0.3 })
      this.trip = null
    } else if (t.phase === 'back' && t.members.every((a) => !a.path.length)) {
      const armed = t.members.includes(this.actors[0]) && this.ammo.n > 0
      const r = settleTrip(t.def.id, t.members.length, armed, () => this.rand())
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
      this.trip = null
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

  private siegeTick(simSeconds: number): void {
    const c = this.clock
    this.guestTick()
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
        this.startSiege(2, false)
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
        this.startSiege(3, false)
      } else if (count > 0) {
        // 顾沉的对讲机提醒过东门有尸群：提前堵好了，少来两只
        const n = this.fewerTonight ? Math.max(1, count - 2) : count
        this.fewerTonight = false
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
    if (!s.done && !s.ambush && c.hour >= SUNRISE && c.hour < 12) s.dawn()
    if (s.finished) this.siege = null
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
      count, crisis, raid, solidWall: this.wall, hard: this.hard, navs: this.navs, defenders: this.actors.filter((a) => !this.isOut(a)), barriers: this.barriers, ammo: this.ammo,
      maxOf: (id) => this.maxOf(id), trap: this.trap,
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
      if (e.raider) this.ammo.n += 2
      else this.cores += e.brute ? 3 : 1
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
        if (this.before?.crisis) {
          const fallen = this.actors.filter((a) => a !== this.actors[0] && !a.guest && !a.dead && e.downed.includes(a.name))
          if (fallen.length) this.die(fallen[Math.floor(this.rand() * fallen.length)], 'crisis')
          else if (e.downed.includes(this.actors[0].name)) this.die(this.actors[0], 'crisis')
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
  buildGarden(): boolean {
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
    const indoor = (s: Spot) => inRect(HOUSE, s.x, s.z)
    let task: Task | null = null
    // 白天爸爸有空就去修被丧尸砸坏的门
    // 会修门的人（爸爸）不在了，就换一个大人（不是女主、不是客人）来修
    const fixer = a.handy || (a !== this.actors[0] && !a.guest && !this.actors.some((x) => x.handy && !x.away && !x.lost && !x.runaway))
    const handy = fixer && !night && (want === 'idle' || want === 'relax' || want === 'stroll')
    if (handy) task = this.repairTask()
    // 白天有空的人去照料菜地：没浇水就浇水，熟了就收
    if (!task && !night && a !== this.actors[0] && (want === 'idle' || want === 'stroll' || want === 'relax')) task = this.gardenTask()
    if (task) { /* 修门 / 种地 */ } else if (want === 'sleep') task = this.sleepTask(a, false)
    else if (want === 'drink') task = this.spotTask(a, this.nearest(a, this.freeSpots('drink')), 'drink', 0.12)
    else if (want === 'eat') task = this.eatTask(a)
    else if (want === 'relax' || (want === 'stroll' && night)) {
      task = this.spotTask(a, this.pick(this.freeSpots('relax', night ? indoor : undefined)), 'relax', 1 + this.rand())
    } else if (want === 'stroll') task = this.spotTask(a, this.pick(this.freeSpots('stroll')), 'stroll', 0.5 + this.rand() * 0.5)
    if (!task) task = { kind: 'idle', spot: null, phase: 'use', hours: 0.25 + this.rand() * 0.4, manual: false }
    this.assign(a, task)
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
  private eatTask(a: Actor, manual = false, at?: Spot): Task | null {
    if (this.available.food < MEAL.food) return null
    const stove = at ?? this.nearest(a, this.freeSpots('cook'))
    if (!stove) return null
    const cook = this.spotTask(a, stove, 'cook', 0.45, manual)
    if (!cook) return null
    // 椅子都有人坐就站在灶台边吃
    cook.then = () => this.spotTask(a, this.nearest(a, this.freeSpots('dine')), 'eat', 0.5, manual)
      ?? { kind: 'eat', spot: null, phase: 'use', hours: 0.5, manual }
    return cook
  }

  private assign(a: Actor, task: Task): void {
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
      // 坐着吃饭、站着喝水有自己的动作
      if (t.kind === 'eat' && a.pose === 'sit') a.pose = 'sitEat'
      if (t.kind === 'drink') a.pose = 'drink'
      if (t.kind === 'cook') this.take('food', MEAL.food)
      if (t.kind === 'drink') this.take('water', DRINK.water)
      return
    }
    t.hours -= hours
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
    // 放松、溜达、发呆时，饿了渴了困了就不干了
    if (!t.manual && (t.kind === 'relax' || t.kind === 'stroll' || t.kind === 'idle')) {
      return n.energy < 18 || (n.thirst < 30 && this.available.water >= DRINK.water) || (n.hunger < 30 && this.available.food >= MEAL.food)
    }
    return false
  }

  private finish(a: Actor): void {
    const t = a.task!
    if (t.kind === 'eat') a.needs = { ...a.needs, hunger: Math.min(100, a.needs.hunger + MEAL.hunger), mood: Math.min(100, a.needs.mood + 3) }
    if (t.kind === 'drink') a.needs = { ...a.needs, thirst: Math.min(100, a.needs.thirst + DRINK.thirst) }
    if (t.kind === 'garden') this.finishGarden()
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
      trip: this.onTrip(a) && this.trip ? { id: this.trip.def.id, left: Math.max(0, this.trip.back - this.absHour) } : undefined,
      needs: { ...a.needs },
      doing: this.siege && !this.siege.done ? (a.pose === 'down' ? 'down' : 'guard') : a.task?.kind ?? 'idle',
      going: !!a.task && a.task.phase === 'go' && a.task.kind !== 'walk',
      floor: a.floor,
    }))
  }
}
