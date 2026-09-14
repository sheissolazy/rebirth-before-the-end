import { useState } from 'react'
import type { GameState, EventDef } from '../engine/types'
import { engine, type Store } from './store'
import { lt, t } from '../i18n'
import { content } from '../content'
import { EventPanel } from './EventPanel'

const KIND_TAG: Record<string, string> = { main: 'bg-red-900/70 text-red-200', routine: 'bg-zinc-700 text-zinc-300', story: 'bg-sky-900/60 text-sky-300', random: 'bg-amber-900/50 text-amber-200' }

export function MapPage({ state, store }: { state: GameState; store: Store }) {
  const [open, setOpen] = useState<EventDef | null>(null)
  const events = engine.availableEvents(state)
  const placedIds = new Set(state.placements.map((p) => p.eventId))
  const kindOf = (e: EventDef) => e.kind ?? (e.storylineNpcId ? 'story' : 'random')
  const mains = events.filter((e) => kindOf(e) === 'main')
  const locs = content.locations.filter((l) => (l.phase === 'both' || l.phase === state.time.phase) && events.some((e) => e.locationId === l.id && kindOf(e) !== 'main'))
  const order = (e: EventDef) => ({ story: 0, routine: 1, random: 2, main: 3 } as Record<string, number>)[kindOf(e)] ?? 2
  const Card = ({ e }: { e: EventDef }) => (
    <button onClick={() => setOpen(e)} className={`w-full rounded-lg border p-2 text-left text-sm ${placedIds.has(e.id) ? 'border-amber-500 bg-amber-950/30' : kindOf(e) === 'main' ? 'border-red-900 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{e.icon} {lt(e.title)} {placedIds.has(e.id) && <span className="text-xs text-amber-400">进行中</span>}</span>
        <span className="shrink-0 text-xs text-zinc-500">
          <span className={`mr-1 rounded px-1 ${KIND_TAG[kindOf(e)]}`}>{t(`event.${kindOf(e)}` as 'event.main')}</span>
          {e.slots.some((sl) => sl.accepts.kind === 'hero') ? `⚡${e.energy ?? 2}` : `👥⚡${e.energy ?? 2}`}
        </span>
      </div>
      <div className="line-clamp-2 text-xs text-zinc-400">{lt(e.text)}{e.resolvesCrisis ? ` （可解决${t(`crisisKind.${e.resolvesCrisis}`)}危机）` : ''}</div>
    </button>
  )
  return (
    <div className="space-y-4 p-4">
      {state.hero.incapacitatedWeeks > 0 && <p className="rounded bg-red-900/40 p-2 text-sm">你受伤了，还有 {state.hero.incapacitatedWeeks} 周不能行动。</p>}
      {state.hero.incapacitatedWeeks === 0 && <p className="text-xs text-zinc-500">本周剩余精力 ⚡{state.hero.energy}。精力够就能同时做几件事；👥 标记的事件可以让伙伴带队，不耗你的精力。</p>}
      {mains.length > 0 && (
        <section>
          <h3 className="font-semibold text-red-300">🔥 {t('event.mainSection')}</h3>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">{mains.map((e) => <li key={e.id}><Card e={e} /></li>)}</ul>
        </section>
      )}
      {locs.map((loc) => (
        <section key={loc.id}>
          <h3 className="font-semibold">{loc.id === 'home' ? `${content.bases.find((b) => b.type === state.base.type)?.icon ?? loc.icon} ${lt(content.bases.find((b) => b.type === state.base.type)?.name ?? loc.name)}` : `${loc.icon} ${lt(loc.name)}`} <span className="text-xs font-normal text-zinc-500">{lt(loc.desc)}</span></h3>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">
            {events.filter((e) => e.locationId === loc.id && kindOf(e) !== 'main').sort((a, b) => order(a) - order(b)).map((e) => <li key={e.id}><Card e={e} /></li>)}
          </ul>
        </section>
      ))}
      {open && <EventPanel state={state} event={open} store={store} onClose={() => setOpen(null)} />}
    </div>
  )
}
