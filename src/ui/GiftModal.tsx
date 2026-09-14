import type { GameState, PersonState } from '../engine/types'
import { engine, type Store } from './store'
import { t } from '../i18n'
import { cardDefs, cardName, personName, RARITY_CLASS, npcDefs } from './lookup'

export function GiftModal({ state, person, store, onClose }: { state: GameState; person: PersonState; store: Store; onClose: () => void }) {
  const needs = person.generated?.needs ?? npcDefs.get(person.defId ?? '')?.needs
  const equipped = new Set([...Object.values(state.hero.equipment), ...Object.values(state.people).flatMap((p) => Object.values(p.equipment))])
  const items = state.warehouse
    .filter((c) => !equipped.has(c.instanceId))
    .map((c) => ({ c, v: engine.giftValue(state, person.id, c.instanceId) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{t('gift.title', { name: personName(person) })}</h3>
        {needs && <p className="text-xs text-zinc-400">{t('gift.needs', { kind: t(`supply.${needs}`) })}</p>}
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {items.map(({ c, v }) => {
            const d = cardDefs.get(c.defId)!
            return (
              <li key={c.instanceId} className={`flex items-center justify-between rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]}`}>
                <span>{cardName(c)}</span>
                <button className="rounded bg-pink-900 px-2 py-0.5" onClick={() => { store.act((s) => engine.gift(s, person.id, c.instanceId)); onClose() }}>{t('gift.value', { n: v })}</button>
              </li>
            )
          })}
          {!items.length && <li className="text-xs text-zinc-500">{t('gift.nothing')}</li>}
        </ul>
        <button className="mt-3 w-full rounded border border-zinc-700 py-2" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
