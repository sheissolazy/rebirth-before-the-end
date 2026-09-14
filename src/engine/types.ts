/**
 * 引擎类型契约（Engine Type Contract）
 *
 * 这是 UI（Codex 负责）与引擎（Claude 负责）之间的唯一接口。
 * 规则：
 *  - 改这里必须先改 docs/DESIGN.md，再在 PR 里 @ 对方。
 *  - UI 只读 GameState，只通过 engine/api.ts 的函数改状态。
 *  - 所有玩家可见文案都是 LocalizedText，不要在代码里写死中文。
 */

// ---------- 基础 ----------

/** 玩家可见文案。中文必填，英文可选（之后补）。 */
export interface LocalizedText {
  zh: string
  en?: string
}

/** 四档品质，对应苏丹的游戏 石/铜/银/金 */
export type Tier = 'stone' | 'bronze' | 'silver' | 'gold'

/** 物资品质分：石1 铜2 银4 金8 */
export const SUPPLY_TIER_POINTS: Record<Tier, number> = { stone: 1, bronze: 2, silver: 4, gold: 8 }
/** 危机需求分：石2 铜4 银8 金16 */
export const CRISIS_TIER_POINTS: Record<Tier, number> = { stone: 2, bronze: 4, silver: 8, gold: 16 }

/** 危机四类：匮乏 / 气候 / 疫病 / 动荡 */
export type CrisisKind = 'scarcity' | 'climate' | 'plague' | 'unrest'

/** 物资六维度：食物 / 水 / 药品 / 能源 / 安全 / 日用 */
export type SupplyKind = 'food' | 'water' | 'medicine' | 'energy' | 'security' | 'daily'

/** 每类危机能用哪些维度的物资硬顶 */
export const CRISIS_ACCEPTS: Record<CrisisKind, SupplyKind[]> = {
  scarcity: ['food', 'water'],
  climate: ['energy', 'daily'],
  plague: ['medicine', 'water'],
  unrest: ['security', 'daily'],
}

/** 主角/NPC 四属性：体力 / 手艺 / 头脑 / 魅力 */
export type Attr = 'strength' | 'craft' | 'mind' | 'charm'
export type Attrs = Record<Attr, number>

/** 好感档位 */
export type AffectionRank = 'stranger' | 'acquaintance' | 'friend' | 'crush' | 'lover'
export const AFFECTION_THRESHOLDS: Record<AffectionRank, number> = {
  stranger: 0, acquaintance: 20, friend: 40, crush: 60, lover: 80,
}

// ---------- 时间 ----------

/** 年 1..10，月 1..12，周 1..4 */
export interface GameTime {
  year: number
  month: number
  week: number
}

/** 从第 1 年 1 月第 1 周起算的绝对周数，0 起 */
export type AbsWeek = number

// ---------- 卡牌定义（内容层，静态） ----------

export type CardKind = 'hero' | 'npc' | 'supply' | 'intel' | 'skill' | 'mood' | 'trouble' | 'crisis'

export interface CardDefBase {
  id: string
  kind: CardKind
  name: LocalizedText
  desc: LocalizedText
  tier: Tier
  /** 卡面图标（emoji 或图片路径），首版用 emoji */
  icon?: string
}

export interface SupplyCardDef extends CardDefBase {
  kind: 'supply'
  supplyKind: SupplyKind
  /** 占仓库格数 1~3 */
  size: number
  /** 保质期（周）。undefined = 不过期 */
  shelfLifeWeeks?: number
  /** 第 1 年 1 月基准价（之后按通胀乘） */
  basePrice: number
}

export interface IntelCardDef extends CardDefBase {
  kind: 'intel'
  effect: IntelEffect
}
export type IntelEffect =
  | { type: 'revealCrisisTier'; monthsAhead: number }
  | { type: 'delayCrisis' }
  | { type: 'fixMemory' }

export interface SkillCardDef extends CardDefBase {
  kind: 'skill'
  ownerNpcId: string
  /** 可代替硬顶的危机类型（借力）。undefined = 只加骰 */
  counters?: CrisisKind
  /** 放进白槽时加的骰子数 */
  bonusDice?: number
}

export interface MoodCardDef extends CardDefBase {
  kind: 'mood'
  moraleDelta?: number
  bonusDice?: number
  /** 持续周数 */
  durationWeeks: number
}

export interface TroubleCardDef extends CardDefBase {
  kind: 'trouble'
  /** 占仓库格数（0 = 不占） */
  size: number
  weeklyMoneyDelta?: number
  weeklyMoraleDelta?: number
  /** 能处理掉它的事件 id */
  resolvedByEventIds: string[]
}

