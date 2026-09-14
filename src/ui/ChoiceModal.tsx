import type { GameState } from '../engine/types'
import type { Store } from './store'
import { t, lt } from '../i18n'
import { eventDefs } from './lookup'
import { content } from '../content'
import { describeEffects } from './effects'

/** 周初突发选择事件。conditions 不满足的选项置灰。 */
export function ChoiceModal({ state, store }: { state: GameState; store: Store }) {
  const result = store.choiceResult
  const event = state.pendingChoice ? eventDefs.get(state.pendingChoice) : (result ? eventDefs.get(result.eventId) : undefined)
  if (!event) return null
  const canPick = (conds?: typeof event.conditions) => {
    if (!conds?.length) return true
    // 前端粗略预检：只处理 hasSupplyKind / hasPet / hasCard，其余交给引擎
    return conds.every((c) => {
      if (c.type === 'hasSupplyKind') return state.warehouse.some((x) => { const d = content.cards.find((k) => k.id === x.defId); return d?.kind === 'supply' && d.supplyKind === c.supplyKind })
      if (c.type === 'hasCard') return state.warehouse.some((x) => x.defId === c.cardId) || state.hand.some((x) => x.defId === c.cardId)
      return true
    })
  }
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-800 bg-zinc-900 p-4">
        <div className="text-xs text-amber-400">{t('choice.title')}</div>
        <h3 className="text-lg font-bold">{event.icon} {lt(event.title)}</h3>
        {result ? (
          <>
            <p className="mt-2 text-sm text-zinc-200">{lt(result.text)}</p>
            <p className="mt-1 text-xs text-zinc-500">{result.diceCount ? `${t(`outcome.${result.outcome}`)}（${result.successes}/${result.diceCount} 骰）` : ''}</p>
            {result.effects.length > 0 && <p className="mt-1 text-xs text-amber-200">{t('report.effects')}：{describeEffects(result.effects)}</p>}
            <button className="mt-3 w-full rounded bg-amber-600 py-2 font-semibold" onClick={store.dismissChoiceResult}>继续</button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-300">{lt(event.text)}</p>
            <div className="mt-3 space-y-2">
              {event.choices?.map((c) => (
                <button key={c.id} disabled={!canPick(c.conditions)} className="w-full rounded border border-zinc-700 bg-zinc-800 p-2 text-left text-sm hover:border-amber-600 disabled:opacity-40"
                  onClick={() => store.choose(c.id)}>
                  {lt(c.label)}{c.check && <span className="ml-2 text-xs text-zinc-500">检定 {c.check.attrs.map((a) => t(`attr.${a}`)).join('+')}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
