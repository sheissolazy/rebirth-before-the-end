import type { CardDef } from '../engine/types'

/**
 * 卡牌。当前只有样例，正式内容按 docs/tasks/T-003 填。
 * id 规范：supply_ / equip_ / core_ / intel_ / skill_<owner>_ / trouble_ / crisis_<kind>_<rarity>
 */
export const cards: CardDef[] = [
  // 物资
  { id: 'supply_rice_5kg', kind: 'supply', rarity: 'fine', supplyKind: 'food', size: 1, shelfLifeWeeks: 48, basePrice: 45, buyable: true, icon: '🍚', name: { zh: '大米 5kg' }, desc: { zh: '囤货的起点。' } },
  { id: 'supply_veg', kind: 'supply', rarity: 'common', supplyKind: 'food', size: 1, shelfLifeWeeks: 2, basePrice: 10, buyable: true, icon: '🥬', name: { zh: '新鲜蔬菜' }, desc: { zh: '两周就蔫。' } },
  { id: 'supply_eggs', kind: 'supply', rarity: 'common', supplyKind: 'food', size: 1, shelfLifeWeeks: 4, basePrice: 15, buyable: true, icon: '🥚', name: { zh: '鸡蛋' }, desc: { zh: '畜栏产的。' } },
  { id: 'supply_water_box', kind: 'supply', rarity: 'fine', supplyKind: 'water', size: 1, shelfLifeWeeks: 96, basePrice: 30, buyable: true, icon: '💧', name: { zh: '一箱矿泉水' }, desc: { zh: '24 瓶。' } },
  { id: 'supply_well_water', kind: 'supply', rarity: 'common', supplyKind: 'water', size: 1, basePrice: 0, buyable: false, icon: '🚰', name: { zh: '井水' }, desc: { zh: '基地产的。' } },
  { id: 'supply_compressed_biscuit', kind: 'supply', rarity: 'rare', supplyKind: 'food', size: 1, shelfLifeWeeks: 144, basePrice: 120, buyable: true, icon: '🍪', name: { zh: '压缩饼干（军用）' }, desc: { zh: '难吃，但能活。' } },
  { id: 'supply_antibiotics', kind: 'supply', rarity: 'rare', supplyKind: 'medicine', size: 1, shelfLifeWeeks: 72, basePrice: 90, buyable: true, icon: '💊', name: { zh: '广谱抗生素' }, desc: { zh: '药店限购一盒。' } },
  { id: 'supply_battery', kind: 'supply', rarity: 'common', supplyKind: 'energy', size: 1, basePrice: 20, buyable: true, icon: '🔋', name: { zh: '充满的电池组' }, desc: { zh: '一周的灯和收音机。' } },
  { id: 'supply_generator', kind: 'supply', rarity: 'legendary', supplyKind: 'energy', size: 3, basePrice: 3200, buyable: true, icon: '⚡', name: { zh: '小型汽油发电机' }, desc: { zh: '吵，但停电时它就是神。' } },
  { id: 'supply_steel', kind: 'supply', rarity: 'fine', supplyKind: 'material', size: 2, basePrice: 200, buyable: true, icon: '🧱', name: { zh: '钢材' }, desc: { zh: '加固用。' } },
  { id: 'supply_bolts', kind: 'supply', rarity: 'common', supplyKind: 'weapon', size: 1, basePrice: 40, buyable: true, icon: '🏹', name: { zh: '一捆弩箭' }, desc: { zh: '工坊能造。' } },
  { id: 'supply_winter_clothes', kind: 'supply', rarity: 'fine', supplyKind: 'daily', size: 1, basePrice: 300, buyable: true, icon: '🧥', name: { zh: '羽绒服' }, desc: { zh: '极寒时一件顶一条命。' } },
  // 装备
  { id: 'equip_machete', kind: 'equipment', rarity: 'fine', slot: 'weapon', bonusDice: 1, forAttr: 'strength', basePrice: 150, buyable: true, icon: '🔪', name: { zh: '砍刀' }, desc: { zh: '五金店就有。' } },
  { id: 'equip_crossbow', kind: 'equipment', rarity: 'rare', slot: 'weapon', bonusDice: 2, forAttr: 'strength', basePrice: 1800, buyable: true, icon: '🏹', name: { zh: '复合弩' }, desc: { zh: '安静，可回收。' } },
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
  // 危机（样例 1 张，正式 20 张见 T-003）
  { id: 'crisis_horde_common', kind: 'crisis', rarity: 'common', crisisKind: 'horde', icon: '🧟', name: { zh: '游尸' }, desc: { zh: '零星游荡的丧尸。' },
    onDraw: { zh: '楼下多了几个不走直线的人影。' },
    onSurvive: { zh: '它们撞了几天门，走了。' },
    onFail: { zh: '门被撞开了。你丢了一批东西，也差点丢了命。' } },
]
