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

/** 每个游戏小时的变化。2026-10-09 老板："食水掉太快，每天光喝水了，什么都干不了"——饿和渴都放慢到一半左右 */
export const RATES = {
  hunger: -3.0,
  thirst: -2.9,
  energyAwake: -4.5,
  energySleep: 13,
  /** 心情往上靠的速度（歇着、干完活有成就感） */
  moodUp: 3.5,
  /** 正常过日子心情往下掉得很慢 */
  moodDown: 0.8,
  /** 饿着、渴着、累垮了、受了重伤：心情掉得快 */
  moodCrash: 6,
}

/** 一顿饭、一次喝水：吃一顿顶得久了，一顿用的粮食也多一点（不然囤的东西吃不完） */
export const MEAL = { hunger: 28, food: 0.38 }
export const DRINK = { thirst: 45, water: 0.45 }

const clamp = (v: number) => Math.max(0, Math.min(100, v))

/** 心情会慢慢靠近一个目标值：需求越差目标越低，在放松就高一些；受了重伤更低 */
export function moodTarget(n: Needs, activity: Activity, injured = false): number {
  let t = 60
  if (n.hunger < 30) t -= 22
  if (n.thirst < 30) t -= 22
  if (n.energy < 20) t -= 15
  if (injured) t -= 25
  if (activity === 'relax' || activity === 'stroll') t += 25
  if (activity === 'sleep') t += 5
  return clamp(t)
}

/** 现在是不是在"受罪"（饿、渴、累垮、重伤）：这时心情才掉得快 */
function suffering(n: Needs, injured: boolean): boolean {
  return n.hunger < 30 || n.thirst < 30 || n.energy < 20 || injured
}

export function decayNeeds(n: Needs, hours: number, activity: Activity, injured = false): Needs {
  const sleeping = activity === 'sleep'
  const target = moodTarget(n, activity, injured)
  // 往上靠得慢慢的；正常日子往下掉得更慢；只有受罪的时候才掉得快
  const rate = target > n.mood ? RATES.moodUp : suffering(n, injured) ? RATES.moodCrash : RATES.moodDown
  const drift = Math.sign(target - n.mood) * Math.min(Math.abs(target - n.mood), rate * hours)
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
  // 饭点刚过、又没赶上那顿的人：补吃一口，别饿着肚子干活
  if (food && n.hunger < 65 && isMealTime(c.hour - 1)) return 'eat'
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
