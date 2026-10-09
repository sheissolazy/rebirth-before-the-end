// 家里的人：走路（会上下楼）、四条需求、像模拟人生那样自己找事做；玩家也可以点家具让 TA 去用。
import * as THREE from 'three'
import { BEDS, FLOOR_H, HOUSE, PARADISE_SPOTS, SPOTS, YARD, inRect, type Floor, type Spot, type StairPoint } from './layout'
import { route, type NavGrid, type Pt } from './nav'
import { PoseDriver, type PoseState } from './people'
import { person } from './meshes'
import {
  DAY_SECONDS, DRINK, MEAL, advance, chooseWant, decayNeeds, isNight, shouldWake,
  type Activity, type Clock, type Needs, type Stock,
} from './life'

export type TaskKind = 'walk' | 'cook' | 'eat' | 'drink' | 'sleep' | 'relax' | 'sit' | 'stroll' | 'idle'

interface Task {
  kind: TaskKind
  spot: Spot | null
  phase: 'go' | 'settle' | 'use'
  /** 还要用多久（游戏小时） */
  hours: number
  manual: boolean
  then?: () => Task | null
}

export interface Where extends Pt { floor: Floor }

const SETTLE_S = 0.45
const rad = THREE.MathUtils.degToRad

function shortestAngle(from: number, to: number): number {
  const d = to - from
  return from + Math.atan2(Math.sin(d), Math.cos(d))
}

export class Actor {
  readonly name: string
  readonly root = new THREE.Group()
  path: StairPoint[] = []
  floor: Floor = 0
  pose: PoseState = 'idle'
  needs: Needs
  task: Task | null = null
  /** 坐下/躺下之前站的位置，起身时回到这里 */
  anchor: StairPoint | null = null
  /** 玩家下过命令后，这么多游戏小时内不自己找事 */
  hold = 0
  /** 这一帧换了楼层 */
  floorChanged = false
  private readonly legFrom = new THREE.Vector3()
  private settle: { from: THREE.Vector3; to: THREE.Vector3; r0: number; r1: number; t: number } | null = null
  private walkT = 0
  private driver: PoseDriver | null = null
  private inner: THREE.Object3D

  constructor(name: string, shirt: string, hair: string, height: number, at: Pt, needs: Needs) {
    this.name = name
    this.needs = { ...needs }
    this.inner = person(shirt, hair, height)
    this.root.add(this.inner)
    this.root.position.set(at.x, 0, at.z)
    this.root.userData.actor = this
  }

  get pos(): Where {
    return { x: this.root.position.x, z: this.root.position.z, floor: this.floor }
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

  setPath(p: StairPoint[]): void {
    this.path = p
    this.legFrom.copy(this.root.position)
  }

  /** 沿路点走（含楼梯的高度）；返回这一帧是否在走 */
  follow(dt: number, speed: number): boolean {
    const next = this.path[0]
    if (!next) return false
    const p = this.root.position
    const dx = next.x - p.x
    const dz = next.z - p.z
    const d = Math.hypot(dx, dz)
    const climbing = Math.abs(next.y - this.legFrom.y) > 0.01
    const step = speed * dt * (climbing ? 0.5 : 1)
    if (d <= step) {
      p.set(next.x, next.y, next.z)
      if (next.floor !== this.floor) this.floorChanged = true
      this.floor = next.floor
      this.path.shift()
      this.legFrom.copy(p)
    } else {
      p.x += (dx / d) * step
      p.z += (dz / d) * step
      const total = Math.hypot(next.x - this.legFrom.x, next.z - this.legFrom.z)
      const k = total > 1e-6 ? 1 - Math.hypot(next.x - p.x, next.z - p.z) / total : 1
      p.y = this.legFrom.y + (next.y - this.legFrom.y) * k
    }
    if (d > 1e-3) this.face(dx, dz, dt)
    return true
  }

  face(dx: number, dz: number, dt: number): void {
    const want = Math.atan2(dx, dz)
    let diff = want - this.root.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.root.rotation.y += diff * Math.min(1, dt * 12)
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
    const state: PoseState = walking ? 'walk' : this.pose
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
    inner.rotation.x = state === 'sleep' ? -Math.PI / 2 : state === 'work' ? 0.22 : 0
    inner.position.y = state === 'sleep' ? 0.5 : state === 'sit' ? -0.22 : 0
  }
}

// --- 一家人 -------------------------------------------------------------------

export interface PersonHud {
  name: string
  needs: Needs
  doing: TaskKind
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
    if (this.speed <= 0) return
    this.clock = advance(this.clock, dt, this.speed)
    const hours = (dt * this.speed * 24) / DAY_SECONDS
    for (const a of this.actors) {
      a.needs = decayNeeds(a.needs, hours, this.activity(a))
      if (a.task) this.runTask(a, hours)
      else {
        a.hold = Math.max(0, a.hold - hours)
        if (a.hold <= 0 && !a.path.length && !a.settling && autonomous(a)) this.think(a)
      }
    }
  }

