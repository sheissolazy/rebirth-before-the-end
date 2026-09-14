import type { EventDef } from '../../engine/types'
import { HERO, HELPER, WEAPON, DOG, CAT, GIFT } from './_slots'

const A = { type: 'phase', phase: 'apocalypse' } as const

export const apocalypseEvents: EventDef[] = [
  // ---- 基地内 ----
  {
    id: 'ev_home_kill_zombies', locationId: 'home', icon: '🧟', repeatable: true, weight: 8,
    title: { zh: '清理楼道的丧尸' }, text: { zh: '它们卡在楼梯口。一只一只来。' },
    conditions: [A, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你被抓了一下。没破皮。应该没破皮。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '两只。你吐了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '五只。手不抖了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
      rare: { text: { zh: '楼道干净了。其中一只脑子里有块发光的东西。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'gainCard', cardId: 'core_fine' }] },
    },
  },
  {
    id: 'ev_home_kill_zombies_villa', locationId: 'home', icon: '🧟', repeatable: true, weight: 8,
    title: { zh: '清理院墙外的丧尸' }, text: { zh: '它们贴着围墙转。从墙头用长矛捅最安全。' },
    conditions: [A, { type: 'baseType', baseType: 'villa' }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '一只翻过了墙。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '三只。墙外一片狼藉。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '清干净了。你在墙头上练出了准头。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
      rare: { text: { zh: '其中一只脑子里有块发光的东西。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'gainCard', cardId: 'core_fine' }] },
    },
  },
  {
    id: 'ev_home_kill_zombies_farm', locationId: 'home', icon: '🧟', repeatable: true, weight: 8,
    title: { zh: '清理围栏边的丧尸' }, text: { zh: '郊区人少，丧尸也少，但每一只都是顺着路来的。' },
    conditions: [A, { type: 'baseType', baseType: 'farmhouse' }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '围栏被撞歪了一段。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'damageModule', moduleId: 'farm_fence' }] },
      common: { text: { zh: '两只。你把它们拖到远处烧了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '清干净了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
      rare: { text: { zh: '其中一只穿着军装。它的晶核比别的亮。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'gainCard', cardId: 'core_fine' }] },
    },
  },
  {
    id: 'ev_home_kill_zombies_bunker', locationId: 'home', icon: '🧟', repeatable: true, weight: 8,
    title: { zh: '清理入口的丧尸' }, text: { zh: '它们知道下面有人。' },
    conditions: [A, { type: 'baseType', baseType: 'bunker' }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你在通道里被堵住了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '通道清干净了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '你在通道里布了陷阱。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
      rare: { text: { zh: '陷阱里有一只异能丧尸。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'gainCard', cardId: 'core_rare' }] },
    },
  },
  {
    id: 'ev_home_train_all', locationId: 'home', icon: '🎯', repeatable: true, weight: 4,
    title: { zh: '带大家训练' }, text: { zh: '沙袋、木刀、绕楼跑。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['strength', 'charm'] },
    outcomes: {
      fail: { text: { zh: '有人扭了脚。' }, effects: [{ type: 'injure', target: 'self', severity: 1 }] },
      common: { text: { zh: '大家都累趴了。' }, effects: [{ type: 'loyalty', target: 'all', delta: 2 }] },
      fine: { text: { zh: '他比昨天强了一点。' }, effects: [{ type: 'attr', target: 'self', attr: 'strength', delta: 1 }, { type: 'loyalty', target: 'all', delta: 3 }] },
      rare: { text: { zh: '你也强了一点。' }, effects: [{ type: 'attr', target: 'self', attr: 'strength', delta: 1 }, { type: 'attr', target: 'hero', attr: 'strength', delta: 1 }, { type: 'loyalty', target: 'all', delta: 5 }] },
    },
  },
  {
    id: 'ev_home_read_apoc', energy: 1, locationId: 'home', icon: '📚', repeatable: true, weight: 4,
    title: { zh: '翻找有用的书' }, text: { zh: '你从隔壁搬来了半个书架。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER], check: { attrs: ['mind'] },
    outcomes: {
      fail: { text: { zh: '全是小说。' }, effects: [] },
      common: { text: { zh: '一本《野外生存手册》。' }, effects: [] },
      fine: { text: { zh: '你学会了净水。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
      rare: { text: { zh: '一本手写的笔记。字迹是谢临的。' }, effects: [{ type: 'attr', target: 'hero', attr: 'mind', delta: 1 }, { type: 'gainCard', cardId: 'intel_xielin_note' }] },
    },
  },
  {
    id: 'ev_home_mutual_aid', locationId: 'home', icon: '📢', once: true, weight: 0, resolvesCrisis: 'human',
    title: { zh: '组织全楼互助' }, text: { zh: '黑鸦要来收保护费。你把楼里还活着的人叫到一起。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'human' }, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1,
    slots: [HERO, { id: 'helper', label: { zh: '王阿姨' }, required: false, accepts: { kind: 'npc', npcId: 'auntwang' }, bonusDice: 2 }], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '没人信你。第二天有人把你的门牌号告诉了黑鸦。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 15 }] },
      common: { text: { zh: '三户人答应轮流守门。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 5 }] },
      fine: { text: { zh: '整层楼封了楼梯。黑鸦来了一次，没上来。' }, effects: [{ type: 'resolveCrisis' }, { type: 'relation', factionId: 'alliance', delta: 10 }] },
      rare: { text: { zh: '你成了这栋楼的主心骨。有人主动搬来和你一起住。' }, effects: [{ type: 'resolveCrisis' }, { type: 'recruitRandom' }, { type: 'relation', factionId: 'alliance', delta: 15 }] },
    },
  },
  {
    id: 'ev_home_lure_horde', locationId: 'home', icon: '🔊', repeatable: true, weight: 0, resolvesCrisis: 'horde',
    title: { zh: '把尸群引开' }, text: { zh: '一台收音机、一桶汽油、一个跑得快的人。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'horde' }, { type: 'hasSupplyKind', supplyKind: 'energy', minPoints: 2 }], durationWeeks: 1,
    slots: [HERO, HELPER, { id: 'fuel', label: { zh: '一桶汽油' }, required: true, accepts: { kind: 'supply', supplyKind: 'energy' }, consumes: true }, DOG], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你跑得不够快。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }] },
      common: { text: { zh: '引开了一半。' }, effects: [] },
      fine: { text: { zh: '它们跟着声音去了河边。整整一个月。' }, effects: [{ type: 'resolveCrisis' }] },
      rare: { text: { zh: '你顺手在河边点了火。晶核捡了一口袋。' }, effects: [{ type: 'resolveCrisis' }, { type: 'gainRandom', table: 'loot_zombie', count: 4 }] },
    },
  },
  {
    id: 'ev_home_quarantine', energy: 1, locationId: 'home', icon: '🚷', repeatable: true, weight: 0, resolvesCrisis: 'plague',
    title: { zh: '严格隔离' }, text: { zh: '所有人分开住，东西煮开了再碰。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'plague' }, { type: 'hasSupplyKind', supplyKind: 'daily', minPoints: 2 }], durationWeeks: 2,
    slots: [HERO, { id: 'soap', label: { zh: '消毒用品' }, required: true, accepts: { kind: 'supply', supplyKind: 'daily' }, consumes: true }], check: { attrs: ['mind', 'charm'] },
    outcomes: {
      fail: { text: { zh: '有人偷偷串门。' }, effects: [{ type: 'loyalty', target: 'all', delta: -5 }] },
      common: { text: { zh: '大家骂骂咧咧地配合了。' }, effects: [{ type: 'loyalty', target: 'all', delta: -3 }] },
      fine: { text: { zh: '两周后，没有一个人发烧。' }, effects: [{ type: 'resolveCrisis' }] },
      rare: { text: { zh: '沈砚听说了你的做法。"你学过？"' }, effects: [{ type: 'resolveCrisis' }, { type: 'affection', npcId: 'shenyan', delta: 8 }] },
    },
  },
  {
    id: 'ev_home_winterize', locationId: 'home', icon: '🧣', repeatable: true, weight: 0, resolvesCrisis: 'climate',
    title: { zh: '封窗、烧火、挤一间' }, text: { zh: '所有人搬进最小的那间屋。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'climate' }, { type: 'hasSupplyKind', supplyKind: 'material', minPoints: 2 }], durationWeeks: 1,
    slots: [HERO, HELPER, { id: 'mat', label: { zh: '木板' }, required: true, accepts: { kind: 'supply', supplyKind: 'material' }, consumes: true }], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '烟排不出去，差点熏死。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '冷，但没冻伤。' }, effects: [] },
      fine: { text: { zh: '屋里能穿单衣了。' }, effects: [{ type: 'resolveCrisis' }] },
      rare: { text: { zh: '你顺手把烟道改成了暖气。' }, effects: [{ type: 'resolveCrisis' }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
  {
    id: 'ev_home_ration', energy: 1, locationId: 'home', icon: '🥣', repeatable: true, weight: 0, resolvesCrisis: 'scarcity',
    title: { zh: '定量配给' }, text: { zh: '每人每天一碗。你自己半碗。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'scarcity' }], durationWeeks: 2, slots: [HERO], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '有人半夜偷吃。' }, effects: [{ type: 'loyalty', target: 'all', delta: -8 }, { type: 'loseCard', cardId: 'supply_rice_5kg' }] },
      common: { text: { zh: '饿，但没人闹。' }, effects: [{ type: 'loyalty', target: 'all', delta: -3 }] },
      fine: { text: { zh: '撑过去了。大家瘦了一圈。' }, effects: [{ type: 'resolveCrisis' }, { type: 'stat', stat: 'health', delta: -1 }] },
      rare: { text: { zh: '你在阳台种的东西刚好在这时候熟了。' }, effects: [{ type: 'resolveCrisis' }, { type: 'gainCard', cardId: 'supply_veg', count: 3 }] },
    },
  },
  // ---- 超市废墟 ----
  {
    id: 'ev_ruin_scavenge', locationId: 'ruin_market', icon: '🛒', repeatable: true, weight: 10,
    title: { zh: '翻超市废墟' }, text: { zh: '货架倒了一半。仓库那边好像没人去过。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, CAT], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '仓库里有东西在动。你跑了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '捡了点零碎。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 1 }] },
      fine: { text: { zh: '仓库没被翻过。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 3 }] },
      rare: { text: { zh: '冷库后面有整托盘的罐头。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 5 }, { type: 'gainCard', cardId: 'core_common' }] },
    },
  },
  {
    id: 'ev_ruin_survivor', locationId: 'ruin_market', icon: '🙋', weight: 5,
    title: { zh: '货架后面有人' }, text: { zh: '"别开枪！我有吃的可以分你。"' },
    conditions: [A], durationWeeks: 1, slots: [HERO, WEAPON], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '是个陷阱。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '你们分了东西，各走各的。' }, effects: [{ type: 'gainRandom', table: 'loot_market', count: 1 }] },
      fine: { text: { zh: '她跟你回了基地。' }, effects: [{ type: 'recruitRandom' }] },
      rare: { text: { zh: '她是个护士。' }, effects: [{ type: 'recruitRandom', rarityWeights: { common: 0, fine: 40, rare: 50, legendary: 10 } }] },
    },
  },
  // ---- 医院 ----
  {
    id: 'ev_hospital_meds', locationId: 'hospital', icon: '💊', repeatable: true, weight: 10,
    title: { zh: '搜药房' }, text: { zh: '三楼。楼梯间全是它们。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER, WEAPON], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你在二楼就退了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '抓了一把。' }, effects: [{ type: 'gainRandom', table: 'loot_hospital', count: 2 }] },
      fine: { text: { zh: '药房的柜子还锁着。你有钥匙的运气。' }, effects: [{ type: 'gainRandom', table: 'loot_hospital', count: 4 }] },
      rare: { text: { zh: '有人在药房里留了字条："沈"。' }, effects: [{ type: 'gainRandom', table: 'loot_hospital', count: 5 }, { type: 'affection', npcId: 'shenyan', delta: 5 }, { type: 'unlockEvent', eventId: 'ev_shenyan_02' }] },
    },
  },
  // ---- 军械库 ----
  {
    id: 'ev_armory_raid', energy: 3, locationId: 'armory', icon: '🔫', repeatable: true, weight: 8,
    title: { zh: '摸军械库' }, text: { zh: '军区撤走时没搬完。黑鸦也盯着。' },
    conditions: [A], durationWeeks: 2, slots: [HERO, HELPER, WEAPON], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '黑鸦先到了。你们打了一架。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      common: { text: { zh: '一把工兵铲和几盒绷带。' }, effects: [{ type: 'gainCard', cardId: 'equip_spear' }, { type: 'gainCard', cardId: 'supply_bandage', count: 2 }] },
      fine: { text: { zh: '防刺服和头盔。' }, effects: [{ type: 'gainCard', cardId: 'equip_vest' }, { type: 'gainCard', cardId: 'equip_helmet' }] },
      rare: { text: { zh: '柜子最里面，一把猎枪。' }, effects: [{ type: 'gainCard', cardId: 'equip_shotgun' }, { type: 'stat', stat: 'exposure', delta: 10 }] },
    },
  },
  // ---- 居民楼 ----
  {
    id: 'ev_apartments_search', locationId: 'apartments', icon: '🏘️', repeatable: true, weight: 10,
    title: { zh: '挨家挨户翻' }, text: { zh: '每一扇门后面都可能有东西。也可能有人。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, CAT], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '门后面是一家三口。都变了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '厨房里还有米。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 2 }] },
      fine: { text: { zh: '一户人家囤了不少。他们没用上。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 4 }] },
      rare: { text: { zh: '阳台上有人挥手。他在等人来。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 3 }, { type: 'recruitRandom' }] },
    },
  },
  {
    id: 'ev_apartments_family', locationId: 'apartments', icon: '👨‍👧', weight: 4,
    title: { zh: '带孩子的男人' }, text: { zh: '他求你收留他们。孩子在发烧。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, GIFT('medicine', '给药')], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '你没敢。第二天那扇门再也没开过。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 2 }] },
      common: { text: { zh: '你给了药，没带他们走。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 5 }] },
      fine: { text: { zh: '他跟你回去了。他说他会修任何东西。' }, effects: [{ type: 'recruitRandom', rarityWeights: { common: 30, fine: 50, rare: 20 } }] },
      rare: { text: { zh: '孩子退烧了。他跪下来的时候你把他拉了起来。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 50, rare: 50 } }, { type: 'loyalty', target: 'all', delta: 5 }] },
    },
  },
  // ---- 工厂 ----
  {
    id: 'ev_factory_materials', energy: 3, locationId: 'factory', icon: '🏭', repeatable: true, weight: 10,
    title: { zh: '拆工厂' }, text: { zh: '钢材、柴油、零件。要人手。' },
    conditions: [A], durationWeeks: 2, slots: [HERO, HELPER, WEAPON], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '车间里的东西太多，人也太多。' }, effects: [{ type: 'injure', target: 'self', severity: 1 }] },
      common: { text: { zh: '搬了两趟。' }, effects: [{ type: 'gainRandom', table: 'loot_factory', count: 2 }] },
      fine: { text: { zh: '你们找到了叉车。' }, effects: [{ type: 'gainRandom', table: 'loot_factory', count: 4 }] },
      rare: { text: { zh: '仓库里有一台没开封的发电机。' }, effects: [{ type: 'gainRandom', table: 'loot_factory', count: 3 }, { type: 'gainCard', cardId: 'supply_generator' }] },
    },
  },
  // ---- 加油站 ----
  {
    id: 'ev_gas_fuel', locationId: 'gasstation', icon: '⛽', repeatable: true, weight: 8,
    title: { zh: '抽油' }, text: { zh: '地下油罐还有。黑鸦的人也知道。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER, WEAPON], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '黑鸦的人在。你退了。' }, effects: [{ type: 'relation', factionId: 'crow', delta: -5 }] },
      common: { text: { zh: '抽了一桶。' }, effects: [{ type: 'gainCard', cardId: 'supply_gasoline' }] },
      fine: { text: { zh: '三桶。' }, effects: [{ type: 'gainCard', cardId: 'supply_gasoline', count: 3 }] },
      rare: { text: { zh: '你找到了油罐车的钥匙。' }, effects: [{ type: 'gainCard', cardId: 'supply_gasoline', count: 5 }, { type: 'stat', stat: 'exposure', delta: 5 }] },
    },
  },
  // ---- 农场 ----
  {
    id: 'ev_farm_trade', locationId: 'farm', icon: '🌾', repeatable: true, weight: 8,
    title: { zh: '跟农场换粮' }, text: { zh: '老农还活着。他要药和电池。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, GIFT('medicine', '带药去换'), { id: 'gift2', label: { zh: '带电池去换' }, required: false, accepts: { kind: 'supply', supplyKind: 'energy' }, consumes: true, bonusDice: 2 }], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '他不信你。' }, effects: [] },
      common: { text: { zh: '换了两袋米。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 2 }] },
      fine: { text: { zh: '米、鸡蛋、一桶井水。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'gainCard', cardId: 'supply_eggs', count: 2 }, { type: 'gainCard', cardId: 'supply_well_water', count: 2 }] },
      rare: { text: { zh: '他说"你要是搬来，地分你一半"。' }, effects: [{ type: 'gainCard', cardId: 'supply_rice_5kg', count: 4 }, { type: 'gainCard', cardId: 'supply_eggs', count: 3 }, { type: 'setFlag', flag: 'farm_invite' }] },
    },
  },
  {
    id: 'ev_farm_seeds', locationId: 'farm', icon: '🌱', repeatable: true, weight: 8,
    title: { zh: '翻农场的仓库找种子' }, text: { zh: '末日后没人卖种子了。农场的仓库里应该还有。' },
    conditions: [A], durationWeeks: 1, slots: [HERO, HELPER, WEAPON], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '仓库里有一群丧尸。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '一袋受潮的种子。' }, effects: [{ type: 'gainRandom', table: 'loot_farm', count: 1 }] },
      fine: { text: { zh: '整整一架子。' }, effects: [{ type: 'gainRandom', table: 'loot_farm', count: 3 }] },
      rare: { text: { zh: '你找到了育苗棚。苗还活着。' }, effects: [{ type: 'gainRandom', table: 'loot_farm', count: 3 }, { type: 'gainCard', cardId: 'supply_seed_sapling', count: 2 }] },
    },
  },
  {
    id: 'ev_farm_move', energy: 3, locationId: 'farm', icon: '🚚', once: true, weight: 0,
    title: { zh: '搬去农场' }, text: { zh: '老农的邀请还有效。搬家要一次搬完。' },
    conditions: [A, { type: 'flag', flag: 'farm_invite' }, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 2, slots: [HERO, HELPER], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '路上遇到尸群。丢了一半东西。' }, effects: [{ type: 'moveBase', baseType: 'farmhouse' }, { type: 'loseCard', cardId: 'supply_rice_5kg', count: 3 }, { type: 'injure', target: 'hero', severity: 1 }] },
      fine: { text: { zh: '三趟。全搬完了。' }, effects: [{ type: 'moveBase', baseType: 'farmhouse' }] },
    },
  },
  // ---- 军区基地 ----
  {
    id: 'ev_army_trade', locationId: 'armygate', icon: '🪖', repeatable: true, weight: 8,
    title: { zh: '跟军区交易' }, text: { zh: '晶核换东西。他们的价公道，但规矩多。' },
    conditions: [A, { type: 'relationAtLeast', factionId: 'army', value: 0 }], durationWeeks: 1, slots: [HERO, { id: 'core', label: { zh: '晶核' }, required: true, accepts: { kind: 'core' }, consumes: true }], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '他们扣了你的晶核，说是"登记"。' }, effects: [{ type: 'relation', factionId: 'army', delta: 2 }] },
      common: { text: { zh: '换了一箱压缩饼干。' }, effects: [{ type: 'gainCard', cardId: 'supply_compressed_biscuit' }, { type: 'relation', factionId: 'army', delta: 3 }] },
      fine: { text: { zh: '换了药和弩箭。' }, effects: [{ type: 'gainCard', cardId: 'supply_antibiotics' }, { type: 'gainCard', cardId: 'supply_bolts', count: 2 }, { type: 'relation', factionId: 'army', delta: 5 }] },
      rare: { text: { zh: '顾沉在。他多给了你一箱。' }, effects: [{ type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 2 }, { type: 'gainCard', cardId: 'supply_medkit' }, { type: 'relation', factionId: 'army', delta: 8 }, { type: 'affection', npcId: 'guchen', delta: 5 }] },
    },
  },
  {
    id: 'ev_army_help', locationId: 'armygate', icon: '🤝', repeatable: true, weight: 5,
    title: { zh: '帮军区守一次墙' }, text: { zh: '他们缺人。你缺关系。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你在墙上腿软了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'relation', factionId: 'army', delta: 2 }] },
      common: { text: { zh: '守了一夜。' }, effects: [{ type: 'relation', factionId: 'army', delta: 8 }, { type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '你打掉的比旁边的兵还多。' }, effects: [{ type: 'relation', factionId: 'army', delta: 12 }, { type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'affection', npcId: 'guchen', delta: 3 }] },
      rare: { text: { zh: '顾沉在墙上看了你很久。' }, effects: [{ type: 'relation', factionId: 'army', delta: 15 }, { type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'affection', npcId: 'guchen', delta: 8 }] },
    },
  },
  // ---- 黑鸦地盘 ----
  {
    id: 'ev_crow_pay', locationId: 'crow_turf', icon: '💰', repeatable: true, weight: 6,
    title: { zh: '交保护费' }, text: { zh: '丢脸，但便宜。' },
    conditions: [A, { type: 'relationAtLeast', factionId: 'crow', value: -80 }], durationWeeks: 1, slots: [HERO, { id: 'pay', label: { zh: '交出去的东西' }, required: true, accepts: { kind: 'supply' }, consumes: true }],
    outcomes: { fine: { text: { zh: '他们收了。这个月不会来。' }, effects: [{ type: 'relation', factionId: 'crow', delta: 15 }, { type: 'stat', stat: 'exposure', delta: 3 }] } },
  },
  {
    id: 'ev_crow_steal', locationId: 'crow_turf', icon: '🥷', repeatable: true, weight: 4,
    title: { zh: '摸黑鸦的仓库' }, text: { zh: '他们抢来的东西堆在旧网吧里。' },
    conditions: [A, { type: 'month', from: 3, to: 12 }], durationWeeks: 1, slots: [HERO, HELPER, WEAPON, CAT], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '被抓了。他们放了你，但记住了你的脸。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'crow', delta: -20 }, { type: 'stat', stat: 'exposure', delta: 15 }] },
      common: { text: { zh: '拿了一点就跑。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 2 }, { type: 'relation', factionId: 'crow', delta: -5 }] },
      fine: { text: { zh: '搬空了一个货架。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 5 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      rare: { text: { zh: '你在他们的账本上看到了自己的名字和地址。你把那页撕了。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 5 }, { type: 'stat', stat: 'exposure', delta: -15 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
    },
  },
]