export interface CrisisCardDef extends CardDefBase {
  kind: 'crisis'
  crisisKind: CrisisKind
  /** 危机文案：抽到时 / 顶住时 / 没顶住时 */
  onDraw: LocalizedText
  onSurvive: LocalizedText
  onFail: LocalizedText
}

export type CardDef =
  | SupplyCardDef | IntelCardDef | SkillCardDef | MoodCardDef | TroubleCardDef | CrisisCardDef

// ---------- NPC 定义 ----------

export interface NpcDef {
  id: string
  name: LocalizedText
  title: LocalizedText          // 身份，如"隔壁程序员"
  bio: LocalizedText
  icon?: string
  /** 是否可攻略 */
  romanceable: boolean
  attrs: Attrs
  /** 他缺的物资维度（送这个最涨好感；同住后带来的也是他不缺的） */
  needs: SupplyKind
  /** 危机技能卡 id（可攻略者才有） */
  skillCardId?: string
  /** 初始好感 */
  initialAffection: number
}

// ---------- 地点与事件定义 ----------

export interface LocationDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  icon?: string
  /** 地图上的位置（0~100 百分比），UI 用 */
  pos: { x: number; y: number }
}

/** 条件：全部满足才成立 */
export type Condition =
  | { type: 'month'; from: number; to: number }
  | { type: 'year'; from: number; to: number }
  | { type: 'flag'; flag: string; value?: boolean }
  | { type: 'affectionAtLeast'; npcId: string; rank: AffectionRank }
  | { type: 'npcAlive'; npcId: string }
  | { type: 'npcCohabiting'; npcId: string; value: boolean }
  | { type: 'moneyAtLeast'; amount: number }
  | { type: 'statAtLeast'; stat: HeroStat; value: number }
  | { type: 'hasSupplyKind'; supplyKind: SupplyKind; minPoints: number }
  | { type: 'crisisActive'; crisisKind: CrisisKind }
  | { type: 'employed'; value: boolean }
  | { type: 'not'; cond: Condition }

export type HeroStat = 'health' | 'morale' | 'reputation' | 'butterfly'

/** 卡槽能接受什么卡 */
export type CardFilter =
  | { kind: 'hero' }
  | { kind: 'npc'; npcId?: string; romanceable?: boolean; minRank?: AffectionRank }
  | { kind: 'supply'; supplyKind?: SupplyKind; minTier?: Tier }
  | { kind: 'intel' }
  | { kind: 'skill'; npcId?: string }
  | { kind: 'mood' }
  | { kind: 'trouble' }

export interface SlotDef {
  id: string
  label: LocalizedText
  /** 红槽 = 必填 */
  required: boolean
  accepts: CardFilter
  /** 放进来的物资卡是否被消耗（送礼/使用） */
  consumes?: boolean
  /** 放进来加几个骰子（物资/情报白槽用） */
  bonusDice?: number
}

/** 检定 = 掷 (attrs 之和 + 白槽加成) 个骰子，数成功数 */
export interface CheckDef {
  attrs: Attr[]
  /** 每骰成功率，默认 0.5 */
  successChance?: number
}

/** 检定结果档：0 = fail, 1~2 = bronze, 3~4 = silver, >=5 = gold */
export type Outcome = 'fail' | 'bronze' | 'silver' | 'gold'

export type Effect =
  | { type: 'money'; delta: number }
  | { type: 'stat'; stat: HeroStat; delta: number }
  | { type: 'attr'; attr: Attr; delta: number }
  | { type: 'gainCard'; cardId: string; count?: number }
  | { type: 'loseCard'; cardId: string; count?: number }
  | { type: 'affection'; npcId: string; delta: number }
  | { type: 'npcCohabit'; npcId: string; value: boolean }
  | { type: 'npcInjure'; npcId: string; severity: 1 | 2 | 3 }
  | { type: 'npcDie'; npcId: string }
  | { type: 'setFlag'; flag: string; value?: boolean }
  | { type: 'warehouseCapacity'; delta: number }
  | { type: 'employment'; value: boolean }
  | { type: 'resolveCrisis' }               // 剧情解：直接顶住本月危机
  | { type: 'revealCrisis'; monthsAhead: number }
  | { type: 'unlockEvent'; eventId: string }
  | { type: 'ending'; endingId: string }

export interface OutcomeBranch {
  text: LocalizedText
  effects: Effect[]
}

