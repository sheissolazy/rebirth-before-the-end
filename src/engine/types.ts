/**
 * 引擎类型契约（Engine Type Contract）v0.3
 *
 * UI（Codex）与引擎（Claude）之间的唯一接口。
 *  - 改这里必须先改 docs/DESIGN.md 对应小节，提交信息加 `contract:` 前缀。
 *  - UI 只读 GameState，只通过 engine/api.ts 改状态。
 *  - 所有玩家可见文案都是 LocalizedText，不要在代码里写死中文。
 */

// ---------- 基础 ----------

/** 玩家可见文案。中文必填，英文可选。 */
export interface LocalizedText {
  zh: string
  en?: string
}

/** 稀有度四档：普通(白) / 优良(绿) / 稀有(蓝) / 传说(金)。全局通用。 */
export type Rarity = 'common' | 'fine' | 'rare' | 'legendary'
export const RARITY_ORDER: Rarity[] = ['common', 'fine', 'rare', 'legendary']
/** 物资/装备/晶核分值 */
export const RARITY_POINTS: Record<Rarity, number> = { common: 1, fine: 2, rare: 4, legendary: 8 }
/** 危机需求分 */
export const CRISIS_POINTS: Record<Rarity, number> = { common: 2, fine: 4, rare: 8, legendary: 16 }

/** 危机五类：尸潮 / 匮乏 / 气候 / 疫病 / 人祸 */
export type CrisisKind = 'horde' | 'scarcity' | 'climate' | 'plague' | 'human'

/** 物资八维度（种子不顶危机，只用于建造种植类模块） */
export type SupplyKind = 'food' | 'water' | 'medicine' | 'energy' | 'weapon' | 'material' | 'daily' | 'seed'
export const SUPPLY_KINDS: SupplyKind[] = ['food', 'water', 'medicine', 'energy', 'weapon', 'material', 'daily', 'seed']

/** 每类危机能用哪些维度硬顶（尸潮/人祸还会算基地防御与守卫战力，见引擎） */
export const CRISIS_ACCEPTS: Record<CrisisKind, SupplyKind[]> = {
  horde: ['weapon'],
  scarcity: ['food', 'water'],
  climate: ['energy', 'daily'],
  plague: ['medicine', 'water'],
  human: ['weapon', 'daily'],
}

/** 三属性：体力 / 头脑 / 魅力 */
export type Attr = 'strength' | 'mind' | 'charm'
export type Attrs = Record<Attr, number>
export const ATTR_MAX = 10

/** 好感档位 */
export type AffectionRank = 'stranger' | 'acquaintance' | 'friend' | 'crush' | 'lover'
export const AFFECTION_THRESHOLDS: Record<AffectionRank, number> = {
  stranger: 0, acquaintance: 20, friend: 40, crush: 60, lover: 80,
}

/** 异能种类 */
export type PowerKind = 'space' | 'lightning' | 'heal' | 'time' | 'fire' | 'mind' | 'sense' | 'strength'

// ---------- 时间 ----------

/**
 * 阶段：序章（末日前）/ 末日后。
 * 序章按"距末日还有 N 周"倒数；末日后按 年/月/周。
 */
export type Phase = 'prologue' | 'apocalypse'

export interface GameTime {
  phase: Phase
  /** 序章：距末日还有几周（4 → 1）。末日后恒为 0 */
  weeksBeforeEnd: number
  /** 末日后：年 1..10，月 1..12，周 1..4。序章时 year=0 */
  year: number
  month: number
  week: number
}

/** 绝对回合数，从本世第 1 回合起算，0 起 */
export type Turn = number

// ---------- 卡牌定义（内容层，静态） ----------

export type CardKind =
  | 'supply' | 'equipment' | 'core' | 'intel' | 'skill' | 'trouble' | 'crisis'

export interface CardDefBase {
  id: string
  kind: CardKind
  name: LocalizedText
  desc: LocalizedText
  rarity: Rarity
  /** 卡面图标：首版 emoji，之后可换图片路径 */
  icon?: string
}

export interface SupplyCardDef extends CardDefBase {
  kind: 'supply'
  supplyKind: SupplyKind
  /** 占格 1~3 */
  size: number
  /** 保质期（周）。undefined = 不过期 */
  shelfLifeWeeks?: number
  /** 份数：食物/水按"人·周"计，一张卡能供几人周。默认 1。其它维度不消耗份数 */
  units?: number
  /** 序章价格（钱）。末日后按晶核/物资汇率换算 */
  basePrice: number
  /** 序章能否网购（枪 = false 只能黑市/门路；生鲜 = false 只能自产） */
  buyable: boolean
  /** 网购到货周数（默认 1；大件 2） */
  deliveryWeeks?: number
  /** 每周限购件数（默认 5） */
  weeklyLimit?: number
  /** 可主动使用（咖啡、功能饮料、维生素…）：使用时的效果，用掉一份 */
  onUse?: Effect[]
}

