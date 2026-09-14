import { useCallback, useMemo, useState } from 'react'
import type { GameState, MetaProgress, NewGameOptions, WeekReport, EventResult } from '../engine/types'
import { createEngine } from '../engine'
import { content } from '../content'
import { loadGame, loadMeta, saveGame, saveMeta, loadHistory, saveHistory } from '../save'

const MAX_HISTORY = 3

export const engine = createEngine(content)

export interface Store {
  state: GameState | null
  meta: MetaProgress
  report: WeekReport | null
  choiceResult: EventResult | null
  error: string | null
  notice: string | null
  clearNotice(): void
  /** 可回退的周数 */
  undoCount: number
  undo(): void
  newGame(opts: Omit<NewGameOptions, 'meta'>): void
  choose(choiceId: string): void
  dismissChoiceResult(): void
  act(fn: (s: GameState) => GameState): void
  endWeek(): void
  dismissReport(): void
  finishLife(): void
  buyShop(itemId: string): void
  clearError(): void
  abandon(): void
}

export function useStore(): Store {
  const [state, setState] = useState<GameState | null>(() => loadGame())
  const [meta, setMeta] = useState<MetaProgress>(() => loadMeta())
  const [report, setReport] = useState<WeekReport | null>(null)
  const [choiceResult, setChoiceResult] = useState<EventResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [history, setHistory] = useState<GameState[]>(() => loadHistory())

  const commit = useCallback((s: GameState | null) => { setState(s); saveGame(s) }, [])
  const commitMeta = useCallback((m: MetaProgress) => { setMeta(m); saveMeta(m) }, [])

  const newGame = useCallback((opts: Omit<NewGameOptions, 'meta'>) => {
    try { commit(engine.newGame(content, { ...opts, meta })); setReport(null); setChoiceResult(null); setHistory([]); saveHistory([]) } catch (e) { setError((e as Error).message) }
  }, [meta, commit])

  const act = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev
      try {
        const next = fn(prev); saveGame(next)
        if (next.noticeSeq !== prev.noticeSeq && next.lastNotice) setNotice(next.lastNotice.zh)
        return next
      } catch (e) { setError((e as Error).message); return prev }
    })
  }, [])

  const endWeek = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev
      try {
        const { state: next, report: r } = engine.endWeek(prev)
        saveGame(next); setReport(r)
        setHistory((h) => { const nh = [...h, prev].slice(-MAX_HISTORY); saveHistory(nh); return nh })
        return next
      } catch (e) { setError((e as Error).message); return prev }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h
      const prev = h[h.length - 1]
      const nh = h.slice(0, -1)
      saveHistory(nh)
      setState(prev); saveGame(prev); setReport(null); setChoiceResult(null)
      setNotice('回到了上一周。这一周的结算和突发都作废。')
      return nh
    })
  }, [])

  const choose = useCallback((choiceId: string) => {
    setState((prev) => {
      if (!prev) return prev
      try { const { state: next, result } = engine.choose(prev, choiceId); saveGame(next); setChoiceResult(result); return next } catch (e) { setError((e as Error).message); return prev }
    })
  }, [])

  const finishLife = useCallback(() => {
    if (!state) return
    commitMeta(engine.settle(state, meta))
    commit(null)
    setReport(null)
    setHistory([]); saveHistory([])
  }, [state, meta, commit, commitMeta])

  const buyShop = useCallback((itemId: string) => {
    const item = content.rebirthShop.find((i) => i.id === itemId)
    if (!item) return
    const n = meta.purchased[itemId] ?? 0
    const cost = item.cost[Math.min(n, item.cost.length - 1)]
    if (n >= item.cost.length || meta.rebirthPoints < cost) { setError('重生点不够'); return }
    commitMeta({ ...meta, rebirthPoints: meta.rebirthPoints - cost, purchased: { ...meta.purchased, [itemId]: n + 1 } })
  }, [meta, commitMeta])

  return useMemo(() => ({
    state, meta, report, choiceResult, error, notice, clearNotice: () => setNotice(null), undoCount: history.length, undo, newGame, act, endWeek, choose,
    dismissReport: () => setReport(null), dismissChoiceResult: () => setChoiceResult(null), finishLife, buyShop,
    clearError: () => setError(null), abandon: () => { commit(null); setReport(null) },
  }), [state, meta, report, choiceResult, error, notice, history.length, undo, newGame, act, endWeek, choose, finishLife, buyShop, commit])
}
