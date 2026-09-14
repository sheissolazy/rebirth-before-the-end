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

export function emptyMeta(): MetaProgress { return { rebirthPoints: 0, traitPoints: 0, rebirths: 0, unlockedEndings: [], purchased: {} } }

export function simulateOne(engine: GameEngine, content: ContentPack, seed: string, meta = emptyMeta(), maxTurns = 60, onWeek?: (s: GameState, report: import('../types').WeekReport) => void): SimResult {
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
    // 突发选择：选第一个能选的
    if (s.pendingChoice) {
      const e = content.events.find((x) => x.id === s.pendingChoice)
      let choices = [...(e?.choices ?? [])]
      // 机器人：粮食不够就别收人；否则随机顺序尝试
      const st = engine.stats(s)
      const foodWeeks = st.foodUnits / Math.max(1, st.weeklyFood)
      const recruits = (c: typeof choices[number]) => Object.values(c.outcomes).some((b) => b?.effects.some((ef) => ef.type === 'recruitRandom'))
      if (foodWeeks < 6) { const noRecruit = choices.filter((c) => !recruits(c)); if (noRecruit.length) choices = noRecruit }
      for (let k = choices.length - 1; k > 0; k--) { const j = (i * 7 + k * 13) % (k + 1); [choices[k], choices[j]] = [choices[j], choices[k]] }
      for (const c of choices) { try { s = engine.choose(s, c.id).state; break } catch { /* next */ } }
      if (s.pendingChoice) s = { ...s, pendingChoice: null }
    }
    // 序章：买东西
    if (s.time.phase === 'prologue') {
      const shopping = ['supply_rice_5kg', 'supply_water_box', 'supply_water_tablets', 'supply_compressed_biscuit', 'supply_canned', 'supply_antibiotics', 'supply_battery', 'supply_wood', 'equip_machete', 'supply_winter_clothes', 'supply_bolts', 'supply_soap']
      for (const id of shopping) for (let k = 0; k < 3; k++) { try { s = engine.buy(s, id, 1) } catch { break } }
      // 水是出租屋的短板：每周再囤 4 板净水片
      for (let k = 0; k < 4; k++) { try { s = engine.buy(s, 'supply_water_tablets', 1) } catch { break } }
      if (s.time.weeksBeforeEnd <= 2) { try { s = engine.build(s, 'apt_rain') } catch { /* ignore */ } }
    }
    // 候选幸存者：粮够、有位置才收
    for (const r of [...s.pendingRecruits]) {
      const st = engine.stats(s)
      if (st.foodUnits >= st.weeklyFood * 6 && st.waterUnits >= st.weeklyWater * 6 && st.population < st.populationCap) { try { s = engine.recruit(s, r.id) } catch { /* full */ } }
      else { try { s = engine.dismissRecruit(s, r.id) } catch { /* ignore */ } }
    }
    // 派工
    for (const p of Object.values(s.people)) {
      if (!p.alive || !p.inBase || p.busyWithEventId) continue
      if (p.defId && content.npcs.find((n) => n.id === p.defId)?.romanceable) continue
      const job = s.crisis?.crisisKind === 'horde' ? 'guard' : (i % 3 === 0 ? 'scavenge' : i % 3 === 1 ? 'guard' : 'train')
      try { s = engine.assignJob(s, p.id, job) } catch { /* ignore */ }
    }
    // 建造：先水源，再其它
    const order = ['apt_rain', 'villa_well', 'farm_watertower', 'bunker_water']
    for (const m of [...content.modules].filter((m) => m.baseType === s.base.type).sort((a, b) => (order.includes(b.id) ? 1 : 0) - (order.includes(a.id) ? 1 : 0))) {
      try { s = engine.build(s, m.id); break } catch { /* ignore */ }
    }
    // 选事件：优先剧情解危机，然后男主线，然后搜刮/上班
    const events = engine.availableEvents(s)
    const score = (e: EventDef) => {
      let sc = e.weight === 0 ? 5 : 1
      if (e.resolvesCrisis && s.crisis && e.resolvesCrisis === s.crisis.crisisKind) sc += 20
      if (e.storylineNpcId) sc += 8
      if (e.id === 'ev_office_work') sc += s.time.phase === 'prologue' ? 3 : 0
      if (e.id.includes('scavenge') || e.id.includes('ruin') || e.id.includes('search') || e.id.includes('farm_trade')) sc += 4
      if (s.time.phase === 'apocalypse') { const st = engine.stats(s); if (st.foodUnits < st.weeklyFood * 4 && (e.id.includes('ruin') || e.id.includes('search') || e.id.includes('farm'))) sc += 10; if (st.waterUnits < st.weeklyWater * 4 && e.id.includes('water')) sc += 12 }
      // 粮食紧张时别收人
      if (s.time.phase === 'apocalypse') { const st = engine.stats(s); if (st.foodUnits < st.weeklyFood * 6 && Object.values(e.outcomes).some((b) => b?.effects.some((ef) => ef.type === 'recruitRandom'))) sc -= 6 }
      return sc
    }
    // 精力够就继续放；受伤时只做基地内的事
    for (const e of [...events].sort((a, b) => score(b) - score(a))) {
      if (s.hero.energy <= 0) break
      if (s.hero.health <= 4 && e.locationId !== 'home' && e.locationId !== 'office') continue
      const ns = tryPlace(s, e)
      if (ns) s = ns
    }
    const { state, report } = engine.endWeek(s)
    s = state
    if (report.crisisResult) { if (report.crisisResult.survived) crisesSurvived++; else crisesFailed++ }
    onWeek?.(s, report)
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
