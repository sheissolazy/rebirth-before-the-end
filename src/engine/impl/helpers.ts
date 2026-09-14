import type {
  GameState, CardInstance, Rarity, SupplyKind, CrisisKind, Attr, Attrs, PersonState, AffectionRank, EquipSlot,
} from '../types'
import { RARITY_ORDER, RARITY_POINTS, AFFECTION_THRESHOLDS, SPACE_CAPACITY, CRISIS_ACCEPTS } from '../types'
import type { ContentIndex } from './content'

export function rarityIndex(r: Rarity): number { return RARITY_ORDER.indexOf(r) }
export function shiftRarity(r: Rarity, delta: number): Rarity {
  const i = Math.max(0, Math.min(RARITY_ORDER.length - 1, rarityIndex(r) + delta))
  return RARITY_ORDER[i]
}

/** 卡牌实例的有效稀有度（过期降档） */
export function effectiveRarity(ci: ContentIndex, inst: CardInstance): Rarity | null {
  const def = ci.card(inst.defId)
  const spoiled = inst.spoiled ?? 0
  if (spoiled >= 2) return null
  return shiftRarity(def.rarity, -spoiled)
}

export function cardPoints(ci: ContentIndex, inst: CardInstance): number {
  const r = effectiveRarity(ci, inst)
  return r ? RARITY_POINTS[r] : 0
}

export function cardSize(ci: ContentIndex, inst: CardInstance): number {
  const def = ci.card(inst.defId)
  if (def.kind === 'supply' || def.kind === 'trouble') return def.size
  if (def.kind === 'equipment') return 1
  return 1
}

export function supplyPoints(ci: ContentIndex, state: GameState, kinds: SupplyKind[]): number {
  let p = 0
  for (const inst of state.warehouse) {
    const def = ci.card(inst.defId)
    if (def.kind === 'supply' && kinds.includes(def.supplyKind)) p += cardPoints(ci, inst)
  }
  return p
}

export function baseStorage(ci: ContentIndex, state: GameState): number {
  const base = ci.bases.get(state.base.type)
  let cap = base?.storage ?? 0
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) if (e.type === 'storage') cap += e.value
  }
  return cap
}

export function spaceStorage(state: GameState): number { return SPACE_CAPACITY[state.hero.spaceRarity] }

export function usedStorage(ci: ContentIndex, state: GameState, inSpace: boolean): number {
  return state.warehouse.filter((c) => !!c.inSpace === inSpace).reduce((s, c) => s + cardSize(ci, c), 0)
}

export function hasRoom(ci: ContentIndex, state: GameState, size: number, inSpace = false): boolean {
  const cap = inSpace ? spaceStorage(state) : baseStorage(ci, state)
  return usedStorage(ci, state, inSpace) + size <= cap
}

export function baseDefense(ci: ContentIndex, state: GameState): number {
  const base = ci.bases.get(state.base.type)
  let d = base?.baseDefense ?? 0
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) if (e.type === 'defense') d += e.value
  }
  for (const p of Object.values(state.people)) if (p.alive && p.inBase && p.job === 'guard') d += 2 + Math.floor(p.attrs.strength / 3)
  for (const pet of state.pets) if (pet.alive && ci.pets.get(pet.defId)?.species === 'dog') d += 1
  return d
}

export function moduleCounters(ci: ContentIndex, state: GameState, kind: CrisisKind): number {
  let p = 0
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) if (e.type === 'counters' && e.crisisKind === kind) p += e.points
  }
  return p
}

/** 顶危机的总分 */
export function crisisPoints(ci: ContentIndex, state: GameState, kind: CrisisKind): number {
  let p = supplyPoints(ci, state, CRISIS_ACCEPTS[kind]) + moduleCounters(ci, state, kind)
  if (kind === 'horde' || kind === 'human') p += baseDefense(ci, state)
  return p
}

export function affectionRank(v: number): AffectionRank {
  let rank: AffectionRank = 'stranger'
  for (const [r, th] of Object.entries(AFFECTION_THRESHOLDS) as [AffectionRank, number][]) if (v >= th) rank = r
  return rank
}
export function rankIndex(r: AffectionRank): number { return Object.keys(AFFECTION_THRESHOLDS).indexOf(r) }

export function isRomanceable(ci: ContentIndex, p: PersonState): boolean {
  return !!(p.defId && ci.npcs.get(p.defId)?.romanceable)
}
export function isCompanion(ci: ContentIndex, p: PersonState): boolean {
  return !isRomanceable(ci, p)
}

export function personName(ci: ContentIndex, p: PersonState) {
  return p.generated?.name ?? ci.npcs.get(p.defId ?? '')?.name ?? { zh: '？' }
}

export function attrSum(attrs: Attrs, keys: Attr[]): number {
  return keys.reduce((s, k) => s + (attrs[k] ?? 0), 0)
}

/** 装备加骰 */
export function equipmentDice(ci: ContentIndex, state: GameState, equipment: Partial<Record<EquipSlot, string>>, attrs: Attr[]): number {
  let d = 0
  for (const instId of Object.values(equipment)) {
    const inst = state.warehouse.find((c) => c.instanceId === instId)
    if (!inst) continue
    const def = ci.card(inst.defId)
    if (def.kind !== 'equipment') continue
    if (!def.forAttr || attrs.includes(def.forAttr)) d += def.bonusDice
    for (const a of inst.affixIds ?? []) d += ci.affixes.get(a)?.bonusDice ?? 0
  }
  return d
}

export function findCard(state: GameState, instanceId: string): CardInstance | undefined {
  return state.warehouse.find((c) => c.instanceId === instanceId) ?? state.hand.find((c) => c.instanceId === instanceId)
}

export function removeCard(state: GameState, instanceId: string): CardInstance | undefined {
  let i = state.warehouse.findIndex((c) => c.instanceId === instanceId)
  if (i >= 0) return state.warehouse.splice(i, 1)[0]
  i = state.hand.findIndex((c) => c.instanceId === instanceId)
  if (i >= 0) return state.hand.splice(i, 1)[0]
  return undefined
}

export function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)) }
