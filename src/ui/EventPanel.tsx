import { useMemo, useState } from 'react'
import type { EventDef, GameState } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { optionLabel } from './lookup'

export function EventPanel({ state, event, store, onClose }: { state: GameState; event: EventDef; store: Store; onClose: () => void }) {
  const placed = state.placements.find((p) => p.eventId === event.id)
  const [assign, setAssign] = useState<Record<string, string>>(placed?.assignments ?? {})
  const options = useMemo(() => Object.fromEntries(event.slots.map((s) => [s.id, engine.eligibleCards(state, event.id, s.id)])), [state, event])
  const dice = event.check ? engine.previewDice(state, event.id, assign) : 0
  const canPlace = event.slots.every((s) => !s.required || assign[s.id])
  const heroSlot = event.slots.find((s) => s.accepts.kind === 'hero')
  const heroBlocked = !placed && heroSlot && options[heroSlot.id].length === 0
  const heroReason = state.hero.incapacitatedWeeks > 0 ? '你受伤了，这周不能行动。' : `精力不够：需要 ${event.energy ?? 2}，剩 ${state.hero.energy}。喝咖啡或下周再来。`
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{event.icon} {lt(event.title)}</h3>
        <p className="mt-1 text-sm text-zinc-300">{lt(event.text)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          耗时 {event.durationWeeks} 周 · {t('event.energy', { n: event.energy ?? 2 })}（剩 {state.hero.energy}）
          {event.check && ` · 检定 ${event.check.attrs.map((a) => t(`attr.${a}`)).join('+')} · 掷 ${dice} 骰`}
          {event.storylineNpcId && ' · 剧情线'}
          {event.resolvesCrisis && ` · 可解决${t(`crisisKind.${event.resolvesCrisis}`)}危机`}
        </p>
        {heroBlocked && <p className="mt-2 rounded bg-red-900/40 p-2 text-xs">{heroReason}</p>}
        <div className="mt-3 space-y-2">
          {event.slots.map((slot) => (
            <label key={slot.id} className="block text-sm">
              <span className={slot.required ? 'text-red-400' : 'text-zinc-400'}>{slot.required ? '● ' : '○ '}{lt(slot.label)}{slot.consumes ? '（消耗）' : ''}{slot.bonusDice ? ` +${slot.bonusDice}骰` : ''}</span>
              <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2" disabled={!!placed} value={assign[slot.id] ?? ''}
                onChange={(e) => setAssign({ ...assign, [slot.id]: e.target.value })}>
                <option value="">—</option>
                {options[slot.id].filter((id) => !Object.entries(assign).some(([k, v]) => v === id && k !== slot.id)).map((id) => (
                  <option key={id} value={id}>{optionLabel(state, id)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          {placed ? (
            <button className="rounded bg-zinc-700 px-4 py-2" onClick={() => { store.act((s) => engine.unplace(s, event.id)); onClose() }}>{t('action.unplace')}</button>
          ) : (
            <button className="rounded bg-amber-600 px-4 py-2 font-semibold disabled:opacity-40" disabled={!canPlace}
              onClick={() => { store.act((s) => engine.place(s, { eventId: event.id, assignments: Object.fromEntries(Object.entries(assign).filter(([, v]) => v)) })); onClose() }}>
              {t('action.place')}
            </button>
          )}
          <button className="rounded border border-zinc-700 px-4 py-2" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}
