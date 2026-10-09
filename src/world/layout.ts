// 小别墅的布局数据（纯数据，不依赖 three.js，方便单测）。
// 坐标：x 向东，z 向南，y 向上，单位米。镜头固定从东南方向（+x +z）看过来，
// 所以东墙和南墙是"靠近镜头的墙"，在家里视角下会压低成矮墙。

export type WallKind = 'wall' | 'window' | 'door'
export type Floor = 0 | 1

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface WallSeg {
  /** 这一米墙段的中心 */
  x: number
  z: number
  /** 墙沿哪个轴延伸 */
  axis: 'x' | 'z'
  kind: WallKind
  floor: Floor
  /** 在家里视角下压低成矮墙：靠近镜头的外墙和所有隔墙（像模拟人生那样只留后面两面外墙） */
  near: boolean
}
export interface Placement {
  piece: string
  x: number
  z: number
  /** 绕 y 轴旋转，角度制 */
  rot: number
  floor: Floor
  /** 挡路的范围（半宽、半深），不填就不挡 */
  block?: [number, number]
}

export const WALL_H = 2.6
export const FLOOR_H = 2.8
export const HOUSE: Rect = { x0: 0, z0: 0, x1: 8, z1: 6 }
export const YARD: Rect = { x0: -4, z0: -3, x1: 12, z1: 13 }
export const GATE = { x: 3.5, z: 13 }
export const STREET: Rect = { x0: -24, z0: 15, x1: 32, z1: 21 }
export const WORLD: Rect = { x0: -24, z0: -8, x1: 32, z1: 30 }
export const HOUSE_CENTER = { x: 4, z: 3 }

function run(floor: Floor, axis: 'x' | 'z', fixed: number, from: number, to: number,
  near: boolean, special: Record<number, WallKind> = {}): WallSeg[] {
  const segs: WallSeg[] = []
  for (let i = from; i < to; i++) {
    const kind = special[i] ?? 'wall'
    segs.push(axis === 'x'
      ? { x: i + 0.5, z: fixed, axis, kind, floor, near }
      : { x: fixed, z: i + 0.5, axis, kind, floor, near })
  }
  return segs
}

export const WALLS: WallSeg[] = [
  // 一楼外墙
  ...run(0, 'x', 0, 0, 8, false, { 1: 'window', 6: 'window' }),
  ...run(0, 'z', 0, 0, 6, false, { 2: 'window' }),
  ...run(0, 'x', 6, 0, 8, true, { 1: 'window', 3: 'door', 6: 'window' }),
  ...run(0, 'z', 8, 0, 6, true, { 1: 'window', 4: 'window' }),
  // 一楼隔墙：厨房（东北角）
  ...run(0, 'z', 5, 0, 3, true, { 1: 'door' }),
  ...run(0, 'x', 3, 5, 8, true, { 6: 'door' }),
  // 二楼外墙
  ...run(1, 'x', 0, 0, 8, false, { 1: 'window', 6: 'window' }),
  ...run(1, 'z', 0, 0, 6, false, { 2: 'window', 4: 'window' }),
  ...run(1, 'x', 6, 0, 8, true, { 1: 'window', 6: 'window' }),
  ...run(1, 'z', 8, 0, 6, true, { 1: 'window', 4: 'window' }),
  // 二楼隔墙：西边卧室、东边书房和楼梯口
  ...run(1, 'z', 4, 0, 6, true, { 4: 'door' }),
  ...run(1, 'x', 3, 4, 8, true, { 5: 'door' }),
]

