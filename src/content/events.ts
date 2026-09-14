import type { EventDef } from '../engine/types'

/**
 * 事件样例（展示四种形态：每周重复 / 带检定 / 剧情线 / 剧情解危机）。
 * 正式内容在 events/ 目录按地点分文件（docs/tasks/T-004、T-005）。
 */
export const events: EventDef[] = [
  {
    id: 'ev_office_work', locationId: 'office', icon: '💼', repeatable: true, weight: 0,
    title: { zh: '去上班' }, text: { zh: '打卡、开会、装作一切正常。周五发薪。' },
    conditions: [{ type: 'phase', phase: 'prologue' }, { type: 'employed', value: true }],
    durationWeeks: 1,
    slots: [{ id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } }],
    outcomes: { fine: { text: { zh: '又熬过一周。工资到账。' }, effects: [{ type: 'money', delta: 5000 }] } },
  },
  {
    id: 'ev_bank_stock', locationId: 'bank', icon: '📈', weight: 0,
    title: { zh: '买那只股票' }, text: { zh: '你记得它下周涨停。也记得你上一世没敢买。' },
    conditions: [{ type: 'phase', phase: 'prologue' }, { type: 'moneyAtLeast', amount: 10000 }, { type: 'not', cond: { type: 'flag', flag: 'stock_used_3' } }],
    durationWeeks: 1,
    slots: [{ id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } }],
    check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '你改变了太多，它没涨。' }, effects: [{ type: 'money', delta: -10000 }, { type: 'stat', stat: 'butterfly', delta: 10 }] },
      common: { text: { zh: '涨了一点。' }, effects: [{ type: 'money', delta: 10000 }, { type: 'stat', stat: 'butterfly', delta: 10 }] },
      fine: { text: { zh: '翻倍。' }, effects: [{ type: 'money', delta: 20000 }, { type: 'stat', stat: 'butterfly', delta: 10 }] },
      rare: { text: { zh: '连续涨停。你手抖着卖了。' }, effects: [{ type: 'money', delta: 50000 }, { type: 'stat', stat: 'butterfly', delta: 15 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
    },
  },
  {
    id: 'ev_jiangye_01', locationId: 'hardware', icon: '🔥', once: true, weight: 0, storylineNpcId: 'jiangye',
    title: { zh: '找到江野' }, text: { zh: '他在户外店后面修车。上一世他替你挡了那一下。你不知道怎么开口。' },
    conditions: [{ type: 'phase', phase: 'prologue' }, { type: 'npcAlive', npcId: 'jiangye' }],
    durationWeeks: 1,
    slots: [
      { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } },
      { id: 'gift', label: { zh: '带件东西' }, required: false, accepts: { kind: 'supply', supplyKind: 'weapon' }, consumes: true, bonusDice: 2 },
    ],
    check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '"你最近是不是压力太大。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 2 }] },
      common: { text: { zh: '他没笑。"你说的我记住了。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 8 }] },
      fine: { text: { zh: '"我信你。"他说得太快，你反而愣住了。' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 12 }, { type: 'unlockEvent', eventId: 'ev_jiangye_02' }] },
      rare: { text: { zh: '他当场收拾了工具箱。"去你家，我看看门。"' }, effects: [{ type: 'affection', npcId: 'jiangye', delta: 15 }, { type: 'npcJoin', npcId: 'jiangye' }, { type: 'unlockEvent', eventId: 'ev_jiangye_02' }] },
    },
  },
  {
    id: 'ev_ruin_scavenge', locationId: 'ruin_market', icon: '🛒', weight: 10, repeatable: true,
    title: { zh: '翻超市废墟' }, text: { zh: '货架倒了一半。仓库那边好像没人去过。' },
    conditions: [{ type: 'phase', phase: 'apocalypse' }],
    durationWeeks: 1,
    slots: [
      { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } },
      { id: 'helper', label: { zh: '带个人' }, required: false, accepts: { kind: 'companion' } },
      { id: 'pet', label: { zh: '带猫' }, required: false, accepts: { kind: 'pet', species: 'cat' }, bonusDice: 1 },
    ],
    check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '仓库里有东西在动。你跑了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '捡了点零碎。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 1 }] },
      fine: { text: { zh: '仓库没被翻过。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 3 }] },
      rare: { text: { zh: '你在冷库后面找到了整托盘的罐头。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 5 }, { type: 'gainCard', cardId: 'core_common' }] },
    },
  },
  {
    id: 'ev_home_mutual_aid', locationId: 'home', icon: '📢', once: true, weight: 0, resolvesCrisis: 'human',
    title: { zh: '组织全楼互助' }, text: { zh: '黑鸦要来收保护费。你把楼里还活着的人叫到一起。' },
    conditions: [{ type: 'phase', phase: 'apocalypse' }, { type: 'crisisActive', crisisKind: 'human' }, { type: 'baseType', baseType: 'apartment' }],
    durationWeeks: 1,
    slots: [
      { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } },
      { id: 'helper', label: { zh: '王阿姨' }, required: false, accepts: { kind: 'npc', npcId: 'auntwang' }, bonusDice: 2 },
    ],
    check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '没人信你。第二天有人把你的门牌号告诉了黑鸦。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 15 }] },
      common: { text: { zh: '三户人答应轮流守门。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 5 }] },
      fine: { text: { zh: '整层楼封了楼梯。黑鸦来了一次，没上来。' }, effects: [{ type: 'resolveCrisis' }, { type: 'relation', factionId: 'alliance', delta: 10 }] },
      rare: { text: { zh: '你成了这栋楼的主心骨。有人主动搬来和你一起住。' }, effects: [{ type: 'resolveCrisis' }, { type: 'recruitRandom' }, { type: 'relation', factionId: 'alliance', delta: 15 }] },
    },
  },
]
