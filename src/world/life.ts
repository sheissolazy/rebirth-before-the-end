// 2.5D 版的"过日子"：时钟、需求、自主行动的决策（纯逻辑，不依赖 three.js，方便单测）。
// 一天 = 文字版的一周；序章 4 天；一个月 4 天，月底那一晚是危机夜。

export const DAY_SECONDS = 1440 // 1 倍速下现实 1 秒 = 游戏 1 分钟，一天 = 现实 24 分钟
/** 说话气泡、挥手、站一下这类小动作原来按"一天 = 现实 5 分钟"调的：倒计时乘它，现实里还是那么长 */
export const BEAT = DAY_SECONDS / 300
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

/** 每个游戏小时的变化。2026-10-09 老板："食水掉太快，每天光喝水了"、"每天只吃喝一次就好了"——一天吃一顿、喝一次 */
export const RATES = {
  hunger: -3.5,
  thirst: -3.0,
  energyAwake: -4.5,
  energySleep: 13,
  /** 心情往上靠的速度（歇着、干完活有成就感） */
  moodUp: 3.5,
  /** 正常过日子心情往下掉得很慢 */
  moodDown: 0.8,
  /** 饿着、渴着、累垮了、受了重伤：心情掉得快 */
  moodCrash: 6,
}

/** 一顿饭（最普通的白米饭）、一次喝水：一天一顿、一次就够 */
export const MEAL = { hunger: 75, food: 1 }
export const DRINK = { thirst: 72, water: 0.6 }

/** 冰柜里的食材：主食（米面、饼干）、肉（罐头、鱼）、菜（院子里种的、野菜）、蛋（鸡下的） */
export type Ing = 'grain' | 'meat' | 'veg' | 'egg'
export const INGS: Ing[] = ['grain', 'meat', 'veg', 'egg']
export const ING_INFO: Record<Ing, { icon: string; name: string }> = {
  grain: { icon: '🌾', name: '主食' },
  meat: { icon: '🥩', name: '肉' },
  veg: { icon: '🥬', name: '菜' },
  egg: { icon: '🥚', name: '蛋' },
}

/** 做饭：一锅做全家的份，做好了放进冰柜，谁饿了谁去拿一份。不同的菜用不同的食材、加不同的状态 */
export interface Dish {
  id: string
  icon: string
  /** 一人份用多少食材（份） */
  use: Partial<Record<Ing, number>>
  /** 大杂烩：一人份用几份"随便什么食材"（按家里各样的比例扣） */
  any?: number
  /** 一人份用多少水 */
  water: number
  /** 一锅用几份草药（不管几人份） */
  herbs: number
  /** 做一锅多久（游戏小时，三个人的量；人多一点稍微久一点） */
  hours: number
  hunger: number
  mood: number
  energy: number
  health: number
}
export const DISHES: Dish[] = [
  { id: 'rice', icon: '🍚', use: { grain: 1 }, water: 0, herbs: 0, hours: 0.5, hunger: 75, mood: 0, energy: 0, health: 0 },
  { id: 'noodles', icon: '🍜', use: { grain: 0.8 }, water: 0.15, herbs: 0, hours: 0.3, hunger: 65, mood: 2, energy: 0, health: 0 },
  { id: 'eggrice', icon: '🍛', use: { grain: 0.7, egg: 0.5 }, water: 0, herbs: 0, hours: 0.5, hunger: 80, mood: 6, energy: 4, health: 0 },
  { id: 'greens', icon: '🥬', use: { grain: 0.5, veg: 0.6 }, water: 0.2, herbs: 0, hours: 0.5, hunger: 70, mood: 3, energy: 0, health: 8 },
  { id: 'wildveg', icon: '🥗', use: { veg: 0.9 }, water: 0.1, herbs: 0, hours: 0.3, hunger: 55, mood: 2, energy: 0, health: 6 },
  { id: 'scrambled', icon: '🍳', use: { egg: 0.8 }, water: 0, herbs: 0, hours: 0.25, hunger: 60, mood: 4, energy: 3, health: 0 },
  { id: 'canmeat', icon: '🥫', use: { meat: 0.7 }, water: 0, herbs: 0, hours: 0.3, hunger: 70, mood: 6, energy: 0, health: 0 },
  { id: 'pork', icon: '🥘', use: { grain: 0.5, meat: 0.8 }, water: 0, herbs: 0, hours: 0.9, hunger: 85, mood: 14, energy: 0, health: 0 },
  { id: 'chicken', icon: '🍲', use: { meat: 0.8, veg: 0.3 }, water: 0.3, herbs: 0, hours: 1.0, hunger: 78, mood: 4, energy: 30, health: 5 },
  { id: 'porridge', icon: '🌿', use: { grain: 0.7 }, water: 0.3, herbs: 1, hours: 0.7, hunger: 70, mood: 0, energy: 5, health: 18 },
  { id: 'feast', icon: '🍱', use: { grain: 0.6, meat: 0.8, veg: 0.5, egg: 0.4 }, water: 0.3, herbs: 0, hours: 1.3, hunger: 95, mood: 22, energy: 12, health: 6 },
  // 剩下一点这个一点那个、哪道菜都凑不齐：一锅乱炖（家里有一份吃的就能凑一份）
  { id: 'stew', icon: '🥣', use: {}, any: 0.9, water: 0.2, herbs: 0, hours: 0.6, hunger: 70, mood: 1, energy: 0, health: 0 },
]
/** 一人份一共用几份食材 */
export const dishFood = (d: Dish): number => d.any ?? INGS.reduce((s, k) => s + (d.use[k] ?? 0), 0)
export const dishOf = (id: string | undefined): Dish => DISHES.find((d) => d.id === id) ?? DISHES[0]

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

/** 一天一顿：一家人习惯晚上 6 点一起吃晚饭 */
export function isMealTime(hour: number): boolean {
  return hour >= 17.5 && hour < 19.5
}

/** 一个人空闲时下一步想干什么（像模拟人生：最急的需求优先） */
export function chooseWant(n: Needs, c: Clock, stock: Stock, roll: number): Want {
  const late = c.hour >= 22 || c.hour < SUNRISE
  const water = stock.water >= DRINK.water
  const food = stock.food >= MEAL.food
  // 渴得、饿得快不行了：再累也先去喝口水、吃口饭（不然累倒了就渴死在家里，水缸还是满的）
  if (n.thirst < 12 && water) return 'drink'
  if (n.hunger < 8 && food) return 'eat'
  if (n.energy < 18 || (late && n.energy < 90)) {
    // 还撑得住的话，睡前先喝口水、垫点东西，不然半夜渴醒
    if (n.energy >= 10 && n.thirst < 35 && water) return 'drink'
    // 晚饭没赶上（等饭的时候困了）：睡前吃一口，不然半夜饿醒
    if (n.energy >= 10 && n.hunger < 45 && food) return 'eat'
    return 'sleep'
  }
  // 一天喝一次：渴了才喝；一天吃一顿：晚饭时间饿了就吃，实在饿得不行了才另外吃
  if (n.thirst < 35 && water) return 'drink'
  if (food && (n.hunger < 30 || (isMealTime(c.hour) && n.hunger < 60))) return 'eat'
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
