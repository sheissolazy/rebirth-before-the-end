import type { StartTraitDef } from '../engine/types'

/** 开局特质。cost > 0 花预算，cost < 0 给预算。初始预算 0，每过一世 +1。 */
export const startTraits: StartTraitDef[] = [
  // 正面
  { id: 'trait_strong', cost: 2, name: { zh: '健壮' }, desc: { zh: '体力 +1' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
  { id: 'trait_smart', cost: 2, name: { zh: '聪明' }, desc: { zh: '头脑 +1' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
  { id: 'trait_charming', cost: 2, name: { zh: '好人缘' }, desc: { zh: '魅力 +1' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }] },
  { id: 'trait_energetic', cost: 3, name: { zh: '精力旺盛' }, desc: { zh: '精力上限 +1' }, effects: [{ type: 'energy', delta: 1, permanent: true }] },
  { id: 'trait_hoarder', cost: 1, name: { zh: '囤货癖' }, desc: { zh: '开局多 3 袋米、3 箱水' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'gainCard', cardId: 'supply_water_box', count: 3 }] },
  { id: 'trait_savings', cost: 1, name: { zh: '有存款' }, desc: { zh: '开局 +2 万' }, effects: [{ type: 'money', delta: 20000 }] },
  { id: 'trait_pharmacist', cost: 1, name: { zh: '药店常客' }, desc: { zh: '开局 2 盒抗生素、1 个急救箱' }, effects: [{ type: 'gainCard', cardId: 'supply_antibiotics', count: 2 }, { type: 'gainCard', cardId: 'supply_medkit' }] },
  { id: 'trait_dog', cost: 1, name: { zh: '狗主人' }, desc: { zh: '开局带一条狗' }, effects: [{ type: 'adoptPet', petId: 'pet_dog' }] },
  { id: 'trait_armed', cost: 1, name: { zh: '户外爱好者' }, desc: { zh: '开局一把砍刀和一把弩' }, effects: [{ type: 'gainCard', cardId: 'equip_machete' }, { type: 'gainCard', cardId: 'equip_crossbow' }] },
  { id: 'trait_space', cost: 4, name: { zh: '空间更大' }, desc: { zh: '空间从优良档开始' }, effects: [{ type: 'powerUp', powerId: 'power_space' }] },
  { id: 'trait_known', cost: 2, name: { zh: '江野的青梅' }, desc: { zh: '江野初始好感 +20' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 20 }] },
  // 负面
  { id: 'trait_weak', cost: -2, name: { zh: '体弱' }, desc: { zh: '体力 -1' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: -1 }] },
  { id: 'trait_shy', cost: -2, name: { zh: '社恐' }, desc: { zh: '魅力 -1' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: -1 }] },
  { id: 'trait_slow', cost: -2, name: { zh: '反应慢' }, desc: { zh: '头脑 -1' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: -1 }] },
  { id: 'trait_tired', cost: -3, name: { zh: '易疲劳' }, desc: { zh: '精力上限 -1' }, effects: [{ type: 'energy', delta: -1, permanent: true }] },
  { id: 'trait_broke', cost: -1, name: { zh: '月光族' }, desc: { zh: '开局 -2 万' }, effects: [{ type: 'money', delta: -20000 }] },
  { id: 'trait_debt', cost: -2, name: { zh: '网贷缠身' }, desc: { zh: '开局带一张"网贷催收"' }, effects: [{ type: 'gainCard', cardId: 'trouble_loan' }] },
  { id: 'trait_ex', cost: -2, name: { zh: '前任纠缠' }, desc: { zh: '开局带一张"周明宇的消息"' }, effects: [{ type: 'gainCard', cardId: 'trouble_ex' }] },
  { id: 'trait_jobless', cost: -2, name: { zh: '刚被裁' }, desc: { zh: '开局失业，没有周薪' }, effects: [{ type: 'employment', value: false }] },
  { id: 'trait_sick', cost: -2, name: { zh: '病根' }, desc: { zh: '开局健康 8' }, effects: [{ type: 'stat', stat: 'health', delta: -2 }] },
  { id: 'trait_famous', cost: -1, name: { zh: '小有名气' }, desc: { zh: '开局暴露 20' }, effects: [{ type: 'stat', stat: 'exposure', delta: 20 }] },
]
