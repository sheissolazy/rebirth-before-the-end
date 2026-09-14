/**
 * 平衡模拟器：一个简单策略的机器人自动玩一世。
 * 用于测试引擎能否跑完、以及粗略的通关率。
 */
import type { GameState, MetaProgress, EventDef } from '../types'
import { RARITY_POINTS, CRISIS_POINTS } from '../types'
import type { GameEngine } from '../api'
import type { ContentPack } from '../types'

export interface SimResult {
  seed: string
  turns: number
  ending: string | null
  health: number
  money: number
  warehouse: number
  companions: number
  crisesSurvived: number
  crisesFailed: number
  maxAffection: number
}

export function emptyMeta(): MetaProgress { return { rebirthPoints: 0, rebirths: 0, unlockedEndings: [], purchased: {} } }

export function simulateOne(engine: GameEngine, content: ContentPack, seed: string, meta = emptyMeta(), maxTurns = 60): SimResult {
  let s = engine.newGame(content, { seed, build: 'balanced', meta })
  let crisesSurvived = 0, crisesFailed = 0
  const cardsById = new Map(content.cards.map((c) => [c.id, c]))

  const tryPlace = (st: GameState, e: EventDef): GameState | null => {
    const assignments: Record<string, string> = {}
    for (const slot of e.slots) {
      const cands = engine.eligibleCards(st, e.id, slot.id).filter((c) => !Object.values(assignments).includes(c))
      if (cands.length === 0) { if (slot.required) return null; continue }
      // 可选槽：只放人/宠物/技能，不白白消耗物资
      if (!slot.required && slot.consumes) continue
      if (!slot.required && slot.accepts.kind === 'supply') continue
      assignments[slot.id] = cands[0]
    }
    try { return engine.place(st, { eventId: e.id, assignments }) } catch { return null }
  }

  for (let i = 0; i < maxTurns && !s.ending; i++) {
    // 序章：买东西
    if (s.time.phase === 'prologue') {
      const shopping = ['supply_rice_5kg', 'supply_water_box', 'supply_compressed_biscuit', 'supply_antibiotics', 'supply_battery', 'supply_steel', 'equip_machete', 'supply_winter_clothes', 'supply_bolts']
      for (let round = 0; round < 30; round++) {
        const id = shopping[round % shopping.length]
        try { s = engine.buy(s, id, 1) } catch { /* 没钱或没地方 */ }
      }
    }
    // 派工
    for (const p of Object.values(s.people)) {
      if (!p.alive || !p.inBase || p.busyWithEventId || p.defId) continue
      const job = s.crisis?.crisisKind === 'horde' ? 'guard' : (i % 3 === 0 ? 'scavenge' : i % 3 === 1 ? 'guard' : 'train')
      try { s = engine.assignJob(s, p.id, job) } catch { /* ignore */ }
    }
    // 建造
    for (const m of content.modules.filter((m) => m.baseType === s.base.type)) {
      try { s = engine.build(s, m.id); break } catch { /* ignore */ }
    }
    // 选事件：优先剧情解危机，然后男主线，然后搜刮/上班
    const events = engine.availableEvents(s)
    const score = (e: EventDef) => {
      let sc = e.weight === 0 ? 5 : 1
      if (e.resolvesCrisis && s.crisis && e.resolvesCrisis === s.crisis.crisisKind) sc += 20
      if (e.storylineNpcId) sc += 8
      if (e.id === 'ev_office_work') sc += s.time.phase === 'prologue' ? 3 : 0
      if (e.id.includes('scavenge') || e.id.includes('ruin')) sc += 4
      return sc
    }
    for (const e of [...events].sort((a, b) => score(b) - score(a))) {
      const ns = tryPlace(s, e)
      if (ns) { s = ns; break }
    }
    const { state, report } = engine.endWeek(s)
    s = state
    if (report.crisisResult) { if (report.crisisResult.survived) crisesSurvived++; else crisesFailed++ }
  }
  const maxAffection = Math.max(0, ...Object.values(s.people).filter((p) => p.defId && content.npcs.find((n) => n.id === p.defId)?.romanceable).map((p) => p.affection))
  return {
    seed, turns: s.turn, ending: s.ending, health: s.hero.health, money: s.money,
    warehouse: s.warehouse.reduce((t, c) => t + (RARITY_POINTS[cardsById.get(c.defId)?.rarity ?? 'common'] ?? 0), 0),
    companions: Object.values(s.people).filter((p) => p.alive && p.inBase).length,
    crisesSurvived, crisesFailed, maxAffection,
  }
}

export function summarize(results: SimResult[]) {
  const n = results.length
  const by = (f: (r: SimResult) => number) => results.reduce((t, r) => t + f(r), 0) / n
  const endings: Record<string, number> = {}
  for (const r of results) endings[r.ending ?? 'none'] = (endings[r.ending ?? 'none'] ?? 0) + 1
  return {
    runs: n,
    survivedYear: results.filter((r) => r.ending && r.ending !== 'death').length / n,
    avgTurns: by((r) => r.turns),
    avgCrisesSurvived: by((r) => r.crisesSurvived),
    avgCrisesFailed: by((r) => r.crisesFailed),
    avgHealth: by((r) => r.health),
    avgCompanions: by((r) => r.companions),
    avgMaxAffection: by((r) => r.maxAffection),
    endings,
    crisisNeedRef: CRISIS_POINTS,
  }
}