export type EquipSlot = 'weapon' | 'armor' | 'accessory'

export interface EquipmentCardDef extends CardDefBase {
  kind: 'equipment'
  slot: EquipSlot
  /** 放进事件白槽或装备后加的骰子 */
  bonusDice: number
  /** 适用属性；undefined = 任何检定都加 */
  forAttr?: Attr
  /** 是否是枪械（序章极难获得） */
  firearm?: boolean
  basePrice: number
  buyable: boolean
  deliveryWeeks?: number
  weeklyLimit?: number
}

/** 装备随机词缀 */
export interface AffixDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  bonusDice?: number
  /** 词缀可带的其它效果（引擎解释） */
  effects?: Effect[]
}

/** 晶核：击杀掉落，升级异能 / 硬通货 */
export interface CoreCardDef extends CardDefBase {
  kind: 'core'
}

export interface IntelCardDef extends CardDefBase {
  kind: 'intel'
  effect: IntelEffect
}
export type IntelEffect =
  | { type: 'revealCrisisRarity'; monthsAhead: number }
  | { type: 'delayCrisis' }
  | { type: 'fixMemory' }
  | { type: 'revealFaction'; factionId: string }

/** 技能卡：男主/伙伴/异能提供，借力顶卡或加骰 */
export interface SkillCardDef extends CardDefBase {
  kind: 'skill'
  /** 归属：npcId 或 'hero' */
  ownerId: string
  /** 可代替硬顶的危机类型 */
  counters?: CrisisKind
  bonusDice?: number
  forAttr?: Attr
}

export interface TroubleCardDef extends CardDefBase {
  kind: 'trouble'
  size: number
  weeklyMoneyDelta?: number
  weeklyLoyaltyDelta?: number
  weeklyExposureDelta?: number
  resolvedByEventIds: string[]
}

export interface CrisisCardDef extends CardDefBase {
  kind: 'crisis'
  crisisKind: CrisisKind
  onDraw: LocalizedText
  onSurvive: LocalizedText
  onFail: LocalizedText
}

export type CardDef =
  | SupplyCardDef | EquipmentCardDef | CoreCardDef | IntelCardDef
  | SkillCardDef | TroubleCardDef | CrisisCardDef

// ---------- 异能 ----------

export interface PowerDef {
  id: string
  kind: PowerKind
  name: LocalizedText
  desc: LocalizedText
  /** 每档效果说明（UI 展示）与升级所需晶核分 */
  levels: Array<{ rarity: Rarity; desc: LocalizedText; upgradeCorePoints: number }>
}

// ---------- 人 ----------

export interface NpcDef {
  id: string
  name: LocalizedText
  title: LocalizedText
  bio: LocalizedText
  icon?: string
  rarity: Rarity
  /** 男主 = true */
  romanceable: boolean
  attrs: Attrs
  /** 缺的物资维度（送这个最涨好感/忠诚） */
  needs: SupplyKind
  powerId?: string
  skillCardIds: string[]
  initialAffection: number
  /** 所属势力（男主/领袖用） */
  factionId?: string
}

/** 随机幸存者生成模板 */
export interface SurvivorTraitDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  attrDelta?: Partial<Attrs>
  /** 派工时的加成 */
  jobBonus?: Partial<Record<CompanionJob, number>>
  /** 每周忠诚变化 */
  loyaltyDrift?: number
}

export type CompanionJob = 'guard' | 'farm' | 'scavenge' | 'train' | 'escort' | 'idle'

export interface PetDef {
  id: string
  species: 'dog' | 'cat'
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  rarity: Rarity
  weeklyFood: number
  effects: Effect[]
}

// ---------- 基地 ----------

export type BaseType = 'apartment' | 'villa' | 'farmhouse' | 'bunker'

export interface ModuleDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  /** 只能建在哪种基地 */
  baseType: BaseType
  /** 建造消耗：材料分 + 人力（伙伴周数）+ 周数 + 必需的特定卡（种子等，消耗） */
  cost: { materialPoints: number; labor: number; weeks: number; money?: number; requires?: Array<{ cardId: string; count: number }> }
  /** 建成效果（持续性，引擎每周结算） */
  provides: ModuleEffect[]
}

