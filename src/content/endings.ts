import type { EndingDef } from '../engine/types'

/** 判定顺序按数组顺序。'death' 与 'survive_alone' 是引擎内置兜底 id。 */
export const endings: EndingDef[] = [
  { id: 'death', title: { zh: '没撑到春天' }, text: { zh: '你死了。但你记得这一次的每一步。再一次睁开眼。' }, conditions: [{ type: 'statAtMost', stat: 'health', value: 0 }], rebirthPoints: 0 },
  { id: 'ending_harmony', title: { zh: '他们都在' }, text: { zh: '第一年过去了。他们都还在你身边。这一世，你不打算再选。' }, conditions: [{ type: 'flag', flag: 'harmony' }], rebirthPoints: 60 },
  { id: 'ending_guchen', title: { zh: '雷霆之后' }, text: { zh: '顾沉把军区的钥匙放在你手心。"这一次，我信你。"' }, conditions: [{ type: 'affectionAtLeast', npcId: 'guchen', rank: 'lover' }, { type: 'npcAlive', npcId: 'guchen' }], rebirthPoints: 40 },
  { id: 'ending_shenyan', title: { zh: '第一支疫苗' }, text: { zh: '沈砚把试管举到灯下。"还差一样。"他看着你，"但我们有时间了。"' }, conditions: [{ type: 'affectionAtLeast', npcId: 'shenyan', rank: 'lover' }, { type: 'npcAlive', npcId: 'shenyan' }], rebirthPoints: 40 },
  { id: 'ending_xielin', title: { zh: '两个人的时间线' }, text: { zh: '谢临说："第二年的事，我知道得比你多。"你说："那这次一起改。"' }, conditions: [{ type: 'affectionAtLeast', npcId: 'xielin', rank: 'lover' }, { type: 'npcAlive', npcId: 'xielin' }], rebirthPoints: 40 },
  { id: 'ending_army', title: { zh: '编入军区' }, text: { zh: '你带着人和物资进了军区。规矩多，但墙很高。第二年从这里开始。' }, conditions: [{ type: 'relationAtLeast', factionId: 'army', value: 60 }], rebirthPoints: 25 },
  { id: 'survive_alone', title: { zh: '独活' }, text: { zh: '你一个人活过了第一年。这已经比上一世强太多。' }, conditions: [], rebirthPoints: 20 },
]
