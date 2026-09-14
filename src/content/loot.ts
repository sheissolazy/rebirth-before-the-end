import type { LootTableDef, AffixDef } from '../engine/types'

export const lootTables: LootTableDef[] = [
  // 超市废墟：吃的为主，货架上也有瓶装水和日用品
  { id: 'loot_market', affixChance: 0, entries: [
    { cardId: 'supply_rice_5kg', weight: 30 }, { cardId: 'supply_canned', weight: 22 }, { cardId: 'supply_compressed_biscuit', weight: 8 },
    { cardId: 'supply_water_box', weight: 15 }, { cardId: 'supply_coffee', weight: 6 }, { cardId: 'supply_soap', weight: 6 },
    { cardId: 'supply_energy_drink', weight: 4 }, { cardId: 'supply_water_tablets', weight: 3 }, { cardId: 'supply_battery', weight: 6 },
  ] },
  // 居民楼 / 派工搜刮：别人家里有什么就翻到什么——存粮、饮水、被子、药箱、拆下来的木板
  { id: 'loot_scavenge', affixChance: 0.3, entries: [
    { cardId: 'supply_rice_5kg', weight: 14 }, { cardId: 'supply_canned', weight: 10 }, { cardId: 'supply_water_box', weight: 14 },
    { cardId: 'supply_blanket', weight: 8 }, { cardId: 'supply_soap', weight: 8 }, { cardId: 'supply_bandage', weight: 8 }, { cardId: 'supply_battery', weight: 10 },
    { cardId: 'supply_wood', weight: 10 }, { cardId: 'supply_winter_clothes', weight: 4 }, { cardId: 'supply_bolts', weight: 4 },
    { cardId: 'equip_machete', weight: 4 }, { cardId: 'core_common', weight: 6 },
  ] },
  // 医院：药
  { id: 'loot_hospital', affixChance: 0, entries: [
    { cardId: 'supply_antibiotics', weight: 35 }, { cardId: 'supply_medkit', weight: 20 }, { cardId: 'supply_bandage', weight: 20 },
    { cardId: 'supply_vitamins', weight: 5 }, { cardId: 'supply_water_box', weight: 8 }, { cardId: 'core_common', weight: 12 },
  ] },
  { id: 'loot_zombie', affixChance: 0, entries: [
    { cardId: 'core_common', weight: 80 }, { cardId: 'core_fine', weight: 20 },
  ] },
  // 农场：种子、鸡蛋、井水
  { id: 'loot_farm', affixChance: 0, entries: [
    { cardId: 'supply_seed_veg', weight: 30 }, { cardId: 'supply_seed_potato', weight: 20 }, { cardId: 'supply_seed_sapling', weight: 8 },
    { cardId: 'supply_rice_5kg', weight: 12 }, { cardId: 'supply_eggs', weight: 15 }, { cardId: 'supply_well_water', weight: 15 },
  ] },
  // 工厂：建材、柴油、工具
  { id: 'loot_factory', affixChance: 0.5, entries: [
    { cardId: 'supply_steel', weight: 45 }, { cardId: 'supply_cement', weight: 10 }, { cardId: 'supply_battery', weight: 12 }, { cardId: 'supply_gasoline', weight: 12 },
    { cardId: 'equip_machete', weight: 6 }, { cardId: 'equip_axe', weight: 6 }, { cardId: 'equip_crossbow', weight: 3 }, { cardId: 'core_common', weight: 6 },
  ] },
  // 加油站：油，和便利店货架上的零食饮料
  { id: 'loot_gas', affixChance: 0, entries: [
    { cardId: 'supply_gasoline', weight: 35 }, { cardId: 'supply_energy_drink', weight: 18 }, { cardId: 'supply_coffee', weight: 10 },
    { cardId: 'supply_canned', weight: 10 }, { cardId: 'supply_water_box', weight: 10 }, { cardId: 'supply_battery', weight: 10 }, { cardId: 'supply_soap', weight: 7 },
  ] },
]

export const affixes: AffixDef[] = [
  { id: 'affix_sharp', name: { zh: '锋利' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
  { id: 'affix_sturdy', name: { zh: '结实' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
  { id: 'affix_bloody', name: { zh: '带血' }, desc: { zh: '+2 骰，但暴露 +1' }, bonusDice: 2, effects: [{ type: 'stat', stat: 'exposure', delta: 1 }] },
  { id: 'affix_silent', name: { zh: '消音' }, desc: { zh: '+1 骰' }, bonusDice: 1 },
]
