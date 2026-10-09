// 临江市地图：派人出门。末日前花钱囤货，末日后去废墟搜刮（会遇到丧尸、会受伤）。
// 地点名字和图标用文字版的 content/locations.ts；结算先用这里的简化规则，以后接引擎的掉落表。
import { t, type UiKey } from '../i18n'
import type { Stock } from './life'

export interface TripStock extends Stock {
  molotovs: number
  money: number
  ammo: number
  medkits: number
  cores: number
}

export interface TripDef {
  id: string
  /** 来回要几个游戏小时 */
  hours: number
  cost: number
  phase: 'prologue' | 'apocalypse' | 'both'
  /** 遇到丧尸的概率（0~1） */
  danger: number
}

export const TRIPS: TripDef[] = [
  { id: 'office', hours: 8, cost: 0, phase: 'prologue', danger: 0 },
  { id: 'supermarket', hours: 3, cost: 1200, phase: 'prologue', danger: 0 },
  { id: 'pharmacy', hours: 2.5, cost: 900, phase: 'prologue', danger: 0 },
  { id: 'hardware', hours: 3.5, cost: 2500, phase: 'prologue', danger: 0 },
  { id: 'blackmarket', hours: 4, cost: 3000, phase: 'prologue', danger: 0 },
  // 军区门口：末日前去示警（见到顾沉），末日后是军区基地，用晶核换物资（结算在 Household 里）
  { id: 'armygate', hours: 3, cost: 0, phase: 'both', danger: 0 },
  { id: 'ruin_market', hours: 4, cost: 0, phase: 'apocalypse', danger: 0.4 },
  { id: 'hospital', hours: 4.5, cost: 0, phase: 'apocalypse', danger: 0.6 },
  { id: 'armory', hours: 5, cost: 0, phase: 'apocalypse', danger: 0.5 },
  { id: 'apartments', hours: 3.5, cost: 0, phase: 'apocalypse', danger: 0.45 },
  { id: 'river', hours: 3, cost: 0, phase: 'apocalypse', danger: 0.35 },
]

export interface TripResult {
  /** 加到存货上的东西（可以是负数） */
  gain: Partial<TripStock>
  /** 加固铁门（耐久上限） */
  gateBonus?: number
  /** 每个人掉多少健康 */
  hurt: number[]
  /** 日记 key + 变量 */
  key: string
  vars: Record<string, string | number>
}

const int = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1))

/** 结算一趟出门。people 是去的人数，fighters 表示带没带枪（女主带着霰弹枪） */
export function settleTrip(id: string, people: number, armed: boolean, r: () => number): TripResult {
  const hurt = Array.from({ length: people }, () => 0)
  const trip = TRIPS.find((x) => x.id === id)!
  const more = people >= 2 ? 1.5 : 1 // 两个人能多扛一点
  if (trip.phase === 'prologue') {
    switch (id) {
      case 'office': return { gain: { money: 3000 }, hurt, key: 'world.trip.office', vars: { money: 3000 } }
      case 'supermarket': {
        const f = Math.round(5 * more)
        return { gain: { money: -trip.cost, food: f, water: f }, hurt, key: 'world.trip.supermarket', vars: { food: f, water: f } }
      }
      case 'pharmacy': return { gain: { money: -trip.cost, medkits: 2 }, hurt, key: 'world.trip.pharmacy', vars: { n: 2 } }
      case 'hardware': return { gain: { money: -trip.cost, molotovs: 3 }, gateBonus: 60, hurt, key: 'world.trip.hardware', vars: { n: 60 } }
      case 'blackmarket': {
        if (r() < 0.15) return { gain: { money: -trip.cost }, hurt, key: 'world.trip.scammed', vars: { money: trip.cost } }
        return { gain: { money: -trip.cost, ammo: 12 }, hurt, key: 'world.trip.blackmarket', vars: { n: 12 } }
      }
    }
  }
  // 末日后：先看有没有撞上丧尸
  let fight = ''
  if (r() < trip.danger) {
    const bad = armed ? 0.35 : 0.7
    const who = int(r, 0, people - 1)
    hurt[who] = r() < bad ? int(r, 15, 35) : int(r, 0, 10)
    fight = hurt[who] >= 15 ? 'hurt' : 'fought'
  }
  const gain: Partial<TripStock> = {}
  if (id === 'ruin_market') { gain.food = Math.round(int(r, 2, 5) * more); gain.water = Math.round(int(r, 1, 3) * more) }
  if (id === 'hospital') gain.medkits = int(r, 1, 3)
  if (id === 'armory') { gain.ammo = Math.round(int(r, 6, 12) * more); gain.molotovs = 1 }
  if (id === 'apartments') { gain.food = int(r, 1, 3); gain.water = int(r, 1, 3) }
  if (id === 'river') gain.water = Math.round(int(r, 5, 8) * more)
  if (fight) gain.cores = 1
  const parts = (Object.entries(gain) as [keyof TripStock, number][]).filter(([, v]) => v > 0)
  return {
    gain, hurt,
    key: fight === 'hurt' ? 'world.trip.backHurt' : fight ? 'world.trip.backFought' : 'world.trip.back',
    vars: { what: parts.map(([k, v]) => t(`world.unit.${k}` as UiKey, { n: v })).join('、') || t('world.unit.nothing') },
  }
}

/** 现在能不能出这趟门：阶段对、钱够、回来时天还没黑 */
export function canGo(t: TripDef, prologue: boolean, money: number, hour: number): 'ok' | 'phase' | 'money' | 'late' {
  if (t.phase !== 'both' && (t.phase === 'prologue') !== prologue) return 'phase'
  if (money < t.cost) return 'money'
  if (hour < 6 || hour + t.hours > 19.5) return 'late'
  return 'ok'
}
