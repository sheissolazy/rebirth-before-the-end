/**
 * 引擎公开 API（签名契约）。实现在 src/engine/impl/（Claude 负责）。
 * 所有函数都是纯函数：输入 state 不被修改，返回新 state。
 */
import type {
  ContentPack, GameState, NewGameOptions, Placement, WeekReport, EventDef, GameTime, Turn,
  CompanionJob, MetaProgress, EventResult, LocalizedText, Rarity, CrisisKind,
} from './types'

export const PROLOGUE_DEFAULT_WEEKS = 4
export const WEEKS_PER_MONTH = 4
export const MONTHS_PER_YEAR = 12
export const WEEKS_PER_YEAR = WEEKS_PER_MONTH * MONTHS_PER_YEAR

export interface GameEngine {
  newGame(content: ContentPack, options: NewGameOptions): GameState
  /** 本周各地点抽出的可见事件（已按 conditions 过滤、按 weight 抽样） */
  availableEvents(state: GameState): EventDef[]
  /** 某槽当前能放哪些：instanceId / 'hero' / personId / petId */
  eligibleCards(state: GameState, eventId: string, slotId: string): string[]
  place(state: GameState, placement: Omit<Placement, 'startedTurn' | 'resolvesAtTurn'>): GameState
  unplace(state: GameState, eventId: string): GameState
  /** 快递站：取回 / 丢弃 */
  pickupParcel(state: GameState, instanceId: string): GameState
  discardParcel(state: GameState, instanceId: string): GameState
  /** 接受 / 拒绝候选幸存者 */
  recruit(state: GameState, personId: string): GameState
  dismissRecruit(state: GameState, personId: string): GameState
  /** 给伙伴派工 */
  assignJob(state: GameState, personId: string, job: CompanionJob): GameState
  /** 开始建造模块 */
  build(state: GameState, moduleId: string): GameState
  /** 过一周 */
  endWeek(state: GameState): { state: GameState; report: WeekReport }
  /** 序章买东西 / 末日后向势力换东西 */
  buy(state: GameState, cardDefId: string, count: number, factionId?: string): GameState
  sell(state: GameState, instanceId: string, factionId?: string): GameState
  gift(state: GameState, personId: string, instanceId: string): GameState
  /** 送这张卡会涨多少好感/忠诚（UI 预览用） */
  giftValue(state: GameState, personId: string, instanceId: string): number
  equip(state: GameState, personId: 'hero' | string, instanceId: string): GameState
  useIntel(state: GameState, instanceId: string): GameState
  /** 用晶核升级异能 */
  upgradePower(state: GameState, powerId: string, coreInstanceIds: string[]): GameState
  /** 把卡放进/拿出空间 */
  moveToSpace(state: GameState, instanceId: string, inSpace: boolean): GameState
  discard(state: GameState, instanceId: string): GameState
  /** 使用消耗品（咖啡等） */
  useItem(state: GameState, instanceId: string): GameState
  /** 处理周初的即时选择事件 */
  choose(state: GameState, choiceId: string): { state: GameState; result: EventResult }
  /** 一世结束后结算重生点 */
  settle(state: GameState, meta: MetaProgress): MetaProgress
  /** UI 展示用的派生数据（防御、仓库占用、危机分、检定预览） */
  stats(state: GameState): DerivedStats
  /** 当前（或指定类型）危机的分数账本：每一分从哪来 */
  crisisBreakdown(state: GameState, kind?: CrisisKind): CrisisBreakdown
  /** 某事件对当前基地的实际精力消耗（离城远多耗） */
  eventEnergy(state: GameState, eventId: string): number
  /** 某事件在给定放卡下会掷几个骰子 */
  previewDice(state: GameState, eventId: string, assignments: Record<string, string>): number
}

export interface CrisisBreakdown {
  kind: CrisisKind | null
  /** 需要分；档位未知时为 null */
  need: number | null
  /** 记忆里的基准档（未看穿时给玩家参考） */
  baseline?: Rarity
  have: number
  items: Array<{ label: LocalizedText; points: number }>
}

export interface DerivedStats {
  energyMax: number
  /** 基地人口（含你）与上限 */
  population: number
  populationCap: number
  /** 每周消耗与库存（份） */
  mouths: number
  petMouths: number
  weeklyFood: number
  weeklyWater: number
  foodUnits: number
  waterUnits: number
  /** 仓库里"材料"维度物资的总分 */
  materialPoints: number
  /** 有没有冷藏（有电就有冰箱） */
  cold: boolean
  defense: number
  storageUsed: number
  storageCap: number
  /** 在路上的网购占的格数 */
  storageReserved: number
  spaceUsed: number
  spaceCap: number
  crisisHave: number
  crisisNeed: number
  corePoints: number
}

export class EngineError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(`${code}: ${message}`)
    this.code = code
  }
}

/** 回合 <-> 时间。prologueWeeks = 本世序章长度（默认 4）。 */
export function turnToTime(turn: Turn, prologueWeeks: number = PROLOGUE_DEFAULT_WEEKS): GameTime {
  if (turn < prologueWeeks) {
    return { phase: 'prologue', weeksBeforeEnd: prologueWeeks - turn, year: 0, month: 0, week: 0 }
  }
  const w = turn - prologueWeeks
  return {
    phase: 'apocalypse',
    weeksBeforeEnd: 0,
    year: Math.floor(w / WEEKS_PER_YEAR) + 1,
    month: Math.floor((w % WEEKS_PER_YEAR) / WEEKS_PER_MONTH) + 1,
    week: (w % WEEKS_PER_MONTH) + 1,
  }
}

export function timeToTurn(t: GameTime, prologueWeeks: number = PROLOGUE_DEFAULT_WEEKS): Turn {
  if (t.phase === 'prologue') return prologueWeeks - t.weeksBeforeEnd
  return prologueWeeks + (t.year - 1) * WEEKS_PER_YEAR + (t.month - 1) * WEEKS_PER_MONTH + (t.week - 1)
}
