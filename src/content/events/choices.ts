import type { EventDef } from '../../engine/types'

const P = { type: 'phase', phase: 'prologue' } as const
const A = { type: 'phase', phase: 'apocalypse' } as const

/** 即时选择事件：周初弹出，当场选。locationId 用 'home' 占位。 */
export const choiceEvents: EventDef[] = [
  // ---- 序章 ----
  {
    id: 'ch_neighbor_borrow', locationId: 'home', instant: true, weight: 10, icon: '🍚',
    title: { zh: '邻居来借米' }, text: { zh: '王阿姨敲门："姑娘，家里米吃完了，超市又限购，借两斤？"她瞟了一眼你身后的箱子。' },
    conditions: [P], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'give', label: { zh: '借她一袋' }, outcomes: { fine: { text: { zh: '她千恩万谢。整栋楼很快都知道你人好。' }, effects: [{ type: 'loseCard', cardId: 'supply_rice_5kg' }, { type: 'affection', npcId: 'auntwang', delta: 15 }, { type: 'stat', stat: 'exposure', delta: 5 }] } } },
      { id: 'refuse', label: { zh: '说自己也没有' }, check: { attrs: ['charm'] }, outcomes: {
        fail: { text: { zh: '她看到了箱子。她什么都没说，但眼神变了。' }, effects: [{ type: 'affection', npcId: 'auntwang', delta: -10 }, { type: 'stat', stat: 'exposure', delta: 8 }] },
        fine: { text: { zh: '你装得很像。她信了。' }, effects: [] },
      } },
      { id: 'tip', label: { zh: '借她米，顺便劝她也囤点' }, check: { attrs: ['charm', 'mind'] }, outcomes: {
        fail: { text: { zh: '她觉得你魔怔了。' }, effects: [{ type: 'loseCard', cardId: 'supply_rice_5kg' }, { type: 'stat', stat: 'butterfly', delta: 3 }] },
        fine: { text: { zh: '她第二天真去买了。末日后，她家会是这栋楼最稳的一户。' }, effects: [{ type: 'loseCard', cardId: 'supply_rice_5kg' }, { type: 'affection', npcId: 'auntwang', delta: 20 }, { type: 'setFlag', flag: 'auntwang_prepared' }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
      } },
    ],
  },
  {
    id: 'ch_gas_check', locationId: 'home', instant: true, weight: 8, icon: '🚪',
    title: { zh: '"查燃气的"' }, text: { zh: '两个穿工装的人敲门，工牌看不清。上一世你没开门。' },
    conditions: [P], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'open', label: { zh: '开门' }, check: { attrs: ['mind'] }, outcomes: {
        fail: { text: { zh: '他们进来转了一圈就走了。第二天你发现少了一箱东西。' }, effects: [{ type: 'loseCard', cardId: 'supply_water_box' }, { type: 'stat', stat: 'exposure', delta: 10 }] },
        fine: { text: { zh: '真是查燃气的。他顺手帮你看了看阀门。' }, effects: [] },
      } },
      { id: 'refuse', label: { zh: '隔着门说不在家' }, outcomes: { fine: { text: { zh: '他们走了。楼道里响起下一家的敲门声。' }, effects: [] } } },
    ],
  },
  {
    id: 'ch_colleague', locationId: 'home', instant: true, weight: 8, icon: '💬',
    title: { zh: '同事的私信' }, text: { zh: '"你朋友圈那些箱子是怎么回事？你知道什么？"' },
    conditions: [P, { type: 'employed', value: true }], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'tell', label: { zh: '暗示她也准备一下' }, check: { attrs: ['charm'] }, outcomes: {
        fail: { text: { zh: '她截图发到了群里。' }, effects: [{ type: 'stat', stat: 'exposure', delta: 15 }, { type: 'stat', stat: 'butterfly', delta: 5 }] },
        fine: { text: { zh: '她没多问，回了个"谢谢"。末日后她会记得你。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 5 }, { type: 'setFlag', flag: 'colleague_warned' }] },
      } },
      { id: 'joke', label: { zh: '说是帮亲戚囤的' }, outcomes: { fine: { text: { zh: '"哦。"她没再问。' }, effects: [] } } },
      { id: 'delete', label: { zh: '删掉朋友圈' }, outcomes: { fine: { text: { zh: '晚了，但总比不删好。' }, effects: [{ type: 'stat', stat: 'exposure', delta: -5 }] } } },
    ],
  },
  {
    id: 'ch_old_man', locationId: 'home', instant: true, weight: 6, icon: '🧓',
    title: { zh: '路边摔倒的老人' }, text: { zh: '没人扶。你有一箱水在手上。' },
    conditions: [P], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'help', label: { zh: '放下东西去扶' }, outcomes: { fine: { text: { zh: '他是退休的老中医。他给你留了一张方子。' }, effects: [{ type: 'gainCard', cardId: 'supply_medkit' }, { type: 'stat', stat: 'butterfly', delta: 2 }] } } },
      { id: 'pass', label: { zh: '走过去' }, outcomes: { fine: { text: { zh: '你没回头。这一世你只能顾自己。' }, effects: [] } } },
    ],
  },
  // ---- 末日后 ----
  {
    id: 'ch_child_cry', locationId: 'home', instant: true, weight: 8, icon: '👶',
    title: { zh: '楼下的哭声' }, text: { zh: '半夜。一个孩子在楼下哭。可能是诱饵，也可能真是孩子。' },
    conditions: [A], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'go', label: { zh: '下去看' }, check: { attrs: ['strength', 'mind'] }, outcomes: {
        fail: { text: { zh: '是诱饵。你挨了一棍，跑回来时少了一箱东西。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'loseCard', cardId: 'supply_canned' }] },
        fine: { text: { zh: '真是个孩子。她妈妈在旁边，已经不动了。你带她上了楼。' }, effects: [{ type: 'recruitRandom', rarityWeights: { common: 70, fine: 30 } }, { type: 'stat', stat: 'butterfly', delta: 3 }] },
        rare: { text: { zh: '是个孩子，和她还能动的妈妈。她妈妈是护士。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 50, rare: 50 } }] },
      } },
      { id: 'ignore', label: { zh: '塞上耳朵' }, outcomes: { fine: { text: { zh: '哭声在凌晨三点停了。' }, effects: [{ type: 'loyalty', target: 'all', delta: -3 }] } } },
    ],
  },
  {
    id: 'ch_family', locationId: 'home', instant: true, weight: 7, icon: '👨‍👧',
    title: { zh: '带孩子的男人' }, text: { zh: '他在你门口跪下来，求你收留。孩子在发烧。他说他会修任何东西。' },
    conditions: [A], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'take', label: { zh: '收留他们（两张嘴，一个会修东西的人）' }, check: { attrs: ['charm', 'mind'] }, outcomes: {
        fail: { text: { zh: '孩子没撑过去。他第二天走了，没带走任何东西。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 3 }] },
        fine: { text: { zh: '孩子退烧了。他成了基地里最勤快的人。' }, effects: [{ type: 'recruitRandom', rarityWeights: { common: 30, fine: 50, rare: 20 } }] },
        rare: { text: { zh: '孩子退烧了。他跪下来的时候你把他拉了起来。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 50, rare: 50 } }, { type: 'loyalty', target: 'all', delta: 5 }] },
      } },
      { id: 'meds', label: { zh: '只给药，不收人' }, conditions: [{ type: 'hasSupplyKind', supplyKind: 'medicine', minPoints: 1 }], outcomes: { fine: { text: { zh: '你给了药，关上了门。他在门外说了声谢谢。' }, effects: [{ type: 'loseCard', cardId: 'supply_bandage' }, { type: 'relation', factionId: 'alliance', delta: 5 }] } } },
      { id: 'refuse', label: { zh: '拒绝' }, outcomes: { fine: { text: { zh: '第二天那扇门再也没开过。' }, effects: [{ type: 'stat', stat: 'butterfly', delta: 2 }] } } },
    ],
  },
  {
    id: 'ch_bitten', locationId: 'home', instant: true, weight: 6, icon: '🩸',
    title: { zh: '他的袖子' }, text: { zh: '一个伙伴的袖子上有血。他说是刮的。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'check', label: { zh: '让他卷起袖子' }, check: { attrs: ['charm', 'mind'] }, outcomes: {
        fail: { text: { zh: '真是咬的。他哭着求你。你没有隔离舱。第二天你不得不做那件事。' }, effects: [{ type: 'loyalty', target: 'all', delta: -10 }, { type: 'stat', stat: 'health', delta: -1 }] },
        fine: { text: { zh: '真是刮的。他很委屈，但理解。' }, effects: [{ type: 'loyalty', target: 'all', delta: 2 }] },
      } },
      { id: 'trust', label: { zh: '信他' }, check: { attrs: ['mind'] }, outcomes: {
        fail: { text: { zh: '三天后，他在夜里变了。' }, effects: [{ type: 'injure', target: 'hero', severity: 2 }, { type: 'loyalty', target: 'all', delta: -15 }] },
        fine: { text: { zh: '真是刮的。他记住了你信他。' }, effects: [{ type: 'loyalty', target: 'all', delta: 6 }] },
      } },
    ],
  },
  {
    id: 'ch_leaflet', locationId: 'home', instant: true, weight: 6, icon: '📄',
    title: { zh: '天上掉下来的传单' }, text: { zh: '"军区收编幸存者，携带物资优先。"落款是顾沉。' },
    conditions: [A, { type: 'month', from: 3, to: 12 }], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'keep', label: { zh: '留着，以后有用' }, outcomes: { fine: { text: { zh: '你把它夹在日记里。' }, effects: [{ type: 'relation', factionId: 'army', delta: 3 }] } } },
      { id: 'share', label: { zh: '贴在楼道里' }, outcomes: { fine: { text: { zh: '第二天走了两户。剩下的更信你了。' }, effects: [{ type: 'relation', factionId: 'army', delta: 8 }, { type: 'loyalty', target: 'all', delta: 4 }] } } },
    ],
  },
  {
    id: 'ch_injured_dog', locationId: 'home', instant: true, weight: 5, icon: '🐕',
    title: { zh: '受伤的狗' }, text: { zh: '它拖着一条腿走到你门口，没叫。' },
    conditions: [A, { type: 'not', cond: { type: 'hasPet', species: 'dog' } }], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'treat', label: { zh: '用绷带给它包扎' }, conditions: [{ type: 'hasSupplyKind', supplyKind: 'medicine', minPoints: 1 }], outcomes: { fine: { text: { zh: '三天后它能走了。它没走。' }, effects: [{ type: 'loseCard', cardId: 'supply_bandage' }, { type: 'adoptPet', petId: 'pet_dog' }] } } },
      { id: 'feed', label: { zh: '给它点吃的，让它走' }, outcomes: { fine: { text: { zh: '它吃完，看了你一眼，走了。' }, effects: [{ type: 'loseCard', cardId: 'supply_veg' }] } } },
      { id: 'shut', label: { zh: '关门' }, outcomes: { fine: { text: { zh: '第二天门口没有狗，只有一滩血。' }, effects: [] } } },
    ],
  },
  {
    id: 'ch_trader', locationId: 'home', instant: true, weight: 6, icon: '🧳',
    title: { zh: '走街串巷的贩子' }, text: { zh: '他背着一个大包，说有药。要晶核或者枪。' },
    conditions: [A, { type: 'month', from: 2, to: 12 }], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'trade', label: { zh: '用晶核换' }, conditions: [{ type: 'hasSupplyKind', supplyKind: 'food', minPoints: 0 }], check: { attrs: ['charm', 'mind'] }, outcomes: {
        fail: { text: { zh: '是过期的。' }, effects: [{ type: 'loseCard', cardId: 'core_common' }, { type: 'gainCard', cardId: 'supply_bandage' }] },
        fine: { text: { zh: '真货。' }, effects: [{ type: 'loseCard', cardId: 'core_common' }, { type: 'gainCard', cardId: 'supply_antibiotics' }] },
        rare: { text: { zh: '他多给了你一瓶，说"下次还找我"。' }, effects: [{ type: 'loseCard', cardId: 'core_common' }, { type: 'gainCard', cardId: 'supply_antibiotics', count: 2 }, { type: 'gainCard', cardId: 'supply_medkit' }] },
      } },
      { id: 'rob', label: { zh: '抢' }, check: { attrs: ['strength'] }, outcomes: {
        fail: { text: { zh: '他比你快。' }, effects: [{ type: 'injure', target: 'hero', severity: 1 }, { type: 'stat', stat: 'exposure', delta: 10 }] },
        fine: { text: { zh: '你拿到了包。他跑了。这事会传出去。' }, effects: [{ type: 'gainRandom', table: 'loot_hospital', count: 3 }, { type: 'stat', stat: 'exposure', delta: 15 }, { type: 'relation', factionId: 'alliance', delta: -10 }] },
      } },
      { id: 'no', label: { zh: '不需要' }, outcomes: { fine: { text: { zh: '他走了。' }, effects: [] } } },
    ],
  },
  {
    id: 'ch_survivor_knock', locationId: 'home', instant: true, weight: 7, icon: '🚪',
    title: { zh: '有人敲门求收留' }, text: { zh: '一个年轻人，看起来没受伤。他说他会修发电机。' },
    conditions: [A], durationWeeks: 0, slots: [], outcomes: { fine: { text: { zh: '' }, effects: [] } },
    choices: [
      { id: 'accept', label: { zh: '让他进来' }, check: { attrs: ['mind', 'charm'] }, outcomes: {
        fail: { text: { zh: '他半夜卷走了一箱东西。' }, effects: [{ type: 'loseCard', cardId: 'supply_water_box' }] },
        fine: { text: { zh: '他真会修发电机。' }, effects: [{ type: 'recruitRandom' }] },
        rare: { text: { zh: '他不仅会修，还带来一桶油。' }, effects: [{ type: 'recruitRandom', rarityWeights: { fine: 60, rare: 40 } }, { type: 'gainCard', cardId: 'supply_gasoline' }] },
      } },
      { id: 'test', label: { zh: '先让他在楼道住三天' }, outcomes: { fine: { text: { zh: '三天后他还在。你开了门。' }, effects: [{ type: 'recruitRandom' }, { type: 'loyalty', target: 'all', delta: -2 }] } } },
      { id: 'refuse', label: { zh: '拒绝' }, outcomes: { fine: { text: { zh: '他没纠缠。' }, effects: [] } } },
    ],
  },
]
