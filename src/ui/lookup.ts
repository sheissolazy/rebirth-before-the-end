import type { GameState, CardInstance, PersonState, Rarity, CardDef, LocalizedText } from '../engine/types'
import { RARITY_POINTS } from '../engine/types'
import { content } from '../content'
import { lt, t } from '../i18n'

export const cardDefs = new Map<string, CardDef>(content.cards.map((c) => [c.id, c]))
export const npcDefs = new Map(content.npcs.map((n) => [n.id, n]))
export const moduleDefs = new Map(content.modules.map((m) => [m.id, m]))
export const petDefs = new Map(content.pets.map((p) => [p.id, p]))
export const locationDefs = new Map(content.locations.map((l) => [l.id, l]))
export const eventDefs = new Map(content.events.map((e) => [e.id, e]))

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'border-zinc-500 text-zinc-200',
  fine: 'border-emerald-500 text-emerald-300',
  rare: 'border-sky-500 text-sky-300',
  legendary: 'border-amber-400 text-amber-300',
}

export function cardName(inst: CardInstance): string {
  const def = cardDefs.get(inst.defId)
  if (!def) return inst.defId
  let name = `${def.icon ?? ''}${lt(def.name)}`
  if (inst.unitsLeft !== undefined) name += ` ×${inst.unitsLeft}`
  if (inst.spoiled) name += inst.spoiled >= 2 ? '（垃圾）' : '（过期）'
  if (inst.affixIds?.length) name += ` [${inst.affixIds.map((a) => lt(content.affixes.find((x) => x.id === a)?.name ?? { zh: a })).join(' ')}]`
  return name
}

export function personName(p: PersonState): string {
  return lt(p.generated?.name ?? npcDefs.get(p.defId ?? '')?.name ?? { zh: '？' })
}

export function personRarity(p: PersonState): Rarity {
  return p.generated?.rarity ?? npcDefs.get(p.defId ?? '')?.rarity ?? 'common'
}

export function isRomanceable(p: PersonState): boolean { return !!(p.defId && npcDefs.get(p.defId)?.romanceable) }

/** 槽位候选 id → 可读标签 */
export function optionLabel(state: GameState, id: string): string {
  if (id === 'hero') return lt(state.hero.name)
  const p = state.people[id]
  if (p) return personName(p)
  const pet = state.pets.find((x) => x.id === id)
  if (pet) return lt(petDefs.get(pet.defId)?.name ?? { zh: '宠物' })
  const c = state.warehouse.find((x) => x.instanceId === id) ?? state.hand.find((x) => x.instanceId === id)
  if (c) return cardName(c)
  return id
}

export function timeLabel(state: GameState): string {
  const tm = state.time
  return tm.phase === 'prologue' ? t('time.prologue', { weeks: tm.weeksBeforeEnd }) : t('time.apocalypse', { year: tm.year, month: tm.month, week: tm.week })
}

export function rarityLabel(r: Rarity): string { return t(`rarity.${r}` as const) }
export function points(r: Rarity): number { return RARITY_POINTS[r] }
export function L(x: LocalizedText | undefined): string { return x ? lt(x) : '' }
