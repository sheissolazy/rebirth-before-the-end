import type { LootTableDef, AffixDef } from '../engine/types'

export const lootTables: LootTableDef[] = [
  { id: 'loot_market', affixChance: 0, entries: [
    { cardId: 'supply_rice_5kg', weight: 25 }, { cardId: 'supply_water_box', weight: 35 }, { cardId: 'supply_canned', weight: 15 }, { cardId: 'supply_compressed_biscuit', weight: 8 },
    { cardId: 'supply_water_tablets', weight: 7 }, { cardId: 'supply_battery', weight: 10 }, { cardId: 'supply_winter_clothes', weight: 5 },
  ] },
  { id: 'loot_scavenge', affixChance: 0.3, entries: [
    { cardId: 'supply_rice_5kg', weight: 18 }, { cardId: 'supply_water_box', weight: 25 }, { cardId: 'supply_canned', weight: 10 }, { cardId: 'supply_antibiotics', weight: 6 },
    { cardId: 'supply_battery', weight: 15 }, { cardId: 'supply_steel', weight: 15 }, { cardId: 'supply_bolts', weight: 10 },
    { cardId: 'equip_machete', weight: 5 }, { cardId: 'core_common', weight: 7 },
  ] },
  { id: 'loot_hospital', affixChance: 0, entries: [
    { cardId: 'supply_antibiotics', weight: 50 }, { cardId: 'supply_water_box', weight: 20 }, { cardId: 'supply_battery', weight: 10 }, { cardId: 'core_common', weight: 20 },
  ] },
  { id: 'loot_zombie', affixChance: 0, entries: [
    { cardId: 'core_common', weight: 80 }, { cardId: 'core_fine', weight: 20 },
  ] },
  { id: 'loot_farm', affixChance: 0, entries: [
    { cardId: 'supply_seed_veg', weight: 35 }, { cardId: 'supply_seed_potato', weight: 25 }, { cardId: 'supply_seed_sapling', weight: 10 }, { cardId: 'supply_rice_5kg', weight: 15 }, { cardId: 'supply_eggs', weight: 15 },
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
