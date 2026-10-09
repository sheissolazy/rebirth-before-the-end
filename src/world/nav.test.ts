import { describe, expect, it } from 'vitest'
import { GATE, YARD, inRect, isHome } from './layout'
import { buildNav } from './nav'

const nav = buildNav()

describe('别墅寻路', () => {
  it('墙挡路，门和铁门能过', () => {
    expect(nav.isBlockedAt(1.5, 0)).toBe(true) // 北墙
    expect(nav.isBlockedAt(3.5, 6)).toBe(false) // 南墙上的大门
    expect(nav.isBlockedAt(1.5, YARD.z1)).toBe(true) // 院子围栏
    expect(nav.isBlockedAt(GATE.x, GATE.z)).toBe(false) // 铁门
  })

  it('从客厅能走到街上，而且要经过大门和铁门', () => {
    const from = { x: 2, z: 4.5 }
    const path = nav.findPath(from, { x: 3.5, z: 18 })
    expect(path).not.toBeNull()
    const pts = [from, ...path!]
    expect(pts[pts.length - 1]).toEqual({ x: 3.5, z: 18 })
    // 路线穿过 z = 某条线时的 x 坐标
    const crossX = (z: number) => {
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1]
        const b = pts[k]
        if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) return a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x)
      }
      return NaN
    }
    expect(Math.abs(crossX(GATE.z) - GATE.x)).toBeLessThan(0.5)
    expect(Math.abs(crossX(6) - 3.5)).toBeLessThan(0.5)
  })

  it('能从客厅走进厨房（隔墙上的门）', () => {
    expect(nav.findPath({ x: 2, z: 1.5 }, { x: 6.5, z: 1.6 })).not.toBeNull()
  })

  it('路径上的每一段都不穿墙', () => {
    const from = { x: 1.5, z: 4 }
    const path = nav.findPath(from, { x: 20, z: 18 })!
    let prev = from
    for (const p of path) {
      expect(nav.clearLine(prev, p)).toBe(true)
      prev = p
    }
  })
})

describe('地盘边界', () => {
  it('院子里是家，出了铁门就是屋外', () => {
    expect(isHome(4, 9, false)).toBe(true)
    expect(isHome(3.5, 16, true)).toBe(false)
  })

  it('在边界附近不会来回切换', () => {
    const z = YARD.z1 - 0.1
    expect(isHome(3.5, z, true)).toBe(true)
    expect(isHome(3.5, z, false)).toBe(false)
    expect(inRect(YARD, 0, 0)).toBe(true)
  })
})
