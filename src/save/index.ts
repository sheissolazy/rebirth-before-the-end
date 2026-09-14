import type { GameState, MetaProgress } from '../engine/types'

const META_KEY = 'rbte:meta'
const SAVE_KEY = 'rbte:save'

export function loadMeta(): MetaProgress {
  try { const raw = localStorage.getItem(META_KEY); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return { rebirthPoints: 0, rebirths: 0, unlockedEndings: [], purchased: {} }
}
export function saveMeta(meta: MetaProgress): void { try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch { /* ignore */ } }
export function loadGame(): GameState | null {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return JSON.parse(raw) } catch { /* ignore */ }
  return null
}
export function saveGame(state: GameState | null): void {
  try { if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); else localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
