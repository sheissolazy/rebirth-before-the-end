// 末日前搞钱（照 DESIGN.md 4.1）：
// - 炒股：前世记得三只股票，一只比一只模糊。一天一个价（9:30～15:00 能买卖，一手 100 股）；末日一到股市就没了，没卖掉的股票变成一串数字。
// - 彩票：记得那一期大乐透的号码，就是后区第二个号记不清是 9 还是 8。末日前 3 天晚上开奖，第二天能兑奖；中了奖亲戚会上门借钱。
// 游戏里的钱数按原型的物价缩过（一袋米 150、发电机 3200）。
import { PROLOGUE_DAYS } from './life'

export interface StockDef {
  id: string
  name: string
  code: string
  /** 女主前世的记忆（股票页上显示） */
  memory: string
  clarity: 'clear' | 'half' | 'vague'
  /** 末日前第 0～3 天每天的价（元/股） */
  prices: number[]
  /** 记得模糊的那只：另一种走法（这一世是哪种开局时定好） */
  alt?: number[]
}

export const STOCKS: StockDef[] = [
  {
    id: 'huakang', name: '华康医药', code: '600317', clarity: 'clear',
    memory: '记得很清楚：末日前那几天医药股天天涨停，一天涨一成。',
    prices: [12.0, 13.2, 14.52, 15.97],
  },
  {
    id: 'xindun', name: '鑫盾安防', code: '002415', clarity: 'half',
    memory: '有点印象：安防股涨过一波，最后一天好像又跌回去了。',
    prices: [20.0, 22.0, 24.2, 19.36],
  },
  {
    id: 'jingu', name: '金谷粮油', code: '600873', clarity: 'vague',
    memory: '记不太清了：粮油股……是涨了吧？还是跌了？',
    prices: [8.0, 8.8, 9.68, 10.65],
    alt: [8.0, 7.6, 6.84, 6.16],
  },
]
/** 一手多少股 */
export const LOT = 100

/** 这只股票今天什么价（末日以后没有价了） */
export function stockPrice(id: string, day: number, fate: boolean): number {
  const s = STOCKS.find((x) => x.id === id)
  if (!s) return 0
  const path = s.alt && !fate ? s.alt : s.prices
  return path[Math.max(0, Math.min(path.length - 1, day))]
}

/** 股市开没开：末日前每天 9:30～15:00 开；末日以后没了 */
export function marketState(day: number, hour: number): 'open' | 'closed' | 'gone' {
  if (day >= PROLOGUE_DAYS) return 'gone'
  return hour >= 9.5 && hour < 15 ? 'open' : 'closed'
}

export const LOTTERY = {
  /** 第几期（显示用） */
  issue: '25118',
  /** 哪天几点开奖（末日前 3 天晚上 9 点半） */
  drawDay: 1,
  drawHour: 21.5,
  front: [3, 11, 17, 25, 31],
  back: 6,
  /** 后区第二个号：其实是 9，女主记成了 9 或者 8 */
  back2: 9,
  back2Maybe: [9, 8],
  /** 一注两块；彩票站最多让打 3 倍（再多太扎眼） */
  price: 2,
  maxMult: 3,
  /** 一等奖、二等奖（税后，一倍） */
  first: 120000,
  second: 30000,
} as const

export const pad2 = (n: number) => String(n).padStart(2, '0')
