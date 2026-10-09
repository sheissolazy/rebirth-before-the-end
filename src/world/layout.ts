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
/** 外婆家的两层自建房：12 × 9 米，北边（z=-3）靠江、南边朝院门；平顶 */
export const HOUSE: Rect = { x0: 0, z0: -3, x1: 12, z1: 6 }
/** 一楼檐廊 / 二楼阳台：房子南边 2 米深 */
export const PORCH: Rect = { x0: 0, z0: 6, x1: 12, z1: 8 }
export const YARD: Rect = { x0: -6, z0: -7, x1: 18, z1: 13 }
export const GATE = { x: 4, z: 13 }
export const STREET: Rect = { x0: -24, z0: 15, x1: 32, z1: 21 }
export const WORLD: Rect = { x0: -24, z0: -12, x1: 32, z1: 30 }
/** 街边路灯（人行道上，铁门这一侧） */
export const STREET_LAMPS = [-18, -6, 6, 18, 30].map((x) => ({ x, z: STREET.z0 - 0.7 }))
export const HOUSE_CENTER = { x: 6, z: 1.5 }
/** 门前的水泥院坝（晒谷子、停车，夜里打丧尸的主战场） */
export const COURT: Rect = { x0: -2.2, z0: 8, x1: 10, z1: 12.8 }
/** 储藏室里码东西的地方（囤得越多堆得越满） */
export const STORE_ROOM: Rect = { x0: 8.5, z0: -2.6, x1: 11.7, z1: 5.7 }
/** 堂屋的双开大门（门洞中心） */
export const FRONT_DOOR = { x: 6, z: 6 }

/** 家里那辆旧面包车停在院坝西边（车头朝东、朝着铁门那边），rot 是 rotation.y */
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

// 房间（见 docs 平面图）：
// 一楼  西：厨房（北，z -3..1.5，后门通江边）/ 爸妈卧室（南）；中：楼梯间（北，z -3..-0.5）/ 堂屋（南，双开大门）；东：储藏室
// 二楼  西：客房二（北）/ 林知夏的房间（南）；中：楼梯口（北，z -3..0.5）/ 小客厅（南，门通阳台）；东：客房一
export const WALLS: WallSeg[] = [
  // 一楼外墙
  ...run(0, 'x', -3, 0, 12, false, { 1: 'door', 3: 'window', 6: 'window', 10: 'window' }),
  ...run(0, 'z', 0, -3, 6, false, { [-2]: 'window', 3: 'window' }),
  ...run(0, 'x', 6, 0, 12, true, { 1: 'window', 2: 'window', 5: 'door', 6: 'door', 9: 'window', 10: 'window' }),
  ...run(0, 'z', 12, -3, 6, true, { [-2]: 'window', 2: 'window' }),
  // 一楼隔墙
  ...run(0, 'z', 4, -3, 6, true, { 0: 'door', 3: 'door' }), // 厨房、爸妈卧室 ↔ 堂屋
  ...run(0, 'x', 1.5, 0, 4, true), // 厨房 ↔ 爸妈卧室
  ...run(0, 'x', -0.5, 4, 8, true, { 4: 'door' }), // 楼梯间 ↔ 堂屋（西头一米是楼梯口）
  ...run(0, 'z', 8, -3, 6, true, { 2: 'door' }), // 堂屋 ↔ 储藏室
  // 二楼外墙
  ...run(1, 'x', -3, 0, 12, false, { 1: 'window', 6: 'window', 10: 'window' }),
  ...run(1, 'z', 0, -3, 6, false, { [-2]: 'window', 3: 'window' }),
  ...run(1, 'x', 6, 0, 12, true, { 1: 'window', 2: 'window', 5: 'door', 6: 'door', 9: 'window', 10: 'window' }),
  ...run(1, 'z', 12, -3, 6, true, { [-2]: 'window', 2: 'window' }),
  // 二楼隔墙
  ...run(1, 'z', 4, -3, 6, true, { [-2]: 'door', 3: 'door' }), // 客房二（从楼梯口进）、林知夏的房间（从小客厅进）
  ...run(1, 'x', 1.5, 0, 4, true), // 客房二 ↔ 林知夏的房间
  ...run(1, 'x', 0.5, 4, 8, true, { 4: 'door', 7: 'door' }), // 楼梯口 ↔ 小客厅
  ...run(1, 'z', 8, -3, 6, true, { 2: 'door' }), // 小客厅 ↔ 客房一
]

