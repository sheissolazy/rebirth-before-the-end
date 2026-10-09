// 街上能搜的地方（末日之后）：盖着车罩的车、接雨水的桶、邻居家。女主走近了就能搜一搜，
// 搜的时候站着不动，可能翻到吃的、水、子弹、急救包，也可能从后面蹦出丧尸。
import type { Pt } from './nav'

export interface ScavengeSpot {
  id: string
  kind: 'car' | 'barrel' | 'house'
  /** 女主站在这里搜 */
  at: Pt
  /** 搜一次要几个游戏小时 */
  hours: number
  /** 末日后蹦出丧尸的概率（夜里翻倍） */
  danger: number
}

export const SCAVENGE: ScavengeSpot[] = [
  { id: 'car_w', kind: 'car', at: { x: -8, z: 15.7 }, hours: 0.4, danger: 0.25 },
  { id: 'car_e', kind: 'car', at: { x: 13, z: 17.4 }, hours: 0.4, danger: 0.25 },
  { id: 'barrels', kind: 'barrel', at: { x: 7.5, z: 15.0 }, hours: 0.25, danger: 0.15 },
  { id: 'house_w', kind: 'house', at: { x: -14, z: 22.5 }, hours: 0.7, danger: 0.4 },
  { id: 'house_m', kind: 'house', at: { x: 0, z: 22.5 }, hours: 0.7, danger: 0.4 },
  { id: 'house_e', kind: 'house', at: { x: 16, z: 22.5 }, hours: 0.7, danger: 0.4 },
  { id: 'house_side', kind: 'house', at: { x: 20, z: 5 }, hours: 0.7, danger: 0.4 },
]

/** 搜过一次，要过几天才会有新东西 */
export const SCAVENGE_COOLDOWN_DAYS = 3

export interface ScavengeLoot { food: number; water: number; ammo: number; medkits: number }

const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1))

export function rollLoot(kind: ScavengeSpot['kind'], r: () => number): ScavengeLoot {
  if (kind === 'barrel') return { food: 0, water: int(r, 2, 3), ammo: 0, medkits: 0 }
  if (kind === 'car') return { food: int(r, 0, 1), water: int(r, 1, 2), ammo: int(r, 0, 3), medkits: 0 }
  return { food: int(r, 1, 3), water: int(r, 0, 1), ammo: 0, medkits: r() < 0.25 ? 1 : 0 }
}

/** 离女主最近、能搜的地方（1.6 米以内） */
export function nearestSpot(p: Pt): ScavengeSpot | null {
  let best: ScavengeSpot | null = null
  let bd = 1.6
  for (const s of SCAVENGE) {
    const d = Math.hypot(s.at.x - p.x, s.at.z - p.z)
    if (d < bd) { bd = d; best = s }
  }
  return best
}

/** 屋后江边的钓鱼点（从铁门出去绕过院子西边的围栏就到） */
export const FISHING = { at: { x: 4, z: -11.6 } as Pt, face: 180 }

export function nearFishing(p: Pt): boolean {
  return Math.hypot(p.x - FISHING.at.x, p.z - FISHING.at.z) < 2.2
}