export interface EventDef {
  id: string
  locationId: string
  title: LocalizedText
  text: LocalizedText
  icon?: string
  /** 出现条件 */
  conditions: Condition[]
  /** 耗时（周）1~2 */
  durationWeeks: number
  slots: SlotDef[]
  /** 无检定 = 直接走 outcomes.silver */
  check?: CheckDef
  outcomes: Partial<Record<Outcome, OutcomeBranch>> & { silver: OutcomeBranch }
  /** 只能触发一次 */
  once?: boolean
  /** 是否是"上班"这类每周重复事件 */
  repeatable?: boolean
  /** 属于哪条 NPC 剧情线（UI 标记用） */
  storylineNpcId?: string
}

/** 第 1 年 12 条重生记忆（半固定危机） */
export interface MemoryEntryDef {
  month: number
  memory: LocalizedText
  crisisKind: CrisisKind
  baseTier: Tier
}

export interface EndingDef {
  id: string
  title: LocalizedText
  text: LocalizedText
  /** 判定顺序按数组顺序，先命中先得 */
  conditions: Condition[]
}

/** 内容包：所有静态内容 */
export interface ContentPack {
  locations: LocationDef[]
  events: EventDef[]
  cards: CardDef[]
  npcs: NpcDef[]
  memories: MemoryEntryDef[]
  endings: EndingDef[]
}

// ---------- 运行时状态 ----------

/** 卡牌实例：仓库/手牌里的一张具体的卡 */
export interface CardInstance {
  instanceId: string
  defId: string
  /** 物资：过期周（绝对周）。undefined = 不过期 */
  expiresAtWeek?: AbsWeek
  /** 已过期次数（0 正常，1 降档，2 垃圾） */
  spoiled?: number
  /** 心情卡：失效周 */
  endsAtWeek?: AbsWeek
}

export interface NpcState {
  id: string
  affection: number
  alive: boolean
  /** 受伤等级 0~3 */
  injury: number
  cohabiting: boolean
  /** 本周被派去的事件 id（在事件中 = 忙） */
  busyWithEventId?: string
  /** 多线"默契"状态 */
  harmony: boolean
}

export interface HeroState {
  name: LocalizedText
  attrs: Attrs
  health: number       // 0~10
  morale: number       // 0~10
  reputation: number   // 0~100
  butterfly: number    // 0~100 蝴蝶效应
  employed: boolean
  skippedWorkStreak: number
  /** 生病/受伤：还有几周不能行动 */
  incapacitatedWeeks: number
}

export interface ActiveCrisis {
  cardDefId: string
  crisisKind: CrisisKind
  /** 实际档位（可能因蝴蝶效应偏离记忆） */
  tier: Tier
  /** 玩家是否已通过情报看穿真实档位 */
  revealed: boolean
  /** 是否已被借力/剧情解顶住 */
  resolved: boolean
  /** 本月结算周 */
  dueWeek: AbsWeek
}

/** 一次放卡：把哪些卡放进某事件的哪些槽 */
export interface Placement {
  eventId: string
  /** slotId -> instanceId（主角用 'hero'，NPC 用 npcId） */
  assignments: Record<string, string>
  startedWeek: AbsWeek
  resolvesAtWeek: AbsWeek
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
  /** 本周吃喝/房租/麻烦卡扣的钱和状态 */
  upkeep: { money: number; health: number; morale: number }
  spoiled: CardInstance[]
  /** 月末才有 */
  crisisResult?: { crisisKind: CrisisKind; tier: Tier; survived: boolean; text: LocalizedText }
  ending?: string
}

export interface GameState {
  seed: string
  rngState: number
  time: GameTime
  hero: HeroState
  money: number
  /** 通胀倍率 */
  priceMultiplier: number
  warehouse: { capacity: number; cards: CardInstance[] }
  /** 非物资的手牌：情报/技能/心情/麻烦 */
  hand: CardInstance[]
  npcs: Record<string, NpcState>
  crisis: ActiveCrisis | null
  /** 未来月份的危机预告（记忆 + 情报修正） */
  forecast: Array<{ month: number; crisisKind: CrisisKind; tier?: Tier; memory: LocalizedText }>
  placements: Placement[]
  flags: Record<string, boolean>
  unlockedEvents: string[]
  usedOnceEvents: string[]
  /** 日记：每周一条，UI 的"末日日记"页 */
  diary: Array<{ week: AbsWeek; text: LocalizedText }>
  lastReport: WeekReport | null
  ending: string | null
}

// ---------- 存档 / 多周目 ----------

export interface MetaProgress {
  /** 记忆碎片数 */
  fragments: number
  unlockedEndings: string[]
  /** 已重生次数 */
  rebirths: number
}

export type RebirthBonus = 'warehouse4' | 'affection20' | 'attrPoint' | 'intelCard'

export interface NewGameOptions {
  seed?: string
  /** 3 种开局属性分配之一 */
  build: 'balanced' | 'brain' | 'social'
  bonus?: RebirthBonus
  bonusNpcId?: string
}
