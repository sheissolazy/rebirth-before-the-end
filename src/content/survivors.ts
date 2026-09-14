import type { SurvivorTraitDef, LocalizedText } from '../engine/types'

export const survivorTraits: SurvivorTraitDef[] = [
  { id: 'trait_strong', name: { zh: '壮实' }, desc: { zh: '扛得动。' }, attrDelta: { strength: 1 }, jobBonus: { guard: 1 } },
  { id: 'trait_bookish', name: { zh: '书呆子' }, desc: { zh: '想得多。' }, attrDelta: { mind: 1 } },
  { id: 'trait_sweet', name: { zh: '嘴甜' }, desc: { zh: '会说话。' }, attrDelta: { charm: 1 } },
  { id: 'trait_farmer', name: { zh: '农村长大' }, desc: { zh: '种什么活什么。' }, jobBonus: { farm: 1 } },
  { id: 'trait_scavenger', name: { zh: '拾荒老手' }, desc: { zh: '知道哪里有东西。' }, jobBonus: { scavenge: 1 } },
  { id: 'trait_loyal', name: { zh: '死心眼' }, desc: { zh: '认定了就不走。' }, loyaltyDrift: 1 },
  { id: 'trait_greedy', name: { zh: '贪心' }, desc: { zh: '总觉得分得少。' }, loyaltyDrift: -1 },
  { id: 'trait_coward', name: { zh: '胆小' }, desc: { zh: '尸潮来了先跑。' }, attrDelta: { strength: -1 }, loyaltyDrift: -1 },
  { id: 'trait_nurse', name: { zh: '护士' }, desc: { zh: '会包扎。' }, attrDelta: { mind: 1 } },
  { id: 'trait_mechanic', name: { zh: '修车工' }, desc: { zh: '什么都能修。' }, attrDelta: { strength: 1 } },
]

export const survivorNames: LocalizedText[] = [
  '小林', '老陈', '阿伟', '小雨', '大壮', '阿芳', '老赵', '小周', '阿强', '晓晓', '老李', '阿杰', '小美', '大刘', '阿花', '小胖', '老吴', '阿峰', '小婷', '大军',
].map((zh) => ({ zh }))
