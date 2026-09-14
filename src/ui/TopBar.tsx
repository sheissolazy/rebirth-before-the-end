import type { GameState } from '../engine/types'
import { engine } from './store'
import { t } from '../i18n'
import { timeLabel } from './lookup'

export function TopBar({ state }: { state: GameState }) {
  const st = engine.stats(state)
  const c = state.crisis
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-2 text-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-semibold">{timeLabel(state)}</span>
        <span>{state.time.phase === 'prologue' ? `💰 ${state.money.toLocaleString()}` : `💎 ${st.corePoints}`}</span>
        <span>❤️ {state.hero.health}/10</span>
        <span>👁 {state.hero.exposure}</span>
        <span>🛡 {st.defense}</span>
      </div>
      {c && (
        <div className="mt-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{t('crisis.title')}：{t(`crisisKind.${c.crisisKind}`)} · {c.revealed ? t(`rarity.${c.rarity}`) : '？'}{c.resolved ? ' · 已解决' : ''}</span>
            <span>{t('crisis.points', { need: c.revealed ? st.crisisNeed : '?', have: st.crisisHave })}</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full rounded bg-zinc-800">
            <div className={`h-1.5 rounded ${c.resolved || st.crisisHave >= st.crisisNeed ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (st.crisisHave / Math.max(1, st.crisisNeed)) * 100)}%` }} />
          </div>
        </div>
      )}
    </header>
  )
}
