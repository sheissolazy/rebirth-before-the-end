import { useCallback, useMemo, useState } from 'react'
import type { GameState, MetaProgress, NewGameOptions, WeekReport, EventResult } from '../engine/types'
import { createEngine } from '../engine'
import { content } from '../content'
import { loadGame, loadMeta, saveGame, saveMeta } from '../save'

export const engine = createEngine(content)

export interface Store {
  state: GameState | null
  meta: MetaProgress
  report: WeekReport | null
  choiceResult: EventResult | null
  error: string | null
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

  const commit = useCallback((s: GameState | null) => { setState(s); saveGame(s) }, [])
  const commitMeta = useCallback((m: MetaProgress) => { setMeta(m); saveMeta(m) }, [])

  const newGame = useCallback((opts: Omit<NewGameOptions, 'meta'>) => {
    try { commit(engine.newGame(content, { ...opts, meta })); setReport(null); setChoiceResult(null) } catch (e) { setError((e as Error).message) }
  }, [meta, commit])

  const act = useCallback((fn: (s: GameState) => GameState) => {
    setState((prev) => {
      if (!prev) return prev
      try { const next = fn(prev); saveGame(next); return next } catch (e) { setError((e as Error).message); return prev }
    })
  }, [])

  const endWeek = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev
      try { const { state: next, report: r } = engine.endWeek(prev); saveGame(next); setReport(r); return next } catch (e) { setError((e as Error).message); return prev }
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
    state, meta, report, choiceResult, error, newGame, act, endWeek, choose,
    dismissReport: () => setReport(null), dismissChoiceResult: () => setChoiceResult(null), finishLife, buyShop,
    clearError: () => setError(null), abandon: () => { commit(null); setReport(null) },
  }), [state, meta, report, choiceResult, error, newGame, act, endWeek, choose, finishLife, buyShop, commit])
}
