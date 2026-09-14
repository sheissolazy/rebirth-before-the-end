/**
 * 引擎公开 API（签名契约）。
 * 实现在 src/engine/impl/（Claude 负责）。UI 只能调这里的函数。
 * 所有函数都是纯函数：输入 state 不被修改，返回新 state。
 */
import type {
  ContentPack, GameState, NewGameOptions, Placement, WeekReport, EventDef, CardFilter, AbsWeek, GameTime,
} from './types'

export interface GameEngine {
  /** 开新一世 */
  newGame(content: ContentPack, options: NewGameOptions): GameState
  /** 本周地图上可见的事件（已按 conditions 过滤） */
  availableEvents(state: GameState): EventDef[]
  /** 某个槽当前能放哪些卡（返回 instanceId / 'hero' / npcId 列表） */
  eligibleCards(state: GameState, eventId: string, slotId: string): string[]
  /** 放卡（校验槽位、主角一周一事、NPC 是否空闲）。失败抛 EngineError */
  place(state: GameState, placement: Omit<Placement, 'startedWeek' | 'resolvesAtWeek'>): GameState
  /** 撤回本周还没结算的放卡 */
  unplace(state: GameState, eventId: string): GameState
  /** 过一周：结算事件 → 消耗 → 过期 → 月末危机 → 新闻 → 日记 */
  endWeek(state: GameState): { state: GameState; report: WeekReport }
  /** 买东西（超市等地点 UI 直接调） */
  buy(state: GameState, cardDefId: string, count: number): GameState
  /** 送礼（涨好感，卡消失） */
  gift(state: GameState, npcId: string, instanceId: string): GameState
  /** 使用情报卡 */
  useIntel(state: GameState, instanceId: string): GameState
  /** 丢弃仓库卡（腾格子） */
  discard(state: GameState, instanceId: string): GameState
}

export class EngineError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** 工具：时间 <-> 绝对周 */
export function toAbsWeek(t: GameTime): AbsWeek {
  return (t.year - 1) * 48 + (t.month - 1) * 4 + (t.week - 1)
}
export function fromAbsWeek(w: AbsWeek): GameTime {
  return { year: Math.floor(w / 48) + 1, month: Math.floor((w % 48) / 4) + 1, week: (w % 4) + 1 }
}

/** 供 UI 判断某张卡能否进某槽（纯前端预检，引擎 place 时仍会复检） */
export type { CardFilter }