export const FURNITURE: Placement[] = [
  // 一楼客厅
  { piece: 'table', x: 2.5, z: 3, rot: 0, floor: 0, block: [0.65, 0.4] },
  { piece: 'chair', x: 2.5, z: 2.35, rot: 180, floor: 0 },
  { piece: 'chair', x: 2.5, z: 3.65, rot: 0, floor: 0 },
  { piece: 'sofa', x: 1.0, z: 5.2, rot: 0, floor: 0, block: [0.9, 0.45] },
  { piece: 'crate', x: 0.5, z: 0.5, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 1.2, z: 0.5, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 0.5, z: 1.2, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'wall_map', x: 0.12, z: 3.8, rot: 90, floor: 0 },
  // 一楼厨房
  { piece: 'counter', x: 6.5, z: 0.4, rot: 0, floor: 0, block: [1.5, 0.35] },
  { piece: 'fridge', x: 7.6, z: 1.4, rot: -90, floor: 0, block: [0.4, 0.4] },
  // 楼梯（只是样子，原型里还不能上楼）
  { piece: 'stairs', x: 6.5, z: 4.5, rot: 0, floor: 0, block: [1.4, 0.6] },
  // 二楼
  { piece: 'bed', x: 1.0, z: 1.2, rot: 180, floor: 1 },
  { piece: 'bed', x: 3.0, z: 1.2, rot: 180, floor: 1 },
  { piece: 'desk', x: 6.0, z: 0.5, rot: 0, floor: 1 },
  { piece: 'chair', x: 6.0, z: 1.1, rot: 0, floor: 1 },
  { piece: 'shelf', x: 7.6, z: 1.5, rot: -90, floor: 1 },
]

/** 院子围栏，铁门那一米留空 */
export function fenceSegments(): { x: number; z: number; axis: 'x' | 'z'; gate: boolean }[] {
  const segs: { x: number; z: number; axis: 'x' | 'z'; gate: boolean }[] = []
  for (let x = YARD.x0; x < YARD.x1; x++) {
    segs.push({ x: x + 0.5, z: YARD.z0, axis: 'x', gate: false })
    segs.push({ x: x + 0.5, z: YARD.z1, axis: 'x', gate: x + 0.5 === GATE.x })
  }
  for (let z = YARD.z0; z < YARD.z1; z++) {
    segs.push({ x: YARD.x0, z: z + 0.5, axis: 'z', gate: false })
    segs.push({ x: YARD.x1, z: z + 0.5, axis: 'z', gate: false })
  }
  return segs
}

/** 街对面和街边的东西：邻居房子、树、废弃的车 */
export interface Prop { kind: 'house' | 'tree' | 'car' | 'barrel'; x: number; z: number; w: number; d: number; rot: number; color?: string }
export const PROPS: Prop[] = [
  { kind: 'house', x: -14, z: 26, w: 7, d: 6, rot: 0, color: '#d9c7a8' },
  { kind: 'house', x: 0, z: 26, w: 8, d: 6, rot: 0, color: '#c9d4c4' },
  { kind: 'house', x: 16, z: 26, w: 7, d: 6, rot: 0, color: '#e0c4b0' },
  { kind: 'house', x: 24, z: 5, w: 7, d: 7, rot: 0, color: '#d4ccbf' },
  { kind: 'car', x: -8, z: 17.2, w: 1.9, d: 4.2, rot: 90, color: '#b85c4a' },
  { kind: 'car', x: 13, z: 19, w: 1.9, d: 4.2, rot: 80, color: '#6f8fa8' },
  { kind: 'barrel', x: 7.2, z: 15.6, w: 0.6, d: 0.6, rot: 0 },
  { kind: 'barrel', x: 7.9, z: 15.9, w: 0.6, d: 0.6, rot: 0 },
  ...[-20, -12, -4, 10, 18, 26].map((x) => ({ kind: 'tree' as const, x, z: 14.2, w: 0.6, d: 0.6, rot: 0 })),
  ...[-18, -6, 6, 20].map((x) => ({ kind: 'tree' as const, x, z: 22, w: 0.6, d: 0.6, rot: 0 })),
  { kind: 'tree', x: -2.5, z: -1.5, w: 0.6, d: 0.6, rot: 0 },
  { kind: 'tree', x: 10.5, z: 10.5, w: 0.6, d: 0.6, rot: 0 },
  { kind: 'tree', x: -2.5, z: 11, w: 0.6, d: 0.6, rot: 0 },
]

export function inRect(r: Rect, x: number, z: number, margin = 0): boolean {
  return x > r.x0 + margin && x < r.x1 - margin && z > r.z0 + margin && z < r.z1 - margin
}

/** 女主是否在自家地盘里（决定用哪种镜头）。带一点滞后，避免在门口来回闪。 */
export function isHome(x: number, z: number, wasHome: boolean): boolean {
  return inRect(YARD, x, z, wasHome ? -0.3 : 0.3)
}
