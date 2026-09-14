import type { BaseDef, ModuleDef } from '../engine/types'

export const bases: BaseDef[] = [
  { type: 'apartment', name: { zh: '出租屋' }, desc: { zh: '六楼，两室一厅。' }, icon: '🏠', price: 0, baseDefense: 2, storage: 30, population: 3 },
  { type: 'villa', name: { zh: '别墅' }, desc: { zh: '带院子的独栋。' }, icon: '🏡', price: 3_000_000, baseDefense: 5, storage: 60, population: 6 },
  { type: 'farmhouse', name: { zh: '郊区自建房' }, desc: { zh: '有地，有井，离城远。' }, icon: '🌾', price: 1_500_000, baseDefense: 6, storage: 100, population: 12 },
  { type: 'bunker', name: { zh: '地下堡垒' }, desc: { zh: '冷战遗留的防空洞改造。' }, icon: '🛡️', price: 20_000_000, baseDefense: 12, storage: 200, population: 20 },
]

/** 每种基地独立的模块表（首版 31 个）。cost.materialPoints 按物资分算。 */
export const modules: ModuleDef[] = [
  // 出租屋
  { id: 'apt_windows', baseType: 'apartment', name: { zh: '加固门窗' }, desc: { zh: '钢条和木板。' }, icon: '🪟', cost: { materialPoints: 4, labor: 1, weeks: 1 }, provides: [{ type: 'defense', value: 2 }] },
  { id: 'apt_storage', baseType: 'apartment', name: { zh: '储物间' }, desc: { zh: '清空杂物间。' }, icon: '📦', cost: { materialPoints: 2, labor: 1, weeks: 1 }, provides: [{ type: 'storage', value: 6 }] },
  { id: 'apt_balcony', baseType: 'apartment', name: { zh: '阳台菜箱' }, desc: { zh: '种点葱和青菜。' }, icon: '🥬', cost: { materialPoints: 2, labor: 1, weeks: 1, requires: [{ cardId: 'supply_seed_veg', count: 1 }] }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_veg', perWeek: 1 }] },
  { id: 'apt_solar', baseType: 'apartment', name: { zh: '太阳能板' }, desc: { zh: '晴天能充电。' }, icon: '☀️', cost: { materialPoints: 6, labor: 1, weeks: 1, money: 8000 }, provides: [{ type: 'produce', supplyKind: 'energy', cardId: 'supply_battery', perWeek: 1 }] },
  { id: 'apt_barricade', baseType: 'apartment', name: { zh: '楼道路障' }, desc: { zh: '把整层楼封起来。' }, icon: '🚧', cost: { materialPoints: 6, labor: 2, weeks: 2 }, provides: [{ type: 'defense', value: 3 }, { type: 'counters', crisisKind: 'horde', points: 2 }] },
  // 别墅
  { id: 'villa_wall', baseType: 'villa', name: { zh: '围墙' }, desc: { zh: '加高加刺。' }, icon: '🧱', cost: { materialPoints: 10, labor: 3, weeks: 2 }, provides: [{ type: 'defense', value: 4 }] },
  { id: 'villa_gate', baseType: 'villa', name: { zh: '铁门' }, desc: { zh: '双层。' }, icon: '🚪', cost: { materialPoints: 6, labor: 2, weeks: 1 }, provides: [{ type: 'defense', value: 2 }] },
  { id: 'villa_garden', baseType: 'villa', name: { zh: '院子菜地' }, desc: { zh: '够两个人吃。' }, icon: '🥕', cost: { materialPoints: 3, labor: 2, weeks: 2, requires: [{ cardId: 'supply_seed_veg', count: 2 }] }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_veg', perWeek: 2 }] },
  { id: 'villa_well', baseType: 'villa', name: { zh: '水井' }, desc: { zh: '打井队最后一单。' }, icon: '🕳️', cost: { materialPoints: 8, labor: 3, weeks: 2, money: 30000 }, provides: [{ type: 'produce', supplyKind: 'water', cardId: 'supply_well_water', perWeek: 3 }] },
  { id: 'villa_genroom', baseType: 'villa', name: { zh: '发电机房' }, desc: { zh: '隔音，安全。' }, icon: '⚡', cost: { materialPoints: 8, labor: 2, weeks: 2 }, provides: [{ type: 'produce', supplyKind: 'energy', cardId: 'supply_battery', perWeek: 2 }] },
  { id: 'villa_workshop', baseType: 'villa', name: { zh: '车库工坊' }, desc: { zh: '修东西、造弩箭。' }, icon: '🛠️', cost: { materialPoints: 8, labor: 2, weeks: 2 }, provides: [{ type: 'produce', supplyKind: 'weapon', cardId: 'supply_bolts', perWeek: 1 }] },
  { id: 'villa_kennel', baseType: 'villa', name: { zh: '犬舍' }, desc: { zh: '狗的家。' }, icon: '🐕', cost: { materialPoints: 3, labor: 1, weeks: 1 }, provides: [{ type: 'defense', value: 1 }] },
  // 郊区自建房
  { id: 'farm_fence', baseType: 'farmhouse', name: { zh: '围栏' }, desc: { zh: '铁丝网加木桩。' }, icon: '🪵', cost: { materialPoints: 10, labor: 4, weeks: 2 }, provides: [{ type: 'defense', value: 3 }] },
  { id: 'farm_tower', baseType: 'farmhouse', name: { zh: '瞭望塔' }, desc: { zh: '提前一天看到尸潮。' }, icon: '🗼', cost: { materialPoints: 8, labor: 3, weeks: 2 }, provides: [{ type: 'defense', value: 2 }, { type: 'counters', crisisKind: 'horde', points: 2 }] },
  { id: 'farm_field', baseType: 'farmhouse', name: { zh: '大田' }, desc: { zh: '土豆和玉米。' }, icon: '🌽', cost: { materialPoints: 4, labor: 4, weeks: 3, requires: [{ cardId: 'supply_seed_potato', count: 2 }] }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_veg', perWeek: 4 }] },
  { id: 'farm_greenhouse', baseType: 'farmhouse', name: { zh: '温室' }, desc: { zh: '冬天也能种。' }, icon: '🏡', cost: { materialPoints: 12, labor: 3, weeks: 3, requires: [{ cardId: 'supply_seed_sapling', count: 1 }] }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_veg', perWeek: 2 }, { type: 'counters', crisisKind: 'climate', points: 2 }] },
  { id: 'farm_pen', baseType: 'farmhouse', name: { zh: '畜栏' }, desc: { zh: '鸡和羊。' }, icon: '🐔', cost: { materialPoints: 6, labor: 3, weeks: 2 }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_eggs', perWeek: 2 }] },
  { id: 'farm_watertower', baseType: 'farmhouse', name: { zh: '水塔' }, desc: { zh: '存雨水和井水。' }, icon: '🚰', cost: { materialPoints: 10, labor: 3, weeks: 2 }, provides: [{ type: 'produce', supplyKind: 'water', cardId: 'supply_well_water', perWeek: 4 }] },
  { id: 'farm_diesel', baseType: 'farmhouse', name: { zh: '柴油发电' }, desc: { zh: '吃油。' }, icon: '🛢️', cost: { materialPoints: 10, labor: 2, weeks: 2 }, provides: [{ type: 'produce', supplyKind: 'energy', cardId: 'supply_battery', perWeek: 3 }] },
  { id: 'farm_warehouse', baseType: 'farmhouse', name: { zh: '仓库' }, desc: { zh: '大棚改的。' }, icon: '🏬', cost: { materialPoints: 8, labor: 3, weeks: 2 }, provides: [{ type: 'storage', value: 30 }] },
  { id: 'farm_clinic', baseType: 'farmhouse', name: { zh: '医务室' }, desc: { zh: '沈砚会喜欢。' }, icon: '🏥', cost: { materialPoints: 8, labor: 2, weeks: 2 }, provides: [{ type: 'heal', perWeek: 1 }, { type: 'counters', crisisKind: 'plague', points: 2 }] },
  { id: 'farm_training', baseType: 'farmhouse', name: { zh: '训练场' }, desc: { zh: '沙袋、靶子、障碍。' }, icon: '🎯', cost: { materialPoints: 6, labor: 2, weeks: 2 }, provides: [{ type: 'trainBonus', attr: 'strength', dice: 2 }] },
  // 地下堡垒
  { id: 'bunker_vent', baseType: 'bunker', name: { zh: '通风净化' }, desc: { zh: '不然一个月就得出去。' }, icon: '🌬️', cost: { materialPoints: 16, labor: 4, weeks: 3 }, provides: [{ type: 'counters', crisisKind: 'plague', points: 4 }] },
  { id: 'bunker_water', baseType: 'bunker', name: { zh: '水循环' }, desc: { zh: '闭环。' }, icon: '💧', cost: { materialPoints: 16, labor: 4, weeks: 3 }, provides: [{ type: 'produce', supplyKind: 'water', cardId: 'supply_well_water', perWeek: 6 }] },
  { id: 'bunker_cold', baseType: 'bunker', name: { zh: '冷库' }, desc: { zh: '食物保质期翻倍。' }, icon: '🧊', cost: { materialPoints: 12, labor: 3, weeks: 2 }, provides: [{ type: 'storage', value: 40 }, { type: 'unlock', feature: 'cold' }] },
  { id: 'bunker_armory', baseType: 'bunker', name: { zh: '武器库' }, desc: { zh: '有了它才配叫堡垒。' }, icon: '🔫', cost: { materialPoints: 12, labor: 3, weeks: 2 }, provides: [{ type: 'defense', value: 4 }, { type: 'counters', crisisKind: 'human', points: 4 }] },
  { id: 'bunker_lab', baseType: 'bunker', name: { zh: '实验室' }, desc: { zh: '疫苗线必需。' }, icon: '🔬', cost: { materialPoints: 20, labor: 4, weeks: 4 }, provides: [{ type: 'unlock', feature: 'research' }] },
  { id: 'bunker_radio', baseType: 'bunker', name: { zh: '无线电室' }, desc: { zh: '联络其他基地。' }, icon: '📻', cost: { materialPoints: 10, labor: 2, weeks: 2 }, provides: [{ type: 'unlock', feature: 'diplomacy' }] },
  { id: 'bunker_grow', baseType: 'bunker', name: { zh: '种植舱' }, desc: { zh: '灯光种植。' }, icon: '🌱', cost: { materialPoints: 14, labor: 3, weeks: 3, requires: [{ cardId: 'supply_seed_sapling', count: 2 }] }, provides: [{ type: 'produce', supplyKind: 'food', cardId: 'supply_veg', perWeek: 4 }] },
  { id: 'bunker_quarantine', baseType: 'bunker', name: { zh: '隔离舱' }, desc: { zh: '被咬的人先关三天。' }, icon: '🚷', cost: { materialPoints: 10, labor: 2, weeks: 2 }, provides: [{ type: 'unlock', feature: 'quarantine' }, { type: 'counters', crisisKind: 'plague', points: 4 }] },
  { id: 'bunker_exit', baseType: 'bunker', name: { zh: '秘密出口' }, desc: { zh: '最后的退路。' }, icon: '🚪', cost: { materialPoints: 12, labor: 4, weeks: 3 }, provides: [{ type: 'unlock', feature: 'escape' }] },
]
