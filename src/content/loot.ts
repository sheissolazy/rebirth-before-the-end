import type { LootTableDef, AffixDef } from '../engine/types'

export const lootTables: LootTableDef[] = [
  { id: 'loot_market', affixChance: 0, entries: [
    { cardId: 'supply_rice_5kg', weight: 30 }, { cardId: 'supply_water_box', weight: 30 }, { cardId: 'supply_compressed_biscuit', weight: 10 },
    { cardId: 'supply_battery', weight: 20 }, { cardId: 'supply_winter_clothes', weight: 10 },
  ] },
  { id: 'loot_scavenge', affixChance: 0.3, entries: [
    { cardId: 'supply_rice_5kg', weight: 20 }, { cardId: 'supply_water_box', weight: 20 }, { cardId: 'supply_antibiotics', weight: 8 },
    { cardId: 'supply_battery', weight: 15 }, { cardId: 'supply_steel', weight: 15 }, { cardId: 'supply_bolts', weight: 10 },
    { cardId: 'equip_machete', weight: 5 }, { cardId: 'core_common', weight: 7 },
  ] },
  { id: 'loot_hospital', affixChance: 0, entries: [
    { cardId: 'supply_antibiotics', weight: 50 }, { cardId: 'supply_water_box', weight: 20 }, { cardId: 'supply_battery', weight: 10 }, { cardId: 'core_common', weight: 20 },
  ] },
  { id: 'loot_zombie', affixChance: 0, entries: [
    { cardId: 'core_common', weight: 80 }, { cardId: 'core_fine', weight: 20 },
  ] },
  { id: 'loot_factory', affixChance: 0.5, entries: [
    { cardId: 'supply_steel', weight: 50 }, { cardId: 'supply_battery', weight: 20 }, { cardId: 'equip_machete', weight: 15 }, { cardId: 'equip_crossbow', weight: 5 }, { cardId: 'core_common', weight: 10 },
  ] },
]

export const affixes: AffixDef[] = [
  { id: 'affix_sharp', name: { zh: '锋利' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
  { id: 'affix_sturdy', name: { zh: '结实' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
  { id: 'affix_bloody', name: { zh: '带血' }, desc: { zh: '+2 骰，但暴露 +1' }, bonusDice: 2, effects: [{ type: 'stat', stat: 'exposure', delta: 1 }] },
  { id: 'affix_silent', name: { zh: '消音' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
]
