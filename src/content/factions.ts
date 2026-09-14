import type { FactionDef } from '../engine/types'

export const factions: FactionDef[] = [
  { id: 'army', name: { zh: '军区基地' }, desc: { zh: '顾沉的地盘。规矩多，但安全，交易最公道（1 晶核分换 1 物资分）。' }, icon: '🪖', leaderNpcId: 'guchen', initialRelation: 10, tradeRate: 1 },
  { id: 'alliance', name: { zh: '幸存者联盟' }, desc: { zh: '松散的互助组织，容易被渗透。' }, icon: '🤝', initialRelation: 0, tradeRate: 2 },
  { id: 'crow', name: { zh: '黑鸦' }, desc: { zh: '周明宇的匪帮。收保护费，搞突袭，交易最黑（3 晶核分换 1 物资分）。' }, icon: '🐦‍⬛', leaderNpcId: 'zhoumingyu', initialRelation: -40, tradeRate: 3 },
  { id: 'dawn', name: { zh: '新黎明教团' }, desc: { zh: '收留任何人。代价不明。' }, icon: '🕯️', initialRelation: 0, tradeRate: 2 },
]
