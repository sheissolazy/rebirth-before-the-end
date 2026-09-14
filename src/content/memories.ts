import type { MemoryEntryDef } from '../engine/types'

/** 末日第 1 年 12 条前世记忆：类型固定，档位可因蝴蝶效应偏移。 */
export const memoriesYear1: MemoryEntryDef[] = [
  { month: 1, crisisKind: 'horde', baseRarity: 'common', memory: { zh: '城市失守。到处是游荡的尸体，它们还很慢。' } },
  { month: 2, crisisKind: 'scarcity', baseRarity: 'common', memory: { zh: '超市被抢空。我抢到了两包方便面。' } },
  { month: 3, crisisKind: 'scarcity', baseRarity: 'fine', memory: { zh: '断水。我开始接雨水。' } },
  { month: 4, crisisKind: 'human', baseRarity: 'fine', memory: { zh: '黑鸦开始挨家收保护费。周明宇站在他们中间。' } },
  { month: 5, crisisKind: 'climate', baseRarity: 'fine', memory: { zh: '暴雨。地下室全淹，我囤的东西泡了一半。' } },
  { month: 6, crisisKind: 'horde', baseRarity: 'fine', memory: { zh: '第一次见到会跑的丧尸。' } },
  { month: 7, crisisKind: 'plague', baseRarity: 'rare', memory: { zh: '高温。满街尸体腐烂，瘟疫来了。' } },
  { month: 8, crisisKind: 'human', baseRarity: 'fine', memory: { zh: '军区开始收编幸存者。进去要交东西。' } },
  { month: 9, crisisKind: 'horde', baseRarity: 'rare', memory: { zh: '秋季尸潮。楼下的铁门撑了三天。' } },
  { month: 10, crisisKind: 'plague', baseRarity: 'rare', memory: { zh: '病毒变异了。被咬的人三天后才变，没人敢收留陌生人。' } },
  { month: 11, crisisKind: 'climate', baseRarity: 'rare', memory: { zh: '降温。燃料告急，我烧了书。' } },
  { month: 12, crisisKind: 'horde', baseRarity: 'legendary', memory: { zh: '极寒降临，尸潮跟着来了。第一年最大的一次。' } },
]
