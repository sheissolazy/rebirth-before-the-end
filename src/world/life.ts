// 2.5D 版的"过日子"：时钟、需求、自主行动的决策（纯逻辑，不依赖 three.js，方便单测）。
// 一天 = 文字版的一周；序章 4 天；一个月 4 天，月底那一晚是危机夜。

export const DAY_SECONDS = 300 // 1 倍速下，游戏里一天 = 现实 5 分钟
export const PROLOGUE_DAYS = 4
export const DAYS_PER_MONTH = 4
export const SUNRISE = 6
export const SUNSET = 19

export interface Clock {
  /** 第几天（0 起），前 PROLOGUE_DAYS 天是末日前 */
  day: number
  /** 0~24 的小时数 */
  hour: number
}

export function advance(c: Clock, realSeconds: number, speed: number): Clock {
  let hour = c.hour + (realSeconds * speed * 24) / DAY_SECONDS
  let day = c.day
  while (hour >= 24) { hour -= 24; day += 1 }
  return { day, hour }
}

export function hhmm(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** 顶栏显示的日期，比如"末日前 3 天 · 08:30"或"末日第1年 1月 第2天 · 14:20" */
export function calendarLabel(c: Clock): string {
  if (c.day < PROLOGUE_DAYS) return `末日前 ${PROLOGUE_DAYS - c.day} 天 · ${hhmm(c.hour)}`
  const d = c.day - PROLOGUE_DAYS
  const month = Math.floor(d / DAYS_PER_MONTH)
  const year = Math.floor(month / 12) + 1
  return `末日第${year}年 ${(month % 12) + 1}月 第${(d % DAYS_PER_MONTH) + 1}天 · ${hhmm(c.hour)}`
}

export function isNight(hour: number): boolean {
  return hour < SUNRISE || hour >= SUNSET + 0.5
}

/** 月底那一晚（末日之后）是危机夜 */
export function isCrisisNight(c: Clock): boolean {
  return c.day >= PROLOGUE_DAYS && (c.day - PROLOGUE_DAYS) % DAYS_PER_MONTH === DAYS_PER_MONTH - 1 && c.hour >= SUNSET
}

// --- 需求 ------------------------------------------------------------------

export type NeedKey = 'hunger' | 'thirst' | 'energy' | 'mood'
/** 0~100，越高越好（饱、不渴、精神足、心情好） */
export type Needs = Record<NeedKey, number>

export type Activity = 'idle' | 'walk' | 'eat' | 'drink' | 'sleep' | 'relax' | 'stroll' | 'cook'

/** 每个游戏小时的变化 */
export const RATES = {
  hunger: -4.2,
  thirst: -5.5,
  energyAwake: -4.5,
  energySleep: 13,
  moodDrift: 6,
}

export const MEAL = { hunger: 32, food: 1 / 3 }
export const DRINK = { thirst: 45, water: 1 / 3 }

const clamp = (v: number) => Math.max(0, Math.min(100, v))

/** 心情会慢慢靠近一个目标值：需求越差目标越低，在放松就高一些 */
export function moodTarget(n: Needs, activity: Activity): number {
  let t = 62
  if (n.hunger < 30) t -= 22
  if (n.thirst < 30) t -= 22
  if (n.energy < 20) t -= 15
  if (activity === 'relax' || activity === 'stroll') t += 25
  if (activity === 'sleep') t += 5
  return clamp(t)
}

export function decayNeeds(n: Needs, hours: number, activity: Activity): Needs {
  const sleeping = activity === 'sleep'
  const target = moodTarget(n, activity)
  const drift = Math.sign(target - n.mood) * Math.min(Math.abs(target - n.mood), RATES.moodDrift * hours)
  return {
    hunger: clamp(n.hunger + RATES.hunger * hours * (sleeping ? 0.5 : 1)),
    thirst: clamp(n.thirst + RATES.thirst * hours * (sleeping ? 0.5 : 1)),
    energy: clamp(n.energy + (sleeping ? RATES.energySleep : RATES.energyAwake) * hours),
    mood: clamp(n.mood + drift),
  }
}

// --- 自主行动 ----------------------------------------------------------------

export interface Stock { food: number; water: number }

export type Want = 'sleep' | 'drink' | 'eat' | 'relax' | 'stroll' | 'idle'

/** 一家人习惯一起吃三顿：早 7 点、中午 12 点、晚 6 点 */
export function isMealTime(hour: number): boolean {
  return (hour >= 7 && hour < 8.5) || (hour >= 12 && hour < 13.5) || (hour >= 18 && hour < 19.5)
}

/** 一个人空闲时下一步想干什么（像模拟人生：最急的需求优先） */
export function chooseWant(n: Needs, c: Clock, stock: Stock, roll: number): Want {
  const late = c.hour >= 22 || c.hour < SUNRISE
  const water = stock.water >= DRINK.water
  const food = stock.food >= MEAL.food
  if (n.energy < 18 || (late && n.energy < 90)) {
    // 还撑得住的话，睡前先喝口水、垫点东西，不然半夜渴醒
    if (n.energy >= 10 && n.thirst < 60 && water) return 'drink'
    if (n.energy >= 10 && n.hunger < 45 && food) return 'eat'
    return 'sleep'
  }
  if (n.thirst < 40 && water) return 'drink'
  if (food && (n.hunger < 40 || (isMealTime(c.hour) && n.hunger < 85))) return 'eat'
  if (n.mood < 55) return roll < 0.5 ? 'relax' : 'stroll'
  if (roll < 0.25) return 'stroll'
  if (roll < 0.45) return 'relax'
  return 'idle'
}

/** 睡到什么时候醒：精神满了而且天亮了 */
export function shouldWake(n: Needs, c: Clock): boolean {
  return n.energy >= 97 && c.hour >= SUNRISE && c.hour < 21
}

/** 心情低到这个数会抑郁（以后：离家出走、可能死亡、小概率奇遇） */
export const DEPRESSED = 18
