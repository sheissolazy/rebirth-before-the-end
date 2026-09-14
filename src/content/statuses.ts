import type { StatusDef } from '../engine/types'

export const statuses: StatusDef[] = [
  { id: 'lowkey', name: { zh: '低调' }, desc: { zh: '不交易、不出风头：网购、以物易物、军区交易、交保护费、便利店、农场换粮都不能做。每周暴露 −3。' }, icon: '🤫', defaultWeeks: 4, noTrade: true, weeklyExposure: -3 },
  { id: 'grounded', name: { zh: '闭门不出' }, desc: { zh: '基地外的事件都不能去。' }, icon: '🚪', defaultWeeks: 2, noOuting: true },
  { id: 'watched', name: { zh: '被盯上' }, desc: { zh: '有人在盯着你的基地，每周暴露 +3。' }, icon: '👁️', defaultWeeks: 4, weeklyExposure: 3 },
  { id: 'army_guard', name: { zh: '军区驻守' }, desc: { zh: '一个班的兵守着你的楼，防御 +6。' }, icon: '🪖', defaultWeeks: 4, defenseBonus: 6 },
]
