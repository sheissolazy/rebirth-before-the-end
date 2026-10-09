import { describe, expect, it } from 'vitest'
import { BEDS, FLOOR_H, GATE, PARADISE_SPOTS, SPOTS, STAIR_PATH, YARD, inRect, isHome } from './layout'
import { buildNav, navFloors, route } from './nav'

const nav = buildNav()

describe('别墅寻路', () => {
  it('墙挡路，门和铁门能过', () => {
    expect(nav.isBlockedAt(1.5, -3)).toBe(true) // 北墙
    expect(nav.isBlockedAt(6, 6)).toBe(false) // 堂屋的双开大门
    expect(nav.isBlockedAt(1.5, YARD.z1)).toBe(true) // 院子围栏
    expect(nav.isBlockedAt(GATE.x, GATE.z)).toBe(false) // 铁门
  })

  it('从堂屋能走到街上，而且要经过大门和铁门', () => {
    const from = { x: 6, z: 4.5 }
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
    expect(Math.abs(crossX(GATE.z) - GATE.x)).toBeLessThan(1)  // 铁门两米宽
    expect(Math.abs(crossX(6) - 6)).toBeLessThan(1) // 大门两米宽
  })

  it('能从堂屋走进厨房、爸妈卧室、储藏室（隔墙上的门）', () => {
    for (const to of [{ x: 2, z: -0.5 }, { x: 2, z: 4.6 }, { x: 10, z: 3 }]) expect(nav.findPath({ x: 6, z: 4.5 }, to)).not.toBeNull()
  })

  it('路径上的每一段都不穿墙', () => {
    const from = { x: 6, z: 4 }
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

describe('两层楼和"能干什么"的位置', () => {
  for (const style of ['toon', 'paradise'] as const) {
    const navs = navFloors(style)
    const spots = [...SPOTS, ...BEDS[style], ...(style === 'paradise' ? PARADISE_SPOTS : [])]
    it(`${style}：从客厅能走到每个位置的入口，还能走回来`, () => {
      const start = { x: 6, z: 4.5, floor: 0 as const }
      for (const s of spots) {
        const goal = { x: s.ax ?? s.x, z: s.az ?? s.z, floor: s.floor }
        expect(navs[s.floor].isBlockedAt(goal.x, goal.z), `${s.kind} @${goal.x},${goal.z} 入口被挡`).toBe(false)
        const there = route(navs, start, goal)
        expect(there, `${s.kind} @${goal.x},${goal.z} 走不到`).not.toBeNull()
        const end = there![there!.length - 1]
        expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(0.01)
        expect(end.floor).toBe(s.floor)
        expect(route(navs, goal, start), `${s.kind} 走不回来`).not.toBeNull()
      }
    })
  }

  it('上楼要经过楼梯，高度一路升到二楼', () => {
    const navs = navFloors('paradise')
    const path = route(navs, { x: 6, z: 4.5, floor: 0 }, { x: 2.0, z: 4.6, floor: 1 })!
    const ys = path.map((p) => p.y)
    expect(ys[0]).toBe(0)
    expect(ys[ys.length - 1]).toBeCloseTo(FLOOR_H)
    expect(path.some((p) => Math.abs(p.x - STAIR_PATH[2].x) < 0.01 && p.floor === 1)).toBe(true)
  })

  it('二楼楼梯口是空的，不能踩', () => {
    const up = navFloors('toon')[1]
    expect(up.isBlockedAt(6, -1.75)).toBe(true)
    expect(up.isBlockedAt(-1, 3)).toBe(true) // 二楼没有院子
    expect(up.isBlockedAt(2.6, 4.6)).toBe(false)
    // 阳台能站，栏杆外面不行
    expect(up.isBlockedAt(9, 7)).toBe(false)
    expect(up.isBlockedAt(9, 8.3)).toBe(true)
  })
})

describe('街上能搜的地方', () => {
  it('每个都站得上去，从家里走得到', async () => {
    const { SCAVENGE, FISHING } = await import('./scavenge')
    const navs = navFloors('paradise')
    for (const s of [...SCAVENGE, { id: 'fishing', at: FISHING.at }]) {
      expect(navs[0].isBlockedAt(s.at.x, s.at.z), s.id).toBe(false)
      expect(route(navs, { x: 4, z: 10, floor: 0 }, { ...s.at, floor: 0 }), s.id).not.toBeNull()
    }
  })
})

describe('卧室和储藏室（世外桃源画风）', () => {
  it('每张床的上床位置、储藏室卸货的位置都走得到；储藏室的门没被架子、纸箱堵住', async () => {
    const { BEDS } = await import('./layout')
    const navs = navFloors('paradise')
    const from = { x: 6.5, z: 4.4, floor: 0 as const }
    for (const b of BEDS.paradise) {
      const at = { x: b.ax ?? b.x, z: b.az ?? b.z, floor: b.floor }
      expect(navs[b.floor].isBlockedAt(at.x, at.z), `${at.x},${at.z} f${at.floor}`).toBe(false)
      expect(route(navs, from, at), `${at.x},${at.z} f${at.floor}`).not.toBeNull()
    }
    // 卸货的四个位置（residents.ts 的 STORE）
    for (const p of [{ x: 10.6, z: 4.6 }, { x: 10.0, z: 5.0 }, { x: 10.6, z: 1.0 }, { x: 10.0, z: 3.4 }]) {
      expect(route(navs, from, { ...p, floor: 0 }), `${p.x},${p.z}`).not.toBeNull()
    }
    // 油桶那一排、纸箱那一摞不能穿过去
    expect(navs[0].isBlockedAt(11.6, 4.5)).toBe(true)
    expect(navs[0].isBlockedAt(8.6, 4.4)).toBe(true)
  })
})
