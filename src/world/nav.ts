// 走路用的格子地图和寻路（纯逻辑，可单测）。
import { FURNITURE, PROPS, WALLS, WORLD, fenceSegments, type Placement, type Rect } from './layout'

export const CELL = 0.5

export interface Pt { x: number; z: number }

export class NavGrid {
  readonly w: number
  readonly h: number
  readonly blocked: Uint8Array
  readonly rect: Rect

  constructor(rect: Rect) {
    this.rect = rect
    this.w = Math.round((rect.x1 - rect.x0) / CELL)
    this.h = Math.round((rect.z1 - rect.z0) / CELL)
    this.blocked = new Uint8Array(this.w * this.h)
  }

  cellOf(x: number, z: number): [number, number] {
    return [Math.floor((x - this.rect.x0) / CELL), Math.floor((z - this.rect.z0) / CELL)]
  }

  centerOf(i: number, j: number): Pt {
    return { x: this.rect.x0 + (i + 0.5) * CELL, z: this.rect.z0 + (j + 0.5) * CELL }
  }

  inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h
  }

  isBlockedCell(i: number, j: number): boolean {
    return !this.inside(i, j) || this.blocked[j * this.w + i] === 1
  }

  isBlockedAt(x: number, z: number): boolean {
    const [i, j] = this.cellOf(x, z)
    return this.isBlockedCell(i, j)
  }

  /** 把一个矩形范围内碰到的格子都标成不能走 */
  blockRect(x0: number, z0: number, x1: number, z1: number): void {
    const [i0, j0] = this.cellOf(Math.min(x0, x1) + 1e-6, Math.min(z0, z1) + 1e-6)
    const [i1, j1] = this.cellOf(Math.max(x0, x1) - 1e-6, Math.max(z0, z1) - 1e-6)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (this.inside(i, j)) this.blocked[j * this.w + i] = 1
  }

  /** 两点之间直线能不能走通（用来把格子路径拉直） */
  clearLine(a: Pt, b: Pt): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.ceil(d / (CELL * 0.4))
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0 : k / n
      if (this.isBlockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false
    }
    return true
  }

  /** 离目标最近的能走的格子 */
  nearestFree(x: number, z: number): [number, number] | null {
    const [ci, cj] = this.cellOf(x, z)
    for (let r = 0; r < 12; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
          if (!this.isBlockedCell(ci + di, cj + dj)) return [ci + di, cj + dj]
        }
    return null
  }

  /** A* 八方向寻路，不能斜着穿墙角；返回拉直后的路点（不含起点） */
  findPath(from: Pt, to: Pt): Pt[] | null {
    const start = this.nearestFree(from.x, from.z)
    const goal = this.nearestFree(to.x, to.z)
    if (!start || !goal) return null
    const W = this.w
    const si = start[1] * W + start[0]
    const gi = goal[1] * W + goal[0]
    const g = new Float32Array(this.w * this.h).fill(Infinity)
    const came = new Int32Array(this.w * this.h).fill(-1)
    const closed = new Uint8Array(this.w * this.h)
    const open: number[] = [si]
    const f = new Float32Array(this.w * this.h).fill(Infinity)
    const hfun = (idx: number) => {
      const dx = Math.abs((idx % W) - goal[0])
      const dz = Math.abs(Math.floor(idx / W) - goal[1])
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
    }
    g[si] = 0
    f[si] = hfun(si)
    let guard = 0
    while (open.length && guard++ < 40000) {
      let bi = 0
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k
      const cur = open[bi]
      open[bi] = open[open.length - 1]
      open.pop()
      if (cur === gi) break
      closed[cur] = 1
      const ci = cur % W
      const cj = Math.floor(cur / W)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ni = ci + di
          const nj = cj + dj
          if (this.isBlockedCell(ni, nj)) continue
          if (di && dj && (this.isBlockedCell(ci + di, cj) || this.isBlockedCell(ci, cj + dj))) continue
          const n = nj * W + ni
          if (closed[n]) continue
          const ng = g[cur] + (di && dj ? Math.SQRT2 : 1)
          if (ng < g[n]) {
            if (g[n] === Infinity) open.push(n)
            g[n] = ng
            f[n] = ng + hfun(n)
            came[n] = cur
          }
        }
    }
    if (came[gi] === -1 && gi !== si) return null
    const cells: Pt[] = []
    for (let c = gi; c !== -1 && c !== si; c = came[c]) cells.push(this.centerOf(c % W, Math.floor(c / W)))
    cells.reverse()
    if (cells.length) cells[cells.length - 1] = this.isBlockedAt(to.x, to.z) ? cells[cells.length - 1] : { ...to }
    // 拉直：能直线走到的路点就跳过中间的
    const out: Pt[] = []
    let anchor: Pt = from
    for (let k = 0; k < cells.length; k++) {
      const next = cells[k + 1]
      if (next && this.clearLine(anchor, next)) continue
      out.push(cells[k])
      anchor = cells[k]
    }
    return out
  }
}

const WALL_HALF_T = 0.15

/** 一楼和院子、街道的可走地图。二楼原型里还不能走。`extra` 是画风特有的家具。 */
export function buildNav(extra: Placement[] = []): NavGrid {
  const nav = new NavGrid(WORLD)
  for (const s of WALLS) {
    if (s.floor !== 0 || s.kind === 'door') continue
    if (s.axis === 'x') nav.blockRect(s.x - 0.5, s.z - WALL_HALF_T, s.x + 0.5, s.z + WALL_HALF_T)
    else nav.blockRect(s.x - WALL_HALF_T, s.z - 0.5, s.x + WALL_HALF_T, s.z + 0.5)
  }
  for (const s of fenceSegments()) {
    if (s.gate) continue
    if (s.axis === 'x') nav.blockRect(s.x - 0.5, s.z - 0.1, s.x + 0.5, s.z + 0.1)
    else nav.blockRect(s.x - 0.1, s.z - 0.5, s.x + 0.1, s.z + 0.5)
  }
  for (const p of [...FURNITURE, ...extra]) {
    if (p.floor !== 0 || !p.block) continue
    const swap = Math.abs(p.rot) % 180 === 90
    const [hw, hd] = swap ? [p.block[1], p.block[0]] : p.block
    nav.blockRect(p.x - hw, p.z - hd, p.x + hw, p.z + hd)
  }
  for (const p of PROPS) {
    const swap = Math.abs(p.rot) % 180 >= 45 && Math.abs(p.rot) % 180 <= 135
    const [hw, hd] = swap ? [p.d / 2, p.w / 2] : [p.w / 2, p.d / 2]
    if (p.kind === 'tree') nav.blockRect(p.x - 0.3, p.z - 0.3, p.x + 0.3, p.z + 0.3)
    else nav.blockRect(p.x - hw, p.z - hd, p.x + hw, p.z + hd)
  }
  return nav
}
