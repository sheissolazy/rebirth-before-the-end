import type { CardDef } from '../engine/types'
import { crises } from './crises'

/**
 * 卡牌。当前只有样例，正式内容按 docs/tasks/T-003 填。
 * id 规范：supply_ / equip_ / core_ / intel_ / skill_<owner>_ / trouble_ / crisis_<kind>_<rarity>
 */
export const cards: CardDef[] = [
  // 物资
  { id: 'supply_rice_5kg', kind: 'supply', rarity: 'fine', supplyKind: 'food', size: 1, units: 5, shelfLifeWeeks: 48, basePrice: 45, buyable: true, icon: '🍚', name: { zh: '大米 5kg' }, desc: { zh: '囤货的起点。' } },
  { id: 'supply_veg', kind: 'supply', rarity: 'common', supplyKind: 'food', size: 1, units: 1, shelfLifeWeeks: 2, basePrice: 10, buyable: false, icon: '🥬', name: { zh: '新鲜蔬菜' }, desc: { zh: '菜箱和菜地产的。两周就蔫，有冰箱四周。' } },
  { id: 'supply_eggs', kind: 'supply', rarity: 'common', supplyKind: 'food', size: 1, units: 2, shelfLifeWeeks: 4, basePrice: 15, buyable: false, icon: '🥚', name: { zh: '鸡蛋' }, desc: { zh: '畜栏产的。四周，有冰箱八周。' } },
  { id: 'supply_water_box', kind: 'supply', rarity: 'fine', supplyKind: 'water', size: 1, units: 4, shelfLifeWeeks: 96, basePrice: 30, buyable: true, icon: '💧', name: { zh: '一箱矿泉水' }, desc: { zh: '24 瓶。' } },
  { id: 'supply_well_water', kind: 'supply', rarity: 'common', supplyKind: 'water', size: 1, units: 2, basePrice: 0, buyable: false, icon: '🚰', name: { zh: '井水' }, desc: { zh: '基地产的。' } },
  { id: 'supply_compressed_biscuit', kind: 'supply', rarity: 'rare', supplyKind: 'food', size: 1, units: 8, shelfLifeWeeks: 144, basePrice: 120, buyable: true, icon: '🍪', name: { zh: '压缩饼干（军用）' }, desc: { zh: '难吃，但能活。' } },
  { id: 'supply_antibiotics', kind: 'supply', rarity: 'rare', supplyKind: 'medicine', size: 1, shelfLifeWeeks: 72, basePrice: 90, buyable: true, icon: '💊', name: { zh: '广谱抗生素' }, desc: { zh: '药店限购一盒。' } },
  { id: 'supply_battery', kind: 'supply', rarity: 'common', supplyKind: 'energy', size: 1, basePrice: 20, buyable: true, icon: '🔋', name: { zh: '充满的电池组' }, desc: { zh: '一周的灯和收音机。' } },
  { id: 'supply_generator', kind: 'supply', rarity: 'legendary', supplyKind: 'energy', size: 3, basePrice: 3200, buyable: true, deliveryWeeks: 2, weeklyLimit: 1, icon: '⚡', name: { zh: '小型汽油发电机' }, desc: { zh: '吵，但停电时它就是神。' } },
  { id: 'supply_steel', kind: 'supply', rarity: 'fine', supplyKind: 'material', size: 2, basePrice: 150, buyable: true, deliveryWeeks: 2, icon: '🧱', name: { zh: '建材包（钢材+水泥）' }, desc: { zh: '材料 2 分，占 2 格。建模块用。物流两周。' } },
  { id: 'supply_bolts', kind: 'supply', rarity: 'common', supplyKind: 'weapon', size: 1, basePrice: 40, buyable: true, icon: '🏹', name: { zh: '一捆弩箭' }, desc: { zh: '工坊能造。' } },
  { id: 'supply_winter_clothes', kind: 'supply', rarity: 'fine', supplyKind: 'daily', size: 1, basePrice: 300, buyable: true, icon: '🧥', name: { zh: '羽绒服' }, desc: { zh: '极寒时一件顶一条命。' } },
  // 装备
  { id: 'equip_machete', kind: 'equipment', rarity: 'fine', slot: 'weapon', bonusDice: 1, forAttr: 'strength', basePrice: 150, buyable: true, icon: '🔪', name: { zh: '砍刀' }, desc: { zh: '五金店就有。' } },
  { id: 'equip_crossbow', kind: 'equipment', rarity: 'rare', slot: 'weapon', bonusDice: 2, forAttr: 'strength', basePrice: 1800, buyable: true, deliveryWeeks: 2, weeklyLimit: 1, icon: '🏹', name: { zh: '复合弩' }, desc: { zh: '安静，可回收。' } },
  { id: 'equip_shotgun', kind: 'equipment', rarity: 'legendary', slot: 'weapon', bonusDice: 4, forAttr: 'strength', firearm: true, basePrice: 60000, buyable: false, icon: '🔫', name: { zh: '猎枪' }, desc: { zh: '黑市六万，或者有门路。' } },
  { id: 'equip_vest', kind: 'equipment', rarity: 'rare', slot: 'armor', bonusDice: 1, basePrice: 2500, buyable: true, icon: '🦺', name: { zh: '防刺服' }, desc: { zh: '防咬也防刀。' } },
  // 晶核
  { id: 'core_common', kind: 'core', rarity: 'common', icon: '💎', name: { zh: '普通晶核' }, desc: { zh: '普通丧尸掉的。' } },
  { id: 'core_fine', kind: 'core', rarity: 'fine', icon: '💎', name: { zh: '优良晶核' }, desc: { zh: '敏捷型丧尸掉的。' } },
  // 情报 / 技能 / 麻烦
  { id: 'intel_army_radio', kind: 'intel', rarity: 'fine', icon: '📻', effect: { type: 'revealCrisisRarity', monthsAhead: 1 }, name: { zh: '军区广播' }, desc: { zh: '看穿下月危机的真实档位。' } },
  { id: 'skill_guchen_thunder', kind: 'skill', rarity: 'legendary', ownerId: 'guchen', counters: 'horde', icon: '⚡', name: { zh: '顾沉：雷霆' }, desc: { zh: '代替硬顶一次尸潮。' } },
  { id: 'skill_shenyan_heal', kind: 'skill', rarity: 'legendary', ownerId: 'shenyan', counters: 'plague', icon: '🩺', name: { zh: '沈砚：治愈' }, desc: { zh: '代替硬顶一次疫病。' } },
  { id: 'skill_xielin_slow', kind: 'skill', rarity: 'legendary', ownerId: 'xielin', bonusDice: 3, icon: '⏳', name: { zh: '谢临：时间减速' }, desc: { zh: '任何检定 +3 骰。' } },
  { id: 'skill_jiangye_guard', kind: 'skill', rarity: 'rare', ownerId: 'jiangye', counters: 'human', icon: '🛡️', name: { zh: '江野：护卫' }, desc: { zh: '代替硬顶一次人祸。' } },
  { id: 'skill_aji_command', kind: 'skill', rarity: 'legendary', ownerId: 'aji', counters: 'horde', icon: '🧟', name: { zh: '阿寂：号令' }, desc: { zh: '解除一次尸潮。' } },
  { id: 'trouble_loan', kind: 'trouble', rarity: 'fine', size: 0, weeklyMoneyDelta: -2000, icon: '📜', resolvedByEventIds: ['ev_bank_repay'], name: { zh: '网贷催收' }, desc: { zh: '序章每周扣 2000。末日后自动消失。' } },
  { id: 'core_rare', kind: 'core', rarity: 'rare', icon: '💎', name: { zh: '稀有晶核' }, desc: { zh: '异能丧尸掉的。' } },
  { id: 'core_legendary', kind: 'core', rarity: 'legendary', icon: '💎', name: { zh: '传说晶核' }, desc: { zh: '丧尸王级别。' } },
  ...crises,
]


