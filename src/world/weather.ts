// 天气：每天按日子算一次会不会下雨、几点下、下多久（同一天每次进游戏都一样）。
// 下雨时天色变灰、雾变浓、大家不去院子里溜达；院子里的木桶会接雨水（前世记忆：断水后开始接雨水）。
import * as THREE from 'three'

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export interface RainSpell { start: number; end: number; heavy: boolean }

/** 这一天的雨（没有就是 null） */
export function rainOf(day: number): RainSpell | null {
  if (hash(day) > 0.3) return null
  const start = 7 + hash(day + 0.37) * 12
  return { start, end: start + 2 + hash(day + 0.71) * 4, heavy: hash(day + 0.13) < 0.35 }
}

/** 现在雨有多大：0 = 不下，1 = 暴雨（前后各半小时渐变） */
export function rainAt(day: number, hour: number): number {
  let v = 0
  for (const d of [day - 1, day]) {
    const r = rainOf(d)
    if (!r) continue
    const h = hour + (day - d) * 24
    const k = Math.min(1, Math.max(0, Math.min(h - r.start, r.end - h) / 0.5))
    v = Math.max(v, k * (r.heavy ? 1 : 0.55))
  }
  return v
}

/** 雨丝：一团围着镜头的线段，往下落，落地后回到顶上 */
export class Rain {
  readonly lines: THREE.LineSegments
  private readonly pos: Float32Array
  private readonly speed: Float32Array
  private readonly n = 2600
  private readonly mat: THREE.LineBasicMaterial
  /** 雪花：跟雨丝用同一批位置（每段的上端），画成会随远近变大小的圆点 */
  readonly flakes: THREE.Points
  private readonly flakePos: Float32Array
  private readonly flakeMat: THREE.PointsMaterial

  constructor() {
    this.pos = new Float32Array(this.n * 6)
    this.speed = new Float32Array(this.n)
    for (let i = 0; i < this.n; i++) {
      this.speed[i] = 14 + Math.random() * 6
      this.reset(i, new THREE.Vector3(), Math.random() * 14)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.mat = new THREE.LineBasicMaterial({ color: '#c9d6e3', transparent: true, opacity: 0, depthWrite: false })
    this.lines = new THREE.LineSegments(geo, this.mat)
    this.lines.frustumCulled = false
    this.lines.visible = false
    this.flakePos = new Float32Array(this.n * 3)
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(this.flakePos, 3))
    this.flakeMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.09, transparent: true, opacity: 0, depthWrite: false })
    this.flakes = new THREE.Points(fg, this.flakeMat)
    this.flakes.frustumCulled = false
    this.flakes.visible = false
  }

  private reset(i: number, c: THREE.Vector3, y = 12 + Math.random() * 4): void {
    const x = c.x + (Math.random() - 0.5) * 44
    const z = c.z + (Math.random() - 0.5) * 44
    this.pos.set([x, y, z, x - 0.06, y - 0.8, z - 0.02], i * 6)
  }

  private t = 0

  /** snow：零度以下下的是雪——白色的小短线（看着像雪花），落得慢、左右飘 */
  update(dt: number, center: THREE.Vector3, amount: number, snow = false): void {
    const on = amount > 0.01
    this.lines.visible = on && !snow
    this.flakes.visible = on && snow
    if (!on) return
    this.t += dt
    this.mat.opacity = 0.3 + amount * 0.4
    this.flakeMat.opacity = 0.6 + amount * 0.35
    const active = Math.floor(this.n * amount)
    for (let i = 0; i < this.n; i++) {
      const o = i * 6
      if (i >= active) { this.pos[o + 1] = -50; this.pos[o + 4] = -50; continue }
      if (snow) {
        const dy = this.speed[i] * 0.11 * dt
        const dx = Math.sin(this.t * 1.3 + i) * 0.4 * dt
        this.pos[o] += dx
        this.pos[o + 1] -= dy
        this.pos[o + 2] += Math.cos(this.t * 0.9 + i * 0.7) * 0.3 * dt
        // 雪花：很短的一小截
        this.pos[o + 3] = this.pos[o] + 0.04
        this.pos[o + 4] = this.pos[o + 1] - 0.07
        this.pos[o + 5] = this.pos[o + 2] + 0.02
      } else {
        const dy = this.speed[i] * dt
        // 刚从下雪换成下雨：把短雪花拉回雨丝的长度
        if (this.pos[o + 1] - this.pos[o + 4] < 0.5) { this.pos[o + 3] = this.pos[o] - 0.06; this.pos[o + 4] = this.pos[o + 1] - 0.8; this.pos[o + 5] = this.pos[o + 2] - 0.02 }
        this.pos[o + 1] -= dy
        this.pos[o + 4] -= dy
        this.pos[o] -= dy * 0.08
        this.pos[o + 3] -= dy * 0.08
      }
      if (this.pos[o + 4] < 0 || Math.abs(this.pos[o] - center.x) > 24 || Math.abs(this.pos[o + 2] - center.z) > 24) this.reset(i, center)
      if (snow) this.flakePos.set([this.pos[o], this.pos[o + 1], this.pos[o + 2]], i * 3)
    }
    if (snow) {
      for (let i = active; i < this.n; i++) this.flakePos[i * 3 + 1] = -50
      this.flakes.geometry.attributes.position.needsUpdate = true
    } else this.lines.geometry.attributes.position.needsUpdate = true
  }
}
