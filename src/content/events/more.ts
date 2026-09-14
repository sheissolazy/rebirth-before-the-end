import type { EventDef } from '../../engine/types'
import { HERO, LEADER, HELPER, WEAPON, CAT } from './_slots'

const P = { type: 'phase', phase: 'prologue' } as const
const A = { type: 'phase', phase: 'apocalypse' } as const

/** 第三批事件：增加可玩度（序章 5 + 末日后 9） */
export const moreEvents: EventDef[] = [
  // ================= 序章 =================
  {
    id: 'ev_supermarket_promo', energy: 1, locationId: 'supermarket', icon: '🏷️', weight: 6,
    title: { zh: '会员日囤罐头' }, text: { zh: '罐头买十送三。收银员说"你是今天第三个这么买的"。' },
    conditions: [P, { type: 'moneyAtLeast', amount: 800 }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '你到的时候货架空了。' }, effects: [] },
      common: { text: { zh: '抢到五箱。' }, effects: [{ type: 'money', delta: -300 }, { type: 'gainCard', cardId: 'supply_canned', count: 5 }] },
      fine: { text: { zh: '你让理货员从仓库又推了一车。' }, effects: [{ type: 'money', delta: -500 }, { type: 'gainCard', cardId: 'supply_canned', count: 9 }] },
      rare: { text: { zh: '整托盘。你叫了辆货拉拉。' }, effects: [{ type: 'money', delta: -800 }, { type: 'gainCard', cardId: 'supply_canned', count: 14 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
    },
  },
  {
    id: 'ev_pharmacy_owner', energy: 1, locationId: 'pharmacy', icon: '🤝', once: true, weight: 0,
    title: { zh: '跟药店老板交个朋友' }, text: { zh: '他一个人守店二十年。你帮他搬了两箱货。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他觉得你另有所图。' }, effects: [] },
      common: { text: { zh: '他多给了你两板退烧药。' }, effects: [{ type: 'gainCard', cardId: 'supply_bandage', count: 2 }] },
      fine: { text: { zh: '"以后限购的东西，你先来。"' }, effects: [{ type: 'gainCard', cardId: 'supply_antibiotics', count: 2 }, { type: 'setFlag', flag: 'pharmacy_friend' }, { type: 'attr', target: 'hero', attr: 'charm', delta: 1 }] },
      rare: { text: { zh: '他把仓库钥匙的备份给了你。"要是真出事，别客气。"' }, effects: [{ type: 'gainCard', cardId: 'supply_antibiotics', count: 3 }, { type: 'gainCard', cardId: 'supply_medkit' }, { type: 'setFlag', flag: 'pharmacy_friend' }, { type: 'attr', target: 'hero', attr: 'charm', delta: 1 }] },
    },
  },
  {
    id: 'ev_hardware_class', energy: 1, locationId: 'hardware', icon: '🏹', weight: 5,
    title: { zh: '跟老板学改弩' }, text: { zh: '五金店老板年轻时是射箭队的。他教你怎么把弩弦换成钢丝。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '你把弦崩断了。' }, effects: [{ type: 'money', delta: -100 }] },
      common: { text: { zh: '学会了换弦。' }, effects: [{ type: 'gainCard', cardId: 'supply_bolts', count: 2 }] },
      fine: { text: { zh: '你改好的弩比店里卖的准。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'supply_bolts', count: 3 }] },
      rare: { text: { zh: '老板把自己那把复合弩送给了你。"我用不上了。"' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'equip_crossbow' }, { type: 'gainCard', cardId: 'supply_bolts', count: 3 }] },
    },
  },
  {
    id: 'ev_bank_sell_jewelry', energy: 1, locationId: 'bank', icon: '💍', once: true, weight: 0,
    title: { zh: '卖首饰' }, text: { zh: '外婆留的金镯子。末日后金子不能吃。' },
    conditions: [P], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '金店压价压得狠。' }, effects: [{ type: 'money', delta: 8000 }] },
      common: { text: { zh: '按当天金价卖的。' }, effects: [{ type: 'money', delta: 15000 }] },
      fine: { text: { zh: '你找了三家比价。' }, effects: [{ type: 'money', delta: 22000 }] },
      rare: { text: { zh: '镯子是老货，收藏家出了高价。' }, effects: [{ type: 'money', delta: 40000 }] },
    },
  },
  {
    id: 'ev_office_colleague', energy: 1, locationId: 'office', icon: '👩‍💼', once: true, weight: 0,
    title: { zh: '同事想跟你一起囤' }, text: { zh: '她注意到你的朋友圈。"我不问为什么，带我一个。"' },
    conditions: [P, { type: 'employed', value: true }], durationWeeks: 1, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '她把你的话当笑话讲给了全办公室。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 10 }] },
      common: { text: { zh: '你给了她一份清单。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 3 }] },
      fine: { text: { zh: '她拼单帮你分摊了运费，还多买了一份给你。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'gainCard', cardId: 'supply_water_box', count: 3 }, { type: 'setFlag', flag: 'colleague_warned' }, { type: 'stat', stat: 'butterfly', delta: 3 }] },
      rare: { text: { zh: '她说末日后来找你。她是护士。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'gainCard', cardId: 'supply_medkit' }, { type: 'setFlag', flag: 'colleague_warned' }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
    },
  },
  // ================= 末日后 =================
  {
    id: 'ev_home_colleague_arrives', energy: 1, locationId: 'home', icon: '👩‍⚕️', once: true, weight: 0, kind: 'story',
    title: { zh: '她真的来了' }, text: { zh: '序章那个同事，背着一个大包站在楼下。她说她是护士。' },
    conditions: [A, { type: 'flag', flag: 'colleague_warned' }, { type: 'month', from: 1, to: 3 }], durationWeeks: 1, slots: [HERO],
    outcomes: { fine: { text: { zh: '她带来了半个急救箱和一双手。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 40, rare: 60 } }, { type: 'gainCard', cardId: 'supply_medkit' }] } },
  },
  {
    id: 'ev_apartments_rooftop', locationId: 'apartments', icon: '☀️', weight: 6,
    title: { zh: '拆楼顶的太阳能板' }, text: { zh: '对面楼顶有一排板子。拆下来能用。' },
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '楼梯间有东西。你们退了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '拆下来两块，一块碎了。' }, effects: [{ type: 'gainCard', cardId: 'supply_battery', count: 2 }] },
      fine: { text: { zh: '四块，还有逆变器。' }, effects: [{ type: 'gainCard', cardId: 'supply_battery', count: 3 }, { type: 'gainCard', cardId: 'supply_steel' }] },
      rare: { text: { zh: '你找到了整套系统。够基地用的。' }, effects: [{ type: 'gainCard', cardId: 'supply_battery', count: 4 }, { type: 'gainCard', cardId: 'supply_steel', count: 2 }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
  {
    id: 'ev_gas_convenience', energy: 1, locationId: 'gasstation', icon: '🏪', weight: 6,
    title: { zh: '加油站的便利店' }, text: { zh: '小鱼守着这家店。她什么都有，什么都要换。' },
    conditions: [A, { type: 'npcAlive', npcId: 'xiaoyu' }, { type: 'status', id: 'lowkey', value: false }], durationWeeks: 1, slots: [LEADER, { id: 'trade', label: { zh: '拿去换的东西' }, required: false, accepts: { kind: 'supply' }, consumes: true, bonusDice: 2 }], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '她嫌你的东西不值钱。' }, effects: [{ type: 'affection', npcId: 'xiaoyu', delta: -2 }] },
      common: { text: { zh: '换了两箱功能饮料。' }, effects: [{ type: 'gainCard', cardId: 'supply_energy_drink', count: 2 }, { type: 'affection', npcId: 'xiaoyu', delta: 3 }] },
      fine: { text: { zh: '她多塞了一箱罐头。"下次带点安全的东西来。"' }, effects: [{ type: 'gainCard', cardId: 'supply_energy_drink', count: 2 }, { type: 'gainCard', cardId: 'supply_canned' }, { type: 'affection', npcId: 'xiaoyu', delta: 6 }] },
      rare: { text: { zh: '她告诉你黑鸦下周要来收店。"你要是能帮我……"' }, effects: [{ type: 'gainCard', cardId: 'supply_energy_drink', count: 3 }, { type: 'gainCard', cardId: 'supply_canned', count: 2 }, { type: 'affection', npcId: 'xiaoyu', delta: 10 }, { type: 'revealCrisis', monthsAhead: 1 }] },
    },
  },
  {
    id: 'ev_factory_forge', locationId: 'factory', icon: '⚒️', weight: 5,
    title: { zh: '在车间改装武器' }, text: { zh: '砂轮还能转。把消防斧开刃，给长矛加倒钩。' },
    conditions: [A, { type: 'hasSupplyKind', supplyKind: 'material', minPoints: 2 }], durationWeeks: 1, slots: [LEADER, HELPER, { id: 'mat', label: { zh: '材料' }, required: true, accepts: { kind: 'supply', supplyKind: 'material' }, consumes: true }], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '砂轮炸了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '打了一把矛。' }, effects: [{ type: 'gainCard', cardId: 'equip_spear' }] },
      fine: { text: { zh: '一把趁手的斧子。' }, effects: [{ type: 'gainCard', cardId: 'equip_axe' }] },
      rare: { text: { zh: '你把一根钢管做成了弩。' }, effects: [{ type: 'gainCard', cardId: 'equip_crossbow' }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
  {
    id: 'ev_farm_lesson', energy: 1, locationId: 'farm', icon: '🧑‍🌾', weight: 5,
    title: { zh: '跟老农学种地' }, text: { zh: '"你们城里人种菜，浇水都浇错。"' },
    conditions: [A], durationWeeks: 1, slots: [LEADER], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '他懒得教你。' }, effects: [] },
      common: { text: { zh: '你学会了看土。' }, effects: [{ type: 'gainCard', cardId: 'supply_seed_veg' }] },
      fine: { text: { zh: '他送了你一箱种薯。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'supply_seed_potato' }] },
      rare: { text: { zh: '"你比我儿子上心。"他把育苗的法子全教了你。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'supply_seed_potato', count: 2 }, { type: 'gainCard', cardId: 'supply_seed_sapling' }, { type: 'setFlag', flag: 'farm_invite' }] },
    },
  },
  {
    id: 'ev_hospital_notes', locationId: 'hospital', icon: '📓', once: true, weight: 0, kind: 'story', storylineNpcId: 'shenyan',
    title: { zh: '沈砚的研究笔记' }, text: { zh: '三楼办公室，一本写满了的笔记本。最后一页是材料清单，五样，划掉了两样。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '你没找到办公室。' }, effects: [] },
      common: { text: { zh: '笔记本被水泡了一半。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 5 }] },
      fine: { text: { zh: '你看懂了清单。第三样，你知道在哪。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 10 }, { type: 'setFlag', flag: 'vaccine_1' }] },
      rare: { text: { zh: '清单最后一样写着"不会腐烂的人"。' }, effects: [{ type: 'affection', npcId: 'shenyan', delta: 12 }, { type: 'setFlag', flag: 'vaccine_1' }, { type: 'setFlag', flag: 'aji_hint' }] },
    },
  },
  {
    id: 'ev_army_drill', energy: 1, locationId: 'armygate', icon: '🎖️', weight: 5,
    title: { zh: '军区开放训练日' }, text: { zh: '他们教平民用刀、用弩、封门。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }, { type: 'relationAtLeast', factionId: 'army', value: 5 }], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你在障碍上摔了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '学了两招。' }, effects: [{ type: 'relation', factionId: 'army', delta: 3 }] },
      fine: { text: { zh: '教官说你有天赋。' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: 1 }, { type: 'relation', factionId: 'army', delta: 5 }] },
      rare: { text: { zh: '顾沉在场。他亲自纠正了你的握刀姿势。' }, effects: [{ type: 'attr', target: 'hero', attr: 'strength', delta: 1 }, { type: 'relation', factionId: 'army', delta: 8 }, { type: 'affection', npcId: 'guchen', delta: 6 }] },
    },
  },
  {
    id: 'ev_crow_defector', locationId: 'crow_turf', icon: '🏃', weight: 3,
    title: { zh: '黑鸦的叛逃者' }, text: { zh: '一个黑鸦的人躲在网吧后巷，说他不想干了。' },
    conditions: [A, { type: 'month', from: 3, to: 12 }], durationWeeks: 1, slots: [HERO, WEAPON], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '是圈套。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      common: { text: { zh: '他给了你黑鸦的巡逻表就跑了。' }, effects: [{ type: 'revealCrisis', monthsAhead: 1 }] },
      fine: { text: { zh: '他想跟你走。他会用枪。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 30, rare: 60, legendary: 10 } }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      rare: { text: { zh: '他带来了周明宇的账本。' }, effects: [{ type: 'recruitRandom', rarityWeights: { rare: 70, legendary: 30 } }, { type: 'relation', factionId: 'crow', delta: -15 }, { type: 'stat', stat: 'exposure', delta: -15 }] },
    },
  },
  {
    id: 'ev_home_radio', energy: 1, locationId: 'home', icon: '📻', weight: 5,
    title: { zh: '摇收音机听广播' }, text: { zh: '军区每天固定时间播一次。噪音里有用的东西不多。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, CAT], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '全是杂音。' }, effects: [] },
      common: { text: { zh: '听到了配给点的位置。' }, effects: [{ type: 'relation', factionId: 'army', delta: 2 }] },
      fine: { text: { zh: '你记下了下个月的预警。' }, effects: [{ type: 'gainCard', cardId: 'intel_army_radio' }] },
      rare: { text: { zh: '广播里有一段不是军区的。是谢临的声音。' }, effects: [{ type: 'gainCard', cardId: 'intel_army_radio' }, { type: 'affection', npcId: 'xielin', delta: 5 }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
]
