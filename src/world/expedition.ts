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
  /** 汽油（桶）：开面包车出门一趟烧一桶 */
  fuel: number
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
  // 加油站：末日前花钱囤油，末日后去抢剩下的（钱没用了，所以不要钱）
  { id: 'gasstation', hours: 2, cost: 600, phase: 'both', danger: 0.5 },
  { id: 'ruin_market', hours: 4, cost: 0, phase: 'apocalypse', danger: 0.4 },
  { id: 'hospital', hours: 4.5, cost: 0, phase: 'apocalypse', danger: 0.6 },
  { id: 'armory', hours: 5, cost: 0, phase: 'apocalypse', danger: 0.5 },
  { id: 'apartments', hours: 3.5, cost: 0, phase: 'apocalypse', danger: 0.45 },
  { id: 'river', hours: 3, cost: 0, phase: 'apocalypse', danger: 0.35 },
  { id: 'factory', hours: 4, cost: 0, phase: 'apocalypse', danger: 0.4 },
]

/** 开面包车：快四成（按半小时取整）、多装一半、烧一桶油；末日后动静大，更容易撞上丧尸，但撞上了跑得掉 */
export const VAN = { time: 0.6, load: 1.5, danger: 1.3, hurt: 0.5 }
/** 去上班不用开车 */
export const vanAllowed = (id: string) => id !== 'office'

export function tripHours(t: TripDef, van: boolean): number {
  return van && vanAllowed(t.id) ? Math.max(1, Math.ceil(t.hours * VAN.time * 2) / 2) : t.hours
}

/** 末日后钱就没用了：两边都能去的地方（加油站）末日后不要钱 */
export function tripCost(t: TripDef, prologue: boolean): number {
  return t.phase === 'both' && !prologue ? 0 : t.cost
}

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

/** 结算一趟出门。people 是去的人数，armed 表示带没带枪（女主带着霰弹枪），van 是开没开面包车 */
export function settleTrip(id: string, people: number, armed: boolean, r: () => number, van = false, prologue = TRIPS.find((x) => x.id === id)!.phase === 'prologue'): TripResult {
  const hurt = Array.from({ length: people }, () => 0)
  const trip = TRIPS.find((x) => x.id === id)!
  const car = van && vanAllowed(id) ? VAN.load : 1
  const more = (people >= 2 ? 1.5 : 1) * car // 两个人能多扛一点，开车能多装一半
  if (prologue) {
    switch (id) {
      case 'office': return { gain: { money: 3000 }, hurt, key: 'world.trip.office', vars: { money: 3000 } }
      case 'supermarket': {
        const f = Math.round(5 * more)
        return { gain: { food: f, water: f }, hurt, key: 'world.trip.supermarket', vars: { food: f, water: f } }
      }
      // 钱在出发时已经付过了（Household.startTrip），这里只结算带回来的东西
      case 'pharmacy': {
        const n = Math.round(2 * car)
        return { gain: { medkits: n }, hurt, key: 'world.trip.pharmacy', vars: { n } }
      }
      case 'hardware': {
        const n = Math.round(60 * car)
        return { gain: { molotovs: Math.round(3 * car) }, gateBonus: n, hurt, key: 'world.trip.hardware', vars: { n } }
      }
      // 一个人拎两桶，开车去能装一后备厢
      case 'gasstation': {
        const n = van ? 6 : Math.min(4, people * 2)
        return { gain: { fuel: n }, hurt, key: 'world.trip.gasBuy', vars: { n } }
      }
      case 'blackmarket': {
        if (r() < 0.15) return { gain: {}, hurt, key: 'world.trip.scammed', vars: { money: trip.cost } }
        return { gain: { ammo: 12 }, hurt, key: 'world.trip.blackmarket', vars: { n: 12 } }
      }
    }
  }
  // 末日后：先看有没有撞上丧尸
  let fight = ''
  if (r() < Math.min(0.9, trip.danger * (van ? VAN.danger : 1))) {
    const bad = (armed ? 0.35 : 0.7) * (van ? VAN.hurt : 1)
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
  if (id === 'gasstation') gain.fuel = Math.round(int(r, 1, 3) * more)
  // 工厂：柴油，还有钢板能焊在铁门上
  if (id === 'factory') gain.fuel = int(r, 1, 2)
  // 居民楼楼下停着的车里能抽点油（得有人记得带管子）
  if (id === 'apartments' && r() < 0.4) gain.fuel = 1
  if (fight) gain.cores = 1
  const parts = (Object.entries(gain) as [keyof TripStock, number][]).filter(([, v]) => v > 0)
  return {
    gain, hurt,
    ...(id === 'factory' ? { gateBonus: 30 } : {}),
    key: fight === 'hurt' ? 'world.trip.backHurt' : fight ? 'world.trip.backFought' : 'world.trip.back',
    vars: { what: parts.map(([k, v]) => t(`world.unit.${k}` as UiKey, { n: v })).join('、') || t('world.unit.nothing') },
  }
}

/** 现在能不能出这趟门：阶段对、钱够、回来时天还没黑 */
export function canGo(t: TripDef, prologue: boolean, money: number, hour: number, van = false): 'ok' | 'phase' | 'money' | 'late' {
  if (t.phase !== 'both' && (t.phase === 'prologue') !== prologue) return 'phase'
  if (money < tripCost(t, prologue)) return 'money'
  // 开车回来还要倒车进院子、卸货，多留半小时
  if (hour < 6 || hour + tripHours(t, van) + (van ? 0.5 : 0) > 19.5) return 'late'
  return 'ok'
}
