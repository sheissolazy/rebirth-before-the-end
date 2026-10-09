import { describe, expect, it } from 'vitest'
import { FORAGE, REGROW, harvest, ripe, standAt } from './forage'
import { COOP_SPOT, PROPS, STREET, WELL_SPOT, YARD, inRect } from './layout'
import { buildNav } from './nav'

describe('野外采集', () => {
  it('每一处都长在院子外面、街道以外、不压着别人家的房子，女主站的地方走得到', () => {
    const nav = buildNav()
    for (const s of FORAGE) {
      const at = standAt(s)
      expect(inRect(YARD, s.at.x, s.at.z, 0.5), s.id).toBe(false)
      expect(inRect(STREET, s.at.x, s.at.z, 0.5), s.id).toBe(false)
      for (const p of PROPS) if (p.kind === 'house') expect(inRect({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2 }, s.at.x, s.at.z, 1), s.id).toBe(false)
      expect(nav.isBlockedAt(at.x, at.z), s.id).toBe(false)
    }
  })

  it('压水井、鸡圈前面站人的地方走得到', () => {
    const nav = buildNav()
    expect(nav.isBlockedAt(WELL_SPOT.x, WELL_SPOT.z)).toBe(false)
    expect(nav.isBlockedAt(COOP_SPOT.x, COOP_SPOT.z)).toBe(false)
  })

  it('采过以后按天数长回来', () => {
    const s = FORAGE.find((f) => f.kind === 'honey')!
    expect(ripe(s, {}, 3)).toBe(true)
    expect(ripe(s, { [s.id]: 3 }, 3 + REGROW.honey - 1)).toBe(false)
    expect(ripe(s, { [s.id]: 3 }, 3 + REGROW.honey)).toBe(true)
  })

  it('收获：野菜给吃的，草药攒着，红伞伞不能吃，蜂蜜有一半会被蛰', () => {
    expect(harvest('greens', () => 0.5).food).toBeGreaterThan(0)
    expect(harvest('herb', () => 0.5).herbs).toBe(1)
    expect(harvest('toadstool', () => 0.5).food).toBe(0)
    expect(harvest('honey', () => 0.1).sting).toBeGreaterThan(0)
    expect(harvest('honey', () => 0.9).sting).toBe(0)
  })
})
