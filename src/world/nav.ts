// 走路用的格子地图和寻路（纯逻辑，可单测）。
import { FLOOR_H, FURNITURE, HOUSE, PARADISE_EXTRAS, PROPS, STAIR_HOLE, STAIR_PATH, VAN_PARK, VAN_SIZE, WALLS, WORLD, fenceSegments, type Floor, type Placement, type Rect, type StairPoint, WELL, COOP, PORCH } from './layout'

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

/** 一楼和院子、街道的可走地图。`extra` 是画风特有的家具。 */
export function buildNav(extra: Placement[] = [], paradise = false): NavGrid {
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
    if (p.floor !== 0 || !p.block || (paradise && p.toonOnly)) continue
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
  // 檐廊的柱子
  for (const x of [PORCH.x0 + 0.15, (PORCH.x0 + PORCH.x1) / 2 - 2, (PORCH.x0 + PORCH.x1) / 2 + 2, PORCH.x1 - 0.15]) nav.blockRect(x - 0.12, PORCH.z1 - 0.27, x + 0.12, PORCH.z1 - 0.03)
  // 压水井、鸡圈
  nav.blockRect(WELL.x - 0.35, WELL.z - 0.35, WELL.x + 0.35, WELL.z + 0.35)
  nav.blockRect(COOP.x0, COOP.z0, COOP.x1, COOP.z1)
  // 面包车的车位（车开走了也绕着走，省得车回来时压到人）
  nav.blockRect(VAN_PARK.x - VAN_SIZE.hl, VAN_PARK.z - VAN_SIZE.hw, VAN_PARK.x + VAN_SIZE.hl, VAN_PARK.z + VAN_SIZE.hw)
  return nav
}

/** 二楼的可走地图：只有房子里面，挡掉墙、家具和楼梯口 */
export function buildNavUpstairs(extra: Placement[] = [], paradise = false): NavGrid {
  const nav = new NavGrid(WORLD)
  nav.blockRect(WORLD.x0, WORLD.z0, WORLD.x1, HOUSE.z0)
  // 南边多出 2 米的阳台（栏杆那一线挡住）
  nav.blockRect(WORLD.x0, PORCH.z1 - 0.25, WORLD.x1, WORLD.z1)
  nav.blockRect(WORLD.x0, WORLD.z0, HOUSE.x0, WORLD.z1)
  nav.blockRect(HOUSE.x1, WORLD.z0, WORLD.x1, WORLD.z1)
  for (const s of WALLS) {
    if (s.floor !== 1 || s.kind === 'door') continue
    if (s.axis === 'x') nav.blockRect(s.x - 0.5, s.z - WALL_HALF_T, s.x + 0.5, s.z + WALL_HALF_T)
    else nav.blockRect(s.x - WALL_HALF_T, s.z - 0.5, s.x + WALL_HALF_T, s.z + 0.5)
  }
  nav.blockRect(STAIR_HOLE.x0, STAIR_HOLE.z0, STAIR_HOLE.x1, STAIR_HOLE.z1)
  for (const p of [...FURNITURE, ...extra]) {
    if (p.floor !== 1 || !p.block || (paradise && p.toonOnly)) continue
    const swap = Math.abs(p.rot) % 180 === 90
    const [hw, hd] = swap ? [p.block[1], p.block[0]] : p.block
    nav.blockRect(p.x - hw, p.z - hd, p.x + hw, p.z + hd)
  }
  return nav
}

/** 两层楼各一张寻路图。世外桃源画风的床、储藏室的架子是另外摆的（卡通画风那套不挡路） */
export function navFloors(style: 'toon' | 'paradise'): Record<Floor, NavGrid> {
  const paradise = style === 'paradise'
  const extra = paradise ? PARADISE_EXTRAS : []
  return { 0: buildNav(extra, paradise), 1: buildNavUpstairs(extra, paradise) }
}

/** 跨楼层寻路：同层直接走；不同层先走到楼梯口，按楼梯路线爬上/爬下，再走到目的地。 */
export function route(navs: Record<Floor, NavGrid>, from: Pt & { floor: Floor }, to: Pt & { floor: Floor }): StairPoint[] | null {
  const lift = (pts: Pt[], floor: Floor): StairPoint[] => pts.map((p) => ({ x: p.x, z: p.z, y: floor * FLOOR_H, floor }))
  if (from.floor === to.floor) {
    const p = navs[from.floor].findPath(from, to)
    return p && lift(p, from.floor)
  }
  const up = from.floor === 0
  const stairs = up ? STAIR_PATH : [...STAIR_PATH].reverse()
  const enter = stairs[0]
  const exit = stairs[stairs.length - 1]
  const a = navs[from.floor].findPath(from, enter)
  const b = navs[to.floor].findPath(exit, to)
  if (!a || !b) return null
  return [...lift(a, from.floor), ...stairs.slice(1), ...lift(b, to.floor)]
}
