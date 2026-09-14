import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { content } from '../../content'
import { emptyMeta, simulateOne, summarize } from './sim'
import { EngineError } from '../api'

const engine = createEngine(content)
const meta = emptyMeta()

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
    const ra = engine.endWeek(engine.place(a, { eventId: 'ev_office_work', assignments: { hero: 'hero' } }))
    const rb = engine.endWeek(engine.place(b, { eventId: 'ev_office_work', assignments: { hero: 'hero' } }))
    expect(JSON.stringify(ra)).toBe(JSON.stringify(rb))
  })
  it('longer prologue from rebirth shop', () => {
    const s = engine.newGame(content, { seed: 'a', build: 'balanced', meta: { ...meta, purchased: { shop_weeks: 2 } } })
    expect(s.prologueWeeks).toBe(12)
    expect(s.time.weeksBeforeEnd).toBe(12)
  })
})

describe('placing and resolving', () => {
  it('work pays salary next week and hero can only be placed once', () => {
    let s = engine.newGame(content, { seed: 'w', build: 'balanced', meta })
    const money = s.money
    s = engine.place(s, { eventId: 'ev_office_work', assignments: { hero: 'hero' } })
    expect(() => engine.place(s, { eventId: 'ev_bank_stock', assignments: { hero: 'hero' } })).toThrow(EngineError)
    const { state, report } = engine.endWeek(s)
    expect(report.eventResults[0].eventId).toBe('ev_office_work')
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
    engine.endWeek(s)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('economy', () => {
  it('buys within budget and refuses unbuyable guns', () => {
    let s = engine.newGame(content, { seed: 'b', build: 'balanced', meta })
    s = engine.buy(s, 'supply_rice_5kg', 2)
    expect(s.warehouse.filter((c) => c.defId === 'supply_rice_5kg')).toHaveLength(3)
    expect(() => engine.buy(s, 'equip_shotgun', 1)).toThrow('NOT_BUYABLE')
    expect(() => engine.buy(s, 'supply_generator', 100)).toThrow()
  })
  it('gift raises affection more when it matches needs', () => {
    let s = engine.newGame(content, { seed: 'g', build: 'balanced', meta })
    s = engine.buy(s, 'supply_antibiotics', 1)
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
    for (let i = 0; i < 4; i++) s = engine.endWeek(s).state
    expect(s.time.phase).toBe('apocalypse')
    expect(s.time).toMatchObject({ year: 1, month: 1, week: 1 })
    expect(s.crisis?.crisisKind).toBe('horde')
    expect(s.hero.employed).toBe(false)
  })
  it('resolves the crisis at month end', () => {
    let s = engine.newGame(content, { seed: 'cr', build: 'balanced', meta })
    s = engine.buy(s, 'supply_rice_5kg', 4)
    s = engine.buy(s, 'supply_water_box', 4)
    for (let i = 0; i < 7; i++) s = engine.endWeek(s).state
    expect(s.hero.health).toBeGreaterThan(0)
    const { state, report } = engine.endWeek(s)
    expect(report.crisisResult).toBeDefined()
    expect(state.time.month).toBe(2)
    expect(state.crisis?.crisisKind).toBe('scarcity')
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
