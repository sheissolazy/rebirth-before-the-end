import { describe, expect, it } from 'vitest'
import { fromAbsWeek, toAbsWeek } from './api'

describe('time helpers', () => {
  it('round-trips year/month/week', () => {
    for (const w of [0, 3, 4, 47, 48, 479]) expect(toAbsWeek(fromAbsWeek(w))).toBe(w)
    expect(fromAbsWeek(48)).toEqual({ year: 2, month: 1, week: 1 })
    expect(toAbsWeek({ year: 1, month: 12, week: 4 })).toBe(47)
  })
})