export const FURNITURE: Placement[] = [
  // 堂屋：八仙桌四把椅子、墙上的地图
  { piece: 'table', x: 6, z: 2.6, rot: 0, floor: 0, block: [0.65, 0.4] },
  { piece: 'chair', x: 6, z: 1.95, rot: 180, floor: 0 },
  { piece: 'chair', x: 6, z: 3.25, rot: 0, floor: 0 },
  { piece: 'chair', x: 5.12, z: 2.6, rot: -90, floor: 0 },
  { piece: 'chair', x: 6.88, z: 2.6, rot: 90, floor: 0 },
  { piece: 'wall_map', x: 4.12, z: 4.6, rot: 90, floor: 0 },
  // 储藏室：囤的东西一箱一箱码着
  { piece: 'crate', x: 11.4, z: 5.4, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 10.7, z: 5.4, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 11.4, z: 4.7, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 11.4, z: 1.2, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'crate', x: 11.4, z: 0.5, rot: 0, floor: 0, block: [0.35, 0.35] },
  { piece: 'shelf', x: 11.6, z: -1.6, rot: -90, floor: 0 },
  // 厨房：灶台靠北墙、碗柜（冰箱）靠楼梯间那面墙
  { piece: 'counter', x: 2.0, z: -2.55, rot: 0, floor: 0, block: [1.5, 0.35] },
  { piece: 'fridge', x: 3.6, z: -1.3, rot: -90, floor: 0, block: [0.4, 0.4] },
  // 楼梯：楼梯间里西头上、东头到二楼
  { piece: 'stairs', x: 6.5, z: -1.75, rot: 0, floor: 0, block: [1.4, 0.6] },
  // 一楼爸妈卧室两张床
  { piece: 'bed', x: 0.9, z: 3.0, rot: 180, floor: 0, block: [0.5, 1.0] },
  { piece: 'bed', x: 2.3, z: 3.0, rot: 180, floor: 0, block: [0.5, 1.0] },
  // 二楼：林知夏的房间（床、书桌，重生日记在桌上）、客房二、客房一（两张床）
  { piece: 'bed', x: 0.9, z: 3.0, rot: 180, floor: 1, block: [0.5, 1.0] },
  { piece: 'desk', x: 2.8, z: 5.55, rot: 180, floor: 1 },
  { piece: 'chair', x: 2.8, z: 4.95, rot: 180, floor: 1 },
  { piece: 'bed', x: 0.9, z: -1.5, rot: 180, floor: 1, block: [0.5, 1.0] },
  { piece: 'bed', x: 11.1, z: -1.5, rot: 180, floor: 1, block: [0.5, 1.0] },
  { piece: 'bed', x: 11.1, z: 2.5, rot: 180, floor: 1, block: [0.5, 1.0] },
  // 二楼小客厅：沙发靠着楼梯口那面墙、书架
  { piece: 'sofa', x: 6.0, z: 1.15, rot: 180, floor: 1, block: [0.9, 0.45] },
  { piece: 'shelf', x: 7.6, z: 3.6, rot: -90, floor: 1 },
]

