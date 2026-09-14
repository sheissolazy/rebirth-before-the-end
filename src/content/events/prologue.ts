import type { EventDef } from '../../engine/types'
import { HERO, GIFT, LEAD, HELPER } from './_slots'

const P = { type: 'phase', phase: 'prologue' } as const

export const prologueEvents: EventDef[] = [
  // ---- 公司 ----
  {
    id: 'ev_office_work', kind: 'routine', locationId: 'office', icon: '💼', repeatable: true, weight: 0,
    title: { zh: '去上班' }, text: { zh: '打卡、开会、装作一切正常。周五发薪。' },
    conditions: [P, { type: 'employed', value: true }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '又熬过一周。工资到账。' }, effects: [{ type: 'money', delta: 5000 }] } },
  },
  {
    id: 'ev_office_advance', locationId: 'office', icon: '🧾', once: true, weight: 0,
    title: { zh: '预支年终奖' }, text: { zh: '跟老板说家里出了事。他看了你很久。' },
    conditions: [P, { type: 'employed', value: true }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '"公司最近也困难。"他没给。' }, effects: [] },
      common: { text: { zh: '他预支了一个月工资。' }, effects: [{ type: 'money', delta: 8000 }] },
      fine: { text: { zh: '他预支了整个年终奖。' }, effects: [{ type: 'money', delta: 25000 }] },
      rare: { text: { zh: '他不仅给了钱，还说"你有什么消息也告诉我一声"。' }, effects: [{ type: 'money', delta: 30000 }, { type: 'setFlag', flag: 'boss_curious' }] },
    },
  },
  {
    id: 'ev_office_quit', energy: 1, locationId: 'office', icon: '🚪', once: true, weight: 0,
    title: { zh: '辞职' }, text: { zh: '把最后四周留给自己。' },
    conditions: [P, { type: 'employed', value: true }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '你交了工牌。走出大楼时，风很大。' }, effects: [{ type: 'employment', value: false }, { type: 'money', delta: 3000 }] } },
  },
  // ---- 超市 ----
  {
    id: 'ev_supermarket_bulk', energy: 3, locationId: 'supermarket', icon: '🛒', repeatable: true, weight: 10,
    title: { zh: '亲自去超市搬' }, text: { zh: '网购限购、要等。你亲自去，推三辆车，当场到手。收银员多看了你一眼。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 2000 }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '限购。你只带回来一点。' }, effects: [{ type: 'money', delta: -500 }, { type: 'gainCard', cardId: 'supply_rice_5kg' }, { type: 'gainCard', cardId: 'supply_water_box' }] },
      common: { text: { zh: '搬了两趟。' }, effects: [{ type: 'money', delta: -1500 }, { type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'gainCard', cardId: 'supply_water_box', count: 3 }, { type: 'gainCard', cardId: 'supply_canned', count: 2 }] },
      fine: { text: { zh: '你找到了仓库直销的门路。' }, effects: [{ type: 'money', delta: -2000 }, { type: 'gainCard', cardId: 'supply_rice_5kg', count: 5 }, { type: 'gainCard', cardId: 'supply_water_box', count: 5 }, { type: 'gainCard', cardId: 'supply_canned', count: 4 }] },
      rare: { text: { zh: '理货员帮你把整托盘的东西送到了楼下。' }, effects: [{ type: 'money', delta: -2500 }, { type: 'gainCard', cardId: 'supply_rice_5kg', count: 6 }, { type: 'gainCard', cardId: 'supply_water_box', count: 6 }, { type: 'gainCard', cardId: 'supply_canned', count: 6 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 2 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
    },
  },
  {
    id: 'ev_supermarket_haggle', locationId: 'supermarket', icon: '🗣️', weight: 6,
    title: { zh: '跟理货员套近乎' }, text: { zh: '听说仓库里还有没上架的军用压缩饼干。' },
    conditions: [P], durationWeeks: 1, slots: [HERO, GIFT('daily', '递根烟/送点东西')], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他觉得你是来找茬的。' }, effects: [] },
      common: { text: { zh: '他偷偷给你留了一箱。' }, effects: [{ type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 1 }, { type: 'money', delta: -120 }] },
      fine: { text: { zh: '他给你开了后门。' }, effects: [{ type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 3 }, { type: 'money', delta: -300 }] },
      rare: { text: { zh: '他加了你微信。"以后有货先通知你。"' }, effects: [{ type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 3 }, { type: 'money', delta: -250 }, { type: 'setFlag', flag: 'supermarket_insider' }] },
    },
  },
  // ---- 药店 ----
  {
    id: 'ev_pharmacy_limit', locationId: 'pharmacy', icon: '💊', repeatable: true, weight: 10,
    title: { zh: '买药' }, text: { zh: '抗生素限购一盒。你跑了三家。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 300 }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '店员要处方。' }, effects: [{ type: 'money', delta: -60 }, { type: 'gainCard', cardId: 'supply_bandage', count: 2 }] },
      common: { text: { zh: '买到一盒。' }, effects: [{ type: 'money', delta: -200 }, { type: 'gainCard', cardId: 'supply_antibiotics' }, { type: 'gainCard', cardId: 'supply_bandage', count: 2 }] },
      fine: { text: { zh: '跑了三家，各买一盒。' }, effects: [{ type: 'money', delta: -500 }, { type: 'gainCard', cardId: 'supply_antibiotics', count: 3 }, { type: 'gainCard', cardId: 'supply_medkit' }] },
      rare: { text: { zh: '药店老板说"你是第二个这么买的人"。第一个是个医生。' }, effects: [{ type: 'money', delta: -600 }, { type: 'gainCard', cardId: 'supply_antibiotics', count: 4 }, { type: 'gainCard', cardId: 'supply_medkit', count: 2 }, { type: 'affection', npcId: 'shenyan', delta: 5 }] },
    },
  },
  // ---- 五金 / 户外 ----
  {
    id: 'ev_hardware_tools', locationId: 'hardware', icon: '🔧', repeatable: true, weight: 10,
    title: { zh: '买工具和材料' }, text: { zh: '钢条、木板、消防斧。老板问你是不是装修。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 500 }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你搬不动。' }, effects: [{ type: 'money', delta: -200 }, { type: 'gainCard', cardId: 'supply_wood', count: 2 }] },
      common: { text: { zh: '雇了辆三轮车。' }, effects: [{ type: 'money', delta: -600 }, { type: 'gainCard', cardId: 'supply_steel', count: 2 }, { type: 'gainCard', cardId: 'supply_wood', count: 2 }] },
      fine: { text: { zh: '老板给你打了折。' }, effects: [{ type: 'money', delta: -800 }, { type: 'gainCard', cardId: 'supply_steel', count: 3 }, { type: 'gainCard', cardId: 'supply_wood', count: 2 }, { type: 'gainCard', cardId: 'equip_axe' }] },
      rare: { text: { zh: '你在仓库角落发现一把没上架的复合弩。' }, effects: [{ type: 'money', delta: -1500 }, { type: 'gainCard', cardId: 'supply_steel', count: 3 }, { type: 'gainCard', cardId: 'supply_cement', count: 2 }, { type: 'gainCard', cardId: 'equip_crossbow' }] },
    },
  },
  {
    id: 'ev_hardware_generator', energy: 3, locationId: 'hardware', icon: '⚡', once: true, weight: 0,
    title: { zh: '去店里提发电机' }, text: { zh: '网购要等两周。老板说店里还有一台现货，三千二，自己搬。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 3200 }], durationWeeks: 1, slots: [HERO, HELPER],
    outcomes: { fine: { text: { zh: '你把发电机搬上了六楼。' }, effects: [{ type: 'money', delta: -3200 }, { type: 'gainCard', cardId: 'supply_generator' }, { type: 'gainCard', cardId: 'supply_gasoline', count: 2 }] } },
  },
  // ---- 黑市 ----
  {
    id: 'ev_blackmarket_find', energy: 3, locationId: 'blackmarket', icon: '🕶️', once: true, weight: 0,
    title: { zh: '找到那扇门' }, text: { zh: '上一世你听说过这个地方。地址在一个已经拆掉的网吧后面。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '你在巷子里转了一下午。有人一直跟着你。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '你找到了门，但没人开。' }, effects: [{ type: 'setFlag', flag: 'blackmarket_found' }] },
      fine: { text: { zh: '门开了。里面的人打量了你三秒。' }, effects: [{ type: 'setFlag', flag: 'blackmarket_found' }, { type: 'unlockEvent', eventId: 'ev_blackmarket_gun' }] },
      rare: { text: { zh: '"你是那个到处买东西的女的。"他笑了，"想要什么？"' }, effects: [{ type: 'setFlag', flag: 'blackmarket_found' }, { type: 'unlockEvent', eventId: 'ev_blackmarket_gun' }, { type: 'gainCard', cardId: 'equip_vest' }, { type: 'money', delta: -2500 }] },
    },
  },
  {
    id: 'ev_blackmarket_gun', locationId: 'blackmarket', icon: '🔫', once: true, weight: 0,
    title: { zh: '买一把猎枪' }, text: { zh: '六万。没有讨价还价。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 60000 }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '沉。比你想象的沉。' }, effects: [{ type: 'money', delta: -60000 }, { type: 'gainCard', cardId: 'equip_shotgun' }, { type: 'stat', stat: 'exposure', delta: 10 }] } },
  },
  // ---- 银行 / 券商 ----
  {
    id: 'ev_bank_stock', locationId: 'bank', icon: '📈', once: true, weight: 0, energy: 1,
    title: { zh: '第一只股票' }, text: { zh: '你记得三只股票。这只最稳：下周涨停。投一万。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 10000 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '你改变了太多，它没涨。' }, effects: [{ type: 'money', delta: -10000 }, { type: 'stat', stat: 'butterfly', delta: 8 }, { type: 'unlockEvent', eventId: 'ev_bank_stock2' }] },
      common: { text: { zh: '涨了一点。' }, effects: [{ type: 'money', delta: 8000 }, { type: 'stat', stat: 'butterfly', delta: 8 }, { type: 'unlockEvent', eventId: 'ev_bank_stock2' }] },
      fine: { text: { zh: '翻倍。' }, effects: [{ type: 'money', delta: 20000 }, { type: 'stat', stat: 'butterfly', delta: 8 }, { type: 'unlockEvent', eventId: 'ev_bank_stock2' }] },
      rare: { text: { zh: '连续涨停。你手抖着卖了。' }, effects: [{ type: 'money', delta: 40000 }, { type: 'stat', stat: 'butterfly', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_bank_stock2' }] },
    },
  },
  {
    id: 'ev_bank_stock2', locationId: 'bank', icon: '📈', once: true, weight: 0, energy: 1,
    title: { zh: '第二只股票' }, text: { zh: '这只你记得没那么清。投三万。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 30000 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '跌停。你记错了。' }, effects: [{ type: 'money', delta: -30000 }, { type: 'stat', stat: 'butterfly', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_bank_stock3' }] },
      common: { text: { zh: '小赚。' }, effects: [{ type: 'money', delta: 15000 }, { type: 'stat', stat: 'butterfly', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_bank_stock3' }] },
      fine: { text: { zh: '翻倍。券商给你打了电话，问你是不是有内幕。' }, effects: [{ type: 'money', delta: 60000 }, { type: 'stat', stat: 'butterfly', delta: 10 }, { type: 'stat', stat: 'exposure', delta: 5 }, { type: 'unlockEvent', eventId: 'ev_bank_stock3' }] },
      rare: { text: { zh: '三倍。' }, effects: [{ type: 'money', delta: 120000 }, { type: 'stat', stat: 'butterfly', delta: 12 }, { type: 'stat', stat: 'exposure', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_bank_stock3' }] },
    },
  },
  {
    id: 'ev_bank_stock3', locationId: 'bank', icon: '📈', once: true, weight: 0, energy: 1,
    title: { zh: '第三只股票' }, text: { zh: '这只你其实只记得个名字。投十万。世界已经被你改了太多。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 100000 }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '停牌。钱没了。' }, effects: [{ type: 'money', delta: -100000 }, { type: 'stat', stat: 'butterfly', delta: 15 }] },
      common: { text: { zh: '保本出来。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 15 }] },
      fine: { text: { zh: '翻倍。这是最后一次。' }, effects: [{ type: 'money', delta: 200000 }, { type: 'stat', stat: 'butterfly', delta: 15 }, { type: 'stat', stat: 'exposure', delta: 10 }] },
      rare: { text: { zh: '五倍。有人开始查你的账户。' }, effects: [{ type: 'money', delta: 500000 }, { type: 'stat', stat: 'butterfly', delta: 20 }, { type: 'stat', stat: 'exposure', delta: 20 }] },
    },
  },
  {
    id: 'ev_bank_loan', locationId: 'bank', icon: '💳', once: true, weight: 0,
    title: { zh: '把所有额度借出来' }, text: { zh: '信用卡、网贷、消费贷。反正末日之后没人来催。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '风控把你拒了。' }, effects: [{ type: 'money', delta: 5000 }, { type: 'gainCard', cardId: 'trouble_loan' }] },
      common: { text: { zh: '批了一些。' }, effects: [{ type: 'money', delta: 30000 }, { type: 'gainCard', cardId: 'trouble_loan' }] },
      fine: { text: { zh: '你把每个 App 都点了一遍。' }, effects: [{ type: 'money', delta: 80000 }, { type: 'gainCard', cardId: 'trouble_loan' }] },
      rare: { text: { zh: '连房子都抵押了。你看着余额，第一次觉得末日没那么可怕。' }, effects: [{ type: 'money', delta: 200000 }, { type: 'gainCard', cardId: 'trouble_loan' }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
    },
  },
  {
    id: 'ev_bank_repay', energy: 1, locationId: 'bank', icon: '💸', once: true, weight: 0,
    title: { zh: '提前还清' }, text: { zh: '催收电话一天十个。你可以还清，也可以等末日替你还。' },
    conditions: [P, { type: 'hasCard', cardId: 'trouble_loan' }, { type: 'moneyAtLeast', amount: 20000 }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '还清了。世界清静了四周。' }, effects: [{ type: 'money', delta: -20000 }, { type: 'loseCard', cardId: 'trouble_loan' }] } },
  },
  {
    id: 'ev_bank_sell_car', energy: 1, locationId: 'bank', icon: '🚗', once: true, weight: 0,
    title: { zh: '卖车' }, text: { zh: '末日之后没有加油站。' },
    conditions: [P], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '二手贩子压价压得很狠。你没还价。' }, effects: [{ type: 'money', delta: 40000 }, { type: 'stat', stat: 'butterfly', delta: 3 }] } },
  },
  {
    id: 'ev_bank_lottery', energy: 2, locationId: 'bank', icon: '🎟️', once: true, weight: 0,
    title: { zh: '去省中心兑奖' }, text: { zh: '你记得号码，也中了。五百万，税后四百万。兑奖要去省城，要登记身份证，要上新闻。' },
    conditions: [P, { type: 'flag', flag: 'lottery_memory' }], durationWeeks: 2, slots: [HERO],
    outcomes: { fine: { text: { zh: '四百万到账。第二天，你的脸出现在本地新闻上。亲戚的电话开始响，周明宇也发来了消息。' },
      effects: [{ type: 'money', delta: 4000000 }, { type: 'stat', stat: 'butterfly', delta: 30 }, { type: 'stat', stat: 'exposure', delta: 40 }, { type: 'gainCard', cardId: 'trouble_relatives' }, { type: 'gainCard', cardId: 'trouble_ex' }, { type: 'relation', factionId: 'crow', delta: -20 }, { type: 'setFlag', flag: 'famous_rich' }] } },
  },
  {
    id: 'ev_bank_buy_villa', energy: 1, locationId: 'bank', icon: '🏡', once: true, weight: 0,
    title: { zh: '全款买别墅' }, text: { zh: '带院子，围墙两米。三百万。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 3000000 }, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '你搬了家。中介说你是他见过最痛快的客户。' }, effects: [{ type: 'money', delta: -3000000 }, { type: 'moveBase', baseType: 'villa' }] } },
  },
  {
    id: 'ev_bank_buy_farm', energy: 1, locationId: 'bank', icon: '🌾', once: true, weight: 0,
    title: { zh: '买郊区自建房' }, text: { zh: '有地，有井，离城四十公里。一百五十万。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 1500000 }, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '房主是个老太太。她说"你一个女孩子住这么远做什么"。' }, effects: [{ type: 'money', delta: -1500000 }, { type: 'moveBase', baseType: 'farmhouse' }] } },
  },
  // ---- 家 ----
  {
    id: 'ev_home_workout', kind: 'routine', locationId: 'home', icon: '🏋️', repeatable: true, weight: 0,
    title: { zh: '练体力' }, text: { zh: '跑步、深蹲、搬米袋。' },
    conditions: [], durationWeeks: 1, slots: [HERO], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '第二天下不了床。' }, effects: [] },
      common: { text: { zh: '酸，但有用。' }, effects: [] },
      fine: { text: { zh: '你能一口气搬两袋米上六楼了。' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
      rare: { text: { zh: '你的身体在记住上一世的东西。' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
    },
  },
  {
    id: 'ev_home_read', kind: 'routine', locationId: 'home', icon: '📚', repeatable: true, weight: 0,
    title: { zh: '看书' }, text: { zh: '急救、电工、种植。你上一世后悔没学的。' },
    conditions: [], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '看睡着了。' }, effects: [] },
      common: { text: { zh: '记了一些笔记。' }, effects: [] },
      fine: { text: { zh: '你学会了接电线。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
      rare: { text: { zh: '你在书里找到了一个上一世没人知道的方法。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'intel_memory_fix' }] },
    },
  },
  {
    id: 'ev_home_social', energy: 1, locationId: 'home', icon: '💬', repeatable: true, weight: 4,
    title: { zh: '跟邻居混熟' }, text: { zh: '帮王阿姨拎菜，跟楼下小孩玩。' },
    conditions: [P, { type: 'not', cond: { type: 'baseType', baseType: 'farmhouse' } }, { type: 'not', cond: { type: 'baseType', baseType: 'bunker' } }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '王阿姨问你是不是传销。' }, effects: [] },
      common: { text: { zh: '你知道了谁家有老人、谁家有狗。' }, effects: [{ type: 'affection', npcId: 'auntwang', delta: 5 }] },
      fine: { text: { zh: '你成了楼里"那个热心的姑娘"。' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }, { type: 'affection', npcId: 'auntwang', delta: 10 }] },
      rare: { text: { zh: '楼下一条流浪狗跟你回了家。' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }, { type: 'adoptPet', petId: 'pet_dog' }] },
    },
  },
  {
    id: 'ev_home_village', locationId: 'home', icon: '🧑‍🌾', repeatable: true, weight: 4,
    title: { zh: '跟村里人混熟' }, text: { zh: '帮隔壁老张修水泵，听他讲哪块地涝。' },
    conditions: [P, { type: 'baseType', baseType: 'farmhouse' }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他们觉得城里来的姑娘待不久。' }, effects: [] },
      common: { text: { zh: '老张送了你一筐土豆。' }, effects: [{ type: 'gainCard', cardId: 'supply_seed_potato' }] },
      fine: { text: { zh: '你知道了村里谁家有井、谁家有枪。' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }, { type: 'gainCard', cardId: 'supply_seed_veg', count: 2 }] },
      rare: { text: { zh: '老张家的狗生了崽。他给了你一只。' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }, { type: 'adoptPet', petId: 'pet_dog' }] },
    },
  },
  {
    id: 'ev_home_adopt_dog', kind: 'routine', energy: 1, locationId: 'home', icon: '🐕', once: true, weight: 0,
    title: { zh: '去收容所领养一条狗' }, text: { zh: '五百块领养费。末日后它会在尸潮来之前叫，守夜时比人靠得住。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 500 }, { type: 'not', cond: { type: 'hasPet', species: 'dog' } }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '它上车的时候没回头看一眼笼子。' }, effects: [{ type: 'money', delta: -500 }, { type: 'adoptPet', petId: 'pet_dog' }] } },
  },
  {
    id: 'ev_home_adopt_cat', energy: 1, locationId: 'home', icon: '🐈', once: true, weight: 3,
    title: { zh: '楼道里的猫' }, text: { zh: '它已经在你门口蹲了三天。' },
    conditions: [], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '你开了门。它进来的样子像是回家。' }, effects: [{ type: 'adoptPet', petId: 'pet_cat' }] } },
  },
  {
    id: 'ev_home_call_parents', energy: 1, locationId: 'home', icon: '☎️', once: true, weight: 0,
    title: { zh: '跟爸妈说清楚' }, text: { zh: '你不能说实话。但你可以让他们也囤点东西。' },
    conditions: [P, { type: 'npcInBase', npcId: 'dad', value: false }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '妈妈哭了。她觉得你被骗了。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 3 }] },
      common: { text: { zh: '他们答应买点米。' }, effects: [{ type: 'loseCard', cardId: 'trouble_parents' }] },
      fine: { text: { zh: '爸爸说"你从小就有主意"。第二天他们提着行李来了，还带了三万块。' }, effects: [{ type: 'loseCard', cardId: 'trouble_parents' }, { type: 'setFlag', flag: 'parents_prepared' }, { type: 'npcJoin', npcId: 'dad' }, { type: 'npcJoin', npcId: 'mom' }, { type: 'money', delta: 30000 }] },
      rare: { text: { zh: '爸爸转了你十万，然后和妈妈一起搬了过来。"别问，拿着。"' }, effects: [{ type: 'loseCard', cardId: 'trouble_parents' }, { type: 'setFlag', flag: 'parents_prepared' }, { type: 'npcJoin', npcId: 'dad' }, { type: 'npcJoin', npcId: 'mom' }, { type: 'money', delta: 100000 }] },
    },
  },
  {
    id: 'ev_home_change_number', energy: 2, locationId: 'home', icon: '📵', once: true, weight: 0,
    title: { zh: '换号、搬东西、闭嘴' }, text: { zh: '把所有人拉黑，把值钱的东西转移，对外说钱都拿去还债了。' },
    conditions: [P, { type: 'hasCard', cardId: 'trouble_relatives' }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '你妈把新号码告诉了你姨。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '清静了一半。' }, effects: [{ type: 'loseCard', cardId: 'trouble_relatives' }] },
      fine: { text: { zh: '你成了"那个中奖后就消失的女的"。' }, effects: [{ type: 'loseCard', cardId: 'trouble_relatives' }, { type: 'stat', stat: 'exposure', delta: -15 }] },
    },
  },
  {
    id: 'ev_home_block_ex', energy: 1, locationId: 'home', icon: '🚫', once: true, weight: 0,
    title: { zh: '拉黑周明宇' }, text: { zh: '他又发来消息："听说你最近很有钱？"' },
    conditions: [{ type: 'hasCard', cardId: 'trouble_ex' }], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '他换了个号继续发。' }, effects: [] },
      common: { text: { zh: '你拉黑了他所有的联系方式。' }, effects: [{ type: 'loseCard', cardId: 'trouble_ex' }] },
      fine: { text: { zh: '你搬走了他知道的那个地址上的所有东西。' }, effects: [{ type: 'loseCard', cardId: 'trouble_ex' }, { type: 'stat', stat: 'exposure', delta: -10 }] },
    },
  },
  // ---- 军区门口 ----
  {
    id: 'ev_armygate_warn', kind: 'story', locationId: 'armygate', icon: '🪖', once: true, weight: 0, storylineNpcId: 'guchen',
    title: { zh: '去军区门口示警' }, text: { zh: '你知道他叫顾沉。他不知道你是谁。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '哨兵把你当成了神经病。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '他出来了。听了三分钟，说"谢谢，我们会注意"。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 5 }] },
      fine: { text: { zh: '他盯着你说"你怎么知道那个编号"。' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 10 }, { type: 'unlockEvent', eventId: 'ev_guchen_02' }] },
      rare: { text: { zh: '他记下了你的地址。"如果你说的是真的，我会来找你。"' }, effects: [{ type: 'affection', npcId: 'guchen', delta: 15 }, { type: 'unlockEvent', eventId: 'ev_guchen_02' }, { type: 'relation', factionId: 'army', delta: 10 }] },
    },
  },
  {
    id: 'ev_armygate_buy', locationId: 'armygate', icon: '🎒', once: true, weight: 0,
    title: { zh: '军品店' }, text: { zh: '军区门口的军品店卖压缩饼干和作训服。老板是退伍的。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 1000 }], durationWeeks: 1, slots: [HERO, LEAD('jiangye', '江野')],
    check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '老板不卖给"囤货的"。' }, effects: [] },
      common: { text: { zh: '买了几箱。' }, effects: [{ type: 'money', delta: -800 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 3 }] },
      fine: { text: { zh: '老板从后面搬出一箱"不能卖"的。' }, effects: [{ type: 'money', delta: -1500 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 5 }, { type: 'gainCard', cardId: 'equip_helmet' }] },
      rare: { text: { zh: '"你是江野的朋友？"他把一把弩推过来，"送你。"' }, effects: [{ type: 'money', delta: -1500 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 5 }, { type: 'gainCard', cardId: 'equip_crossbow' }] },
    },
  },
]
