// 丧尸夜：丧尸从街上来，先砸铁门，再砸大门，最后砸楼梯口的箱子。一家人自动守在当前这一层，
// 外层被破就往里退（设计文档 §1.3 / P3）。纯逻辑 + 少量 three 对象，不依赖渲染，方便跑模拟测试。
import * as THREE from 'three'
import type { Floor } from './layout'
import { route, type NavGrid, type Pt } from './nav'
import { PoseDriver, type PoseState } from './people'
import { person } from './meshes'
import type { Actor } from './residents'
import { Walker, type Where } from './walker'

export type LayerId = 'gate' | 'door' | 'stairs'

export interface Layer {
  id: LayerId
  max: number
  /** 丧尸围在这一圈砸 */
  bash: Where[]
  /** 守的人站位：[远程, 近战1, 近战2] */
  posts: Where[]
  /** 近战隔着铁门/门缝/楼梯能打到多远 */
  reach: number
}

const f0 = (x: number, z: number): Where => ({ x, z, floor: 0 })
const f1 = (x: number, z: number): Where => ({ x, z, floor: 1 })

export const LAYERS: Layer[] = [
  {
    id: 'gate', max: 180, reach: 1.9,
    bash: [f0(3.4, 13.75), f0(4.6, 13.75), f0(4.0, 13.85), f0(3.0, 14.25), f0(5.0, 14.25), f0(4.0, 14.5)],
    posts: [f0(4, 10.3), f0(3.5, 12.3), f0(4.5, 12.3), f0(2.9, 12.4), f0(5.1, 12.4)],
  },
  {
    id: 'door', max: 160, reach: 1.9,
    bash: [f0(3.2, 6.7), f0(3.8, 6.7), f0(3.5, 7.15), f0(2.8, 7.3), f0(4.2, 7.3), f0(3.5, 7.7)],
    posts: [f0(4.3, 4.3), f0(3.15, 5.3), f0(3.85, 5.3), f0(2.6, 5.3), f0(4.4, 5.3)],
  },
  {
    id: 'stairs', max: 70, reach: 3.2,
    bash: [f0(4.45, 4.25), f0(4.45, 4.75), f0(4.0, 4.5), f0(3.9, 3.9), f0(3.9, 5.1), f0(3.4, 4.5)],
    posts: [f1(5.6, 5.25), f1(4.6, 4.7), f1(4.6, 4.2), f1(5.0, 5.3), f1(6.3, 5.3)],
  },
]

export type Barriers = Record<LayerId, number>
export const fullBarriers = (): Barriers => ({ gate: LAYERS[0].max, door: LAYERS[1].max, stairs: LAYERS[2].max })

/** 武器：射程、冷却（秒）、伤害 */
const WEAPONS = {
  shotgun: { range: 4.6, cool: 1.5, dmg: 34 },
  crowbar: { range: 0, cool: 0.95, dmg: 16 },
  pin: { range: 0, cool: 1.05, dmg: 11 },
  knife: { range: 0, cool: 0.85, dmg: 12 },
  machete: { range: 0, cool: 0.8, dmg: 15 },
}
const ZOMBIE = { hp: 60, speed: 0.95, bashDmg: 5, biteDmg: 9, cool: 1.3, reach: 1.15 }

export class Zombie extends Walker {
  hp = ZOMBIE.hp
  /** 黑鸦的人（不是丧尸）：走得快、皮厚、打不过会跑 */
  raider = false
  speed = ZOMBIE.speed
  state: 'walk' | 'bash' | 'wait' | 'hunt' | 'dead' | 'leave' = 'walk'
  /** 砸门的位置编号；-1 = 挤不上去，在后面等 */
  slot = -1
  id = 0
  cool = Math.random() * ZOMBIE.cool
  deadT = 0
  repath = 0
  /** 被打中时闪一下 */
  hitT = 0
  /** 还要烧几秒 */
  burn = 0
  driver: PoseDriver | null = null
  private inner: THREE.Object3D

