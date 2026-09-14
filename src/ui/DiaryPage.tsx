import type { GameState } from '../engine/types'
import { lt } from '../i18n'
import { turnToTime } from '../engine'

export function DiaryPage({ state }: { state: GameState }) {
  const label = (turn: number) => {
    const tm = turnToTime(turn, state.prologueWeeks)
    return tm.phase === 'prologue' ? `末日前 ${tm.weeksBeforeEnd} 周` : `第${tm.year}年${tm.month}月第${tm.week}周`
  }
  return (
    <div className="space-y-2 p-4">
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