export type ModuleEffect =
  | { type: 'defense'; value: number }
  | { type: 'storage'; value: number }
  | { type: 'produce'; supplyKind: SupplyKind; cardId: string; perWeek: number }
  | { type: 'heal'; perWeek: number }
  | { type: 'trainBonus'; attr: Attr; dice: number }
  | { type: 'counters'; crisisKind: CrisisKind; points: number }
  | { type: 'unlock'; feature: 'diplomacy' | 'research' | 'quarantine' | 'escape' | 'cold' }
  | { type: 'population'; value: number }

export interface BaseDef {
  type: BaseType
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  price: number
  baseDefense: number
  storage: number
  population: number
}

// ---------- 势力 ----------

export interface FactionDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  leaderNpcId?: string
  initialRelation: number
  /** 交易汇率：1 晶核分 = 多少物资分 */
  tradeRate: number
}

// ---------- 地点与事件 ----------

export interface LocationDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  /** 序章 / 末日后 / 两者 */
  phase: Phase | 'both'
  /** 基地内 = true（不算外出，无遭遇） */
  inBase?: boolean
  pos: { x: number; y: number }
  /** 遭遇权重（外出地点）：随机丧尸/幸存者/势力的概率 */
  encounter?: { zombie: number; survivor: number; faction: number }
}

export type HeroStat = 'health' | 'exposure' | 'butterfly'

export type Condition =
  | { type: 'phase'; phase: Phase }
  | { type: 'weeksBeforeEnd'; from: number; to: number }
  | { type: 'month'; from: number; to: number }
  | { type: 'year'; from: number; to: number }
  | { type: 'flag'; flag: string; value?: boolean }
  | { type: 'affectionAtLeast'; npcId: string; rank: AffectionRank }
  | { type: 'npcAlive'; npcId: string }
  | { type: 'npcInBase'; npcId: string; value: boolean }
  | { type: 'moneyAtLeast'; amount: number }
  | { type: 'statAtLeast'; stat: HeroStat; value: number }
  | { type: 'statAtMost'; stat: HeroStat; value: number }
  | { type: 'attrAtLeast'; attr: Attr; value: number }
  | { type: 'hasSupplyKind'; supplyKind: SupplyKind; minPoints: number }
  | { type: 'crisisActive'; crisisKind: CrisisKind }
  | { type: 'baseType'; baseType: BaseType }
  | { type: 'hasModule'; moduleId: string }
  | { type: 'relationAtLeast'; factionId: string; value: number }
  | { type: 'powerAtLeast'; powerId: string; rarity: Rarity }
  | { type: 'employed'; value: boolean }
  | { type: 'hasPet'; species: 'dog' | 'cat' }
  | { type: 'hasCard'; cardId: string }
  | { type: 'not'; cond: Condition }
  | { type: 'random'; chance: number }

export type CardFilter =
  | { kind: 'hero' }
  | { kind: 'npc'; npcId?: string; romanceable?: boolean; minRank?: AffectionRank }
  | { kind: 'companion'; minLoyalty?: number }
  | { kind: 'pet'; species?: 'dog' | 'cat' }
  | { kind: 'supply'; supplyKind?: SupplyKind; minRarity?: Rarity }
  | { kind: 'equipment'; slot?: EquipSlot }
  | { kind: 'core'; minRarity?: Rarity }
  | { kind: 'intel' }
  | { kind: 'skill'; ownerId?: string }
  | { kind: 'trouble' }

export interface SlotDef {
  id: string
  label: LocalizedText
  required: boolean
  accepts: CardFilter
  /** 放进来的卡是否被消耗 */
  consumes?: boolean
  bonusDice?: number
}

export interface CheckDef {
  attrs: Attr[]
  successChance?: number
  /** 达到传说结果需要的成功数（默认不设 = 无传说档） */
  legendaryAt?: number
}

export type Outcome = 'fail' | 'common' | 'fine' | 'rare' | 'legendary'

