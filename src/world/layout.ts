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
  /** 离本层地面的高度（挂在空中的灯等） */
  y?: number
  scale?: number
}

export const WALL_H = 2.6
export const FLOOR_H = 2.8
export const HOUSE: Rect = { x0: 0, z0: 0, x1: 8, z1: 6 }
export const YARD: Rect = { x0: -4, z0: -3, x1: 12, z1: 13 }
export const GATE = { x: 4, z: 13 }
export const STREET: Rect = { x0: -24, z0: 15, x1: 32, z1: 21 }
export const WORLD: Rect = { x0: -24, z0: -8, x1: 32, z1: 30 }
/** 街边路灯（人行道上，铁门这一侧） */
export const STREET_LAMPS = [-18, -6, 6, 18, 30].map((x) => ({ x, z: STREET.z0 - 0.7 }))
export const HOUSE_CENTER = { x: 4, z: 3 }

/** 家里那辆旧面包车停在院子西南角（车头朝东、朝着铁门那边），rot 是 rotation.y */
export const VAN_PARK = { x: 0.3, z: 11.9, rot: Math.PI / 2 }
/** 车挡住的地方（半长、半宽） */
export const VAN_SIZE = { hl: 1.98, hw: 0.82 }
/** 上下车站的地方：车北边（左手边）的车门外 */
export const VAN_DOORS = [{ x: 1.35, z: 10.65 }, { x: 0.35, z: 10.65 }, { x: -0.6, z: 10.65 }, { x: 2.3, z: 10.4 }]
/** 车正在开出去 / 开回来：从哪个游戏时刻（day*24+hour）开始 */
export interface VanMove { dir: 'out' | 'in'; t0: number }
/** 开出去 / 开回来各用多少游戏小时（画面和 Household 用同一个数，快进、读档都对得上） */
export const VAN_OUT_H = 0.5
export const VAN_IN_H = 0.8

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
  { piece: 'chair', x: 1.62, z: 3.0, rot: -90, floor: 0 },
  { piece: 'sofa', x: 1.0, z: 5.2, rot: 0, floor: 0, block: [0.9, 0.45] },
  { piece: 'crate', x: 0.5, z: 0.5, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 1.2, z: 0.5, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 0.5, z: 1.2, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'wall_map', x: 0.12, z: 3.8, rot: 90, floor: 0 },
  // 一楼厨房
  { piece: 'counter', x: 6.5, z: 0.4, rot: 0, floor: 0, block: [1.5, 0.35] },
  { piece: 'fridge', x: 7.6, z: 1.4, rot: -90, floor: 0, block: [0.4, 0.4] },
  // 楼梯：西头上、东头到二楼
  { piece: 'stairs', x: 6.5, z: 4.5, rot: 0, floor: 0, block: [1.4, 0.6] },
  // 二楼
  { piece: 'bed', x: 1.0, z: 1.2, rot: 180, floor: 1, block: [0.5, 1.0] },
  { piece: 'bed', x: 3.0, z: 1.2, rot: 180, floor: 1, block: [0.5, 1.0] },
  { piece: 'desk', x: 6.0, z: 0.5, rot: 0, floor: 1 },
  { piece: 'chair', x: 6.0, z: 1.1, rot: 0, floor: 1 },
  { piece: 'shelf', x: 7.6, z: 1.5, rot: -90, floor: 1 },
]

/** 世外桃源画风里额外摆的 Poly Haven 模型（卡通画风里没有） */
export const PARADISE_EXTRAS: Placement[] = [
  { piece: 'Rockingchair_01', x: 0.9, z: 2.0, rot: 110, floor: 0, block: [0.4, 0.45] },
  { piece: 'chinese_cabinet', x: 3.3, z: 0.42, rot: 0, floor: 0, block: [0.65, 0.32], scale: 0.85 },
  { piece: 'potted_plant_01', x: 4.35, z: 0.55, rot: 0, floor: 0, block: [0.3, 0.3] },
  { piece: 'WoodenTable_01', x: 0.3, z: 3.3, rot: 90, floor: 0, block: [0.63, 0.23], scale: 0.7 },
  { piece: 'chinese_chandelier', x: 2.5, z: 3.0, rot: 0, floor: 0, y: 1.7, scale: 0.8 },
  { piece: 'ClassicNightstand_01', x: 2.7, z: 0.38, rot: 0, floor: 1, block: [0.3, 0.22] },
  { piece: 'wooden_lantern_01', x: 2.7, z: 0.38, rot: 0, floor: 1, y: 0.7 },
  { piece: 'vintage_day_bed', x: 1.25, z: 0.55, rot: 0, floor: 1, block: [1.0, 0.45] },
  { piece: 'vintage_day_bed', x: 0.55, z: 3.7, rot: 90, floor: 1, block: [1.0, 0.45] },
  { piece: 'vintage_day_bed', x: 2.4, z: 5.45, rot: 180, floor: 1, block: [1.0, 0.45] },
  { piece: 'painted_wooden_bench', x: 7.0, z: 9.2, rot: -90, floor: 0, block: [0.6, 0.3] },
  { piece: 'wine_barrel_01', x: 8.75, z: 5.3, rot: 0, floor: 0, block: [0.4, 0.4] },
  { piece: 'wooden_bucket_01', x: 8.8, z: 4.4, rot: 0, floor: 0, block: [0.2, 0.2] },
  { piece: 'boulder_01', x: 11.0, z: 11.8, rot: 30, floor: 0, block: [0.7, 0.9] },
]

