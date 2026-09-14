import type { WeekReport, GameState } from '../engine/types'
import { t, lt } from '../i18n'
import { cardName, eventDefs, personName, moduleDefs } from './lookup'
import { describeEffects } from './effects'

export function WeekReportModal({ report, state, onClose }: { report: WeekReport; state: GameState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{t('report.title')}</h3>
        {report.news.map((n, i) => <p key={i} className="mt-2 rounded bg-zinc-800 p-2 text-sm">📰 {lt(n)}</p>)}
        {report.eventResults.map((r) => {
          const e = eventDefs.get(r.eventId)
          return (
            <div key={r.eventId} className="mt-2 rounded border border-zinc-700 p-2 text-sm">
              <div className="font-medium">{e?.icon} {e ? lt(e.title) : r.eventId} · {t(`outcome.${r.outcome}`)}{r.diceCount ? `（${r.successes}/${r.diceCount} 骰）` : ''}</div>
              <div className="text-zinc-300">{lt(r.text)}</div>
              {r.effects.length > 0 && <div className="mt-1 text-xs text-amber-200">{t('report.effects')}：{describeEffects(r.effects)}</div>}
            </div>
          )
        })}
        {report.crisisResult && (
          <div className={`mt-2 rounded border p-2 text-sm ${report.crisisResult.survived ? 'border-emerald-700' : 'border-red-700'}`}>
            <div className="font-medium">{t(`crisisKind.${report.crisisResult.crisisKind}`)} · {t(`rarity.${report.crisisResult.rarity}`)} · {report.crisisResult.survived ? '顶住了' : '没顶住'}</div>
            <div>{lt(report.crisisResult.text)}</div>
          </div>
        )}
        {report.changes.length > 0 && (
          <div className="mt-2 rounded border border-zinc-800 p-2 text-xs">
            <div className="font-medium text-zinc-300">{t('report.changes')}</div>
            <ul className="mt-1 space-y-0.5">
              {report.changes.map((c, i) => <li key={i} className={c.delta > 0 ? 'text-emerald-300' : 'text-red-300'}>{lt(c.label)} {c.delta > 0 ? '+' : ''}{c.delta}：<span className="text-zinc-400">{lt(c.reason)}</span></li>)}
            </ul>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-400">
          消耗：食物 {report.upkeep.food} · 水 {report.upkeep.water}{report.upkeep.money ? ` · 钱 ${report.upkeep.money}` : ''}{report.upkeep.health ? ` · 健康 ${report.upkeep.health}` : ''}
          {report.produced.length > 0 && ` · 产出 ${report.produced.length} 张`}
          {report.delivered.length > 0 && ` · 到货：${report.delivered.map(cardName).join('、')}`}
          {report.builtModuleId && ` · 建成：${lt(moduleDefs.get(report.builtModuleId)?.name ?? { zh: report.builtModuleId })}`}
          {report.spoiled.length > 0 && ` · 过期：${report.spoiled.map(cardName).join('、')}`}
          {report.deaths.length > 0 && ` · 死亡：${report.deaths.map((id) => state.people[id] ? personName(state.people[id]) : id).join('、')}`}
        </p>
        <button className="mt-3 w-full rounded bg-amber-600 py-2 font-semibold" onClick={onClose}>继续</button>
      </div>
    </div>
  )
}
