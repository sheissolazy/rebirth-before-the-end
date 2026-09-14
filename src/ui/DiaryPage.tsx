import { useState } from 'react'
import type { GameState } from '../engine/types'
import { lt, t } from '../i18n'
import { turnToTime } from '../engine'
import type { Store } from './store'

export function DiaryPage({ state, store }: { state: GameState; store: Store }) {
  const [confirm, setConfirm] = useState(false)
  const label = (turn: number) => {
    const tm = turnToTime(turn, state.prologueWeeks)
    return tm.phase === 'prologue' ? `末日前 ${tm.weeksBeforeEnd} 周` : `第${tm.year}年${tm.month}月第${tm.week}周`
  }
  return (
    <div className="space-y-2 p-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <button className="rounded bg-zinc-700 px-3 py-1 disabled:opacity-40" disabled={store.undoCount === 0} onClick={store.undo}>{t('action.undo')}{t('action.undoLeft', { n: store.undoCount })}</button>
        {!confirm
          ? <button className="rounded border border-red-800 px-3 py-1 text-red-300" onClick={() => setConfirm(true)}>{t('action.restart')}</button>
          : <button className="rounded bg-red-800 px-3 py-1" onClick={() => { store.finishLife(); window.location.hash = '' }}>{t('action.restartConfirm')}</button>}
      </div>
      {[...state.diary].reverse().map((d, i) => (
        <div key={i} className="rounded border border-zinc-800 p-2 text-sm">
          <div className="text-xs text-zinc-500">{label(d.turn)}</div>
          <div>{lt(d.text)}</div>
        </div>
      ))}
      <p className="text-xs text-zinc-600">种子：{state.seed}</p>
    </div>
  )
}
