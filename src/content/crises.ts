import type { CrisisCardDef } from '../engine/types'

/** 20 张危机卡（5 类 × 4 档）。文案先起草，Codex 在 T-003 里润色。 */
export const crises: CrisisCardDef[] = [
  // 尸潮
  { id: 'crisis_horde_common', kind: 'crisis', rarity: 'common', crisisKind: 'horde', icon: '🧟', name: { zh: '游尸' }, desc: { zh: '零星游荡的丧尸。' },
    onDraw: { zh: '楼下多了几个不走直线的人影。' }, onSurvive: { zh: '它们撞了几天门，走了。' }, onFail: { zh: '门被撞开了。你丢了一批东西，也差点丢了命。' } },
  { id: 'crisis_horde_fine', kind: 'crisis', rarity: 'fine', crisisKind: 'horde', icon: '🧟', name: { zh: '尸群' }, desc: { zh: '几十只，被声音引来的。' },
    onDraw: { zh: '不知道谁在楼下放了音乐。然后整条街都动了。' }, onSurvive: { zh: '你们守了三天。第四天早上，街上安静得像什么都没发生。' }, onFail: { zh: '铁门变形了。有人受了伤。' } },
  { id: 'crisis_horde_rare', kind: 'crisis', rarity: 'rare', crisisKind: 'horde', icon: '🧟', name: { zh: '尸潮' }, desc: { zh: '上百只。' },
    onDraw: { zh: '远处的地平线在动。不是风。' }, onSurvive: { zh: '围墙外堆了一层尸体。你们活着，但没人说话。' }, onFail: { zh: '防线被冲垮了。有人没能退回来。' } },
  { id: 'crisis_horde_legendary', kind: 'crisis', rarity: 'legendary', crisisKind: 'horde', icon: '🧟', name: { zh: '极寒尸潮' }, desc: { zh: '气温骤降，丧尸被逼进城。' },
    onDraw: { zh: '气温一夜掉到零下三十度。丧尸也怕冷，它们往有人的地方挤。' }, onSurvive: { zh: '你活过了第一年。这是上一世没做到的事。' }, onFail: { zh: '这一次，还是没能撑过这个冬天。' } },
  // 匮乏
  { id: 'crisis_scarcity_common', kind: 'crisis', rarity: 'common', crisisKind: 'scarcity', icon: '🍞', name: { zh: '断供' }, desc: { zh: '超市被抢空。' },
    onDraw: { zh: '超市货架空了。连过期的都没剩。' }, onSurvive: { zh: '你早就囤好了。' }, onFail: { zh: '这周你没吃上像样的东西。' } },
  { id: 'crisis_scarcity_fine', kind: 'crisis', rarity: 'fine', crisisKind: 'scarcity', icon: '🍞', name: { zh: '断水' }, desc: { zh: '自来水停了。' },
    onDraw: { zh: '水龙头咳了两声，什么都没出来。' }, onSurvive: { zh: '你的存水撑住了。' }, onFail: { zh: '你去河边打水。回来的时候少了一个人。' } },
  { id: 'crisis_scarcity_rare', kind: 'crisis', rarity: 'rare', crisisKind: 'scarcity', icon: '🍞', name: { zh: '饥荒' }, desc: { zh: '整个城市都在挨饿。' },
    onDraw: { zh: '有人开始吃不该吃的东西。' }, onSurvive: { zh: '你把最后一袋米分成了三十份。够了。' }, onFail: { zh: '饿疯了的人比丧尸更危险。' } },
  { id: 'crisis_scarcity_legendary', kind: 'crisis', rarity: 'legendary', crisisKind: 'scarcity', icon: '🍞', name: { zh: '颗粒无收' }, desc: { zh: '土地死了。' },
    onDraw: { zh: '种下去的东西没有一样发芽。' }, onSurvive: { zh: '空间里的东西救了所有人。' }, onFail: { zh: '你饿死在了一个囤满物资的梦里。' } },
  // 气候
  { id: 'crisis_climate_common', kind: 'crisis', rarity: 'common', crisisKind: 'climate', icon: '❄️', name: { zh: '降温' }, desc: { zh: '第一场寒流。' },
    onDraw: { zh: '早上呼出来的气是白的。' }, onSurvive: { zh: '你翻出了羽绒服。' }, onFail: { zh: '你冻感冒了，浑身没劲。' } },
  { id: 'crisis_climate_fine', kind: 'crisis', rarity: 'fine', crisisKind: 'climate', icon: '🌧️', name: { zh: '暴雨' }, desc: { zh: '连下一周。' },
    onDraw: { zh: '雨下了七天。地下室开始进水。' }, onSurvive: { zh: '你提前把东西搬到了高处。' }, onFail: { zh: '囤的东西泡了一半。' } },
  { id: 'crisis_climate_rare', kind: 'crisis', rarity: 'rare', crisisKind: 'climate', icon: '🔥', name: { zh: '极端高温' }, desc: { zh: '四十五度。' },
    onDraw: { zh: '沥青软了。尸体在街上发酵。' }, onSurvive: { zh: '发电机和水撑住了。' }, onFail: { zh: '中暑倒下的人，醒来时已经不是人了。' } },
  { id: 'crisis_climate_legendary', kind: 'crisis', rarity: 'legendary', crisisKind: 'climate', icon: '🌪️', name: { zh: '气候剧变' }, desc: { zh: '这个世界不打算恢复了。' },
    onDraw: { zh: '一天之内经历了四季。' }, onSurvive: { zh: '堡垒里的温度计纹丝不动。' }, onFail: { zh: '天气杀人，不需要理由。' } },
  // 疫病
  { id: 'crisis_plague_common', kind: 'crisis', rarity: 'common', crisisKind: 'plague', icon: '🤒', name: { zh: '流感' }, desc: { zh: '普通的病，在末日不普通。' },
    onDraw: { zh: '有人开始咳嗽。所有人都盯着他。' }, onSurvive: { zh: '退烧药起效了。' }, onFail: { zh: '你病了一周，什么都干不了。' } },
  { id: 'crisis_plague_fine', kind: 'crisis', rarity: 'fine', crisisKind: 'plague', icon: '🦠', name: { zh: '感染者混入' }, desc: { zh: '有人被咬了没说。' },
    onDraw: { zh: '他说那只是擦伤。' }, onSurvive: { zh: '你及时把他隔离了。他没有怪你。' }, onFail: { zh: '他在夜里变了。' } },
  { id: 'crisis_plague_rare', kind: 'crisis', rarity: 'rare', crisisKind: 'plague', icon: '🦠', name: { zh: '病毒变异' }, desc: { zh: '潜伏期变长了。' },
    onDraw: { zh: '被咬的人三天后才变。没人敢再收留陌生人。' }, onSurvive: { zh: '隔离舱救了整个基地。' }, onFail: { zh: '你们中间有一个人已经不是人了，只是还不知道是谁。' } },
  { id: 'crisis_plague_legendary', kind: 'crisis', rarity: 'legendary', crisisKind: 'plague', icon: '☣️', name: { zh: '基地内爆发' }, desc: { zh: '空气传播。' },
    onDraw: { zh: '这一次不用被咬。' }, onSurvive: { zh: '疫苗原型起效了。沈砚三天没合眼。' }, onFail: { zh: '你在发烧中想起了上一世。' } },
  // 人祸
  { id: 'crisis_human_common', kind: 'crisis', rarity: 'common', crisisKind: 'human', icon: '🔪', name: { zh: '小偷' }, desc: { zh: '有人盯上了你的存货。' },
    onDraw: { zh: '门锁上有新的划痕。' }, onSurvive: { zh: '加固的门让他们放弃了。' }, onFail: { zh: '少了几箱东西。' } },
  { id: 'crisis_human_fine', kind: 'crisis', rarity: 'fine', crisisKind: 'human', icon: '🐦‍⬛', name: { zh: '黑鸦收保护费' }, desc: { zh: '周明宇的人。' },
    onDraw: { zh: '他们挨家敲门。"交一半，保你平安。"' }, onSurvive: { zh: '你没交。他们没敢动手。' }, onFail: { zh: '他们把你的门踹开，拿走了一半。' } },
  { id: 'crisis_human_rare', kind: 'crisis', rarity: 'rare', crisisKind: 'human', icon: '💥', name: { zh: '基地突袭' }, desc: { zh: '有人知道你有多少东西。' },
    onDraw: { zh: '半夜，围墙外有车灯。' }, onSurvive: { zh: '他们退了。但他们记住了你。' }, onFail: { zh: '仓库被搬空了。有人没能活下来。' } },
  { id: 'crisis_human_legendary', kind: 'crisis', rarity: 'legendary', crisisKind: 'human', icon: '⚔️', name: { zh: '全面战争' }, desc: { zh: '势力之间的清算。' },
    onDraw: { zh: '军区和黑鸦开战了。你的基地在中间。' }, onSurvive: { zh: '你选对了边。' }, onFail: { zh: '战争不分敌我。' } },
]