  private activity(a: Actor): Activity {
    if (a.path.length) return 'walk'
    const t = a.task
    if (!t || t.phase !== 'use') return 'idle'
    if (t.kind === 'sit') return 'relax'
    if (t.kind === 'walk') return 'idle'
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
    const want = chooseWant(a.needs, this.clock, this.stock, this.rand())
    const night = isNight(this.clock.hour)
    const indoor = (s: Spot) => inRect(HOUSE, s.x, s.z)
    let task: Task | null = null
    if (want === 'sleep') task = this.sleepTask(a, false)
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
    if (this.stock.food < MEAL.food) return null
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
    if (!task.spot) a.pose = task.kind === 'eat' ? 'work' : 'idle'
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
      if (t.kind === 'cook') this.stock.food = Math.max(0, this.stock.food - MEAL.food)
      if (t.kind === 'drink') this.stock.water = Math.max(0, this.stock.water - DRINK.water)
      return
    }
    t.hours -= hours
    if (this.isDone(a, t)) this.finish(a)
  }

  private isDone(a: Actor, t: Task): boolean {
    const n = a.needs
    if (t.kind === 'sleep') return (t.hours <= 0 && shouldWake(n, this.clock)) || n.hunger < 6 || n.thirst < 6
    if (t.hours <= 0) return true
    // 放松、溜达、发呆时，饿了渴了困了就不干了
    if (!t.manual && (t.kind === 'relax' || t.kind === 'stroll' || t.kind === 'idle')) {
      return n.energy < 18 || (n.thirst < 30 && this.stock.water >= DRINK.water) || (n.hunger < 30 && this.stock.food >= MEAL.food)
    }
    return false
  }

  private finish(a: Actor): void {
    const t = a.task!
    if (t.kind === 'eat') a.needs = { ...a.needs, hunger: Math.min(100, a.needs.hunger + MEAL.hunger), mood: Math.min(100, a.needs.mood + 3) }
    if (t.kind === 'drink') a.needs = { ...a.needs, thirst: Math.min(100, a.needs.thirst + DRINK.thirst) }
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
    this.cancel(a)
    const path = route(this.navs, a.pos, to)
    if (!path) return null
    a.setPath(path)
    a.task = { kind: 'walk', spot: null, phase: 'go', hours: 0, manual: true }
    return path
  }

  /** 点了家具：去用它。返回 false 表示用不了（有人在用、没吃的…） */
  commandSpot(a: Actor, spot: Spot): boolean {
    const who = this.taken.get(spot)
    if (who && who !== a) return false
    this.cancel(a)
    let task: Task | null = null
    if (spot.kind === 'cook') task = this.eatTask(a, true, spot)
    else if (spot.kind === 'drink') task = this.stock.water >= DRINK.water ? this.spotTask(a, spot, 'drink', 0.12, true) : null
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
      needs: { ...a.needs },
      doing: a.task?.kind ?? 'idle',
      going: !!a.task && a.task.phase === 'go' && a.task.kind !== 'walk',
      floor: a.floor,
    }))
  }
}
