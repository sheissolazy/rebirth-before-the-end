import { describe, expect, it } from 'vitest'
import { skyAt } from './daylight'

const day = { sky: '#cfe1e8', fog: '#dfe6dd', sun: '#ffe2b8' }

describe('昼夜', () => {
  it('中午太阳最亮、在南边偏高；半夜只有月光', () => {
    const noon = skyAt(12.5, day)
    expect(noon.light).toBeCloseTo(1)
    expect(noon.dir.y).toBeGreaterThan(0.8)
    expect(noon.lamps).toBe(0)
    expect(noon.sky.getHexString()).toBe('cfe1e8')
    const night = skyAt(1, day)
    expect(night.light).toBeLessThan(0.3)
    expect(night.lamps).toBe(1)
    expect(night.night).toBeCloseTo(1)
  })

  it('早上太阳在东边，傍晚在西边', () => {
    expect(skyAt(7.5, day).dir.x).toBeGreaterThan(0.5)
    expect(skyAt(17.5, day).dir.x).toBeLessThan(-0.5)
  })

  it('日出日落时光线连续，不会突然一闪', () => {
    for (let h = 0; h < 24; h += 0.05) {
      const a = skyAt(h, day)
      const b = skyAt(h + 0.05, day)
      expect(Math.abs(a.light - b.light)).toBeLessThan(0.08)
      expect(Math.abs(a.ambient - b.ambient)).toBeLessThan(0.08)
    }
  })
})