/** 院子围栏，铁门那两米留空 */
export function fenceSegments(): { x: number; z: number; axis: 'x' | 'z'; gate: boolean }[] {
  const segs: { x: number; z: number; axis: 'x' | 'z'; gate: boolean }[] = []
  for (let x = YARD.x0; x < YARD.x1; x++) {
    segs.push({ x: x + 0.5, z: YARD.z0, axis: 'x', gate: false })
    segs.push({ x: x + 0.5, z: YARD.z1, axis: 'x', gate: Math.abs(x + 0.5 - GATE.x) < 0.6 })
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
  { kind: 'tree', x: 11, z: -1.5, w: 0.6, d: 0.6, rot: 0 },
  { kind: 'tree', x: -2.5, z: 11, w: 0.6, d: 0.6, rot: 0 },
]

export function inRect(r: Rect, x: number, z: number, margin = 0): boolean {
  return x > r.x0 + margin && x < r.x1 - margin && z > r.z0 + margin && z < r.z1 - margin
}

/** 女主是否在自家地盘里（决定用哪种镜头）。带一点滞后，避免在门口来回闪。 */
export function isHome(x: number, z: number, wasHome: boolean): boolean {
  return inRect(YARD, x, z, wasHome ? -0.3 : 0.3)
}

// --- 楼梯和"能干什么"的位置 ----------------------------------------------------

export interface StairPoint { x: number; z: number; y: number; floor: Floor }
/** 楼梯：一楼从西头（x≈5）往东爬，到二楼东头再往南迈一步上楼板 */
export const STAIR_PATH: StairPoint[] = [
  { x: 4.75, z: 4.5, y: 0, floor: 0 },
  { x: 5.15, z: 4.5, y: 0, floor: 0 },
  { x: 7.6, z: 4.5, y: FLOOR_H, floor: 1 },
  { x: 7.25, z: 5.25, y: FLOOR_H, floor: 1 },
]
/** 二楼楼板上楼梯那一块是空的（不能走、也不铺地板） */
export const STAIR_HOLE: Rect = { x0: 5, z0: 4, x1: 8, z1: 5 }

export type SpotKind = 'cook' | 'drink' | 'dine' | 'relax' | 'stroll' | 'sleep'
export type SpotPose = 'idle' | 'sit' | 'sleep' | 'work'
export interface Spot {
  kind: SpotKind
  /** 人在这里时 root 的位置（坐着是屁股、躺着是脚） */
  x: number
  z: number
  floor: Floor
  /** 朝向：rotation.y，角度（0 = 面朝 +z / 南） */
  face: number
  pose: SpotPose
  /** 离本层地面的高度偏移 */
  y?: number
  /** 先走到这里再挪进去（家具占的格子走不进去） */
  ax?: number
  az?: number
}

export const SPOTS: Spot[] = [
  // 厨房：灶台、案板、冰箱
  { kind: 'cook', x: 6.85, z: 1.1, floor: 0, face: 180, pose: 'work' },
  { kind: 'cook', x: 5.95, z: 1.1, floor: 0, face: 180, pose: 'work' },
  { kind: 'drink', x: 6.75, z: 1.65, floor: 0, face: 90, pose: 'work' },
  // 餐桌三把椅子
  { kind: 'dine', x: 2.5, z: 2.3, floor: 0, face: 0, pose: 'sit' },
  { kind: 'dine', x: 2.5, z: 3.7, floor: 0, face: 180, pose: 'sit' },
  { kind: 'dine', x: 1.62, z: 3.0, floor: 0, face: 90, pose: 'sit', ax: 1.25, az: 3.2 },
  // 沙发两个座位、院子里的长椅
  { kind: 'relax', x: 0.62, z: 5.15, floor: 0, face: 180, pose: 'sit', ax: 0.62, az: 4.25 },
  { kind: 'relax', x: 1.38, z: 5.15, floor: 0, face: 180, pose: 'sit', ax: 1.38, az: 4.25 },
  // 院子里溜达
  { kind: 'stroll', x: 2, z: 9, floor: 0, face: 160, pose: 'idle' },
  { kind: 'stroll', x: 9.5, z: 2.5, floor: 0, face: 90, pose: 'idle' },
  { kind: 'stroll', x: -2, z: 6, floor: 0, face: -90, pose: 'idle' },
  { kind: 'stroll', x: 9.5, z: 10.2, floor: 0, face: 45, pose: 'idle' },
  { kind: 'stroll', x: 5.5, z: 11, floor: 0, face: 0, pose: 'idle' },
  { kind: 'stroll', x: 3, z: -1.8, floor: 0, face: 180, pose: 'idle' },
]

/** 世外桃源画风多出来能坐的地方：摇椅、院子里的长椅 */
export const PARADISE_SPOTS: Spot[] = [
  { kind: 'relax', x: 0.92, z: 2.0, floor: 0, face: 110, pose: 'sit', y: 0.04, ax: 1.75, az: 2.0 },
  { kind: 'relax', x: 7.02, z: 9.2, floor: 0, face: -90, pose: 'sit', ax: 6.25, az: 9.2 },
]

/** 每人一个睡觉的地方，按人的顺序分（女主、妈妈、爸爸、住进来的两个人）。x/z 是脚的位置，躺下后头朝 face 的反方向 */
export const BEDS: Record<'toon' | 'paradise', Spot[]> = {
  toon: [
    { kind: 'sleep', x: 1, z: 2.1, floor: 1, face: 0, pose: 'sleep', ax: 1, az: 2.75 },
    { kind: 'sleep', x: 3, z: 2.1, floor: 1, face: 0, pose: 'sleep', ax: 3, az: 2.75 },
    { kind: 'sleep', x: 1.8, z: 5.15, floor: 0, face: 90, pose: 'sleep', y: -0.12, ax: 1.6, az: 4.25 },
    { kind: 'sleep', x: 6.9, z: 2.1, floor: 1, face: 90, pose: 'sleep', y: -0.48, ax: 5.6, az: 2.4 },
    { kind: 'sleep', x: 6.9, z: 2.65, floor: 1, face: 90, pose: 'sleep', y: -0.48, ax: 5.6, az: 2.4 },
  ],
  paradise: [
    { kind: 'sleep', x: 2.1, z: 0.52, floor: 1, face: 90, pose: 'sleep', y: -0.08, ax: 2.1, az: 1.25 },
    { kind: 'sleep', x: 0.52, z: 4.6, floor: 1, face: 0, pose: 'sleep', y: -0.08, ax: 1.25, az: 4.3 },
    { kind: 'sleep', x: 3.25, z: 5.48, floor: 1, face: 90, pose: 'sleep', y: -0.08, ax: 3.25, az: 4.75 },
    // 住进来的人：一个睡一楼沙发，一个在二楼书房打地铺
    { kind: 'sleep', x: 1.8, z: 5.15, floor: 0, face: 90, pose: 'sleep', y: -0.12, ax: 1.6, az: 4.25 },
    { kind: 'sleep', x: 6.9, z: 2.1, floor: 1, face: 90, pose: 'sleep', y: -0.48, ax: 5.6, az: 2.4 },
  ],
}

/** 菜地：院子东边一块 2.6 × 2 米的地（镜头从东南看过来，正好看得见），蹲在南边照料 */
export const GARDEN = { x0: 8.8, z0: 6.6, x1: 11.4, z1: 8.6 }
/** 屋子东边：压水井、鸡圈（以后院子变大再挪） */
export const WELL = { x: 10.9, z: 5.0 }
export const WELL_SPOT: Spot = { kind: 'stroll', x: 10.9, z: 5.75, floor: 0, face: 180, pose: 'work' }
export const COOP: Rect = { x0: 10.1, z0: 0.9, x1: 11.8, z1: 3.3 }
export const COOP_SPOT: Spot = { kind: 'stroll', x: 10.9, z: 3.85, floor: 0, face: 180, pose: 'work' }
export const GARDEN_SPOT: Spot = { kind: 'stroll', x: 10.1, z: 9.05, floor: 0, face: 180, pose: 'work' }