/** 第二批卡（引擎/事件需要）。 */
export const cardsBatch2: CardDef[] = [
  { id: 'supply_canned', kind: 'supply', rarity: 'fine', supplyKind: 'food', size: 1, units: 4, shelfLifeWeeks: 200, basePrice: 60, buyable: true, icon: '🥫', name: { zh: '一箱罐头' }, desc: { zh: '午餐肉和豆子。末日的硬通货。' } },
  { id: 'supply_water_filter', kind: 'supply', rarity: 'rare', supplyKind: 'water', size: 1, units: 12, basePrice: 800, buyable: true, deliveryWeeks: 2, weeklyLimit: 2, icon: '🧪', name: { zh: '户外净水器' }, desc: { zh: '河水也能喝。' } },
  { id: 'supply_water_tablets', kind: 'supply', rarity: 'fine', supplyKind: 'water', size: 1, units: 6, basePrice: 45, buyable: true, weeklyLimit: 10, icon: '💊', name: { zh: '净水片' }, desc: { zh: '一板能处理 6 人周的脏水。' } },
  { id: 'supply_gasoline', kind: 'supply', rarity: 'fine', supplyKind: 'energy', size: 2, basePrice: 150, buyable: true, icon: '🛢️', name: { zh: '一桶汽油' }, desc: { zh: '发电机的命。' } },
  { id: 'supply_bandage', kind: 'supply', rarity: 'common', supplyKind: 'medicine', size: 1, basePrice: 20, buyable: true, icon: '🩹', name: { zh: '绷带和碘伏' }, desc: { zh: '小伤够用。' } },
  { id: 'supply_medkit', kind: 'supply', rarity: 'fine', supplyKind: 'medicine', size: 1, shelfLifeWeeks: 100, basePrice: 200, buyable: true, icon: '🧰', name: { zh: '急救箱' }, desc: { zh: '缝合、止血、退烧。' } },
  { id: 'supply_wood', kind: 'supply', rarity: 'common', supplyKind: 'material', size: 1, basePrice: 70, buyable: true, weeklyLimit: 10, icon: '🪵', name: { zh: '木板' }, desc: { zh: '材料 1 分，占 1 格。便宜、当周到，但占地方。' } },
  { id: 'supply_cement', kind: 'supply', rarity: 'rare', supplyKind: 'material', size: 3, basePrice: 320, buyable: true, deliveryWeeks: 2, weeklyLimit: 3, icon: '🏗️', name: { zh: '工程建材包' }, desc: { zh: '材料 4 分，占 3 格。最省地方，物流两周。' } },
  { id: 'supply_soap', kind: 'supply', rarity: 'common', supplyKind: 'daily', size: 1, basePrice: 15, buyable: true, icon: '🧼', name: { zh: '肥皂和卫生用品' }, desc: { zh: '不体面的死法太多了。' } },
  { id: 'supply_blanket', kind: 'supply', rarity: 'common', supplyKind: 'daily', size: 1, basePrice: 80, buyable: true, icon: '🛏️', name: { zh: '毛毯' }, desc: { zh: '一人一条。' } },
  { id: 'supply_seed_veg', kind: 'supply', rarity: 'common', supplyKind: 'seed', size: 1, basePrice: 15, buyable: true, weeklyLimit: 10, icon: '🌱', name: { zh: '蔬菜种子' }, desc: { zh: '青菜、萝卜、小葱。菜箱和菜地要用。末日后只有农场有。' } },
  { id: 'supply_seed_potato', kind: 'supply', rarity: 'fine', supplyKind: 'seed', size: 1, basePrice: 40, buyable: true, weeklyLimit: 5, icon: '🥔', name: { zh: '土豆种薯' }, desc: { zh: '一箱。大田要用。产量最稳的东西。' } },
  { id: 'supply_seed_sapling', kind: 'supply', rarity: 'rare', supplyKind: 'seed', size: 1, basePrice: 300, buyable: true, weeklyLimit: 2, deliveryWeeks: 2, icon: '🌿', name: { zh: '温室种苗' }, desc: { zh: '番茄、黄瓜、草莓的苗。温室和种植舱要用。' } },
  { id: 'supply_coffee', kind: 'supply', rarity: 'common', supplyKind: 'daily', size: 1, units: 5, basePrice: 40, buyable: true, icon: '☕', name: { zh: '速溶咖啡' }, desc: { zh: '用一份：本周精力 +1。' }, onUse: [{ type: 'energy', delta: 1 }] },
  { id: 'supply_energy_drink', kind: 'supply', rarity: 'fine', supplyKind: 'daily', size: 1, units: 3, basePrice: 90, buyable: true, icon: '🥤', name: { zh: '功能饮料' }, desc: { zh: '用一份：本周精力 +2。' }, onUse: [{ type: 'energy', delta: 2 }] },
  { id: 'supply_vitamins', kind: 'supply', rarity: 'rare', supplyKind: 'medicine', size: 1, basePrice: 600, buyable: true, icon: '💊', name: { zh: '高剂量维生素' }, desc: { zh: '用掉：精力上限永久 +1。' }, onUse: [{ type: 'energy', delta: 1, permanent: true }] },
  { id: 'equip_spear', kind: 'equipment', rarity: 'common', slot: 'weapon', bonusDice: 1, forAttr: 'strength', basePrice: 60, buyable: true, icon: '🔱', name: { zh: '自制长矛' }, desc: { zh: '拖把杆加菜刀。' } },
  { id: 'equip_axe', kind: 'equipment', rarity: 'fine', slot: 'weapon', bonusDice: 2, forAttr: 'strength', basePrice: 300, buyable: true, icon: '🪓', name: { zh: '消防斧' }, desc: { zh: '劈门也劈头。' } },
  { id: 'equip_helmet', kind: 'equipment', rarity: 'fine', slot: 'armor', bonusDice: 1, basePrice: 200, buyable: true, icon: '⛑️', name: { zh: '工地头盔' }, desc: { zh: '保命。' } },
  { id: 'equip_radio', kind: 'equipment', rarity: 'rare', slot: 'accessory', bonusDice: 1, forAttr: 'mind', basePrice: 1500, buyable: true, icon: '📻', name: { zh: '手摇收音机' }, desc: { zh: '能收到军区广播。' } },
  { id: 'intel_xielin_note', kind: 'intel', rarity: 'rare', icon: '📝', effect: { type: 'revealCrisisRarity', monthsAhead: 1 }, name: { zh: '谢临的便条' }, desc: { zh: '"下个月比你记得的更糟。"看穿下月危机档位。' } },
  { id: 'intel_memory_fix', kind: 'intel', rarity: 'fine', icon: '🧠', effect: { type: 'fixMemory' }, name: { zh: '静下来回忆' }, desc: { zh: '蝴蝶效应 -20。' } },
  { id: 'trouble_ex', kind: 'trouble', rarity: 'fine', size: 0, weeklyExposureDelta: 2, icon: '📱', resolvedByEventIds: ['ev_home_block_ex'], name: { zh: '周明宇的消息' }, desc: { zh: '他一直在打听你囤了多少。每周暴露 +2。' } },
  { id: 'trouble_relatives', kind: 'trouble', rarity: 'rare', size: 0, weeklyMoneyDelta: -5000, weeklyExposureDelta: 3, icon: '🧧', resolvedByEventIds: ['ev_home_change_number'], name: { zh: '借钱的亲戚' }, desc: { zh: '中奖上了新闻。八竿子打不着的亲戚都来了。序章每周 -5000，暴露 +3。' } },
  { id: 'trouble_parents', kind: 'trouble', rarity: 'common', size: 0, weeklyMoneyDelta: -800, icon: '☎️', resolvedByEventIds: ['ev_home_call_parents'], name: { zh: '爸妈的唠叨' }, desc: { zh: '他们看不懂你为什么突然买这么多东西，天天念。序章每周 -800。做「跟爸妈说清楚」解决。' } },
]
