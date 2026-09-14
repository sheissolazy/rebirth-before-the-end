import type { CardDef } from '../engine/types'

/**
 * 样例卡（给 UI 开发用）。正式内容在 cards.ts（Codex 按 docs/tasks/T-003 填 40 种物资）。
 * 保质期单位：周。价格是第 1 年 1 月基准价。
 */
export const sampleCards: CardDef[] = [
  { id: 'supply_rice_5kg', kind: 'supply', tier: 'bronze', supplyKind: 'food', size: 1, shelfLifeWeeks: 48, basePrice: 45, icon: '🍚',
    name: { zh: '大米 5kg' }, desc: { zh: '囤货的起点。放阴凉处。' } },
  { id: 'supply_water_box', kind: 'supply', tier: 'bronze', supplyKind: 'water', size: 1, shelfLifeWeeks: 96, basePrice: 30, icon: '💧',
    name: { zh: '一箱矿泉水' }, desc: { zh: '24 瓶。搬上六楼要命。' } },
  { id: 'supply_compressed_biscuit', kind: 'supply', tier: 'silver', supplyKind: 'food', size: 1, shelfLifeWeeks: 144, basePrice: 120, icon: '🍪',
    name: { zh: '压缩饼干（军用）' }, desc: { zh: '难吃，但能活。' } },
  { id: 'supply_generator', kind: 'supply', tier: 'gold', supplyKind: 'energy', size: 3, basePrice: 3200, icon: '⚡',
    name: { zh: '小型汽油发电机' }, desc: { zh: '吵，但停电时它就是神。' } },
  { id: 'supply_antibiotics', kind: 'supply', tier: 'silver', supplyKind: 'medicine', size: 1, shelfLifeWeeks: 72, basePrice: 90, icon: '💊',
    name: { zh: '广谱抗生素' }, desc: { zh: '药店限购，一次只给一盒。' } },
  { id: 'supply_door_bar', kind: 'supply', tier: 'silver', supplyKind: 'security', size: 2, basePrice: 400, icon: '🚪',
    name: { zh: '防盗门加固杆' }, desc: { zh: '让撬门的人多花十分钟。' } },
  { id: 'intel_azhe_leak', kind: 'intel', tier: 'bronze', icon: '📄', effect: { type: 'revealCrisisTier', monthsAhead: 1 },
    name: { zh: '阿哲的内部消息' }, desc: { zh: '看穿下月危机的真实档位。' } },
  { id: 'skill_azhe_intel', kind: 'skill', tier: 'silver', ownerNpcId: 'azhe', bonusDice: 2, icon: '🖥️',
    name: { zh: '阿哲：爬虫' }, desc: { zh: '放进任何情报类事件 +2 骰。' } },
  { id: 'skill_lin_medic', kind: 'skill', tier: 'silver', ownerNpcId: 'lin', counters: 'plague', icon: '🩺',
    name: { zh: '林晚舟：急救' }, desc: { zh: '代替硬顶一次疫病危机。' } },
  { id: 'skill_laok_guard', kind: 'skill', tier: 'silver', ownerNpcId: 'laok', counters: 'unrest', icon: '🛡️',
    name: { zh: '老K：守夜' }, desc: { zh: '代替硬顶一次动荡危机。' } },
  { id: 'trouble_landlord', kind: 'trouble', tier: 'bronze', size: 0, weeklyMoneyDelta: -300, icon: '📜', resolvedByEventIds: ['ev_home_negotiate_rent'],
    name: { zh: '房东要涨租' }, desc: { zh: '每周多扣 300，直到你去谈。' } },
  { id: 'crisis_scarcity_stone', kind: 'crisis', tier: 'stone', crisisKind: 'scarcity', icon: '🍞',
    name: { zh: '限购' }, desc: { zh: '超市开始限购。' },
    onDraw: { zh: '超市门口贴了张纸：鸡蛋每人限购一盒。' },
    onSurvive: { zh: '你早就囤好了。看着排队的人，你有点心虚，又有点庆幸。' },
    onFail: { zh: '你这周没吃上像样的东西。心态有点崩。' } },
]
