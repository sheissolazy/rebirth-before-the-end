import type { EventDef } from '../../engine/types'
import { HERO, GIFT, LEAD, WEAPON } from './_slots'

const P = { type: 'phase', phase: 'prologue' } as const
const A = { type: 'phase', phase: 'apocalypse' } as const

/**
 * 男主线（先做顾沉 / 沈砚 / 谢临 各 4~5 个，江野 2 个，阿寂 1 个）。
 * Codex 在 T-005 里扩到每人 10 个。链条：unlockEvent 解锁下一段。
 */
export const storyEvents: EventDef[] = [
  // ================= 顾沉 =================
  {
    id: 'ev_guchen_02', kind: 'story', locationId: 'home', icon: '⚡', once: true, weight: 0, storylineNpcId: 'guchen',
    title: { zh: '他真的来了' }, text: { zh: '末日第一周。有人敲门，敲法很有规律。是顾沉，带着两个兵。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'guchen', rank: 'acquaintance' }], durationWeeks: 1, slots: [HERO, GIFT('medicine', '给他们的伤员一些药')], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '他只是确认你还活着，就走了。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 3 }] },
      common: { text: { zh: '"你说的都对了。"他没多说，留下一箱压缩饼干。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 8 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit' }] },
      fine: { text: { zh: '"我需要知道你还知道什么。"' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_guchen_03' }, { type: 'relation', factionId: 'army', delta: 10 }] },
      rare: { text: { zh: '他的手臂上有细小的电弧。他自己没察觉。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 15 }, { type: 'unlockEvent', eventId: 'ev_guchen_03' }, { type: 'relation', factionId: 'army', delta: 15 }, { type: 'setFlag', flag: 'guchen_power_seen' }] },
    },
  },
  {
    id: 'ev_guchen_03', kind: 'story', locationId: 'armygate', icon: '⚡', once: true, weight: 0, storylineNpcId: 'guchen',
    title: { zh: '告诉他六月的事' }, text: { zh: '六月会出现会跑的丧尸。上一世军区损失了一个连。' },
    conditions: [A, { type: 'month', from: 2, to: 6 }, { type: 'affectionAtLeast', npcId: 'guchen', rank: 'acquaintance' }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '参谋们觉得你在编故事。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 2 }] },
      common: { text: { zh: '他记下了。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 8 }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
      fine: { text: { zh: '他当场调整了防线。"你救了很多人，虽然他们不知道。"' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 12 }, { type: 'stat', stat: 'butterfly', delta: 8 }, { type: 'relation', factionId: 'army', delta: 15 }, { type: 'unlockEvent', eventId: 'ev_guchen_04' }] },
      rare: { text: { zh: '他把一张通行证放在你手里。"随时可以进来。"' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 15 }, { type: 'stat', stat: 'butterfly', delta: 8 }, { type: 'relation', factionId: 'army', delta: 20 }, { type: 'unlockEvent', eventId: 'ev_guchen_04' }, { type: 'gainCard', cardId: 'intel_army_radio' }] },
    },
  },
  {
    id: 'ev_guchen_04', kind: 'story', locationId: 'armygate', icon: '⚡', once: true, weight: 0, storylineNpcId: 'guchen',
    title: { zh: '他的雷' }, text: { zh: '尸群冲墙的那晚，他的手指间炸开一道白光。他吓到了。你没有。' },
    conditions: [A, { type: 'month', from: 6, to: 12 }, { type: 'affectionAtLeast', npcId: 'guchen', rank: 'friend' }], durationWeeks: 1, slots: [HERO, WEAPON], check: { attrs: ['charm', 'strength'] },
    outcomes: {
      fail: { text: { zh: '你在混乱中受了伤。他把你送回来，没说话。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'affection', npcId: 'guchen', delta: 5 }] },
      common: { text: { zh: '"你早就知道。"他说。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 10 }, { type: 'gainCard', cardId: 'skill_guchen_thunder' }] },
      fine: { text: { zh: '"上一世你怎么死的？"他第一次问这个。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 15 }, { type: 'gainCard', cardId: 'skill_guchen_thunder' }, { type: 'unlockEvent', eventId: 'ev_guchen_05' }] },
      rare: { text: { zh: '他握住你的手，电流没有伤到你。"看来它认得你。"' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 20 }, { type: 'gainCard', cardId: 'skill_guchen_thunder' }, { type: 'unlockEvent', eventId: 'ev_guchen_05' }] },
    },
  },
  {
    id: 'ev_guchen_05', kind: 'story', energy: 1, locationId: 'home', icon: '⚡', once: true, weight: 0, storylineNpcId: 'guchen',
    title: { zh: '"住到我这里来"' }, text: { zh: '他站在你门口，说的是军区。你说的是这里。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'guchen', rank: 'crush' }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他走了。第二天送来一个班的兵守你的楼。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 5 }, { type: 'relation', factionId: 'army', delta: 10 }, { type: 'status', id: 'army_guard', weeks: 4 }] },
      common: { text: { zh: '他每周来两次。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 10 }] },
      fine: { text: { zh: '他搬了进来。军装挂在你衣柜里，很不搭。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 15 }, { type: 'npcJoin', npcId: 'guchen' }] },
    },
  },
  // ================= 沈砚 =================
  {
    id: 'ev_shenyan_01', kind: 'story', locationId: 'pharmacy', icon: '🩺', once: true, weight: 0, storylineNpcId: 'shenyan',
    title: { zh: '药店里的另一个人' }, text: { zh: '他在买和你一样的东西。抗生素、退烧药、消毒水。他看你的眼神像在看同行。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '你们抢了最后一盒抗生素。他让给了你，没说话。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 3 }, { type: 'gainCard', cardId: 'supply_antibiotics' }] },
      common: { text: { zh: '"你也觉得要出事。"不是问句。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 8 }] },
      fine: { text: { zh: '他留了电话。"如果有人发烧超过三天，联系我。"' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_shenyan_02' }] },
      rare: { text: { zh: '"病毒的名字。你知道吗？"你说了。他的脸白了。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 15 }, { type: 'unlockEvent', eventId: 'ev_shenyan_02' }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
    },
  },
  {
    id: 'ev_shenyan_02', kind: 'story', locationId: 'hospital', icon: '🩺', once: true, weight: 0, storylineNpcId: 'shenyan',
    title: { zh: '医院最后的人' }, text: { zh: '医院已经沦陷。三楼还有灯。他一个人守着二十个病人。' },
    conditions: [A, { type: 'month', from: 1, to: 8 }], durationWeeks: 1, slots: [HERO, GIFT('energy', '给他电'), WEAPON], check: { attrs: ['strength', 'charm'] },
    outcomes: {
      fail: { text: { zh: '你没能上到三楼。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '你把电池留下就走了。他在楼上喊了一句谢谢。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 8 }] },
      fine: { text: { zh: '你帮他把病人转移到了地下室。他第一次笑了。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_shenyan_03' }] },
      rare: { text: { zh: '"你说的那个名字，我在显微镜下看到了。"' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 15 }, { type: 'unlockEvent', eventId: 'ev_shenyan_03' }, { type: 'setFlag', flag: 'vaccine_1' }] },
    },
  },
  {
    id: 'ev_shenyan_03', kind: 'story', locationId: 'home', icon: '🩺', once: true, weight: 0, storylineNpcId: 'shenyan',
    title: { zh: '他倒下了' }, text: { zh: '七月。他在你门口晕倒。四十度。' },
    conditions: [A, { type: 'month', from: 6, to: 10 }, { type: 'affectionAtLeast', npcId: 'shenyan', rank: 'acquaintance' }], durationWeeks: 2, slots: [HERO, GIFT('medicine', '用药')], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '你守了三天。他醒了，但更瘦了。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 10 }, { type: 'injure', target: 'shenyan', severity: 2 }] },
      common: { text: { zh: '他醒来第一句是"我的样本呢"。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 12 }, { type: 'injure', target: 'shenyan', severity: 1 }] },
      fine: { text: { zh: '他醒来时你在旁边睡着了。他没叫醒你。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 18 }, { type: 'gainCard', cardId: 'skill_shenyan_heal' }, { type: 'unlockEvent', eventId: 'ev_shenyan_04' }] },
      rare: { text: { zh: '"上一世，我是不是死在这里。"他问。你没回答。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 22 }, { type: 'gainCard', cardId: 'skill_shenyan_heal' }, { type: 'unlockEvent', eventId: 'ev_shenyan_04' }, { type: 'stat', stat: 'butterfly', delta: 10 }] },
    },
  },
  {
    id: 'ev_shenyan_04', kind: 'story', energy: 1, locationId: 'home', icon: '🩺', once: true, weight: 0, storylineNpcId: 'shenyan',
    title: { zh: '实验室搬进你家' }, text: { zh: '他需要一个稳定的地方。你有。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'shenyan', rank: 'friend' }], durationWeeks: 1, slots: [HERO, GIFT('energy', '给实验室供电')],
    check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '他去了军区。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 3 }] },
      common: { text: { zh: '他白天在你这里，晚上回医院。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 10 }] },
      fine: { text: { zh: '显微镜摆在你餐桌上。他搬进来了。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 15 }, { type: 'npcJoin', npcId: 'shenyan' }, { type: 'setFlag', flag: 'vaccine_2' }] },
    },
  },
  // ================= 谢临 =================
  {
    id: 'ev_xielin_01', kind: 'story', locationId: 'supermarket', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '另一个买空货架的人' }, text: { zh: '他推着三辆车，和你一样。他看你的第一眼，像在确认什么。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '他抢走了最后一箱压缩饼干。笑了一下。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: -2 }, { type: 'stat', stat: 'butterfly', delta: 3 }] },
      common: { text: { zh: '"你也是？"他问。你装没听懂。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 5 }] },
      fine: { text: { zh: '"第几次？"他问。你愣住了。"我第三次。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_xielin_02' }, { type: 'setFlag', flag: 'xielin_known' }] },
      rare: { text: { zh: '"上一世我见过你。"他说，"在第三年的地铁站。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_xielin_02' }, { type: 'setFlag', flag: 'xielin_known' }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
    },
  },
  {
    id: 'ev_xielin_01b', kind: 'story', locationId: 'ruin_market', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '废墟里另一个有备而来的人' }, text: { zh: '超市废墟里，有人比你先到，而且拿的全是对的东西。他看你的眼神像在确认什么。' },
    conditions: [A, { type: 'month', from: 1, to: 6 }, { type: 'not', cond: { type: 'flag', flag: 'xielin_known' } }], durationWeeks: 1, slots: [HERO, WEAPON], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '他抢先搬走了冷库的罐头。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: -2 }] },
      common: { text: { zh: '"你也是？"他问。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 8 }, { type: 'setFlag', flag: 'xielin_known' }] },
      fine: { text: { zh: '"第几次？"他问。"我第三次。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 15 }, { type: 'setFlag', flag: 'xielin_known' }] },
      rare: { text: { zh: '"上一世我见过你。"他说，"在第三年的地铁站。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 20 }, { type: 'setFlag', flag: 'xielin_known' }, { type: 'gainCard', cardId: 'intel_xielin_note' }] },
    },
  },
  {
    id: 'ev_xielin_02', kind: 'story', energy: 1, locationId: 'home', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '交换记忆' }, text: { zh: '他知道第三年以后的事。你知道他不知道的细节。谁先说？' },
    conditions: [A, { type: 'month', from: 1, to: 6 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '他套走了你的话，什么都没给。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 2 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '他告诉了你四月的事。是真的。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 8 }, { type: 'revealCrisis', monthsAhead: 1 }] },
      fine: { text: { zh: '"第八年我死在了谁手里，你猜。"他把便条塞给你。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 12 }, { type: 'gainCard', cardId: 'intel_xielin_note' }, { type: 'unlockEvent', eventId: 'ev_xielin_03' }] },
      rare: { text: { zh: '你们对着日历把两世的记忆拼在一起。有一段，两个人的记忆是矛盾的。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 15 }, { type: 'gainCard', cardId: 'intel_xielin_note', count: 2 }, { type: 'unlockEvent', eventId: 'ev_xielin_03' }, { type: 'stat', stat: 'butterfly', delta: -10 }] },
    },
  },
  {
    id: 'ev_xielin_03', kind: 'story', locationId: 'factory', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '他的时间' }, text: { zh: '工厂里尸群围了上来。他抓住你的手腕，世界慢了下来。' },
    conditions: [A, { type: 'month', from: 3, to: 10 }, { type: 'affectionAtLeast', npcId: 'xielin', rank: 'acquaintance' }], durationWeeks: 1, slots: [HERO, WEAPON], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你们逃出来了。他用完异能吐了血。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 8 }, { type: 'injure', target: 'xielin', severity: 1 }] },
      common: { text: { zh: '"这个我上一世第二年才觉醒。"他说，"因为你。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 12 }, { type: 'gainCard', cardId: 'skill_xielin_slow' }] },
      fine: { text: { zh: '慢下来的三秒里，你看清了他的表情。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 15 }, { type: 'gainCard', cardId: 'skill_xielin_slow' }, { type: 'unlockEvent', eventId: 'ev_xielin_04' }, { type: 'gainRandom', table: 'loot_zombie', count: 3 }] },
      rare: { text: { zh: '"上一世你死的时候，我在。"他说，"我来晚了。"' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 20 }, { type: 'gainCard', cardId: 'skill_xielin_slow' }, { type: 'unlockEvent', eventId: 'ev_xielin_04' }, { type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'setFlag', flag: 'xielin_truth' }] },
    },
  },
  {
    id: 'ev_xielin_04', kind: 'story', energy: 1, locationId: 'home', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '两个重生者的基地' }, text: { zh: '"分开囤，两边都不够。"他说，"合起来。"' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'xielin', rank: 'friend' }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '你们谈崩了。他带走了一半东西。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: -10 }, { type: 'loseCard', cardId: 'supply_compressed_biscuit', count: 2 }] },
      common: { text: { zh: '他把仓库搬了过来，人没来。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 8 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 3 }, { type: 'gainCard', cardId: 'supply_gasoline', count: 2 }] },
      fine: { text: { zh: '他搬进来了。带着两世的东西。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 15 }, { type: 'npcJoin', npcId: 'xielin' }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 3 }, { type: 'gainCard', cardId: 'supply_gasoline', count: 2 }, { type: 'gainCard', cardId: 'core_rare' }] },
    },
  },
  {
    id: 'ev_shenyan_05', kind: 'story', energy: 1, locationId: 'home', icon: '🩺', once: true, weight: 0, storylineNpcId: 'shenyan',
    title: { zh: '第一支' }, text: { zh: '他做出了疫苗的第一支原型。他没先给军区，也没先给自己。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'shenyan', rank: 'crush' }, { type: 'month', from: 8, to: 12 }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '"我不知道有没有用。"他说，"但我想先知道你会不会有事。"' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 20 }, { type: 'setFlag', flag: 'vaccine_3' }, { type: 'npcJoin', npcId: 'shenyan' }] } },
  },
  {
    id: 'ev_xielin_05', kind: 'story', energy: 1, locationId: 'home', icon: '⏳', once: true, weight: 0, storylineNpcId: 'xielin',
    title: { zh: '第三年的地铁站' }, text: { zh: '他终于说了那件事：上一世你死的那天，他在，他来晚了。这一世他提前了两年。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'xielin', rank: 'crush' }, { type: 'month', from: 7, to: 12 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '你没说话。他也没再说。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 5 }] },
      fine: { text: { zh: '"这一世你不用赶。"你说。他笑了，两世第一次。' }, effects: [{ type: 'affection', npcId: 'xielin', delta: 20 }, { type: 'setFlag', flag: 'xielin_truth' }] },
    },
  },
  // ================= 江野 =================
  {
    id: 'ev_jiangye_01', kind: 'story', locationId: 'hardware', icon: '🔥', once: true, weight: 0, storylineNpcId: 'jiangye',
    title: { zh: '找到江野' }, text: { zh: '他在户外店后面修车。上一世他替你挡了那一下。你不知道怎么开口。' },
    conditions: [P, { type: 'npcAlive', npcId: 'jiangye' }], durationWeeks: 1, slots: [HERO, GIFT('weapon', '带件东西')], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '"你最近是不是压力太大。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 2 }] },
      common: { text: { zh: '他没笑。"你说的我记住了。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 8 }] },
      fine: { text: { zh: '"我信你。"他说得太快，你反而愣住了。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_jiangye_02' }] },
      rare: { text: { zh: '他当场收拾了工具箱。"去你家，我看看门。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 15 }, { type: 'npcJoin', npcId: 'jiangye' }, { type: 'unlockEvent', eventId: 'ev_jiangye_02' }] },
    },
  },
  {
    id: 'ev_jiangye_02', kind: 'story', locationId: 'home', icon: '🔥', once: true, weight: 0, storylineNpcId: 'jiangye',
    title: { zh: '他的队伍' }, text: { zh: '末日之后，他带着六个人来敲你的门。都是退伍的。' },
    conditions: [A, { type: 'month', from: 1, to: 4 }, { type: 'affectionAtLeast', npcId: 'jiangye', rank: 'acquaintance' }], durationWeeks: 1, slots: [HERO, LEAD('jiangye', '江野')], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你家太小。他们去了军区。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 5 }, { type: 'relation', factionId: 'army', delta: 5 }] },
      common: { text: { zh: '他留下两个人守你的楼。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 8 }, { type: 'recruitRandom' }] },
      fine: { text: { zh: '他自己留下了。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 12 }, { type: 'npcJoin', npcId: 'jiangye' }, { type: 'gainCard', cardId: 'skill_jiangye_guard' }, { type: 'recruitRandom' }] },
      rare: { text: { zh: '他留下了，还带来了一箱弩箭和一条狗。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 15 }, { type: 'npcJoin', npcId: 'jiangye' }, { type: 'gainCard', cardId: 'skill_jiangye_guard' }, { type: 'recruitRandom' }, { type: 'gainCard', cardId: 'supply_bolts', count: 3 }, { type: 'adoptPet', petId: 'pet_dog' }] },
    },
  },
  {
    id: 'ev_jiangye_03', kind: 'story', energy: 1, locationId: 'home', icon: '🔥', once: true, weight: 0, storylineNpcId: 'jiangye',
    title: { zh: '"这次换我站你后面"' }, text: { zh: '他说他记得那一下——不是上一世的，是小时候你替他挨的那一巴掌。' },
    conditions: [A, { type: 'affectionAtLeast', npcId: 'jiangye', rank: 'crush' }, { type: 'month', from: 5, to: 12 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '你笑着岔开了话题。他没追。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 5 }] },
      fine: { text: { zh: '"以后你站我后面。"你说。"不。"他说，"并排。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 20 }, { type: 'npcJoin', npcId: 'jiangye' }] },
    },
  },
  // ================= 阿寂 =================
  {
    id: 'ev_aji_01', kind: 'main', energy: 1, locationId: 'home', icon: '🧟', once: true, weight: 0, storylineNpcId: 'aji',
    title: { zh: '不会腐烂的男人' }, text: { zh: '十二月。极寒。尸潮外面站着一个人。所有丧尸绕开他走。他抬头看着你的窗。' },
    conditions: [A, { type: 'month', from: 12, to: 12 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你没开窗。他走了，尸潮跟着走了一半。' }, effects: [{ type: 'affection', npcId: 'aji', delta: 5 }] },
      common: { text: { zh: '你隔着玻璃看了他很久。他做了一个"嘘"的手势。' }, effects: [{ type: 'affection', npcId: 'aji', delta: 10 }] },
      fine: { text: { zh: '你扔下去一条毛毯。他接住了。尸潮退了。' }, effects: [{ type: 'affection', npcId: 'aji', delta: 15 }, { type: 'resolveCrisis' }, { type: 'loseCard', cardId: 'supply_blanket' }] },
      rare: { text: { zh: '"你认识我。"他说。声音像很久没用过。你点头。' }, effects: [{ type: 'affection', npcId: 'aji', delta: 20 }, { type: 'resolveCrisis' }, { type: 'gainCard', cardId: 'skill_aji_command' }, { type: 'setFlag', flag: 'aji_met' }] },
    },
  },
  // ================= 修罗场 =================
  {
    id: 'ev_home_confrontation', kind: 'main', energy: 1, locationId: 'home', icon: '💔', once: true, weight: 0,
    title: { zh: '他们在同一张桌子上' }, text: { zh: '谁都没说话。你知道他们都知道。' },
    conditions: [A, { type: 'crushesInBase', min: 2 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '有人摔门走了。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: -20 }, { type: 'affection', npcId: 'shenyan', delta: -20 }, { type: 'affection', npcId: 'xielin', delta: -20 }, { type: 'affection', npcId: 'jiangye', delta: -20 }] },
      common: { text: { zh: '这顿饭很难吃。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: -5 }, { type: 'affection', npcId: 'shenyan', delta: -5 }, { type: 'affection', npcId: 'xielin', delta: -5 }, { type: 'affection', npcId: 'jiangye', delta: -5 }] },
      fine: { text: { zh: '"末日了。"你说，"我不选。"没人反对。' }, effects: [] },
      rare: { text: { zh: '他们互相看了一眼，然后同时给你夹了菜。' }, effects: [{ type: 'setFlag', flag: 'harmony' }] },
    },
  },
]
