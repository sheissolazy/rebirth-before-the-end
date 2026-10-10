// 气温和极端天气（第一版，数值是我先定的，等老板拍板）：
// 跟前世记忆走——第 7 个月高温（白天 42 度）、第 11 个月降温（夜里零下十几度）、第 12 个月极寒（夜里零下 25 度）；平常按月份慢慢变。
// 屋里比外面温和一点；空调（要有电）把屋里压到 26 度；火炉烧着把屋里撑到 16 度以上。
import { DAYS_PER_MONTH, PROLOGUE_DAYS } from './life'

/** 末日后第几个月（0 起）；末日前算 -1 */
export function monthOf(day: number): number {
  return day < PROLOGUE_DAYS ? -1 : Math.floor((day - PROLOGUE_DAYS) / DAYS_PER_MONTH)
}

export type Extreme = 'heat' | 'cold' | 'frost' | null
/** 这个月有没有极端天气：第 7 个月高温、第 11 个月降温、第 12 个月极寒（一年一轮） */
export function extremeOf(day: number): Extreme {
  const m = monthOf(day)
  if (m < 0) return null
  const k = m % 12
  return k === 6 ? 'heat' : k === 10 ? 'cold' : k === 11 ? 'frost' : null
}

/** 每个月白天最高、夜里最低（度）；末日前是秋天 */
const MONTHS: [number, number][] = [
  [22, 13], [24, 15], [27, 18], [30, 21], [32, 24], [34, 26], [42, 32], [30, 22], [24, 15], [16, 7], [-2, -14], [-10, -25],
]

/** 外面现在几度：早上 6 点最冷，下午 2 点最热 */
export function outdoorTemp(day: number, hour: number): number {
  const m = monthOf(day)
  const [hi, lo] = m < 0 ? [23, 14] : MONTHS[m % 12]
  const k = hour >= 6 && hour <= 22 ? Math.max(0, Math.sin((Math.PI * (hour - 6)) / 16)) : 0
  return lo + (hi - lo) * k
}

/** 屋里几度：墙挡着温和一点；空调开着压到 26，火炉烧着撑到 16 */
export function indoorTemp(out: number, ac: boolean, stove: boolean): number {
  let t = out > 24 ? out - 4 : out < 12 ? out + 6 : out
  if (ac && t > 26) t = 26
  if (stove && t < 16) t = 16
  return t
}

/** 冷热对人的影响（每游戏小时）：渴得快、累得快、心情差；太热中暑、太冷冻伤（掉健康） */
export function tempEffect(t: number): { thirst: number; energy: number; mood: number; health: number } {
  if (t >= 35) return { thirst: t >= 40 ? 4 : 2.5, energy: 2, mood: 2, health: t >= 40 ? 2 : 0 }
  if (t <= 5) return { thirst: 0, energy: t <= -5 ? 2.5 : 1.5, mood: t <= -5 ? 2 : 1, health: t <= -15 ? 4 : t <= -5 ? 3 : 0 }
  return { thirst: 0, energy: 0, mood: 0, health: 0 }
}

/** 火炉烧一根竹竿顶几个小时；没有竹竿就烧汽油（每小时几桶） */
export const BAMBOO_HOURS = 6
export const STOVE_FUEL = 0.04
/** 空调开着（末日后靠发电机）每小时烧几桶油 */
export const AC_FUEL = 0.04
