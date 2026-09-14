import type { GameState, EventDef, CardFilter, Placement, Outcome, EventResult, Attr, WeekReport, SlotDef } from '../types'
import { RARITY_ORDER } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { checkAll } from './conditions'
import { applyEffects, type EffectCtx } from './effects'
import {
  attrSum, equipmentDice, effectiveRarity, rarityIndex, affectionRank, rankIndex, isRomanceable, isCompanion, findCard, removeCard,
} from './helpers'
import { EngineError } from '../api'

const DRAWS_PER_LOCATION = 3

/** 每周为每个地点抽事件 */
export function drawEvents(ci: ContentIndex, state: GameState, rng: Rng): void {
  const drawn: Record<string, string[]> = {}
  const inProgress = new Set(state.placements.map((p) => p.eventId))
  for (const loc of ci.pack.locations) {
    if (loc.phase !== 'both' && loc.phase !== state.time.phase) continue
    const pool = ci.pack.events.filter((e) => !e.instant && e.locationId === loc.id && isEventEligible(ci, state, e, rng))
    const fixed = pool.filter((e) => e.weight <= 0 || inProgress.has(e.id))
    let random = pool.filter((e) => e.weight > 0 && !inProgress.has(e.id))
    const picked: EventDef[] = [...fixed]
    for (let i = 0; i < DRAWS_PER_LOCATION && random.length; i++) {
      const e = rng.weighted(random, (x) => x.weight)
      if (!e) break
      picked.push(e)
      random = random.filter((x) => x !== e)
    }
    drawn[loc.id] = picked.map((e) => e.id)
  }
  state.drawnEvents = drawn
}

/** 周初抽一个即时选择事件（50% 概率） */
export function drawChoice(ci: ContentIndex, state: GameState, rng: Rng): void {
  state.pendingChoice = null
  if (!rng.chance(0.5)) return
  const pool = ci.pack.events.filter((e) => e.instant && e.choices?.length && isEventEligible(ci, state, e, rng))
  const e = rng.weighted(pool, (x) => Math.max(1, x.weight))
  if (e) state.pendingChoice = e.id
}

export function resolveChoice(ci: ContentIndex, state: GameState, rng: Rng, choiceId: string): EventResult {
  if (!state.pendingChoice) throw new EngineError('NO_CHOICE', 'no pending choice')
  const e = ci.event(state.pendingChoice)
  const choice = e.choices?.find((c) => c.id === choiceId)
  if (!choice) throw new EngineError('NO_CHOICE', choiceId)
  if (choice.conditions && !checkAll(ci, state, choice.conditions, rng)) throw new EngineError('NOT_ELIGIBLE', choiceId)
  let dice = 0, successes = 0
  let outcome: Outcome = 'fine'
  if (choice.check) {
    dice = Math.max(0, BASE_DICE + attrSum(state.hero.attrs, choice.check.attrs) + equipmentDice(ci, state, state.hero.equipment, choice.check.attrs) - (state.hero.health <= 3 ? 1 : 0))
    successes = rng.roll(dice, choice.check.successChance ?? 0.5)
    outcome = outcomeFromSuccesses(successes, choice.check.legendaryAt)
  }
  const picked = pickBranch(choice, outcome)
  applyEffects({ ci, state, rng, actorId: 'hero' }, picked.branch.effects)
  if (e.once) state.usedOnceEvents.push(e.id)
  state.pendingChoice = null
  state.diary.push({ turn: state.turn, text: picked.branch.text })
  return { eventId: e.id, outcome: picked.outcome, successes, diceCount: dice, text: picked.branch.text, effects: picked.branch.effects }
}

export function isEventEligible(ci: ContentIndex, state: GameState, e: EventDef, rng?: Rng): boolean {
  if (e.once && state.usedOnceEvents.includes(e.id)) return false
  if (ci.lockedEvents.has(e.id) && !state.unlockedEvents.includes(e.id)) return false
  return checkAll(ci, state, e.conditions, rng)
}

export function availableEvents(ci: ContentIndex, state: GameState): EventDef[] {
  const ids = Object.values(state.drawnEvents).flat()
  return ids.map((id) => ci.events.get(id)).filter((e): e is EventDef => !!e)
}