  constructor(at: Pt, model?: THREE.Object3D) {
    super()
    this.inner = model ?? person('#5d6b4a', '#2a2a22', 1)
    if (!model) this.inner.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.position.y > 1) m.material = new THREE.MeshToonMaterial({ color: '#8fa37e' })
    })
    if (model) this.driver = new PoseDriver(model)
    this.root.add(this.inner)
    this.root.position.set(at.x, 0, at.z)
    this.root.userData.zombie = this
  }

  get alive(): boolean {
    return this.state !== 'dead'
  }

  animate(dt: number, walking: boolean): void {
    const fight = this.state === 'bash' || this.state === 'hunt'
    const state: PoseState = this.state === 'dead' ? 'dead'
      : this.raider ? (walking ? 'walk' : fight ? 'melee' : 'idle')
      : walking ? 'zwalk' : fight ? 'zattack' : 'zwalk'
    if (this.driver) this.driver.update(dt, state)
    else {
      this.inner.rotation.x = state === 'dead' ? Math.PI / 2 : 0.25
      this.inner.position.y = state === 'dead' ? 0.2 : 0
    }
    // 死了一会儿就沉到地下去
    if (this.state === 'dead' && this.deadT > 3) this.root.position.y -= dt * 0.25
  }
}

export type Role = 'ranged' | 'melee1' | 'melee2'

export type SiegeEvent =
  | { kind: 'start'; count: number; crisis: boolean; raid: boolean }
  | { kind: 'broken'; layer: LayerId }
  | { kind: 'kill'; at: Pt; by: string; raider: boolean }
  | { kind: 'shot'; from: Actor; at: Pt }
  | { kind: 'hit'; at: Pt }
  | { kind: 'bash'; layer: LayerId; at: Pt }
  | { kind: 'fire'; at: Pt }
  | { kind: 'down'; who: string }
  | { kind: 'end'; won: boolean; kills: number; broken: LayerId[]; downed: string[] }

export interface SiegeOpts {
  count: number
  crisis: boolean
  /** 黑鸦来抢（不是丧尸） */
  raid?: boolean
  navs: Record<Floor, NavGrid>
  defenders: Actor[]
  barriers: Barriers
  ammo: { n: number }
  /** 防线耐久上限（铁门可能加固过） */
  maxOf?: (id: LayerId) => number
  spawn: (at: Pt, raider: boolean) => Zombie
  emit: (e: SiegeEvent) => void
}

