// 外婆家的橘猫"大橘"：Blender 捏的 Q 版（tools/blender/make_toon_cat.py），不用骨骼，
// 身子、头、四条腿、三节尾巴是分开的节点，这里直接转节点摆姿势。
// 白天到处溜达、跟着女主、凑到坐着歇着的人身边趴下（旁边的人心情慢慢变好）、找块地毯打盹；
// 夜里去二楼女主床边睡；打丧尸的时候躲到二楼。点它会喵一声、呼噜呼噜。
import * as THREE from 'three'
import { FLOOR_H, HOUSE, YARD, inRect, type Floor } from './layout'
import { route, type NavGrid } from './nav'
import { Walker, type Where } from './walker'
import type { Actor } from './residents'

export type CatPose = 'walk' | 'stand' | 'sit' | 'loaf'
type Plan = 'wander' | 'follow' | 'cuddle' | 'nap' | 'bed' | 'hide' | 'poked'

export interface CatCtx {
  navs: Record<Floor, NavGrid>
  hero: Actor
  family: Actor[]
  hour: number
  siege: boolean
  /** 下着雨：只在屋里待着 */
  rain?: boolean
  /** 丧尸快来了（天黑前半小时）：猫先察觉，哈气、躲上楼 */
  danger?: boolean
  /** 女主在开车：不跟（不然猫会追着车跑上街） */
  heroDriving?: boolean
}

/** 打盹的地方：客厅沙发前的青色地毯、二楼床中间的地毯、院子长椅边晒太阳 */
const NAPS: Where[] = [
  { x: 1.3, z: 4.45, floor: 0 },
  { x: 2.0, z: 2.6, floor: 1 },
  { x: 6.3, z: 9.6, floor: 0 },
  { x: 3.2, z: 4.2, floor: 0 },
]
/** 晚上睡、打丧尸时躲：二楼 */
const BEDSIDE: Where = { x: 2.0, z: 1.45, floor: 1 }
const HIDE: Where = { x: 2.2, z: 3.0, floor: 1 }

const WALK = 1.05
const TROT = 2.3

export class Cat extends Walker {
  readonly inner = new THREE.Group()
  private body: THREE.Object3D | null = null
  private head: THREE.Object3D | null = null
  private legs: THREE.Object3D[] = []
  private tail: THREE.Object3D[] = []
  private bodyY = 0.2
  pose: CatPose = 'stand'
  plan: Plan = 'wander'
  private left = 2
  private t = Math.random() * 10
  private target: Actor | null = null
  private repath = 0
  /** 被点了一下：心形泡泡还要冒多久（秒） */
  hearts = 0
  /** 炸毛哈气：还要多久（秒） */
  hiss = 0
  /** 这一晚已经哈过气了 */
  private warned = false

  constructor(model: THREE.Object3D, at: Where) {
    super()
    // glTF 里猫朝 -z，转过来朝 +z（跟人一样，rotation.y = atan2(dx, dz)）
    this.inner.rotation.y = Math.PI
    this.inner.add(model)
    this.root.add(this.inner)
    this.root.userData.cat = this
    this.root.position.set(at.x, at.floor * FLOOR_H, at.z)
    this.floor = at.floor
    this.body = model.getObjectByName('body') ?? null
    this.head = model.getObjectByName('head') ?? null
    this.legs = ['legFL', 'legFR', 'legBL', 'legBR'].map((n) => model.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o)
    this.tail = ['tail1', 'tail2', 'tail3'].map((n) => model.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o)
    if (this.body) this.bodyY = this.body.position.y
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
  }

  private go(navs: Record<Floor, NavGrid>, to: Where): boolean {
    const p = route(navs, this.pos, to)
    if (!p) return false
    this.setPath(p)
    return true
  }

