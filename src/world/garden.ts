// 菜园：院子里最多开四块菜地，每块种一样菜。种子在五金店、网上买（外婆家里本来就有几包）；
// 种下去要浇水（下雨也算），长熟了收——小白菜、小葱、番茄是菜，土豆、玉米是主食，艾草是草药。收的时候一半机会留一包种。
import type { Rect, Spot } from './layout'

export type CropId = 'bokchoy' | 'scallion' | 'tomato' | 'potato' | 'corn' | 'mugwort'
export interface CropDef {
  id: CropId
  name: string
  icon: string
  /** 天天浇水几天长熟（不浇水慢三倍多） */
  days: number
  /** 一包种子多少钱 */
  seedPrice: number
  /** 收一块地得到什么 */
  gives: { veg?: number; grain?: number; herbs?: number }
  /** 种子包上的一句话 */
  desc: string
}

export const CROPS: CropDef[] = [
  { id: 'bokchoy', name: '小白菜', icon: '🥬', days: 2, seedPrice: 20, gives: { veg: 3 }, desc: '长得快，两天一茬。' },
  { id: 'scallion', name: '小葱', icon: '🧅', days: 1.5, seedPrice: 15, gives: { veg: 2 }, desc: '最快，一天半就能掐。' },
  { id: 'tomato', name: '番茄', icon: '🍅', days: 3, seedPrice: 25, gives: { veg: 4 }, desc: '三天，结得多，红了才好吃。' },
  { id: 'potato', name: '土豆', icon: '🥔', days: 4, seedPrice: 30, gives: { grain: 5 }, desc: '慢，但能当主食，顶饿。' },
  { id: 'corn', name: '玉米', icon: '🌽', days: 4, seedPrice: 30, gives: { grain: 4 }, desc: '长得高高的，也是主食。' },
  { id: 'mugwort', name: '艾草', icon: '🌿', days: 3, seedPrice: 40, gives: { herbs: 2 }, desc: '草药，三份能做一个急救包。' },
]
export const cropOf = (id: string | null | undefined): CropDef | undefined => CROPS.find((c) => c.id === id)

/** 四块菜地的位置（第一块就是原来那块）：东边三块（井的南边、再往南、鸡圈和井中间），西边一块（樱花树和晾衣绳中间） */
export const PLOT_SLOTS: Rect[] = [
  { x0: 13.5, z0: 6.6, x1: 16.1, z1: 8.6 },
  { x0: 13.5, z0: 10.0, x1: 16.1, z1: 11.8 },
  { x0: 13.5, z0: -1.5, x1: 16.1, z1: 0.3 },
  { x0: -5.6, z0: 2.4, x1: -3.0, z1: 4.2 },
]
export const MAX_PLOTS = PLOT_SLOTS.length

/** 在哪块地边上干活：第二块在北边（跟第一块中间那条路上），其余在南边，面朝菜地 */
export function plotSpot(i: number): Spot {
  const r = PLOT_SLOTS[i]
  const x = (r.x0 + r.x1) / 2
  if (i === 1) return { kind: 'stroll', x, z: r.z0 - 0.45, floor: 0, face: 0, pose: 'work' }
  return { kind: 'stroll', x, z: r.z1 + 0.45, floor: 0, face: 180, pose: 'work' }
}

export interface Plot {
  built: boolean
  crop: CropId | null
  growth: number
  /** 哪天浇过水 */
  watered: number
  /** 上一茬种的什么（收了以后家里人接着种这个） */
  last: CropId | null
}
export const emptyPlot = (): Plot => ({ built: false, crop: null, growth: 0, watered: -1, last: null })

/** 一天长多少：浇过水 1/days，没浇 0.3/days */
export function growPerDay(c: CropDef, watered: boolean, farmer: boolean): number {
  return ((watered ? 1 : 0.3) / c.days) * (farmer ? 1.4 : 1)
}