export type Effect =
  | { type: 'money'; delta: number }
  | { type: 'stat'; stat: HeroStat; delta: number }
  | { type: 'attr'; target: 'hero' | string; attr: Attr; delta: number }
  | { type: 'gainCard'; cardId: string; count?: number }
  | { type: 'gainRandom'; table: string; count?: number }          // 掉落表
  | { type: 'loseCard'; cardId: string; count?: number }
  | { type: 'affection'; npcId: string; delta: number }
  | { type: 'loyalty'; target: string | 'all'; delta: number }
  | { type: 'npcJoin'; npcId: string }                               // 男主/固定 NPC 入住
  | { type: 'npcLeave'; npcId: string }
  | { type: 'recruitRandom'; rarityWeights?: Partial<Record<Rarity, number>> }
  | { type: 'injure'; target: 'hero' | string; severity: 1 | 2 | 3 }
  | { type: 'kill'; target: string }
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'employment'; value: boolean }
  | { type: 'resolveCrisis' }
  | { type: 'revealCrisis'; monthsAhead: number }
  | { type: 'unlockEvent'; eventId: string }
  | { type: 'relation'; factionId: string; delta: number }
  | { type: 'moveBase'; baseType: BaseType }
  | { type: 'buildModule'; moduleId: string }
  | { type: 'damageModule'; moduleId?: string }
  | { type: 'powerUp'; powerId: string }
  | { type: 'adoptPet'; petId: string }
  | { type: 'losePet'; petId: string }
  | { type: 'rebirthPoints'; delta: number }
  | { type: 'energy'; delta: number; permanent?: boolean }
  | { type: 'ending'; endingId: string }

export interface OutcomeBranch {
  text: LocalizedText
  effects: Effect[]
}

/** 选择事件的一个选项 */
export interface ChoiceDef {
  id: string
  label: LocalizedText
  conditions?: Condition[]
  check?: CheckDef
  outcomes: Partial<Record<Outcome, OutcomeBranch>> & { fine: OutcomeBranch }
}

export interface EventDef {
  id: string
  locationId: string
  title: LocalizedText
  text: LocalizedText
  icon?: string
  /** 女主参与需要的精力（默认 2）。伙伴不耗精力 */
  energy?: number
  /** 即时选择事件：周初弹出，当场选一个选项结算，不占槽位。locationId 可为 '' */
  instant?: boolean
  choices?: ChoiceDef[]
  conditions: Condition[]
  /** 事件牌堆权重（剧情事件设 0 = 必出） */
  weight: number
  durationWeeks: number
  slots: SlotDef[]
  check?: CheckDef
  /** 无检定 = 直接走 outcomes.fine */
  outcomes: Partial<Record<Outcome, OutcomeBranch>> & { fine: OutcomeBranch }
  once?: boolean
  repeatable?: boolean
  storylineNpcId?: string
  /** 危机"剧情解"事件：标记对应类型 */
  resolvesCrisis?: CrisisKind
}

/** 掉落表 */
export interface LootTableDef {
  id: string
  entries: Array<{ cardId: string; weight: number; count?: [number, number] }>
  /** 装备是否附随机词缀 */
  affixChance?: number
}

export interface MemoryEntryDef {
  month: number
  memory: LocalizedText
  crisisKind: CrisisKind
  baseRarity: Rarity
}

export interface EndingDef {
  id: string
  title: LocalizedText
  text: LocalizedText
  conditions: Condition[]
  rebirthPoints: number
}

/** 开局特质：cost > 0 花预算，cost < 0 给预算 */
export interface StartTraitDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  cost: number
  effects: Effect[]
}

/** 重生点商店条目 */
export interface RebirthShopItemDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  /** 价格随已购次数递增：cost[n] */
  cost: number[]
  effect:
    | { type: 'prologueWeeks'; delta: number }
    | { type: 'money'; delta: number }
    | { type: 'spaceRarity'; rarity: Rarity }
    | { type: 'attrPoint'; count: number }
    | { type: 'affection'; delta: number }      // 选一位男主
    | { type: 'pet'; species: 'dog' | 'cat' }
    | { type: 'keepEquipment' }
    | { type: 'traitPoints'; delta: number }
}

/** 内容包 */
export interface ContentPack {
  locations: LocationDef[]
  events: EventDef[]
  cards: CardDef[]
  affixes: AffixDef[]
  lootTables: LootTableDef[]
  npcs: NpcDef[]
  survivorTraits: SurvivorTraitDef[]
  survivorNames: LocalizedText[]
  powers: PowerDef[]
  pets: PetDef[]
  bases: BaseDef[]
  modules: ModuleDef[]
  factions: FactionDef[]
  memories: MemoryEntryDef[]
  endings: EndingDef[]
  rebirthShop: RebirthShopItemDef[]
  startTraits: StartTraitDef[]
}

// ---------- 运行时状态 ----------

export interface CardInstance {
  instanceId: string
  defId: string
  /** 剩余份数（食物/水） */
  unitsLeft?: number
  expiresAtTurn?: Turn
  /** 过期次数（0 正常，1 降档，2 垃圾） */
  spoiled?: number
  /** 装备词缀 */
  affixIds?: string[]
  /** 在空间里（抢不走） */
  inSpace?: boolean
}

