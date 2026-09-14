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

/** 在路上的网购占的格数 */
export function reservedStorage(ci: ContentIndex, state: GameState): number {
  return state.orders.reduce((t, o) => t + cardSize(ci, { instanceId: '', defId: o.cardDefId }) * o.count, 0)
}

export function baseDefense(ci: ContentIndex, state: GameState): number {
  const base = ci.bases.get(state.base.type)
  let d = base?.baseDefense ?? 0
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) if (e.type === 'defense') d += e.value
  }
  // 基地里的每个人都算：体力/2；守卫再 +2；你自己体力/2 + 装备武器加成
  for (const p of Object.values(state.people)) if (p.alive && p.inBase) d += Math.floor(p.attrs.strength / 2) + (p.job === 'guard' ? 2 : 0)
  d += Math.floor(state.hero.attrs.strength / 2) + equipmentDice(ci, state, state.hero.equipment, ['strength'])
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

/** 危机分账本 */
export function crisisBreakdown(ci: ContentIndex, state: GameState, kind: CrisisKind): Array<{ label: { zh: string }; points: number }> {
  const items: Array<{ label: { zh: string }; points: number }> = []
  const kinds = CRISIS_ACCEPTS[kind]
  const byKind: Record<string, number> = {}
  for (const inst of state.warehouse) {
    const def = ci.card(inst.defId)
    if (def.kind === 'supply' && kinds.includes(def.supplyKind)) byKind[def.supplyKind] = (byKind[def.supplyKind] ?? 0) + cardPoints(ci, inst)
  }
  const KIND_ZH: Record<string, string> = { food: '食物', water: '水', medicine: '药品', energy: '能源', weapon: '武器', material: '材料', daily: '日用', seed: '种子' }
  for (const k of kinds) items.push({ label: { zh: `${KIND_ZH[k]}物资` }, points: byKind[k] ?? 0 })
  for (const m of state.base.modules) {
    if (m.damaged) continue
    const def = ci.modules.get(m.moduleId)
    for (const e of def?.provides ?? []) if (e.type === 'counters' && e.crisisKind === kind) items.push({ label: { zh: `模块：${def?.name.zh}` }, points: e.points })
  }
  if (kind === 'horde' || kind === 'human') {
    const base = ci.bases.get(state.base.type)
    items.push({ label: { zh: `基地基础（${base?.name.zh ?? ''}）` }, points: base?.baseDefense ?? 0 })
    for (const m of state.base.modules) {
      if (m.damaged) continue
      const def = ci.modules.get(m.moduleId)
      for (const e of def?.provides ?? []) if (e.type === 'defense') items.push({ label: { zh: `模块：${def?.name.zh}` }, points: e.value })
    }
    items.push({ label: { zh: `你（体力 ${state.hero.attrs.strength}${Object.keys(state.hero.equipment).length ? '，含武器' : ''}）` }, points: Math.floor(state.hero.attrs.strength / 2) + equipmentDice(ci, state, state.hero.equipment, ['strength']) })
    for (const p of Object.values(state.people)) if (p.alive && p.inBase) items.push({ label: { zh: `${p.job === 'guard' ? '守卫' : '在家'}：${personName(ci, p).zh}（体力 ${p.attrs.strength}）` }, points: Math.floor(p.attrs.strength / 2) + (p.job === 'guard' ? 2 : 0) })
    for (const pet of state.pets) if (pet.alive && ci.pets.get(pet.defId)?.species === 'dog') items.push({ label: { zh: '狗' }, points: 1 })
  }
  return items
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

export function populationCap(ci: ContentIndex, state: GameState): number {
  let cap = ci.bases.get(state.base.type)?.population ?? 3
  for (const m of state.base.modules) if (!m.damaged) for (const e of ci.modules.get(m.moduleId)?.provides ?? []) if (e.type === 'population') cap += e.value
  return cap
}
export function population(state: GameState): number {
  return 1 + Object.values(state.people).filter((p) => p.alive && p.inBase).length
}

/** 冷藏：序章电网正常；末日后要有冷库、或任何产能源的模块（有电就有冰箱） */
export function hasCold(ci: ContentIndex, state: GameState): boolean {
  if (state.time.phase === 'prologue') return true
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) {
      if (e.type === 'unlock' && e.feature === 'cold') return true
      if (e.type === 'produce' && e.supplyKind === 'energy') return true
    }
  }
  return false
}

/** 好感上限：序章男主不信你，最多到朋友（39）；江野例外到暧昧（59）。末日后 100 */
export function affectionCap(state: GameState, npcId: string): number {
  if (state.time.phase !== 'prologue') return 100
  return npcId === 'jiangye' ? 59 : 39
}

/** 精力上限 = 3 + 体力/2 + 永久加成 */
export function energyMax(state: GameState): number {
  return Math.max(1, 3 + Math.floor(state.hero.attrs.strength / 2) + state.hero.energyBonus)
}
