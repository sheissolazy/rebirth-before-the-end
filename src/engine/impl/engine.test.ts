import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { content } from '../../content'
import { emptyMeta, simulateOne, summarize } from './sim'
import { EngineError } from '../api'

const engine = createEngine(content)
const meta = emptyMeta()

/** 周初突发选择：选第一个能选的 */
function settleChoice(s: ReturnType<typeof engine.newGame>) {
  if (!s.pendingChoice) return s
  const e = content.events.find((x) => x.id === s.pendingChoice)!
  for (const c of e.choices ?? []) { try { return engine.choose(s, c.id).state } catch { /* next */ } }
  return s
}
const week = (s: ReturnType<typeof engine.newGame>) => engine.endWeek(settleChoice(s))

describe('newGame', () => {
  it('starts in prologue with 4 weeks and drawn events', () => {
    const s = engine.newGame(content, { seed: 'a', build: 'balanced', meta })
    expect(s.time.phase).toBe('prologue')
    expect(s.time.weeksBeforeEnd).toBe(4)
    expect(Object.keys(s.drawnEvents).length).toBeGreaterThan(0)
    expect(engine.availableEvents(s).some((e) => e.id === 'ev_office_work')).toBe(true)
  })
  it('is deterministic for the same seed', () => {
    const a = engine.newGame(content, { seed: 'same', build: 'mind', meta })
    const b = engine.newGame(content, { seed: 'same', build: 'mind', meta })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    const ra = week(engine.place(a, { eventId: 'ev_office_work', assignments: { hero: 'hero' } }))
    const rb = week(engine.place(b, { eventId: 'ev_office_work', assignments: { hero: 'hero' } }))
    expect(JSON.stringify(ra)).toBe(JSON.stringify(rb))
  })
  it('longer prologue from rebirth shop', () => {
    const s = engine.newGame(content, { seed: 'a', build: 'balanced', meta: { ...meta, purchased: { shop_weeks: 2 } } })
    expect(s.prologueWeeks).toBe(12)
    expect(s.time.weeksBeforeEnd).toBe(12)
  })
})