/** 世外桃源画风里额外摆的 Poly Haven 模型（卡通画风里没有） */
export const PARADISE_EXTRAS: Placement[] = [
  // 堂屋：神龛（中式柜子）靠北墙、角落一盆绿植、八仙桌上的吊灯、门边的摇椅
  { piece: 'chinese_cabinet', x: 6.4, z: -0.05, rot: 0, floor: 0, block: [0.65, 0.32], scale: 0.85 },
  { piece: 'potted_plant_01', x: 7.55, z: 0.1, rot: 0, floor: 0, block: [0.3, 0.3] },
  { piece: 'chinese_chandelier', x: 6, z: 2.6, rot: 0, floor: 0, y: 1.7, scale: 0.8 },
  { piece: 'Rockingchair_01', x: 4.75, z: 5.0, rot: 135, floor: 0, block: [0.4, 0.45] },
  // 爸妈卧室：床边的小桌
  { piece: 'WoodenTable_01', x: 3.55, z: 5.3, rot: 90, floor: 0, block: [0.63, 0.23], scale: 0.7 },
  // 一楼爸妈的两张床
  { piece: 'vintage_day_bed', x: 0.9, z: 3.0, rot: 90, floor: 0, block: [1.0, 0.45] },
  { piece: 'vintage_day_bed', x: 2.3, z: 3.0, rot: 90, floor: 0, block: [1.0, 0.45] },
  // 二楼：林知夏的床和床头柜、客房二、客房一
  { piece: 'vintage_day_bed', x: 0.9, z: 3.0, rot: 90, floor: 1, block: [1.0, 0.45] },
  { piece: 'ClassicNightstand_01', x: 1.95, z: 2.25, rot: 0, floor: 1, block: [0.3, 0.22] },
  { piece: 'wooden_lantern_01', x: 1.95, z: 2.25, rot: 0, floor: 1, y: 0.7 },
  { piece: 'vintage_day_bed', x: 0.9, z: -1.5, rot: 90, floor: 1, block: [1.0, 0.45] },
  { piece: 'vintage_day_bed', x: 11.1, z: -1.5, rot: 90, floor: 1, block: [1.0, 0.45] },
  { piece: 'vintage_day_bed', x: 11.1, z: 2.5, rot: 90, floor: 1, block: [1.0, 0.45] },
  // 院子里：檐廊上的酒桶、井边的木桶、院坝东边的长椅和石头
  { piece: 'wine_barrel_01', x: 11.45, z: 7.35, rot: 0, floor: 0, block: [0.4, 0.4] },
  { piece: 'wooden_bucket_01', x: 14.9, z: 3.35, rot: 0, floor: 0, block: [0.2, 0.2] },
  { piece: 'painted_wooden_bench', x: 10.6, z: 9.6, rot: -90, floor: 0, block: [0.6, 0.3] },
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
  { kind: 'tree', x: -4.5, z: -5.5, w: 0.6, d: 0.6, rot: 0 },
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
/** 楼梯：楼梯间里一楼从西头（x≈5）往东爬，到二楼东头再往南迈一步上楼梯口 */
export const STAIR_PATH: StairPoint[] = [
  { x: 4.75, z: -1.75, y: 0, floor: 0 },
  { x: 5.15, z: -1.75, y: 0, floor: 0 },
  { x: 7.6, z: -1.75, y: FLOOR_H, floor: 1 },
  { x: 7.25, z: -0.75, y: FLOOR_H, floor: 1 },
]
/** 二楼楼板上楼梯那一块是空的（不能走、也不铺地板） */
export const STAIR_HOLE: Rect = { x0: 5, z0: -2.25, x1: 8, z1: -1.25 }

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
  // 厨房：灶台两个位置、碗柜边上拿水
  { kind: 'cook', x: 2.4, z: -1.85, floor: 0, face: 180, pose: 'work' },
  { kind: 'cook', x: 1.5, z: -1.85, floor: 0, face: 180, pose: 'work' },
  { kind: 'drink', x: 2.75, z: -1.3, floor: 0, face: 90, pose: 'work' },
  // 八仙桌四把椅子
  { kind: 'dine', x: 6, z: 1.9, floor: 0, face: 0, pose: 'sit' },
  { kind: 'dine', x: 6, z: 3.3, floor: 0, face: 180, pose: 'sit' },
  { kind: 'dine', x: 5.12, z: 2.6, floor: 0, face: 90, pose: 'sit', ax: 4.75, az: 2.8 },
  { kind: 'dine', x: 6.88, z: 2.6, floor: 0, face: -90, pose: 'sit', ax: 7.25, az: 2.8 },
  // 二楼小客厅的沙发两个座位
  { kind: 'relax', x: 5.62, z: 1.2, floor: 1, face: 0, pose: 'sit', ax: 5.62, az: 2.1 },
  { kind: 'relax', x: 6.38, z: 1.2, floor: 1, face: 0, pose: 'sit', ax: 6.38, az: 2.1 },
  // 院子里溜达
  { kind: 'stroll', x: 1.5, z: 9.5, floor: 0, face: 160, pose: 'idle' },
  { kind: 'stroll', x: 14.5, z: 0.5, floor: 0, face: 90, pose: 'idle' },
  { kind: 'stroll', x: -3.5, z: 1.0, floor: 0, face: -90, pose: 'idle' },
  { kind: 'stroll', x: 14.0, z: 10.5, floor: 0, face: 45, pose: 'idle' },
  { kind: 'stroll', x: 8.5, z: 10.5, floor: 0, face: 0, pose: 'idle' },
  { kind: 'stroll', x: 4.0, z: -4.8, floor: 0, face: 180, pose: 'idle' },
  // 檐廊下站一站、二楼阳台上看看院子
  { kind: 'stroll', x: 3.0, z: 7.0, floor: 0, face: 0, pose: 'idle' },
  { kind: 'stroll', x: 9.5, z: 7.0, floor: 1, face: 0, pose: 'idle' },
]

