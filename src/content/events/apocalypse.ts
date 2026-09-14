import type { EventDef } from '../../engine/types'
import { HERO, LEADER, HELPER, WEAPON, DOG, CAT, GIFT } from './_slots'

const A = { type: 'phase', phase: 'apocalypse' } as const

export const apocalypseEvents: EventDef[] = [
  // ---- 基地内 ----
  {
    id: 'ev_home_kill_zombies', locationId: 'home', icon: '🧟', repeatable: true, weight: 8,
    title: { zh: '清理楼道的丧尸' }, text: { zh: '它们卡在楼梯口。一只一只来。' },
    conditions: [A, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
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
    conditions: [A, { type: 'baseType', baseType: 'villa' }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
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
    conditions: [A, { type: 'baseType', baseType: 'farmhouse' }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
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
    conditions: [A, { type: 'baseType', baseType: 'bunker' }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你在通道里被堵住了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '通道清干净了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '你在通道里布了陷阱。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
      rare: { text: { zh: '陷阱里有一只异能丧尸。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'gainCard', cardId: 'core_rare' }] },
    },
  },
  {
    id: 'ev_home_neighbors_apoc', locationId: 'home', icon: '🏘️', repeatable: true, weight: 4,
    title: { zh: '跟楼里的幸存者打交道' }, text: { zh: '还活着的几户人，谁有什么、谁缺什么，得摸清。' },
    conditions: [A, { type: 'baseType', baseType: 'apartment' }], durationWeeks: 1, energy: 1, slots: [HERO], check: { attrs: ['charm'] },
    outcomes: {
      fail: { text: { zh: '有人怀疑你囤了很多。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 5 }] },
      common: { text: { zh: '换了点东西。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 1 }, { type: 'relation', factionId: 'alliance', delta: 3 }] },
      fine: { text: { zh: '你们约好尸潮来时互相照应。' }, effects: [{ type: 'attr', target: 'hero', attr: 'charm', delta: 1 }, { type: 'relation', factionId: 'alliance', delta: 8 }] },
      rare: { text: { zh: '四楼那家想搬来跟你一起住。' }, effects: [{ type: 'recruitRandom' }, { type: 'relation', factionId: 'alliance', delta: 8 }] },
    },
  },
  {
    id: 'ev_hunt_cores', kind: 'routine', locationId: 'apartments', icon: '💎', repeatable: true, weight: 0,
    title: { zh: '猎杀丧尸取晶核' }, text: { zh: '晶核在丧尸后脑。一刀，一挖。这是末日后唯一的硬通货，也是升级异能的唯一办法。' },
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你被扑倒了。狗把它拖开的。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '两颗。手上全是黑血。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 2 }] },
      fine: { text: { zh: '五颗。你开始熟练了。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 4 }, { type: 'attr', target: 'hero', attr: 'strength', delta: 1 }] },
      rare: { text: { zh: '你遇到一只不一样的。它的晶核是蓝色的。' }, effects: [{ type: 'gainRandom', table: 'loot_zombie', count: 4 }, { type: 'gainCard', cardId: 'core_rare' }] },
    },
  },
  {
    id: 'ev_home_train_all', kind: 'routine', locationId: 'home', icon: '🎯', repeatable: true, weight: 0,
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
    id: 'ev_home_read_apoc', kind: 'routine', energy: 1, locationId: 'home', icon: '📚', repeatable: true, weight: 4,
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
    id: 'ev_home_mutual_aid', kind: 'main', locationId: 'home', icon: '📢', once: true, weight: 0, resolvesCrisis: 'human',
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
    id: 'ev_home_lure_horde', kind: 'main', locationId: 'home', icon: '🔊', repeatable: true, weight: 0, resolvesCrisis: 'horde',
    title: { zh: '把尸群引开' }, text: { zh: '一台收音机、一桶汽油、一个跑得快的人。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'horde' }, { type: 'hasSupplyKind', supplyKind: 'energy', minPoints: 2 }], durationWeeks: 1,
    slots: [LEADER, HELPER, { id: 'fuel', label: { zh: '一桶汽油' }, required: true, accepts: { kind: 'supply', supplyKind: 'energy' }, consumes: true }, DOG], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你跑得不够快。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }] },
      common: { text: { zh: '引开了一半。' }, effects: [] },
      fine: { text: { zh: '它们跟着声音去了河边。整整一个月。' }, effects: [{ type: 'resolveCrisis' }] },
      rare: { text: { zh: '你顺手在河边点了火。晶核捡了一口袋。' }, effects: [{ type: 'resolveCrisis' }, { type: 'gainRandom', table: 'loot_zombie', count: 4 }] },
    },
  },
  {
    id: 'ev_home_quarantine', kind: 'main', energy: 1, locationId: 'home', icon: '🚷', repeatable: true, weight: 0, resolvesCrisis: 'plague',
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
    id: 'ev_home_winterize', kind: 'main', locationId: 'home', icon: '🧣', repeatable: true, weight: 0, resolvesCrisis: 'climate',
    title: { zh: '封窗、烧火、挤一间' }, text: { zh: '所有人搬进最小的那间屋。' },
    conditions: [A, { type: 'crisisActive', crisisKind: 'climate' }, { type: 'hasSupplyKind', supplyKind: 'material', minPoints: 2 }], durationWeeks: 1,
    slots: [LEADER, HELPER, { id: 'mat', label: { zh: '木板' }, required: true, accepts: { kind: 'supply', supplyKind: 'material' }, consumes: true }], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '烟排不出去，差点熏死。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '冷，但没冻伤。' }, effects: [] },
      fine: { text: { zh: '屋里能穿单衣了。' }, effects: [{ type: 'resolveCrisis' }] },
      rare: { text: { zh: '你顺手把烟道改成了暖气。' }, effects: [{ type: 'resolveCrisis' }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
  {
    id: 'ev_home_ration', kind: 'main', energy: 1, locationId: 'home', icon: '🥣', repeatable: true, weight: 0, resolvesCrisis: 'scarcity',
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
    id: 'ev_ruin_scavenge', kind: 'routine', locationId: 'ruin_market', icon: '🛒', repeatable: true, weight: 0,
    title: { zh: '翻超市废墟' }, text: { zh: '货架倒了一半。仓库那边好像没人去过。' },
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, CAT], check: { attrs: ['strength', 'mind'] },
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
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['strength', 'mind'] },
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
    conditions: [A], durationWeeks: 2, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '黑鸦先到了。你们打了一架。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      common: { text: { zh: '一把工兵铲和几盒绷带。' }, effects: [{ type: 'gainCard', cardId: 'equip_spear' }, { type: 'gainCard', cardId: 'supply_bandage', count: 2 }] },
      fine: { text: { zh: '防刺服和头盔。' }, effects: [{ type: 'gainCard', cardId: 'equip_vest' }, { type: 'gainCard', cardId: 'equip_helmet' }] },
      rare: { text: { zh: '柜子最里面，一把猎枪。' }, effects: [{ type: 'gainCard', cardId: 'equip_shotgun' }, { type: 'stat', stat: 'exposure', delta: 10 }] },
    },
  },
  // ---- 居民楼 ----
  {
    id: 'ev_apartments_search', kind: 'routine', locationId: 'apartments', icon: '🏘️', repeatable: true, weight: 0,
    title: { zh: '挨家挨户翻' }, text: { zh: '每一扇门后面都可能有东西。也可能有人。' },
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, CAT], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '门后面是一家三口。都变了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }] },
      common: { text: { zh: '厨房里还有米。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 2 }] },
      fine: { text: { zh: '一户人家囤了不少。他们没用上。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 4 }] },
      rare: { text: { zh: '阳台上有人挥手。他在等人来。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 3 }, { type: 'recruitRandom' }] },
    },
  },
  // ---- 工厂 ----
  {
    id: 'ev_factory_materials', energy: 3, locationId: 'factory', icon: '🏭', repeatable: true, weight: 10,
    title: { zh: '拆工厂' }, text: { zh: '钢材、柴油、零件。要人手。' },
    conditions: [A], durationWeeks: 2, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['strength'] },
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
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['mind', 'strength'] },
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
    conditions: [A], durationWeeks: 1, slots: [LEADER, GIFT('medicine', '带药去换'), { id: 'gift2', label: { zh: '带电池去换' }, required: false, accepts: { kind: 'supply', supplyKind: 'energy' }, consumes: true, bonusDice: 2 }], check: { attrs: ['charm'] },
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
    conditions: [A], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['mind', 'strength'] },
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
    id: 'ev_army_trade', kind: 'routine', locationId: 'armygate', icon: '🪖', repeatable: true, weight: 0,
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
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['strength'] },
    outcomes: {
      fail: { text: { zh: '你在墙上腿软了。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'relation', factionId: 'army', delta: 2 }] },
      common: { text: { zh: '守了一夜。' }, effects: [{ type: 'relation', factionId: 'army', delta: 8 }, { type: 'gainRandom', table: 'loot_zombie', count: 1 }] },
      fine: { text: { zh: '你打掉的比旁边的兵还多。' }, effects: [{ type: 'relation', factionId: 'army', delta: 12 }, { type: 'gainRandom', table: 'loot_zombie', count: 2 }, { type: 'affection', npcId: 'guchen', delta: 3 }] },
      rare: { text: { zh: '顾沉在墙上看了你很久。' }, effects: [{ type: 'relation', factionId: 'army', delta: 15 }, { type: 'gainRandom', table: 'loot_zombie', count: 3 }, { type: 'affection', npcId: 'guchen', delta: 8 }] },
    },
  },
  {
    id: 'ev_army_task_meds', locationId: 'armygate', icon: '📋', repeatable: true, weight: 6,
    title: { zh: '军区委托：送药到前哨' }, text: { zh: '布告栏上贴着：急需抗生素，送到东门前哨，军区记账。' },
    conditions: [A, { type: 'relationAtLeast', factionId: 'army', value: 0 }, { type: 'hasSupplyKind', supplyKind: 'medicine', minPoints: 2 }], durationWeeks: 1,
    slots: [LEADER, { id: 'meds', label: { zh: '送的药' }, required: true, accepts: { kind: 'supply', supplyKind: 'medicine' }, consumes: true }, HELPER, WEAPON], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '路上遇到尸群，药丢了一半。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'relation', factionId: 'army', delta: 3 }] },
      common: { text: { zh: '送到了。前哨的兵给你敬了个礼。' }, effects: [{ type: 'relation', factionId: 'army', delta: 8 }, { type: 'affection', npcId: 'guchen', delta: 3 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit' }] },
      fine: { text: { zh: '送到了，还顺手帮他们处理了两个伤员。' }, effects: [{ type: 'relation', factionId: 'army', delta: 12 }, { type: 'affection', npcId: 'guchen', delta: 5 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 2 }, { type: 'gainCard', cardId: 'core_common' }] },
      rare: { text: { zh: '顾沉正好在前哨。他把你的名字记进了名册。' }, effects: [{ type: 'relation', factionId: 'army', delta: 15 }, { type: 'affection', npcId: 'guchen', delta: 8 }, { type: 'gainCard', cardId: 'supply_compressed_biscuit', count: 2 }, { type: 'gainCard', cardId: 'core_fine' }] },
    },
  },
  {
    id: 'ev_army_task_scout', locationId: 'armygate', icon: '🔭', repeatable: true, weight: 6,
    title: { zh: '军区委托：侦察尸群动向' }, text: { zh: '他们缺人手去河东数丧尸。带回来的情报换物资。' },
    conditions: [A, { type: 'relationAtLeast', factionId: 'army', value: 10 }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '你被发现了。跑回来时丢了背包。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'loseCard', cardId: 'supply_water_box' }] },
      common: { text: { zh: '数了个大概。' }, effects: [{ type: 'relation', factionId: 'army', delta: 6 }, { type: 'gainCard', cardId: 'supply_battery', count: 2 }] },
      fine: { text: { zh: '你画的地图比他们的准。' }, effects: [{ type: 'relation', factionId: 'army', delta: 10 }, { type: 'affection', npcId: 'guchen', delta: 5 }, { type: 'gainCard', cardId: 'intel_army_radio' }, { type: 'gainCard', cardId: 'supply_battery', count: 2 }] },
      rare: { text: { zh: '你发现了一群往城里挤的尸潮。军区提前一周布防。' }, effects: [{ type: 'relation', factionId: 'army', delta: 15 }, { type: 'affection', npcId: 'guchen', delta: 8 }, { type: 'gainCard', cardId: 'intel_army_radio' }, { type: 'revealCrisis', monthsAhead: 1 }, { type: 'gainCard', cardId: 'supply_gasoline' }] },
    },
  },
  {
    id: 'ev_army_task_rescue', locationId: 'armygate', icon: '🆘', repeatable: true, weight: 4,
    title: { zh: '军区委托：找回失联小队' }, text: { zh: '一个班三天没回来。最后位置在工厂。' },
    conditions: [A, { type: 'relationAtLeast', factionId: 'army', value: 20 }, { type: 'month', from: 3, to: 12 }], durationWeeks: 2, energy: 3, slots: [LEADER, HELPER, WEAPON, DOG], check: { attrs: ['strength', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你找到了他们。他们已经不是人了。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'army', delta: 5 }] },
      common: { text: { zh: '找到两个活的。' }, effects: [{ type: 'relation', factionId: 'army', delta: 12 }, { type: 'affection', npcId: 'guchen', delta: 6 }, { type: 'gainRandom', table: 'loot_zombie', count: 2 }] },
      fine: { text: { zh: '全找回来了。其中一个想跟你走。' }, effects: [{ type: 'relation', factionId: 'army', delta: 18 }, { type: 'affection', npcId: 'guchen', delta: 10 }, { type: 'recruitRandom', rarityWeights: { fine: 50, rare: 50 } }, { type: 'gainCard', cardId: 'equip_helmet' }] },
      rare: { text: { zh: '你不仅找回了人，还找回了他们丢的枪。顾沉说这把归你。' }, effects: [{ type: 'relation', factionId: 'army', delta: 20 }, { type: 'affection', npcId: 'guchen', delta: 12 }, { type: 'gainCard', cardId: 'equip_shotgun' }, { type: 'recruitRandom', rarityWeights: { fine: 50, rare: 50 } }] },
    },
  },
  // ---- 幸存者联盟 / 教团 委托（挂在居民楼与农场） ----
  {
    id: 'ev_alliance_task_pump', locationId: 'apartments', icon: '🔧', repeatable: true, weight: 5,
    title: { zh: '联盟委托：修水泵' }, text: { zh: '三号楼的人凑了东西，求个会修水泵的。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 1, slots: [LEADER, HELPER, { id: 'part', label: { zh: '带零件' }, required: false, accepts: { kind: 'supply', supplyKind: 'material' }, consumes: true, bonusDice: 2 }], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '修坏了。他们脸色很难看。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: -5 }] },
      common: { text: { zh: '修好了一半。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 6 }, { type: 'gainCard', cardId: 'supply_rice_5kg' }] },
      fine: { text: { zh: '水出来了。整栋楼给你鼓掌。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 12 }, { type: 'gainCard', cardId: 'supply_rice_5kg', count: 2 }, { type: 'gainCard', cardId: 'supply_well_water', count: 2 }, { type: 'stat', stat: 'exposure', delta: 3 }] },
      rare: { text: { zh: '你顺手教会了他们怎么修。以后他们会记得你。' }, effects: [{ type: 'relation', factionId: 'alliance', delta: 18 }, { type: 'gainCard', cardId: 'supply_rice_5kg', count: 2 }, { type: 'gainCard', cardId: 'supply_well_water', count: 2 }, { type: 'attr', target: 'hero', attr: 'mind', delta: 1 }] },
    },
  },
  {
    id: 'ev_dawn_task_letter', locationId: 'farm', icon: '✉️', repeatable: true, weight: 4,
    title: { zh: '教团委托：送一封信' }, text: { zh: '新黎明的人在农场等你。信封着，他们说别拆。' },
    conditions: [A, { type: 'month', from: 3, to: 12 }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON], check: { attrs: ['charm', 'mind'] },
    outcomes: {
      fail: { text: { zh: '你拆了。里面是一份名单，有你的名字。' }, effects: [{ type: 'relation', factionId: 'dawn', delta: -10 }, { type: 'stat', stat: 'exposure', delta: 10 }] },
      common: { text: { zh: '送到了。他们给了你一袋米和一个微笑。' }, effects: [{ type: 'relation', factionId: 'dawn', delta: 8 }, { type: 'gainCard', cardId: 'supply_rice_5kg' }] },
      fine: { text: { zh: '送到了。收信的人是个医生，他多看了你两眼。' }, effects: [{ type: 'relation', factionId: 'dawn', delta: 12 }, { type: 'gainCard', cardId: 'supply_antibiotics' }, { type: 'affection', npcId: 'shenyan', delta: 3 }] },
      rare: { text: { zh: '你没拆，但你记住了封印的图案。' }, effects: [{ type: 'relation', factionId: 'dawn', delta: 15 }, { type: 'gainCard', cardId: 'supply_antibiotics' }, { type: 'gainCard', cardId: 'core_fine' }, { type: 'setFlag', flag: 'dawn_seal_seen' }] },
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
    conditions: [A, { type: 'month', from: 3, to: 12 }], durationWeeks: 1, slots: [LEADER, HELPER, WEAPON, CAT], check: { attrs: ['mind', 'strength'] },
    outcomes: {
      fail: { text: { zh: '被抓了。他们放了你，但记住了你的脸。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'relation', factionId: 'crow', delta: -20 }, { type: 'stat', stat: 'exposure', delta: 15 }] },
      common: { text: { zh: '拿了一点就跑。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 2 }, { type: 'relation', factionId: 'crow', delta: -5 }] },
      fine: { text: { zh: '搬空了一个货架。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 5 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
      rare: { text: { zh: '你在他们的账本上看到了自己的名字和地址。你把那页撕了。' }, effects: [{ type: 'gainRandom', table: 'loot_scavenge', count: 5 }, { type: 'stat', stat: 'exposure', delta: -15 }, { type: 'relation', factionId: 'crow', delta: -10 }] },
    },
  },
]