export interface PersonState {
  id: string
  /** 固定 NPC = defId；随机幸存者 = 生成的资料 */
  defId?: string
  generated?: { name: LocalizedText; rarity: Rarity; traitId: string; needs: SupplyKind; powerId?: string }
  attrs: Attrs
  alive: boolean
  injury: number           // 0~3
  inBase: boolean
  /** 男主：好感；伙伴：忠诚 */
  affection: number
  loyalty: number
  job: CompanionJob
  busyWithEventId?: string
  harmony: boolean
  equipment: Partial<Record<EquipSlot, string>>   // instanceId
  powerRarity?: Rarity
}

export interface HeroState {
  name: LocalizedText
  attrs: Attrs
  /** 本周剩余精力 */
  energy: number
  /** 永久精力上限加成（特质、稀有药） */
  energyBonus: number
  health: number       // 0~10
  exposure: number     // 0~100
  butterfly: number    // 0~100
  employed: boolean
  skippedWorkStreak: number
  incapacitatedWeeks: number
  equipment: Partial<Record<EquipSlot, string>>
  spaceRarity: Rarity
  /** 序章贷款余额（末日后作废） */
  debt: number
}

export interface BaseState {
  type: BaseType
  modules: Array<{ moduleId: string; damaged: boolean }>
  /** 在建模块（一次只能建一个），完工后进入 modules */
  building?: { moduleId: string; weeksLeft: number }
}

/** 网购订单 */
export interface Order {
  cardDefId: string
  count: number
  arrivesAtTurn: Turn
}

export interface PetState {
  id: string
  defId: string
  alive: boolean
}

/** 空间容量（格）按档位 */
export const SPACE_CAPACITY: Record<Rarity, number> = { common: 10, fine: 40, rare: 120, legendary: 300 }

export interface ActiveCrisis {
  cardDefId: string
  crisisKind: CrisisKind
  rarity: Rarity
  revealed: boolean
  resolved: boolean
  dueTurn: Turn
}

export interface Placement {
  eventId: string
  /** slotId -> instanceId | 'hero' | personId | petId */
  assignments: Record<string, string>
  startedTurn: Turn
  resolvesAtTurn: Turn
}

export interface EventResult {
  eventId: string
  outcome: Outcome
  successes: number
  diceCount: number
  text: LocalizedText
  effects: Effect[]
}

export interface WeekReport {
  time: GameTime
  news: LocalizedText[]
  eventResults: EventResult[]
  upkeep: { money: number; food: number; water: number; health: number; loyalty: number }
  spoiled: CardInstance[]
  produced: CardInstance[]
  /** 本周到货的网购 */
  delivered: CardInstance[]
  /** 本周完工的模块 */
  builtModuleId?: string
  crisisResult?: { crisisKind: CrisisKind; rarity: Rarity; survived: boolean; text: LocalizedText }
  deaths: string[]
  ending?: string
}

export interface GameState {
  seed: string
  rngState: number
  /** 本世序章长度（周） */
  prologueWeeks: number
  turn: Turn
  time: GameTime
  hero: HeroState
  money: number
  priceMultiplier: number
  base: BaseState
  /** 基地仓库 + 空间（inSpace 标记） */
  warehouse: CardInstance[]
  hand: CardInstance[]
  people: Record<string, PersonState>
  pets: PetState[]
  factions: Record<string, { relation: number }>
  crisis: ActiveCrisis | null
  forecast: Array<{ month: number; crisisKind: CrisisKind; rarity?: Rarity; memory: LocalizedText }>
  /** 本周各地点抽出的事件 */
  drawnEvents: Record<string, string[]>
  /** 周初弹出的即时选择事件（必须先处理才能过周） */
  pendingChoice: string | null
  /** 在路上的网购（序章）。末日一到全部丢失 */
  orders: Order[]
  /** 本周各商品已下单件数（限购） */
  orderedThisWeek: Record<string, number>
  placements: Placement[]
  flags: Record<string, boolean>
  unlockedEvents: string[]
  usedOnceEvents: string[]
  diary: Array<{ turn: Turn; text: LocalizedText }>
  lastReport: WeekReport | null
  rebirthPointsEarned: number
  ending: string | null
}

// ---------- 存档 / 多周目 ----------

export interface MetaProgress {
  rebirthPoints: number
  /** 开局特质预算（每过一世 +1，商店可买） */
  traitPoints: number
  rebirths: number
  unlockedEndings: string[]
  purchased: Record<string, number>   // shopItemId -> 次数
}

export interface NewGameOptions {
  seed?: string
  build: 'balanced' | 'strength' | 'mind' | 'charm'
  /** 选中的开局特质 id */
  traits?: string[]
  meta: MetaProgress
  /** 本世应用的商店效果 */
  bonusNpcId?: string
}