/** 已被本周其它放卡占用的 id（主角可以多次参与，靠精力限制） */
function assignedIds(state: GameState): Set<string> {
  const s = new Set<string>()
  for (const p of state.placements) for (const v of Object.values(p.assignments)) if (v !== 'hero') s.add(v)
  return s
}

export function eventEnergy(e: EventDef): number { return e.energy ?? 2 }

export function eligibleForSlot(ci: ContentIndex, state: GameState, slot: SlotDef, exclude: Set<string>, event?: EventDef): string[] {
  const f: CardFilter = slot.accepts
  const equipped = new Set([...Object.values(state.hero.equipment), ...Object.values(state.people).flatMap((p) => Object.values(p.equipment))])
  const out: string[] = []
  switch (f.kind) {
    case 'hero':
      if (state.hero.incapacitatedWeeks <= 0 && state.hero.energy >= (event ? eventEnergy(event) : 1)) out.push('hero')
      break
    case 'person':
      if (state.hero.incapacitatedWeeks <= 0 && state.hero.energy >= (event ? eventEnergy(event) : 1)) out.push('hero')
      for (const p of Object.values(state.people)) {
        if (!p.alive || !p.inBase || p.busyWithEventId || exclude.has(p.id) || p.injury >= 2) continue
        out.push(p.id)
      }
      break
    case 'npc':
      for (const p of Object.values(state.people)) {
        if (!p.alive || p.busyWithEventId || exclude.has(p.id)) continue
        if (f.npcId && p.id !== f.npcId) continue
        const rom = isRomanceable(ci, p)
        if (f.romanceable !== undefined && rom !== f.romanceable) continue
        if (!rom && !p.inBase) continue
        if (f.minRank && rankIndex(affectionRank(p.affection)) < rankIndex(f.minRank)) continue
        out.push(p.id)
      }
      break
    case 'companion':
      for (const p of Object.values(state.people)) {
        if (!p.alive || !p.inBase || p.busyWithEventId || exclude.has(p.id)) continue
        if (!isCompanion(ci, p) && !p.inBase) continue
        if (f.minLoyalty !== undefined && p.loyalty < f.minLoyalty) continue
        out.push(p.id)
      }
      break
    case 'pet':
      for (const p of state.pets) {
        if (!p.alive || exclude.has(p.id)) continue
        if (f.species && ci.pets.get(p.defId)?.species !== f.species) continue
        out.push(p.id)
      }
      break
    case 'supply':
    case 'equipment':
    case 'core':
      for (const c of state.warehouse) {
        if (exclude.has(c.instanceId) || equipped.has(c.instanceId)) continue
        const def = ci.card(c.defId)
        if (def.kind !== f.kind) continue
        const er = effectiveRarity(ci, c)
        if (!er) continue
        if (f.kind === 'supply' && def.kind === 'supply') {
          if (f.supplyKind && def.supplyKind !== f.supplyKind) continue
          if (f.minRarity && rarityIndex(er) < rarityIndex(f.minRarity)) continue
        }
        if (f.kind === 'equipment' && def.kind === 'equipment' && f.slot && def.slot !== f.slot) continue
        if (f.kind === 'core' && f.minRarity && rarityIndex(er) < rarityIndex(f.minRarity)) continue
        out.push(c.instanceId)
      }
      break
    case 'intel':
    case 'trouble':
      for (const c of state.hand) if (!exclude.has(c.instanceId) && ci.card(c.defId).kind === f.kind) out.push(c.instanceId)
      break
    case 'skill':
      for (const c of state.hand) {
        if (exclude.has(c.instanceId)) continue
        const def = ci.card(c.defId)
        if (def.kind !== 'skill') continue
        if (f.ownerId && def.ownerId !== f.ownerId) continue
        if (def.ownerId !== 'hero') {
          const owner = state.people[def.ownerId]
          if (!owner?.alive) continue
          if (!owner.inBase && rankIndex(affectionRank(owner.affection)) < rankIndex('friend')) continue
        }
        out.push(c.instanceId)
      }
      break
  }
  return out
}