/** 一晚的围攻 */
export class Siege {
  readonly zombies: Zombie[] = []
  layer = 0
  kills = 0
  done = false
  private readonly o: SiegeOpts
  private queue: { t: number; at: Pt }[] = []
  private t = 0
  private readonly cool = new Map<Actor, number>()
  private readonly broken: LayerId[] = []
  private readonly downed = new Set<Actor>()
  private nextId = 0
  private seed = 7

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0
    return this.seed / 4294967296
  }

  constructor(o: SiegeOpts) {
    this.o = o
    // 已经坏掉的层（上一晚被破、还没修好）直接跳过
    while (this.layer < LAYERS.length && o.barriers[LAYERS[this.layer].id] <= 0) this.layer++
    // 分两三波从街两头过来；危机夜来得又多又急
    const spread = o.crisis ? 14 : 22
    for (let k = 0; k < o.count; k++) {
      const west = k % 2 === 0
      this.queue.push({ t: (k * spread) / Math.max(1, o.count) + (o.crisis && k >= o.count / 2 ? 6 : 0), at: { x: west ? -13 - (k % 3) : 21 + (k % 3), z: 17 + (k % 4) * 0.8 } })
    }
    o.emit({ kind: 'start', count: o.count, crisis: o.crisis, raid: !!o.raid })
  }

  get alive(): number {
    return this.zombies.filter((z) => z.alive).length + this.queue.length
  }

  get current(): Layer | null {
    return LAYERS[this.layer] ?? null
  }

  /** 玩家调过的守位：人 → 站位编号（0 后排、1/2 贴门） */
  private readonly postOf = new Map<Actor, number>()

  /** 这个人现在守哪个位置：拿枪的默认后排，其他人按顺序贴门 */
  post(a: Actor): number {
    const fixed = this.postOf.get(a)
    if (fixed !== undefined) return fixed
    if (a.weapon === 'shotgun') return 0
    const melee = this.o.defenders.filter((d) => d.weapon !== 'shotgun')
    return Math.min(4, 1 + melee.indexOf(a))
  }

  /** 玩家把某人换到某个站位，原来站那里的人换到他的位置 */
  assign(a: Actor, slot: number): void {
    const mine = this.post(a)
    if (mine === slot) return
    const other = this.o.defenders.find((d) => d !== a && this.post(d) === slot)
    if (other) { this.postOf.set(other, mine); other.path = [] }
    this.postOf.set(a, slot)
    a.path = []
  }

  roleOf(a: Actor): Role {
    return a.weapon === 'shotgun' ? 'ranged' : a.weapon === 'crowbar' ? 'melee1' : 'melee2'
  }

  /** 打完了、尸体也清掉了 */
  get finished(): boolean {
    return this.done && this.zombies.length === 0
  }

  /** dt：游戏里的秒（已经乘过倍速） */
  tick(dt: number): void {
    this.t += dt
    while (!this.done && this.queue.length && this.queue[0].t <= this.t) {
      const q = this.queue.shift()!
      const z = this.o.spawn(q.at, !!this.o.raid)
      if (this.o.raid) { z.raider = true; z.hp = 75; z.speed = 1.35 }
      z.id = this.nextId++
      this.zombies.push(z)
      this.sendZombie(z)
    }
    for (const z of this.zombies) this.zombieTick(z, dt)
    if (!this.done) for (const a of this.o.defenders) this.defenderTick(a, dt)
    // 尸体沉下去以后移除
    for (let k = this.zombies.length - 1; k >= 0; k--) {
      const z = this.zombies[k]
      if (z.state === 'dead') {
        z.deadT += dt
        if (z.deadT > 7) { z.root.removeFromParent(); this.zombies.splice(k, 1) }
      }
    }
    if (this.done) return
    const standing = this.o.defenders.filter((a) => !this.downed.has(a))
    if (!standing.length) this.finish(false)
    else if (!this.queue.length && !this.zombies.some((z) => z.alive)) this.finish(true)
  }

  /** 天亮了：剩下的丧尸散回街上 */
  dawn(): void {
    this.finish(this.o.defenders.some((a) => !this.downed.has(a)))
  }

  private scatter(): void {
    for (const z of this.zombies) if (z.alive && z.state !== 'leave') {
      z.state = 'leave'
      z.setPath(route(this.o.navs, z.pos, { x: z.pos.x < 4 ? -20 : 28, z: 18, floor: 0 }) ?? [])
    }
    this.queue = []
  }

  private finish(won: boolean): void {
    if (this.done) return
    this.done = true
    this.scatter()
    this.o.emit({ kind: 'end', won, kills: this.kills, broken: [...this.broken], downed: [...this.downed].map((a) => a.name) })
  }

  // --- 丧尸 -----------------------------------------------------------------

  private sendZombie(z: Zombie): void {
    const layer = this.current
    z.slot = -1
    if (!layer) { z.state = 'hunt'; z.repath = 0; return }
    // 一层最多六只同时砸，其他的挤在后面等
    const used = new Set(this.zombies.filter((o) => o !== z && o.alive && o.slot >= 0).map((o) => o.slot))
    const free = layer.bash.findIndex((_, k) => !used.has(k))
    const jitter = ((z.id * 37) % 10) / 40 - 0.12
    let goal: Where
    if (free >= 0) {
      z.slot = free
      goal = { ...layer.bash[free], x: layer.bash[free].x + jitter }
    } else {
      const base = layer.bash[z.id % layer.bash.length]
      const post = layer.posts[1]
      const dx = base.x - post.x
      const dz = base.z - post.z
      const d = Math.hypot(dx, dz) || 1
      goal = { x: base.x + (dx / d) * 1.3 + jitter * 3, z: base.z + (dz / d) * 1.3, floor: base.floor }
    }
    const path = route(this.o.navs, z.pos, goal)
    z.state = 'walk'
    z.setPath(path ?? [])
  }

  /** 前面的倒下了，后面等着的补上去 */
  private fillSlots(): void {
    const layer = this.current
    if (!layer) return
    const used = this.zombies.filter((z) => z.alive && z.slot >= 0).length
    if (used >= layer.bash.length) return
    const waiter = this.zombies.find((z) => z.alive && z.slot < 0 && (z.state === 'wait' || z.state === 'walk'))
    if (waiter) this.sendZombie(waiter)
  }

  private zombieTick(z: Zombie, dt: number): void {
    z.hitT = Math.max(0, z.hitT - dt)
    if (z.state === 'dead') return
    // 身上着火：每秒掉血
    if (z.burn > 0 && z.state !== 'leave') {
      z.burn -= dt
      z.hp -= 9 * dt
      if (z.hp <= 0) { this.kill(z, 'fire'); return }
    }
    if (z.state === 'leave') {
      if (!z.path.length) { z.state = 'dead'; z.deadT = 7 }
      return
    }
    z.cool -= dt
    const layer = this.current
    if (z.state === 'walk') {
      if (!z.path.length) z.state = !layer ? 'hunt' : z.slot >= 0 ? 'bash' : 'wait'
      return
    }
    if (z.state === 'wait') {
      if (!layer) z.state = 'hunt'
      return
    }
    if (z.state === 'bash') {
      if (!layer) { z.state = 'hunt'; return }
      // 朝着要砸的东西
      const look = layer.posts[1]
      z.face(look.x - z.pos.x, look.z - z.pos.z, dt)
      if (z.cool <= 0) {
        z.cool = ZOMBIE.cool
        // 贴在门边打的人，偶尔会被从栏杆/门缝里伸出来的手抓伤
        const close = this.o.defenders.find((a) => !this.downed.has(a) && this.post(a) !== 0
          && Math.hypot(a.pos.x - z.pos.x, a.pos.z - z.pos.z) < 1.7)
        if (close && this.rand() < 0.3) {
          close.health = Math.max(0, close.health - 5)
          this.o.emit({ kind: 'hit', at: close.pos })
          if (close.health <= 0) this.knockDown(close)
          return
        }
        const id = layer.id
        this.o.barriers[id] = Math.max(0, this.o.barriers[id] - ZOMBIE.bashDmg)
        this.o.emit({ kind: 'bash', layer: id, at: z.pos })
        if (this.o.barriers[id] <= 0) this.breakLayer()
      }
      return
    }
    // 最后一层也没了：直接扑人
    const prey = this.nearestDefender(z.pos)
    if (!prey) return
    const d = Math.hypot(prey.pos.x - z.pos.x, prey.pos.z - z.pos.z)
    if (d <= ZOMBIE.reach && prey.floor === z.floor) {
      z.path = []
      z.face(prey.pos.x - z.pos.x, prey.pos.z - z.pos.z, dt)
      if (z.cool <= 0) {
        z.cool = ZOMBIE.cool
        prey.health = Math.max(0, prey.health - ZOMBIE.biteDmg)
        this.o.emit({ kind: 'hit', at: prey.pos })
        if (prey.health <= 0) this.knockDown(prey)
      }
    } else if ((z.repath -= dt) <= 0) {
      z.repath = 1
      z.setPath(route(this.o.navs, z.pos, prey.pos) ?? [])
    }
  }

  private breakLayer(): void {
    const layer = this.current
    if (!layer) return
    this.broken.push(layer.id)
    this.o.emit({ kind: 'broken', layer: layer.id })
    this.layer++
    for (const z of this.zombies) if (z.alive && z.state !== 'leave') this.sendZombie(z)
    // 守的人往里退
    for (const a of this.o.defenders) a.path = []
  }

  private nearestDefender(p: Where): Actor | null {
    let best: Actor | null = null
    let bd = Infinity
    for (const a of this.o.defenders) {
      if (this.downed.has(a)) continue
      const d = Math.hypot(a.pos.x - p.x, a.pos.z - p.z) + (a.floor === p.floor ? 0 : 5)
      if (d < bd) { bd = d; best = a }
    }
    return best
  }

  private knockDown(a: Actor): void {
    if (this.downed.has(a)) return
    this.downed.add(a)
    a.path = []
    a.pose = 'down'
    this.o.emit({ kind: 'down', who: a.name })
  }

  // --- 守的人 ---------------------------------------------------------------

  private defenderTick(a: Actor, dt: number): void {
    if (this.downed.has(a)) { a.pose = 'down'; return }
    const layer = this.current
    // 武器跟着人：女主霰弹枪（没子弹就换菜刀），爸爸撬棍，妈妈擀面杖，住进来的人拿砍刀
    const weapon = a.weapon === 'shotgun' ? (this.o.ammo.n > 0 ? 'shotgun' : 'knife') : a.weapon
    const slot = this.post(a)
    // 回到这一层的站位（最后一层没了就原地打）
    if (layer) {
      const post = layer.posts[slot]
      const far = Math.hypot(post.x - a.pos.x, post.z - a.pos.z) > 0.35 || post.floor !== a.floor
      if (far && !a.path.length) a.setPath(route(this.o.navs, a.pos, post) ?? [])
      if (a.path.length) { a.pose = 'idle'; return }
    }
    const w = WEAPONS[weapon]
    const reach = w.range || (layer ? layer.reach : 1.5)
    let target: Zombie | null = null
    let bd = reach
    for (const z of this.zombies) {
      if (!z.alive || z.state === 'leave') continue
      const d = Math.hypot(z.pos.x - a.pos.x, z.pos.z - a.pos.z)
      // 近战只打已经贴上来砸门的
      if (!w.range && (z.state === 'walk' || z.state === 'wait')) continue
      if (d < bd) { bd = d; target = z }
    }
    if (!target) {
      a.pose = 'idle'
      return
    }
    a.face(target.pos.x - a.pos.x, target.pos.z - a.pos.z, dt)
    a.pose = w.range ? 'shoot' : 'melee'
    const c = (this.cool.get(a) ?? Math.random() * 0.5) - dt
    if (c > 0) { this.cool.set(a, c); return }
    this.cool.set(a, w.cool)
    let dmg = w.dmg
    if (weapon === 'shotgun') {
      this.o.ammo.n -= 1
      dmg = bd < 3.5 ? w.dmg * 1.3 : w.dmg
      a.driver?.recoil()
      this.o.emit({ kind: 'shot', from: a, at: target.pos })
    }
    target.hp -= dmg
    target.hitT = 0.15
    this.o.emit({ kind: 'hit', at: target.pos })
    if (target.hp <= 0) this.kill(target, a.name)
  }

  private kill(z: Zombie, by: string): void {
    z.state = 'dead'
    z.path = []
    z.slot = -1
    z.burn = 0
    this.kills++
    this.o.emit({ kind: 'kill', at: z.pos, by, raider: z.raider })
    this.fillSlots()
    // 黑鸦的人倒下一大半，剩下的就跑了
    if (this.o.raid && this.kills >= Math.ceil(this.o.count * 0.6)) this.finish(true)
  }

  /** 扔燃烧瓶：砸在正在砸门的那一堆中间，烧伤一片，还会接着烧几秒 */
  molotov(): Pt | null {
    if (this.done) return null
    const layer = this.current
    const alive = this.zombies.filter((z) => z.alive && z.state !== 'leave')
    if (!alive.length) return null
    let at: Pt
    if (layer) {
      const bashing = alive.filter((z) => z.state === 'bash' || z.state === 'wait')
      const pts = bashing.length ? bashing.map((z) => z.pos) : layer.bash
      at = { x: pts.reduce((v, p) => v + p.x, 0) / pts.length, z: pts.reduce((v, p) => v + p.z, 0) / pts.length }
    } else at = alive[0].pos
    for (const z of alive) {
      if (Math.hypot(z.pos.x - at.x, z.pos.z - at.z) > 2.4) continue
      z.hp -= 40
      z.burn = 3
      z.hitT = 0.3
      if (z.hp <= 0) this.kill(z, 'fire')
    }
    this.o.emit({ kind: 'fire', at })
    return at
  }

  /** 战斗结束后：倒下的人爬起来 */
  revive(): void {
    for (const a of this.downed) {
      a.health = Math.max(a.health, 15)
      a.pose = 'idle'
    }
  }
}
