import type { GameState, WeekReport, Rarity, CrisisKind } from '../types'
import { CRISIS_POINTS, CRISIS_ACCEPTS } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { crisisPoints, shiftRarity, cardPoints, isCompanion, personName } from './helpers'
import { loseRandomCards, killPerson, type EffectCtx } from './effects'

const KINDS: CrisisKind[] = ['horde', 'scarcity', 'climate', 'plague', 'human']

export function drawCrisis(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const month = state.time.month
  const mem = ci.pack.memories.find((m) => m.month === month)
  let kind: CrisisKind = mem?.crisisKind ?? rng.pick(KINDS)
  let rarity: Rarity = mem?.baseRarity ?? 'common'
  // 蝴蝶效应：偏移概率 = butterfly/100
  const b = state.hero.butterfly / 100
  if (rng.chance(b * 0.3)) kind = rng.pick(KINDS)
  if (rng.chance(b)) rarity = shiftRarity(rarity, rng.chance(0.6) ? 1 : -1)
  if (kind === 'human' && state.hero.exposure > 50) rarity = shiftRarity(rarity, 1)
  const def = ci.pack.cards.find((c) => c.kind === 'crisis' && c.crisisKind === kind && c.rarity === rarity)
    ?? ci.pack.cards.find((c) => c.kind === 'crisis' && c.crisisKind === kind)
  const forecast = state.forecast.find((f) => f.month === month)
  const dog = state.pets.some((p) => p.alive && ci.pets.get(p.defId)?.species === 'dog')
  state.crisis = {
    cardDefId: def?.id ?? '', crisisKind: kind, rarity,
    revealed: !!forecast?.rarity || (dog && kind === 'horde'),
    resolved: false, dueTurn: state.turn + 3,
  }
  if (forecast) { forecast.crisisKind = kind; if (state.crisis.revealed) forecast.rarity = rarity }
  if (def && def.kind === 'crisis') report.news.push(def.onDraw)
}

export function resolveCrisis(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const c = state.crisis
  if (!c) return
  const def = ci.cards.get(c.cardDefId)
  const need = CRISIS_POINTS[c.rarity]
  const have = crisisPoints(ci, state, c.crisisKind)
  const survived = c.resolved || have >= need
  const ctx: EffectCtx = { ci, state, rng, report }
  if (survived) {
    if (!c.resolved) consumeSupplies(ci, state, c.crisisKind, Math.ceil(need / 2))
    state.rebirthPointsEarned += 2
  } else {
    switch (c.rarity) {
      case 'common': loseRandomCards(ctx, 2); break
      case 'fine': state.hero.health = Math.max(0, state.hero.health - 2); state.hero.incapacitatedWeeks = Math.max(state.hero.incapacitatedWeeks, 1); loseRandomCards(ctx, 2); break
      case 'rare': {
        const comps = Object.values(state.people).filter((p) => p.alive && p.inBase && isCompanion(ci, p))
        if (comps.length) killPerson(ctx, rng.pick(comps))
        else { const mods = state.base.modules.filter((m) => !m.damaged); if (mods.length) rng.pick(mods).damaged = true }
        state.hero.health = Math.max(0, state.hero.health - 3)
        loseRandomCards(ctx, 4)
        break
      }
      case 'legendary': state.hero.health = 0; break
    }
  }
  const text = def && def.kind === 'crisis' ? (survived ? def.onSurvive : def.onFail) : { zh: survived ? '你撑过去了。' : '你没撑住。' }
  report.crisisResult = { crisisKind: c.crisisKind, rarity: c.rarity, survived, text }
  state.diary.push({ turn: state.turn, text })
  state.crisis = null
}

/** 硬顶后消耗对应维度的物资（先消耗低档、快过期的） */
function consumeSupplies(ci: ContentIndex, state: GameState, kind: CrisisKind, points: number): void {
  if (kind === 'horde') return
  const kinds = CRISIS_ACCEPTS[kind]
  const cards = state.warehouse
    .filter((c) => { const d = ci.card(c.defId); return d.kind === 'supply' && kinds.includes(d.supplyKind) })
    .sort((a, b) => cardPoints(ci, a) - cardPoints(ci, b) || (a.expiresAtTurn ?? 1e9) - (b.expiresAtTurn ?? 1e9))
  let left = points
  for (const c of cards) {
    if (left <= 0) break
    left -= cardPoints(ci, c)
    state.warehouse.splice(state.warehouse.indexOf(c), 1)
  }
}

export { personName }
