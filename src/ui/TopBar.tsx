import { useState } from 'react'
import type { GameState } from '../engine/types'
import { engine } from './store'
import { t } from '../i18n'
import { timeLabel } from './lookup'

export function TopBar({ state }: { state: GameState }) {
  const st = engine.stats(state)
  const c = state.crisis
  const [legend, setLegend] = useState(false)
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 px-4 py-2 text-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-semibold" title={t('legend.time')}>{timeLabel(state)}</span>
        <span title={t('legend.money')}>{state.time.phase === 'prologue' ? `💰 ${state.money.toLocaleString()}` : `💎 ${st.corePoints}`}</span>
        <span title={t('legend.energy')}>⚡ {state.hero.energy}/{st.energyMax}</span>
        <span title={t('legend.health')}>❤️ {state.hero.health}/10</span>
        <span title={t('legend.exposure')}>👁 {state.hero.exposure}</span>
        <span title={t('legend.defense')}>🛡 {st.defense}</span>
        <button className="rounded-full border border-zinc-700 px-2 text-xs text-zinc-400" onClick={() => setLegend(!legend)} aria-label="legend">{t('legend.toggle')}</button>
      </div>
      {legend && (
        <ul className="mt-1 space-y-0.5 rounded bg-zinc-900 p-2 text-xs text-zinc-400" onClick={() => setLegend(false)}>
          <li>🕐 {t('legend.time')}</li><li>💰/💎 {t('legend.money')}</li><li>⚡ {t('legend.energy')}</li><li>❤️ {t('legend.health')}</li><li>👁 {t('legend.exposure')}</li><li>🛡 {t('legend.defense')}</li><li>📉 {t('legend.crisis')}</li>
        </ul>
      )}
      {c && (
        <div className="mt-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{t('crisis.title')}：{t(`crisisKind.${c.crisisKind}`)} · {c.revealed ? t(`rarity.${c.rarity}`) : '？'}{c.resolved ? ' · 已解决' : ''}</span>
            <span>{t('crisis.points', { need: c.revealed ? st.crisisNeed : `?（记忆约 ${{ common: 2, fine: 4, rare: 8, legendary: 16 }[engine.crisisBreakdown(state).baseline ?? 'common']}）`, have: st.crisisHave })}</span>
          </div>
          <div className="mt-0.5 h-1.5 w-full rounded bg-zinc-800">
            <div className={`h-1.5 rounded ${c.resolved || st.crisisHave >= st.crisisNeed ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (st.crisisHave / Math.max(1, st.crisisNeed)) * 100)}%` }} />
          </div>
        </div>
      )}
    </header>
  )
}
