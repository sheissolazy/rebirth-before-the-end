import { describe, expect, it } from 'vitest'
import { timeToTurn, turnToTime } from './api'

describe('time helpers', () => {
  it('prologue counts down', () => {
    expect(turnToTime(0)).toEqual({ phase: 'prologue', weeksBeforeEnd: 4, year: 0, month: 0, week: 0 })
    expect(turnToTime(3).weeksBeforeEnd).toBe(1)
  })
  it('apocalypse starts at year 1 month 1 week 1', () => {
    expect(turnToTime(4)).toEqual({ phase: 'apocalypse', weeksBeforeEnd: 0, year: 1, month: 1, week: 1 })
    expect(turnToTime(4 + 47)).toEqual({ phase: 'apocalypse', weeksBeforeEnd: 0, year: 1, month: 12, week: 4 })
    expect(turnToTime(4 + 48).year).toBe(2)
  })
  it('round-trips with a longer prologue', () => {
    for (const t of [0, 5, 47, 48, 100, 527]) expect(timeToTurn(turnToTime(t, 48), 48)).toBe(t)
  })
})
