import type { GameState } from '../engine/types'
import type { Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { personName, isRomanceable } from './lookup'

export function EndingScreen({ state, store }: { state: GameState; store: Store }) {
  const ending = content.endings.find((e) => e.id === state.ending)
  const alive = Object.values(state.people).filter((p) => p.alive && (p.inBase || isRomanceable(p)))
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">{ending ? lt(ending.title) : state.ending}</h1>
      <p className="text-zinc-300">{ending ? lt(ending.text) : ''}</p>
      <div className="rounded-lg border border-zinc-800 p-3 text-sm">
        <p>活了 {state.turn} 周 · 健康 {state.hero.health} · 蝴蝶效应 {state.hero.butterfly} · 暴露 {state.hero.exposure}</p>
        <p className="mt-1">身边的人：{alive.map(personName).join('、') || '没有'}</p>
        <p className="mt-1">本世重生点：{state.rebirthPointsEarned + (ending?.rebirthPoints ?? 0)}</p>
      </div>
      <button className="w-full rounded bg-amber-600 py-2 font-semibold" onClick={() => { store.finishLife(); window.location.hash = '' }}>{t('ending.rebirth')}</button>
    </main>
  )
}
