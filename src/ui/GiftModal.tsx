import type { GameState, PersonState } from '../engine/types'
import { engine, type Store } from './store'
import { t } from '../i18n'
import { cardDefs, cardName, personName, RARITY_CLASS, npcDefs, isRomanceable } from './lookup'

export function GiftModal({ state, person, store, onClose }: { state: GameState; person: PersonState; store: Store; onClose: () => void }) {
  const needs = person.generated?.needs ?? npcDefs.get(person.defId ?? '')?.needs
  const equipped = new Set([...Object.values(state.hero.equipment), ...Object.values(state.people).flatMap((p) => Object.values(p.equipment))])
  const all = state.warehouse.filter((c) => !equipped.has(c.instanceId)).map((c) => ({ c, ...engine.giftPreview(state, person.id, c.instanceId) }))
  const itemsAll = all.filter((x) => x.raw > 0).sort((a, b) => b.raw - a.raw)
  // 同品叠加
  const seen = new Map<string, number>()
  for (const x of itemsAll) { const k = `${x.c.defId}|${x.c.spoiled ?? 0}|${(x.c.affixIds ?? []).join(',')}`; seen.set(k, (seen.get(k) ?? 0) + 1) }
  const shown = new Set<string>()
  const items = itemsAll.filter((x) => { const k = `${x.c.defId}|${x.c.spoiled ?? 0}|${(x.c.affixIds ?? []).join(',')}`; if (shown.has(k)) return false; shown.add(k); return true }).map((x) => ({ ...x, n: seen.get(`${x.c.defId}|${x.c.spoiled ?? 0}|${(x.c.affixIds ?? []).join(',')}`) ?? 1 }))
  const capInfo = isRomanceable(person) ? engine.giftPreview(state, person.id, all[0]?.c.instanceId ?? '') : null
  const nearCap = !!capInfo && capInfo.cap - person.affection < 10
  const giftable = all.some((x) => { const d = cardDefs.get(x.c.defId); return d && (d.kind === 'supply' || d.kind === 'equipment' || d.kind === 'core') })
  const capped = isRomanceable(person) && giftable && items.every((x) => x.effective <= 0)
  const boundary = [20, 40, 60, 80].find((b) => person.affection < b) ?? 100
  const capValue = Math.min(boundary - 1, state.time.phase === 'prologue' ? (person.id === 'jiangye' ? 59 : 39) : 100)
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-700 bg-zinc-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{t('gift.title', { name: personName(person) })}</h3>
        {needs && <p className="text-xs text-zinc-400">{t('gift.needs', { kind: t(`supply.${needs}`) })}</p>}
        {nearCap && capInfo && <p className="mt-1 rounded bg-amber-950/40 p-2 text-xs text-amber-200">{t('gift.capNote', { a: person.affection, cap: capInfo.cap })}</p>}
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {items.map(({ c, raw, effective, n }) => {
            const d = cardDefs.get(c.defId)!
            return (
              <li key={c.instanceId} className={`flex items-center justify-between rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]}`}>
                <span>{cardName(c)}{n > 1 ? ` ×${n}` : ''}</span>
                <button className="rounded bg-pink-900 px-2 py-0.5 disabled:opacity-40" disabled={effective <= 0} onClick={() => { store.act((s) => engine.gift(s, person.id, c.instanceId)); onClose() }}>{effective < raw ? t('gift.valueCapped', { n: raw, left: effective }) : t('gift.value', { n: raw })}</button>
              </li>
            )
          })}
          {!items.length && <li className="text-xs text-zinc-500">{capped ? t('gift.capped', { a: person.affection, cap: capValue, prologue: state.time.phase === 'prologue' ? t('gift.prologueCap') : '' }) : t('gift.nothing')}</li>}
        </ul>
        <button className="mt-3 w-full rounded border border-zinc-700 py-2" onClick={onClose}>关闭</button>
      </div>
    </div>
  )
}