  /** 选下一件事 */
  private decide(c: CatCtx): void {
    const r = Math.random()
    const home = c.family.filter((a) => !a.away && !a.dead)
    const night = c.hour >= 22 || c.hour < 6
    this.target = null
    if (c.siege || c.danger) {
      this.plan = 'hide'
      this.left = 30
      if (!this.go(c.navs, HIDE)) this.left = 3
      return
    }
    if (night) {
      this.plan = 'bed'
      this.left = 60
      if (!this.go(c.navs, BEDSIDE)) this.left = 3
      return
    }
    // 有人坐着 / 歇着 / 吃饭：过去挨着趴下
    const sitting = home.filter((a) => a.pose === 'sit' || a.pose === 'sitEat' || (a.task?.kind === 'relax' && a.task.phase === 'use'))
    if (r < 0.32 && sitting.length) {
      const a = sitting[Math.floor(Math.random() * sitting.length)]
      const ang = a.root.rotation.y + (Math.random() < 0.5 ? 1 : -1) * 1.3
      const to: Where = { x: a.pos.x + Math.sin(ang) * 0.55, z: a.pos.z + Math.cos(ang) * 0.55, floor: a.floor }
      if (this.go(c.navs, to)) {
        this.plan = 'cuddle'
        this.target = a
        this.left = 25 + Math.random() * 25
        return
      }
    }
    if (r < 0.6 && !c.hero.away && !c.heroDriving && c.hero.floor === this.floor) {
      this.plan = 'follow'
      this.target = c.hero
      this.left = 10 + Math.random() * 10
      return
    }
    if (r < 0.82) {
      const naps = c.rain ? NAPS.filter((p) => inRect(HOUSE, p.x, p.z)) : NAPS
      const n = naps[Math.floor(Math.random() * naps.length)]
      if (this.go(c.navs, n)) {
        this.plan = 'nap'
        this.left = 25 + Math.random() * 35
        return
      }
    }
    // 随便走走：屋里或者院子里
    for (let k = 0; k < 6; k++) {
      const inHouse = c.rain || Math.random() < 0.6
      const x = inHouse ? HOUSE.x0 + 0.6 + Math.random() * (HOUSE.x1 - HOUSE.x0 - 1.2) : YARD.x0 + 1 + Math.random() * (YARD.x1 - YARD.x0 - 2)
      const z = inHouse ? HOUSE.z0 + 0.6 + Math.random() * (HOUSE.z1 - HOUSE.z0 - 1.2) : 6.8 + Math.random() * 5
      if (!inHouse && inRect(HOUSE, x, z, -0.5)) continue
      if (this.go(c.navs, { x, z, floor: inHouse ? this.floor : 0 })) break
    }
    this.plan = 'wander'
    this.left = 4 + Math.random() * 6
  }

  /** 有人在摸它：先别走 */
  stay(seconds: number): void {
    this.left = Math.max(this.left, seconds)
  }

  /** 点了一下：停下来、朝镜头那边坐着喵一声 */
  poke(): void {
    this.plan = 'poked'
    this.path = []
    this.left = 3
    this.hearts = 2.2
  }

  /** dt = 游戏里过了多少"秒"（已经乘了倍速）；返回在不在走 */
  update(dt: number, c: CatCtx): boolean {
    this.left -= dt
    this.hearts = Math.max(0, this.hearts - dt)
    this.hiss = Math.max(0, this.hiss - dt)
    // 丧尸快来了：先冲院门哈一声，然后躲上楼（跟打丧尸时一样）
    if (c.danger && !this.warned) {
      this.warned = true
      this.hiss = 2.5
      this.path = []
      this.left = 0
    }
    if (!c.danger && !c.siege) this.warned = false
    // 跟着女主：隔一会儿重新找路，离近了就停下坐着看她
    if (this.plan === 'follow' && this.target) {
      const d = Math.hypot(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z)
      this.repath -= dt
      if (this.target.away || c.heroDriving || (this.target.floor !== this.floor && !this.path.length)) { this.left = 0; if (c.heroDriving) this.path = [] }
      else if (d > 1.4 && this.repath <= 0 && this.left > 0) {
        this.repath = 1.2
        const back = this.target.root.rotation.y + Math.PI + (Math.random() - 0.5)
        this.go(c.navs, { x: this.target.pos.x + Math.sin(back) * 0.8, z: this.target.pos.z + Math.cos(back) * 0.8, floor: this.target.floor })
      }
    }
    // 挨着的人起身走了，就不趴了
    if (this.plan === 'cuddle' && this.target && !this.path.length) {
      const t = this.target
      if (t.away || (t.pose !== 'sit' && t.pose !== 'sitEat' && t.task?.kind !== 'relax')) this.left = Math.min(this.left, 1)
    }
    // 打丧尸了：不管在干什么都先躲起来；天黑了回去睡
    const night = c.hour >= 22 || c.hour < 6
    if ((c.siege || c.danger) && this.plan !== 'hide' && this.hiss <= 0) { this.left = 0; if (this.plan === 'follow') this.path = [] }
    if (!c.siege && !c.danger && this.plan === 'hide') this.left = Math.min(this.left, 2)
    if (night && !c.siege && this.plan !== 'bed' && this.plan !== 'poked') this.left = Math.min(this.left, 0.5)
    if (!night && this.plan === 'bed') this.left = Math.min(this.left, 2)
    // 下起雨来还在院子里：先回屋
    if (c.rain && this.floor === 0 && !inRect(HOUSE, this.pos.x, this.pos.z) && this.plan !== 'hide' && !this.path.length) this.left = 0
    if (this.left <= 0 && !this.path.length && this.hiss <= 0) this.decide(c)

    let walking = false
    const far = this.plan === 'hide' || (this.plan === 'follow' && this.target && Math.hypot(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z) > 3)
    for (let left = dt; left > 1e-6; left -= 0.05) walking = this.follow(Math.min(left, 0.05), far ? TROT : WALK) || walking
    // 到了地方摆什么姿势
    if (this.hiss > 0) this.pose = 'stand'
    else if (walking) this.pose = 'walk'
    else if (this.plan === 'nap' || this.plan === 'bed' || this.plan === 'cuddle' || this.plan === 'hide') this.pose = 'loaf'
    else if (this.plan === 'follow' || this.plan === 'poked') this.pose = 'sit'
    else this.pose = this.left > 2 ? 'sit' : 'stand'
    // 挨着人趴着、跟着人坐着时脸朝那个人
    if (!walking && this.target && (this.plan === 'follow' || this.plan === 'cuddle')) {
      this.face(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z, dt * 0.4)
    }
    this.animate(dt, walking ? (far ? TROT : WALK) : 0)
    return walking
  }