export function eligibleCards(ci: ContentIndex, state: GameState, eventId: string, slotId: string): string[] {
  const e = ci.event(eventId)
  const slot = e.slots.find((s) => s.id === slotId)
  if (!slot) throw new EngineError('NO_SLOT', `slot ${slotId} not in ${eventId}`)
  return eligibleForSlot(ci, state, slot, assignedIds(state), e)
}

export function place(ci: ContentIndex, state: GameState, placement: Omit<Placement, 'startedTurn' | 'resolvesAtTurn'>): void {
  const e = ci.event(placement.eventId)
  if (!Object.values(state.drawnEvents).flat().includes(e.id)) throw new EngineError('NOT_AVAILABLE', `${e.id} not on the map this week`)
  if (state.placements.some((p) => p.eventId === e.id)) throw new EngineError('ALREADY_PLACED', `${e.id} already placed`)
  const exclude = assignedIds(state)
  const usedHere = new Set<string>()
  for (const slot of e.slots) {
    const v = placement.assignments[slot.id]
    if (!v) {
      if (slot.required) throw new EngineError('SLOT_REQUIRED', `slot ${slot.id} required`)
      continue
    }
    if (usedHere.has(v)) throw new EngineError('DUPLICATE', `${v} used twice`)
    const ok = eligibleForSlot(ci, state, slot, exclude, e)
    if (!ok.includes(v)) throw new EngineError('NOT_ELIGIBLE', v === 'hero' ? `精力不够（需要 ${eventEnergy(e)}）` : `${v} cannot go in ${slot.id}`)
    usedHere.add(v)
  }
  if (usedHere.has('hero')) state.hero.energy -= eventEnergy(e)
  for (const v of usedHere) if (state.people[v]) state.people[v].busyWithEventId = e.id
  state.placements.push({ eventId: e.id, assignments: { ...placement.assignments }, startedTurn: state.turn, resolvesAtTurn: state.turn + Math.max(1, e.durationWeeks) })
}

export function unplace(ci: ContentIndex, state: GameState, eventId: string): void {
  const i = state.placements.findIndex((p) => p.eventId === eventId)
  if (i < 0) throw new EngineError('NOT_PLACED', `${eventId} not placed`)
  if (state.placements[i].startedTurn !== state.turn) throw new EngineError('IN_PROGRESS', `${eventId} already in progress`)
  const p = state.placements.splice(i, 1)[0]
  for (const v of Object.values(p.assignments)) if (state.people[v]) state.people[v].busyWithEventId = undefined
  if (Object.values(p.assignments).includes('hero')) state.hero.energy += eventEnergy(ci.event(eventId))
}

/** 每次检定固定加的基础骰（常识和运气），让低属性也有成长机会 */
export const BASE_DICE = 2
/** 成功数分档：0 失败 / 1~2 普通 / 3~5 优良 / 6~7 稀有 / 8+ 传说（事件可自定传说线） */
export const RARE_AT = 6
export const LEGENDARY_AT = 8

export function outcomeFromSuccesses(s: number, legendaryAt?: number): Outcome {
  if (s >= (legendaryAt ?? LEGENDARY_AT)) return 'legendary'
  if (s >= RARE_AT) return 'rare'
  if (s >= 3) return 'fine'
  if (s >= 1) return 'common'
  return 'fail'
}

const OUTCOME_ORDER: Outcome[] = ['fail', 'common', 'fine', 'rare', 'legendary']

export function pickBranch(e: { outcomes: EventDef['outcomes'] }, o: Outcome) {
  let i = OUTCOME_ORDER.indexOf(o)
  while (i >= 0) {
    const b = e.outcomes[OUTCOME_ORDER[i]]
    if (b) return { outcome: OUTCOME_ORDER[i], branch: b }
    i--
  }
  return { outcome: 'fine' as Outcome, branch: e.outcomes.fine }
}