/** 世外桃源画风多出来能坐的地方：堂屋的摇椅、院坝的长椅 */
export const PARADISE_SPOTS: Spot[] = [
  { kind: 'relax', x: 4.75, z: 5.0, floor: 0, face: 135, pose: 'sit', y: 0.04, ax: 5.4, az: 4.4 },
  { kind: 'relax', x: 10.62, z: 9.6, floor: 0, face: -90, pose: 'sit', ax: 9.85, az: 9.6 },
]

/** 每人一个睡觉的地方，按人的顺序分（女主、妈妈、爸爸、住进来的两个人）。x/z 是脚的位置，躺下后头朝 face 的反方向 */
const bed = (x: number, z: number, floor: Floor, y = 0): Spot => ({ kind: 'sleep', x, z: z + 0.9, floor, face: 0, pose: 'sleep', y, ax: x, az: z + 1.55 })
export const BEDS: Record<'toon' | 'paradise', Spot[]> = {
  // 女主二楼自己的房间；爸妈一楼；住进来的两个人：二楼客房一、客房二
  toon: [bed(0.9, 3.0, 1), bed(0.9, 3.0, 0), bed(2.3, 3.0, 0), bed(11.1, 2.5, 1), bed(0.9, -1.5, 1)],
  paradise: [bed(0.9, 3.0, 1, -0.08), bed(0.9, 3.0, 0, -0.08), bed(2.3, 3.0, 0, -0.08), bed(11.1, 2.5, 1, -0.08), bed(0.9, -1.5, 1, -0.08)],
}

/** 菜地：院子东边一块 2.6 × 2 米的地（镜头从东南看过来，正好看得见），蹲在南边照料 */
export const GARDEN = { x0: 13.5, z0: 6.6, x1: 16.1, z1: 8.6 }
/** 院子东边：压水井、鸡圈 */
export const WELL = { x: 15.6, z: 3.0 }
export const WELL_SPOT: Spot = { kind: 'stroll', x: 15.6, z: 3.75, floor: 0, face: 180, pose: 'work' }
export const COOP: Rect = { x0: 14.3, z0: -5.6, x1: 16.6, z1: -3.2 }
export const COOP_SPOT: Spot = { kind: 'stroll', x: 15.4, z: -2.65, floor: 0, face: 180, pose: 'work' }
export const GARDEN_SPOT: Spot = { kind: 'stroll', x: 14.8, z: 9.05, floor: 0, face: 180, pose: 'work' }
