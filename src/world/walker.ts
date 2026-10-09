// 会走路的东西（人和丧尸）的公共部分。
import * as THREE from 'three'
import type { Floor, StairPoint } from './layout'
import type { Pt } from './nav'

export interface Where extends Pt { floor: Floor }

/** 小于这个距离（米）就不按方向转身 */
const MIN_FACE = 0.12
/** 转身最快多少弧度每秒 */
const TURN_SPEED = 9

/** 沿路点走，楼梯上高度跟着变 */
export class Walker {
  readonly root = new THREE.Group()
  path: StairPoint[] = []
  floor: Floor = 0
  /** 这一帧换了楼层 */
  floorChanged = false
  protected readonly legFrom = new THREE.Vector3()

  get pos(): Where {
    return { x: this.root.position.x, z: this.root.position.z, floor: this.floor }
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
    // 离得太近（两个人叠在一起、丧尸贴脸、快走到路点）方向全是噪声：不转，不然会原地疯狂打转
    if (dx * dx + dz * dz < MIN_FACE * MIN_FACE) return
    const r = this.root.rotation.y
    const want = Math.atan2(dx, dz)
    let diff = want - r
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    // 转身也有最快速度：一秒最多转一圈半
    const max = TURN_SPEED * dt
    const turn = Math.max(-max, Math.min(max, diff * Math.min(1, dt * 12)))
    const next = r + turn
    this.root.rotation.y = Math.atan2(Math.sin(next), Math.cos(next))
  }
}

