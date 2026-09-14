import type { GameState, PersonState } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { cardDefs, cardName, personName, RARITY_CLASS } from './lookup'

export function EquipModal({ state, person, store, onClose }: { state: GameState; person: PersonState | 'hero'; store: Store; onClose: () => void }) {
  const id = person === 'hero' ? 'hero' : person.id
  const name = person === 'hero' ? lt(state.hero.name) : personName(person)
  const equippedByOthers = new Set([...Object.values(state.hero.equipment), ...Object.values(state.people).flatMap((p) => Object.values(p.equipment))])
  const mine = new Set(Object.values(person === 'hero' ? state.hero.equipment : person.equipment))
  const items = state.warehouse.filter((c) => cardDefs.get(c.defId)?.kind === 'equipment')
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{t('equip.title', { name })}</h3>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {items.map((c) => {
            const d = cardDefs.get(c.defId)!
            if (d.kind !== 'equipment') return null
            const isMine = mine.has(c.instanceId)
            const taken = !isMine && equippedByOthers.has(c.instanceId)
            return (
              <li key={c.instanceId} className={`flex items-center justify-between rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]} ${isMine ? 'bg-amber-950/30' : ''}`}>
                <span><div>{cardName(c)}</div><div className="text-zinc-500">{d.slot === 'weapon' ? '武器' : d.slot === 'armor' ? '防具' : '饰品'} · +{d.bonusDice} 骰{d.forAttr ? `（${t(`attr.${d.forAttr}`)}）` : ''}{taken ? ' · 别人装着' : ''}</div></span>
                {!isMine && <button className="rounded bg-zinc-700 px-2 py-0.5" onClick={() => { store.act((s) => engine.equip(s, id, c.instanceId)); onClose() }}>{taken ? '换过来' : t('action.equip')}</button>}
                {isMine && <span className="text-amber-300">已装备</span>}
              </li>
            )
          })}
          {!items.length && <li className="text-xs text-zinc-500">{t('equip.nothing')}</li>}
        </ul>
        <button className="mt-3 w-full rounded border border-zinc-700 py-2" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
