import type { EventDef } from '../engine/types'

/**
 * 样例事件（给 UI 开发用，展示三种形态：每周重复 / 带检定 / 剧情线）。
 * 正式内容在 events/ 目录，按地点分文件（docs/tasks/T-004）。
 */
export const sampleEvents: EventDef[] = [
  {
    id: 'ev_office_work', locationId: 'office', icon: '💼', repeatable: true,
    title: { zh: '去上班' }, text: { zh: '打卡、开会、装作一切正常。周五发薪。' },
    conditions: [{ type: 'employed', value: true }],
    durationWeeks: 1,
    slots: [{ id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } }],
    outcomes: { silver: { text: { zh: '又熬过一周。工资到账。' }, effects: [{ type: 'money', delta: 2500 }, { type: 'employment', value: true }] } },
  },
  {
    id: 'ev_supermarket_haggle', locationId: 'supermarket', icon: '🛒',
    title: { zh: '跟理货员套近乎' }, text: { zh: '听说仓库里还有没上架的大米。' },
    conditions: [{ type: 'month', from: 1, to: 8 }],
    durationWeeks: 1,
    slots: [
      { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } },
      { id: 'helper', label: { zh: '带个人' }, required: false, accepts: { kind: 'npc', minRank: 'friend' } },
      { id: 'gift', label: { zh: '递根烟/送点东西' }, required: false, accepts: { kind: 'supply', supplyKind: 'daily' }, consumes: true, bonusDice: 1 },
    ],
    check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '他觉得你是来找茬的。' }, effects: [{ type: 'stat', stat: 'morale', delta: -1 }] },
      bronze: { text: { zh: '他偷偷给你留了一袋。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 1 }, { type: 'money', delta: -45 }] },
      silver: { text: { zh: '他给你开了后门，你搬了三袋。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'money', delta: -135 }] },
      gold: { text: { zh: '他加了你微信，以后有货先通知你。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'money', delta: -100 }, { type: 'setFlag', flag: 'supermarket_insider' }] },
    },
  },
  {
    id: 'ev_azhe_wifi', locationId: 'home', icon: '📶', once: true, storylineNpcId: 'azhe',
    title: { zh: '隔壁的 Wi-Fi 密码' }, text: { zh: '你家网断了。隔壁那个从不出门的程序员，门缝里透着光。' },
    conditions: [{ type: 'month', from: 1, to: 3 }, { type: 'npcAlive', npcId: 'azhe' }],
    durationWeeks: 1,
    slots: [
      { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } },
      { id: 'gift', label: { zh: '带点吃的' }, required: false, accepts: { kind: 'supply', supplyKind: 'food' }, consumes: true, bonusDice: 2 },
    ],
    check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他隔着门说"我不认识你"。' }, effects: [{ type: 'affection', npcId: 'azhe', delta: -2 }] },
      bronze: { text: { zh: '他把密码写在便利贴上从门缝塞出来。' }, effects: [{ type: 'affection', npcId: 'azhe', delta: 5 }] },
      silver: { text: { zh: '他开了门。屋里三块显示器，一面墙的泡面。' }, effects: [{ type: 'affection', npcId: 'azhe', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_azhe_02' }] },
      gold: { text: { zh: '"你也觉得要出事对吧。"他盯着你，"我看到数据了。"' }, effects: [{ type: 'affection', npcId: 'azhe', delta: 15 }, { type: 'gainCard', cardId: 'intel_azhe_leak' }, { type: 'unlockEvent', eventId: 'ev_azhe_02' }] },
    },
  },
]
