import type { GameState, MetaProgress } from '../engine/types'

const PREFIX = (import.meta.env.VITE_SAVE_PREFIX as string | undefined) ?? 'rbte'
const META_KEY = `${PREFIX}:meta`
const SAVE_KEY = `${PREFIX}:save`
const HISTORY_KEY = `${PREFIX}:history`

export function loadMeta(): MetaProgress {
  try { const raw = localStorage.getItem(META_KEY); if (raw) return { traitPoints: 0, ...JSON.parse(raw) } } catch { /* ignore */ }
  return { rebirthPoints: 0, traitPoints: 0, rebirths: 0, unlockedEndings: [], purchased: {} }
}
export function saveMeta(meta: MetaProgress): void { try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch { /* ignore */ } }
/** 旧存档补字段 */
function migrate(s: GameState): GameState {
  const x = s as Partial<GameState>
  x.pendingRecruits ??= []
  x.parcels ??= []
  x.statuses ??= []
  x.orders ??= []
  x.orderedThisWeek ??= {}
  x.lastNotice ??= null
  x.noticeSeq ??= 0
  x.hero!.energy ??= 3
  x.hero!.energyBonus ??= 0
  // 旧存档：爸妈改为开局就在家
  for (const id of ['dad', 'mom']) { const p = x.people?.[id]; if (p && p.alive && !p.inBase && !x.flags?.parents_left) { p.inBase = true; p.loyalty = Math.max(p.loyalty, 70) } }
  return x as GameState
}
export function loadGame(): GameState | null {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return migrate(JSON.parse(raw)) } catch { /* ignore */ }
  return null
}
export function loadHistory(): GameState[] {
  try { const raw = localStorage.getItem(HISTORY_KEY); if (raw) return (JSON.parse(raw) as GameState[]).map(migrate) } catch { /* ignore */ }
  return []
}
export function saveHistory(h: GameState[]): void {
  try { if (h.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); else localStorage.removeItem(HISTORY_KEY) } catch { /* ignore */ }
}
export function saveGame(state: GameState | null): void {
  try { if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); else localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