  /** 节点摆姿势：走路对角线两条腿一起迈，尾巴竖着轻轻摆；坐着前腿撑直、后腿收起；趴着四条腿收进肚子底下、尾巴绕过来 */
  private animate(dt: number, speed: number): void {
    this.t += dt
    const body = this.body
    if (!body) return
    const L = this.legs
    const T = this.tail
    const set = (o: THREE.Object3D | undefined, x: number, y = 0, z = 0) => { if (o) o.rotation.set(x, y, z) }
    const want = { bx: 0, by: this.bodyY, hx: 0, hy: 0, hz: 0, legs: [0, 0, 0, 0], tail: [[-0.1, 0], [0.1, 0], [0.15, 0]] as [number, number][] }
    const wag = Math.sin(this.t * 1.6)
    if (this.pose === 'walk') {
      const p = this.t * (speed > 1.5 ? 13 : 8.5)
      const s = Math.sin(p) * (speed > 1.5 ? 0.7 : 0.5)
      want.legs = [s, -s, -s, s]
      want.by = this.bodyY + Math.abs(Math.cos(p)) * 0.012
      want.hx = Math.sin(p * 2) * 0.03
      want.tail = [[-0.35, Math.sin(this.t * 2.2) * 0.2], [0.25, Math.sin(this.t * 2.2 - 0.6) * 0.25], [0.3, Math.sin(this.t * 2.2 - 1.2) * 0.3]]
    } else if (this.pose === 'sit') {
      want.bx = 0.5
      want.by = this.bodyY - 0.035
      want.legs = [-0.5, -0.5, 1.45, 1.45]
      want.hx = -0.45 + Math.sin(this.t * 0.7) * 0.05
      want.hy = Math.sin(this.t * 0.45) * 0.35
      want.tail = [[0.9, 1.1 + wag * 0.15], [0.3, 0.6], [0.2, 0.5 + wag * 0.3]]
    } else if (this.pose === 'loaf') {
      want.by = this.bodyY - 0.1 + Math.sin(this.t * 1.3) * 0.004
      want.legs = [-1.5, -1.5, 1.5, 1.5]
      want.hx = -0.12
      want.hz = Math.sin(this.t * 0.3) * 0.05
      // 尾巴先往旁边转、再压平贴着地，绕到身子边上
      want.tail = [[1.25, 1.2], [0.15, 0.9], [0.1, 0.7 + Math.sin(this.t * 0.9) * 0.15]]
    } else {
      want.hy = Math.sin(this.t * 0.5) * 0.45
      want.tail = [[-0.2, wag * 0.3], [0.2, Math.sin(this.t * 1.6 - 0.6) * 0.35], [0.25, Math.sin(this.t * 1.6 - 1.2) * 0.4]]
    }
    // 炸毛哈气：弓起背、尾巴竖得笔直、低着头
    if (this.hiss > 0) {
      want.by = this.bodyY + 0.035
      want.bx = -0.1
      want.legs = [0.12, 0.12, -0.12, -0.12]
      want.hx = -0.28
      want.hy = 0
      want.tail = [[-0.75, 0], [0, 0], [0, 0]]
    }
    // 慢慢过渡过去
    const k = 1 - Math.exp(-dt * 8)
    const lerp = (a: number, b: number) => a + (b - a) * k
    body.rotation.x = lerp(body.rotation.x, want.bx)
    body.position.y = lerp(body.position.y, want.by)
    L.forEach((o, i) => set(o, lerp(o.rotation.x, want.legs[i])))
    if (this.head) set(this.head, lerp(this.head.rotation.x, want.hx), lerp(this.head.rotation.y, want.hy), lerp(this.head.rotation.z, want.hz))
    T.forEach((o, i) => set(o, lerp(o.rotation.x, want.tail[i][0]), lerp(o.rotation.y, want.tail[i][1])))
  }
}
