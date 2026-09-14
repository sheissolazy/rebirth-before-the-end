import { useMemo, useState } from 'react'
import type { EventDef, GameState } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { optionLabel } from './lookup'
import { describeEffects } from './effects'

export function EventPanel({ state, event, store, onClose }: { state: GameState; event: EventDef; store: Store; onClose: () => void }) {
  const placed = state.placements.find((p) => p.eventId === event.id)
  const [assign, setAssign] = useState<Record<string, string>>(placed?.assignments ?? {})
  const options = useMemo(() => Object.fromEntries(event.slots.map((s) => [s.id, engine.eligibleCards(state, event.id, s.id)])), [state, event])
  const personSlot = event.slots.find((sl) => sl.accepts.kind === 'hero' || sl.accepts.kind === 'person')
  const assumed = personSlot && !assign[personSlot.id] ? { ...assign, [personSlot.id]: 'hero' } : assign
  const assuming = personSlot && !assign[personSlot.id]
  const dice = event.check ? engine.previewDice(state, event.id, Object.fromEntries(Object.entries(assumed).filter(([, v]) => v))) : 0
  const canPlace = event.slots.every((s) => !s.required || assign[s.id])
  const clean = (a: Record<string, string>) => Object.fromEntries(Object.entries(a).filter(([, v]) => v))
  const optionDice = (slotId: string, id: string) => {
    if (!event.check) return 0
    const base = personSlot && slotId !== personSlot.id && !assign[personSlot.id] ? { ...assign, [personSlot.id]: 'hero' } : assign
    const without = engine.previewDice(state, event.id, clean({ ...base, [slotId]: '' }))
    const withIt = engine.previewDice(state, event.id, clean({ ...base, [slotId]: id }))
    return withIt - without
  }
  // 二项分布：每骰 50%
  const odds = (() => {
    const p = event.check?.successChance ?? 0.5
    const n = dice
    const pk = (k: number) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c * Math.pow(p, k) * Math.pow(1 - p, n - k) }
    const sum = (a: number, b: number) => { let t = 0; for (let k = a; k <= Math.min(b, n); k++) t += pk(k); return t }
    const pc = (x: number) => Math.round(x * 100)
    const legAt = event.check?.legendaryAt ?? 9
    const leg = pc(sum(legAt, n))
    return { fail: pc(sum(0, 0)), common: pc(sum(1, 2)), fine: pc(sum(3, 6)), rare: pc(sum(7, legAt - 1)), legendary: leg > 0 && event.outcomes.legendary ? ` · 传说 ${leg}%` : '' }
  })()
  const leaderSlot = event.slots.find((s) => s.accepts.kind === 'person')
  const heroSlot = event.slots.find((s) => s.accepts.kind === 'hero' || s.accepts.kind === 'person')
  const heroBlocked = !placed && heroSlot && options[heroSlot.id].length === 0
  const heroReason = state.hero.incapacitatedWeeks > 0 ? '你受伤了，这周不能行动。' : `精力不够：需要 ${event.energy ?? 2}，剩 ${state.hero.energy}。喝咖啡或下周再来。`
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{event.icon} {lt(event.title)}</h3>
        <p className="mt-1 text-sm text-zinc-300">{lt(event.text)}</p>
        {event.check && <p className="mt-1 text-xs text-amber-200">{t('event.odds', odds)}{assuming ? t('event.oddsAssume') : ''}</p>}
        {event.check && <p className="text-xs text-zinc-600">{t('event.diceNote')}</p>}
        {leaderSlot && <p className="mt-1 text-xs text-zinc-500">{t('event.leaderHint')}</p>}
        <p className="mt-1 text-xs text-zinc-500">
          耗时 {event.durationWeeks} 周 · {t('event.energy', { n: event.energy ?? 2 })}（剩 {state.hero.energy}）
          {event.check && ` · 检定 ${event.check.attrs.map((a) => t(`attr.${a}`)).join('+')} · 掷 ${dice} 骰`}
          {event.storylineNpcId && ' · 剧情线'}
          {event.resolvesCrisis && ` · 可解决${t(`crisisKind.${event.resolvesCrisis}`)}危机`}
        </p>
        {heroBlocked && <p className="mt-2 rounded bg-red-900/40 p-2 text-xs">{heroReason}</p>}
        <details className="mt-2 text-xs text-zinc-500">
          <summary className="cursor-pointer">各档结果能拿到什么</summary>
          <ul className="mt-1 space-y-0.5">
            {(['fail', 'common', 'fine', 'rare', 'legendary'] as const).map((k) => event.outcomes[k] ? <li key={k}><span className="text-zinc-300">{t(`outcome.${k}`)}</span>：{describeEffects(event.outcomes[k]!.effects) || '无直接效果'}</li> : null)}
          </ul>
        </details>
        <div className="mt-3 space-y-2">
          {event.slots.map((slot) => (
            <label key={slot.id} className="block text-sm">
              <span className={slot.required ? 'text-red-400' : 'text-zinc-400'}>{slot.required ? '● ' : '○ '}{lt(slot.label)}{slot.consumes ? '（消耗）' : ''}{slot.bonusDice ? ` +${slot.bonusDice}骰` : ''}</span>
              <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2" disabled={!!placed} value={assign[slot.id] ?? ''}
                onChange={(e) => setAssign({ ...assign, [slot.id]: e.target.value })}>
                <option value="">—</option>
                {options[slot.id].filter((id) => !Object.entries(assign).some(([k, v]) => v === id && k !== slot.id)).map((id) => {
                  const d = optionDice(slot.id, id)
                  return <option key={id} value={id}>{optionLabel(state, id)}{event.check && d ? `（+${d} 骰）` : ''}</option>
                })}
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
