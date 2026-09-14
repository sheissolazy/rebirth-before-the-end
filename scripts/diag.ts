import { createEngine } from '../src/engine'
import { content } from '../src/content'
import { emptyMeta } from '../src/engine/impl/sim'
import type { GameState, EventDef } from '../src/engine/types'
const engine = createEngine(content)
let s = engine.newGame(content, { seed: process.argv[2] ?? 'diag', build: 'balanced', meta: emptyMeta() })
const tryPlace = (st: GameState, e: EventDef) => {
  const a: Record<string, string> = {}
  for (const slot of e.slots) { const c = engine.eligibleCards(st, e.id, slot.id).filter((x) => !Object.values(a).includes(x)); if (!c.length) { if (slot.required) return null; continue } if (!slot.required && (slot.consumes || slot.accepts.kind === 'supply')) continue; a[slot.id] = c[0] }
  try { return engine.place(st, { eventId: e.id, assignments: a }) } catch { return null }
}
for (let i = 0; i < 60 && !s.ending; i++) {
  if (s.pendingChoice) { const e = content.events.find((x) => x.id === s.pendingChoice)!; for (const c of e.choices ?? []) { try { s = engine.choose(s, c.id).state; break } catch { /* */ } } }
  for (const r of [...s.pendingRecruits]) { const st = engine.stats(s); if (st.foodUnits >= st.weeklyFood * 6 && st.population < st.populationCap) { try { s = engine.recruit(s, r.id) } catch { /* */ } } else s = engine.dismissRecruit(s, r.id) }
  if (s.time.phase === 'prologue') { try { s = engine.build(s, 'apt_rain') } catch { /* */ } }
  if (s.time.phase === 'prologue') for (const id of ['supply_rice_5kg', 'supply_water_box', 'supply_water_tablets', 'supply_compressed_biscuit', 'supply_canned', 'supply_antibiotics', 'supply_battery', 'supply_wood', 'equip_machete', 'supply_winter_clothes', 'supply_bolts', 'supply_soap']) for (let k = 0; k < 3; k++) { try { s = engine.buy(s, id, 1) } catch { break } }
  for (const p of Object.values(s.people)) if (p.alive && p.inBase && !p.busyWithEventId && !(p.defId && content.npcs.find((n) => n.id === p.defId)?.romanceable)) { try { s = engine.assignJob(s, p.id, i % 2 ? 'scavenge' : 'guard') } catch { /* */ } }
  const events = engine.availableEvents(s)
  const placed: string[] = []
  for (const e of events.sort((a, b) => (b.id.includes('ruin') || b.id.includes('search') ? 1 : 0) - (a.id.includes('ruin') || a.id.includes('search') ? 1 : 0))) { if (s.hero.energy <= 0) break; const ns = tryPlace(s, e); if (ns) { s = ns; placed.push(e.id) } }
  const { state, report } = engine.endWeek(s); s = state
  const st = engine.stats(s)
  const ch = report.changes.filter((c) => c.label.zh === '健康').map((c) => `${c.delta}:${c.reason.zh}`).join(' ')
  console.log(`t${s.turn} ${s.time.phase === 'prologue' ? 'P' : `${s.time.month}m${s.time.week}w`} hp=${s.hero.health} food=${st.foodUnits}/${st.weeklyFood} water=${st.waterUnits}/${st.weeklyWater} pop=${st.population} placed=[${placed.join(',')}] ${ch} ${report.eventResults.map((r) => `${r.eventId}:${r.outcome}`).join(' ')}`)
}
console.log('ENDING', s.ending)
