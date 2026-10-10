import { describe, expect, it } from 'vitest'
import {
  DAY_SECONDS, DRINK, MEAL, PROLOGUE_DAYS, advance, calendarLabel, chooseWant, decayNeeds, dishOf, isCrisisNight, isNight, shouldWake,
  type Needs,
} from './life'

const full: Needs = { hunger: 100, thirst: 100, energy: 100, mood: 70 }

describe('时钟', () => {
  it('1 倍速下现实 5 分钟是一天', () => {
    const c = advance({ day: 0, hour: 8 }, DAY_SECONDS, 1)
    expect(c.day).toBe(1)
    expect(c.hour).toBeCloseTo(8)
  })

  it('序章倒数，之后按年月日显示', () => {
    expect(calendarLabel({ day: 0, hour: 8.5 })).toBe('末日前 4 天 · 08:30')
    expect(calendarLabel({ day: PROLOGUE_DAYS, hour: 0 })).toBe('末日第1年 1月 第1天 · 00:00')
    expect(calendarLabel({ day: PROLOGUE_DAYS + 5, hour: 14.25 })).toBe('末日第1年 2月 第2天 · 14:15')
  })

  it('月底那一晚是危机夜，序章没有', () => {
    expect(isCrisisNight({ day: 3, hour: 21 })).toBe(false)
    expect(isCrisisNight({ day: PROLOGUE_DAYS + 3, hour: 21 })).toBe(true)
    expect(isCrisisNight({ day: PROLOGUE_DAYS + 3, hour: 12 })).toBe(false)
    expect(isNight(23)).toBe(true)
    expect(isNight(12)).toBe(false)
  })
})

describe('需求', () => {
  it('一天吃一顿、喝一次就够：醒 16 小时睡 8 小时，一顿饭、一次水补得回来（一人一天一份吃的、0.6 份水）', () => {
    let n = { ...full }
    for (let h = 0; h < 16; h++) n = decayNeeds(n, 1, 'idle')
    for (let h = 0; h < 8; h++) n = decayNeeds(n, 1, 'sleep')
    expect(100 - n.hunger).toBeLessThanOrEqual(MEAL.hunger + 1)
    expect(100 - n.thirst).toBeLessThanOrEqual(DRINK.thirst + 1)
    expect(MEAL.food).toBe(1)
  })

  it('菜不一样加的东西不一样：红烧肉加心情、鸡汤加精力、草药粥加健康', () => {
    expect(dishOf('pork').mood).toBeGreaterThan(10)
    expect(dishOf('chicken').energy).toBeGreaterThan(20)
    expect(dishOf('porridge').health).toBeGreaterThan(10)
    expect(dishOf('porridge').herbs).toBe(1)
    expect(dishOf('nope').id).toBe('rice')
  })

  it('正常过日子心情掉得很慢；饿着渴着才掉得快', () => {
    let n: Needs = { ...full, mood: 70 }
    for (let h = 0; h < 8; h++) n = decayNeeds(n, 1, 'idle')
    expect(n.mood).toBeGreaterThan(62)
  })

  it('睡八小时能把精神补满', () => {
    let n = { ...full, energy: 10 }
    for (let h = 0; h < 8; h++) n = decayNeeds(n, 1, 'sleep')
    expect(n.energy).toBeGreaterThan(95)
  })

  it('又饿又渴心情会往下掉，放松会回升', () => {
    let n: Needs = { hunger: 10, thirst: 10, energy: 60, mood: 70 }
    for (let h = 0; h < 6; h++) n = decayNeeds(n, 1, 'idle')
    expect(n.mood).toBeLessThan(40)
    let m: Needs = { ...full, mood: 30 }
    for (let h = 0; h < 4; h++) m = decayNeeds(m, 1, 'relax')
    // 歇着慢慢回升（四个小时涨十几点）
    expect(m.mood).toBeGreaterThan(42)
  })
})

describe('自主行动', () => {
  const stock = { food: 10, water: 10 }
  it('最急的需求优先', () => {
    expect(chooseWant({ ...full, thirst: 20, hunger: 20 }, { day: 0, hour: 12 }, stock, 0.9)).toBe('drink')
    expect(chooseWant({ ...full, hunger: 20 }, { day: 0, hour: 12 }, stock, 0.9)).toBe('eat')
    expect(chooseWant({ ...full, energy: 60 }, { day: 0, hour: 23 }, stock, 0.9)).toBe('sleep')
  })

  it('一天一顿：晚饭时间有点饿就去吃，别的时候不太饿就不吃', () => {
    expect(chooseWant({ ...full, hunger: 55 }, { day: 0, hour: 18.2 }, stock, 0.9)).toBe('eat')
    expect(chooseWant({ ...full, hunger: 55 }, { day: 0, hour: 12.2 }, stock, 0.9)).toBe('idle')
    expect(chooseWant({ ...full, hunger: 80 }, { day: 0, hour: 18.2 }, stock, 0.9)).toBe('idle')
  })

  it('睡前口渴先喝水，累垮了就直接睡', () => {
    expect(chooseWant({ ...full, energy: 50, thirst: 30 }, { day: 0, hour: 22.5 }, stock, 0.9)).toBe('drink')
    expect(chooseWant({ ...full, energy: 5, thirst: 30 }, { day: 0, hour: 22.5 }, stock, 0.9)).toBe('sleep')
  })

  it('没吃的就不会去吃', () => {
    expect(chooseWant({ ...full, hunger: 20 }, { day: 0, hour: 12 }, { food: 0, water: 0 }, 0.9)).not.toBe('eat')
  })

  it('天亮而且睡饱了才起床', () => {
    expect(shouldWake({ ...full, energy: 99 }, { day: 1, hour: 6.5 })).toBe(true)
    expect(shouldWake({ ...full, energy: 99 }, { day: 1, hour: 3 })).toBe(false)
    expect(shouldWake({ ...full, energy: 60 }, { day: 1, hour: 8 })).toBe(false)
  })
})
