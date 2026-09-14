import type { MemoryEntryDef } from '../engine/types'

/** 第 1 年 12 条重生记忆：类型固定，档位可因蝴蝶效应偏移。 */
export const memoriesYear1: MemoryEntryDef[] = [
  { month: 1, crisisKind: 'scarcity', baseTier: 'stone', memory: { zh: '超市开始限购鸡蛋。当时谁都没当回事。' } },
  { month: 2, crisisKind: 'plague', baseTier: 'stone', memory: { zh: '办公室一半人得了流感，我也躺了三天。' } },
  { month: 3, crisisKind: 'climate', baseTier: 'stone', memory: { zh: '小区跳闸一整晚，手机没电，黑得发慌。' } },
  { month: 4, crisisKind: 'unrest', baseTier: 'stone', memory: { zh: '楼道的电动车被偷了，物业说"看监控"。' } },
  { month: 5, crisisKind: 'scarcity', baseTier: 'bronze', memory: { zh: '第一次抢购潮。货架空了两天，米涨了一倍。' } },
  { month: 6, crisisKind: 'climate', baseTier: 'bronze', memory: { zh: '暴雨内涝，地下车库全淹，一楼进水。' } },
  { month: 7, crisisKind: 'climate', baseTier: 'bronze', memory: { zh: '连续高温，电网限电，空调成了奢侈品。' } },
  { month: 8, crisisKind: 'plague', baseTier: 'bronze', memory: { zh: '新闻里第一次出现那个病毒的名字。' } },
  { month: 9, crisisKind: 'scarcity', baseTier: 'silver', memory: { zh: '裁员潮，银行每周限提。钱开始不像钱了。' } },
  { month: 10, crisisKind: 'plague', baseTier: 'silver', memory: { zh: '小区封控。物资靠团购，团购靠运气。' } },
  { month: 11, crisisKind: 'unrest', baseTier: 'silver', memory: { zh: '第一次暴乱。超市被砸，警察没来。' } },
  { month: 12, crisisKind: 'climate', baseTier: 'gold', memory: { zh: '末日降临。气温一夜掉到零下三十度，再也没升回来。' } },
]
