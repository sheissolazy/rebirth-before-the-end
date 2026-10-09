import { describe, expect, it } from 'vitest'
import { rainAt, rainOf } from './weather'

describe('天气', () => {
  it('大约三成的日子会下一场雨，雨在白天，下两到六个小时', () => {
    const days = Array.from({ length: 200 }, (_, d) => rainOf(d))
    const wet = days.filter(Boolean)
    expect(wet.length).toBeGreaterThan(40)
    expect(wet.length).toBeLessThan(85)
    for (const r of wet) {
      expect(r!.start).toBeGreaterThanOrEqual(7)
      expect(r!.end - r!.start).toBeGreaterThanOrEqual(2)
      expect(r!.end - r!.start).toBeLessThanOrEqual(6)
    }
  })

  it('雨是慢慢下大、慢慢停的', () => {
    const d = Array.from({ length: 50 }, (_, k) => k).find((k) => rainOf(k))!
    const r = rainOf(d)!
    expect(rainAt(d, r.start - 0.1)).toBe(0)
    expect(rainAt(d, r.start + 0.25)).toBeGreaterThan(0)
    expect(rainAt(d, r.start + 0.25)).toBeLessThan(rainAt(d, (r.start + r.end) / 2) + 1e-9)
    expect(rainAt(d, r.end + 0.1)).toBe(0)
  })
})