describe('placing and resolving', () => {
  it('work pays salary next week and energy limits how much the hero does', () => {
    let s = engine.newGame(content, { seed: 'w', build: 'balanced', meta })
    const money = s.money
    const energy = s.hero.energy
    s = engine.place(s, { eventId: 'ev_office_work', assignments: { hero: 'hero' } })
    expect(s.hero.energy).toBe(energy - 2)
    // 精力耗尽后不能再放
    let blocked = false
    for (let i = 0; i < 5; i++) {
      const e = engine.availableEvents(s).find((x) => !s.placements.some((p) => p.eventId === x.id) && x.slots.some((sl) => sl.accepts.kind === 'hero'))
      if (!e) break
      try { s = engine.place(s, { eventId: e.id, assignments: { hero: 'hero' } }) } catch (err) { blocked = err instanceof EngineError; break }
    }
    expect(blocked || s.hero.energy === 0).toBe(true)
    const { state, report } = week(s)
    expect(report.eventResults.some((r) => r.eventId === 'ev_office_work')).toBe(true)
    expect(state.money).toBeGreaterThan(money - 1000)
    expect(state.time.weeksBeforeEnd).toBe(3)
  })
  it('rejects missing required slot and unplaces cleanly', () => {
    let s = engine.newGame(content, { seed: 'w', build: 'balanced', meta })
    expect(() => engine.place(s, { eventId: 'ev_office_work', assignments: {} })).toThrow('required')
    s = engine.place(s, { eventId: 'ev_office_work', assignments: { hero: 'hero' } })
    s = engine.unplace(s, 'ev_office_work')
    expect(s.placements).toHaveLength(0)
  })
  it('does not mutate the input state', () => {
    const s = engine.newGame(content, { seed: 'w', build: 'balanced', meta })
    const before = JSON.stringify(s)
    engine.place(s, { eventId: 'ev_office_work', assignments: { hero: 'hero' } })
    week(s)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('economy', () => {
  it('online orders arrive next week, guns are not sold, limits apply', () => {
    let s = engine.newGame(content, { seed: 'b', build: 'balanced', meta })
    s = engine.buy(s, 'supply_rice_5kg', 2)
    expect(s.warehouse.filter((c) => c.defId === 'supply_rice_5kg')).toHaveLength(1)
    expect(s.orders).toHaveLength(1)
    expect(() => engine.buy(s, 'equip_shotgun', 1)).toThrow('NOT_BUYABLE')
    expect(() => engine.buy(s, 'supply_generator', 2)).toThrow('LIMIT')
    s = week(s).state
    expect(s.warehouse.filter((c) => c.defId === 'supply_rice_5kg')).toHaveLength(3)
    expect(s.orders).toHaveLength(0)
  })
  it('undelivered orders are lost when the apocalypse begins', () => {
    let s = engine.newGame(content, { seed: 'b2', build: 'balanced', meta })
    for (let i = 0; i < 3; i++) s = week(s).state
    s = engine.buy(s, 'supply_generator', 1)   // 两周到货，末日在一周后
    const { state, report } = week(s)
    expect(state.time.phase).toBe('apocalypse')
    expect(state.orders).toHaveLength(0)
    expect(report.news.some((n) => n.zh.includes('永远在路上'))).toBe(true)
  })
  it('building takes weeks and needs materials', () => {
    let s = engine.newGame(content, { seed: 'bd', build: 'balanced', meta })
    expect(() => engine.build(s, 'apt_windows')).toThrow('NO_MATERIAL')
    s = engine.buy(s, 'supply_wood', 4)
    s = week(s).state
    s = engine.build(s, 'apt_windows')
    expect(s.base.building?.moduleId).toBe('apt_windows')
    expect(s.base.modules).toHaveLength(0)
    const { state, report } = week(s)
    expect(report.builtModuleId).toBe('apt_windows')
    expect(state.base.modules[0].moduleId).toBe('apt_windows')
  })
  it('gift raises affection more when it matches needs', () => {
    let s = engine.newGame(content, { seed: 'g', build: 'balanced', meta })
    s = engine.buy(s, 'supply_antibiotics', 1)
    s = week(s).state
    const inst = s.warehouse.find((c) => c.defId === 'supply_antibiotics')!
    const before = s.people.guchen.affection
    s = engine.gift(s, 'guchen', inst.instanceId)
    expect(s.people.guchen.affection).toBe(before + 15)
    expect(s.warehouse.find((c) => c.instanceId === inst.instanceId)).toBeUndefined()
  })
  it('space has its own capacity', () => {
    let s = engine.newGame(content, { seed: 'sp', build: 'balanced', meta })
    const inst = s.warehouse[0]
    s = engine.moveToSpace(s, inst.instanceId, true)
    expect(s.warehouse.find((c) => c.instanceId === inst.instanceId)?.inSpace).toBe(true)
  })
})

describe('apocalypse transition and crises', () => {
  it('enters apocalypse after the prologue and draws a crisis', () => {
    let s = engine.newGame(content, { seed: 'ap', build: 'balanced', meta })
    for (let i = 0; i < 4; i++) s = week(s).state
    expect(s.time.phase).toBe('apocalypse')
    expect(s.time).toMatchObject({ year: 1, month: 1, week: 1 })
    expect(s.crisis?.crisisKind).toBe('horde')
    expect(s.hero.employed).toBe(false)
  })
  it('resolves the crisis at month end', () => {
    let s = engine.newGame(content, { seed: 'cr', build: 'balanced', meta })
    s = engine.buy(s, 'supply_rice_5kg', 4)
    s = engine.buy(s, 'supply_water_box', 4)
    s = engine.buy(s, 'supply_compressed_biscuit', 4)
    for (let i = 0; i < 7; i++) s = week(s).state
    expect(s.hero.health).toBeGreaterThan(0)
    const { state, report } = week(s)
    expect(report.crisisResult).toBeDefined()
    expect(state.time.month).toBe(2)
    expect(state.crisis?.crisisKind).toBe('scarcity')
  })
})

describe('traits and choices', () => {
  it('rejects traits over budget and applies balanced ones', () => {
    expect(() => engine.newGame(content, { seed: 't', build: 'balanced', meta, traits: ['trait_strong'] })).toThrow('TRAIT_BUDGET')
    const s = engine.newGame(content, { seed: 't', build: 'balanced', meta, traits: ['trait_strong', 'trait_shy'] })
    expect(s.hero.attrs.strength).toBe(3)
    expect(s.hero.attrs.charm).toBe(1)
  })
  it('blocks endWeek while a choice is pending and resolves it', () => {
    // 找一个开局就有突发的种子
    let s = engine.newGame(content, { seed: 'c1', build: 'balanced', meta })
    for (let i = 0; i < 20 && !s.pendingChoice; i++) s = engine.newGame(content, { seed: `c${i}`, build: 'balanced', meta })
    expect(s.pendingChoice).toBeTruthy()
    expect(() => engine.endWeek(s)).toThrow('PENDING_CHOICE')
    const e = content.events.find((x) => x.id === s.pendingChoice)!
    const { state, result } = engine.choose(s, e.choices![0].id)
    expect(state.pendingChoice).toBeNull()
    expect(result.eventId).toBe(e.id)
  })
  it('coffee restores energy', () => {
    let s = engine.newGame(content, { seed: 'k', build: 'balanced', meta })
    s = engine.buy(s, 'supply_coffee', 1)
    s = week(s).state
    s = engine.place(s, { eventId: 'ev_office_work', assignments: { hero: 'hero' } })
    const before = s.hero.energy
    const coffee = s.warehouse.find((c) => c.defId === 'supply_coffee')!
    s = engine.useItem(s, coffee.instanceId)
    expect(s.hero.energy).toBe(before + 1)
    expect(s.warehouse.find((c) => c.defId === 'supply_coffee')?.unitsLeft).toBe(4)
  })
})

describe('full simulation', () => {
  it('bot can play through a full year without engine errors', () => {
    const results = Array.from({ length: 20 }, (_, i) => simulateOne(engine, content, `sim-${i}`))
    for (const r of results) expect(r.turns).toBeLessThanOrEqual(53)
    const sum = summarize(results)
    // 引擎能跑完；通关率在平衡阶段再调
    expect(sum.avgTurns).toBeGreaterThan(8)
    console.log(JSON.stringify(sum, null, 1))
  })
})