/** 一张卡放进白槽加几骰：物资按稀有度（普通/优良 = 槽位基础，稀有 +1，传说 +2），装备按自身加成+词缀，技能按自身 */
export function cardDice(ci: ContentIndex, state: GameState, card: { defId: string; affixIds?: string[]; spoiled?: number }, slot: SlotDef, attrs: Attr[]): number {
  const def = ci.card(card.defId)
  const base = slot.bonusDice ?? (def.kind === 'supply' ? 1 : 0)
  if (def.kind === 'supply') {
    const r = effectiveRarity(ci, card as never) ?? 'common'
    return base + [0, 0, 1, 2][rarityIndex(r)]
  }
  if (def.kind === 'equipment') {
    let d = (!def.forAttr || attrs.includes(def.forAttr)) ? def.bonusDice : Math.floor(def.bonusDice / 2)
    for (const a of card.affixIds ?? []) d += ci.affixes.get(a)?.bonusDice ?? 0
    return d + (slot.bonusDice ?? 0)
  }
  if (def.kind === 'skill') return ((!def.forAttr || attrs.includes(def.forAttr)) ? def.bonusDice ?? 0 : 0) + (slot.bonusDice ?? 0)
  if (def.kind === 'core') return base + rarityIndex(def.rarity)
  void state
  return base
}

export function diceFor(ci: ContentIndex, state: GameState, e: EventDef, p: Placement): number {
  if (!e.check) return 0
  const attrs: Attr[] = e.check.attrs
  let dice = BASE_DICE
  for (const slot of e.slots) {
    const v = p.assignments[slot.id]
    if (!v) continue
    if (v === 'hero') dice += attrSum(state.hero.attrs, attrs) + equipmentDice(ci, state, state.hero.equipment, attrs)
    else if (state.people[v]) {
      // 带队的人算全属性；同行的人只算一半（不然检定太容易）
      const person = state.people[v]
      const isLeader = slot.accepts.kind === 'person'
      const base = attrSum(person.attrs, attrs)
      dice += (isLeader ? base : Math.max(1, Math.floor(base / 2))) + equipmentDice(ci, state, person.equipment, attrs) - person.injury
    }
    else if (state.pets.some((x) => x.id === v)) dice += slot.bonusDice ?? 0
    else {
      const card = findCard(state, v)
      if (card) dice += cardDice(ci, state, card, slot, attrs)
    }
  }
  if (state.hero.health <= 3) dice -= 1
  return Math.max(0, dice)
}

export function resolvePlacement(ci: ContentIndex, state: GameState, rng: Rng, p: Placement, report: WeekReport): EventResult {
  const e = ci.event(p.eventId)
  let successes = 0
  const dice = diceFor(ci, state, e, p)
  let outcome: Outcome = 'fine'
  if (e.check) {
    successes = rng.roll(dice, e.check.successChance ?? 0.5)
    outcome = outcomeFromSuccesses(successes, e.check.legendaryAt)
  }
  const picked = pickBranch(e, outcome)
  // 消耗
  for (const slot of e.slots) {
    const v = p.assignments[slot.id]
    if (!v) continue
    if (state.people[v]) state.people[v].busyWithEventId = undefined
    else if (slot.consumes || ci.cards.get(findCard(state, v)?.defId ?? '')?.kind === 'intel') removeCard(state, v)
  }
  const heroPresent = Object.values(p.assignments).includes('hero')
  const leaderSlot = e.slots.find((s) => s.accepts.kind === 'person' || s.accepts.kind === 'hero')
  const leader = leaderSlot ? p.assignments[leaderSlot.id] : undefined
  const actor = (leader && leader !== 'hero' && state.people[leader]) ? leader : Object.values(p.assignments).find((v) => v !== 'hero' && state.people[v])
  const ctx: EffectCtx = { ci, state, rng, report, actorId: actor ?? 'hero', heroPresent }
  applyEffects(ctx, picked.branch.effects)
  // 同行涨好感/忠诚
  for (const v of Object.values(p.assignments)) {
    const person = state.people[v]
    if (!person) continue
    if (isRomanceable(ci, person)) person.affection = Math.min(100, person.affection + 2)
    else person.loyalty = Math.min(100, person.loyalty + 1)
  }
  if (e.once) state.usedOnceEvents.push(e.id)
  if (e.id === 'ev_office_work') state.hero.skippedWorkStreak = 0
  return { eventId: e.id, outcome: picked.outcome, successes, diceCount: dice, text: picked.branch.text, effects: picked.branch.effects }
}

export { RARITY_ORDER }
