import { useState } from 'react'
import type { GameState, EventDef } from '../engine/types'
import { engine, type Store } from './store'
import { lt } from '../i18n'
import { content } from '../content'
import { EventPanel } from './EventPanel'

export function MapPage({ state, store }: { state: GameState; store: Store }) {
  const [open, setOpen] = useState<EventDef | null>(null)
  const events = engine.availableEvents(state)
  const placedIds = new Set(state.placements.map((p) => p.eventId))
  const heroBusy = state.placements.some((p) => Object.values(p.assignments).includes('hero'))
  const locs = content.locations.filter((l) => (l.phase === 'both' || l.phase === state.time.phase) && events.some((e) => e.locationId === l.id))
  return (
    <div className="space-y-4 p-4">
      {state.hero.incapacitatedWeeks > 0 && <p className="rounded bg-red-900/40 p-2 text-sm">你受伤了，还有 {state.hero.incapacitatedWeeks} 周不能行动。</p>}
      {!heroBusy && state.hero.incapacitatedWeeks === 0 && <p className="text-xs text-zinc-500">本周你还没安排自己去做任何事。</p>}
      {locs.map((loc) => (
        <section key={loc.id}>
          <h3 className="font-semibold">{loc.icon} {lt(loc.name)} <span className="text-xs font-normal text-zinc-500">{lt(loc.desc)}</span></h3>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">
            {events.filter((e) => e.locationId === loc.id).map((e) => (
              <li key={e.id}>
                <button onClick={() => setOpen(e)} className={`w-full rounded-lg border p-2 text-left text-sm ${placedIds.has(e.id) ? 'border-amber-500 bg-amber-950/30' : e.weight === 0 ? 'border-sky-800 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}>
                  <div className="font-medium">{e.icon} {lt(e.title)} {placedIds.has(e.id) && <span className="text-xs text-amber-400">进行中</span>}</div>
                  <div className="line-clamp-2 text-xs text-zinc-400">{lt(e.text)}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open && <EventPanel state={state} event={open} store={store} onClose={() => setOpen(null)} />}
    </div>
  )
}
