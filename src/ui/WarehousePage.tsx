import { useState } from 'react'
import type { GameState, CardInstance, SupplyKind } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { cardDefs, cardName, RARITY_CLASS, personName } from './lookup'

const KINDS: SupplyKind[] = ['food', 'water', 'medicine', 'energy', 'weapon', 'material', 'daily']

export function WarehousePage({ state, store }: { state: GameState; store: Store }) {
  const st = engine.stats(state)
  const [shopOpen, setShopOpen] = useState(state.time.phase === 'prologue')
  const [giftTarget, setGiftTarget] = useState<string>('')
  const [faction, setFaction] = useState<string>(content.factions[0]?.id ?? '')
  const people = Object.values(state.people).filter((p) => p.alive && (p.inBase || (p.defId && content.npcs.find((n) => n.id === p.defId)?.romanceable)))

  const group = (inSpace: boolean) => {
    const cards = state.warehouse.filter((c) => !!c.inSpace === inSpace)
    const byKind: Record<string, CardInstance[]> = {}
    for (const c of cards) {
      const d = cardDefs.get(c.defId)
      const k = d?.kind === 'supply' ? d.supplyKind : d?.kind ?? 'other'
      ;(byKind[k] ??= []).push(c)
    }
    return byKind
  }

  const Card = ({ c }: { c: CardInstance }) => {
    const d = cardDefs.get(c.defId)!
    const equipped = Object.values(state.hero.equipment).includes(c.instanceId) || Object.values(state.people).some((p) => Object.values(p.equipment).includes(c.instanceId))
    return (
      <li className={`rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]} ${equipped ? 'bg-amber-950/30' : 'bg-zinc-900'}`}>
        <div className="font-medium">{cardName(c)} {equipped && '（已装备）'}</div>
        <div className="text-zinc-500">{lt(d.desc)}{c.expiresAtTurn !== undefined && ` · ${Math.max(0, c.expiresAtTurn - state.turn)} 周后过期`}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.moveToSpace(s, c.instanceId, !c.inSpace))}>{c.inSpace ? t('action.fromSpace') : t('action.toSpace')}</button>
          {d.kind === 'equipment' && <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.equip(s, 'hero', c.instanceId))}>{t('action.equip')}</button>}
          {giftTarget && d.kind === 'supply' && <button className="rounded bg-pink-900 px-2 py-0.5" onClick={() => store.act((s) => engine.gift(s, giftTarget, c.instanceId))}>{t('action.gift')}</button>}
          {(d.kind === 'supply' || d.kind === 'equipment') && <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.sell(s, c.instanceId, state.time.phase === 'apocalypse' ? faction : undefined))}>{t('action.sell')}</button>}
          <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.discard(s, c.instanceId))}>{t('action.discard')}</button>
        </div>
      </li>
    )
  }

  const Section = ({ title, inSpace }: { title: string; inSpace: boolean }) => {
    const g = group(inSpace)
    return (
      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{title}</h3>
        {[...KINDS, 'equipment', 'core', 'other'].map((k) => g[k]?.length ? (
          <div key={k} className="mt-2">
            <h4 className="text-xs text-zinc-400">{KINDS.includes(k as SupplyKind) ? t(`supply.${k as SupplyKind}`) : k === 'equipment' ? '装备' : k === 'core' ? '晶核' : '其它'}</h4>
            <ul className="mt-1 grid gap-1 sm:grid-cols-2">{g[k].map((c) => <Card key={c.instanceId} c={c} />)}</ul>
          </div>
        ) : null)}
        {!Object.keys(g).length && <p className="text-xs text-zinc-500">空的。</p>}
      </section>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label>送礼对象：
          <select className="rounded border border-zinc-700 bg-zinc-800 p-1" value={giftTarget} onChange={(e) => setGiftTarget(e.target.value)}>
            <option value="">—</option>
            {people.map((p) => <option key={p.id} value={p.id}>{personName(p)}</option>)}
          </select>
        </label>
        {state.time.phase === 'apocalypse' && (
          <label>交易对象：
            <select className="rounded border border-zinc-700 bg-zinc-800 p-1" value={faction} onChange={(e) => setFaction(e.target.value)}>
              {content.factions.map((f) => <option key={f.id} value={f.id}>{lt(f.name)}（关系 {state.factions[f.id]?.relation ?? 0}）</option>)}
            </select>
          </label>
        )}
        <button className="rounded bg-zinc-700 px-3 py-1" onClick={() => setShopOpen(!shopOpen)}>{shopOpen ? '收起商店' : '打开商店'}</button>
      </div>

      {shopOpen && (
        <section className="rounded-lg border border-amber-900 p-3">
          <h3 className="font-semibold">{state.time.phase === 'prologue' ? `商店（物价 ×${state.priceMultiplier}）` : '以物易物（用晶核分换）'}</h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {content.cards.filter((c) => c.kind === 'supply' || c.kind === 'equipment').filter((c) => state.time.phase === 'apocalypse' || c.buyable).map((c) => {
              const price = state.time.phase === 'prologue' ? Math.round(c.basePrice * state.priceMultiplier) : ({ common: 1, fine: 2, rare: 4, legendary: 8 }[c.rarity] * (content.factions.find((f) => f.id === faction)?.tradeRate ?? 2))
              return (
                <li key={c.id} className={`flex items-center justify-between rounded border p-2 text-xs ${RARITY_CLASS[c.rarity]}`}>
                  <span>{c.icon} {lt(c.name)} <span className="text-zinc-500">{state.time.phase === 'prologue' ? `￥${price}` : `💎${price}`}</span></span>
                  <button className="rounded bg-amber-700 px-2 py-0.5" onClick={() => store.act((s) => engine.buy(s, c.id, 1, state.time.phase === 'apocalypse' ? faction : undefined))}>{t('action.buy')}</button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <Section title={t('warehouse.capacity', { used: st.storageUsed, cap: st.storageCap })} inSpace={false} />
      <Section title={t('space.capacity', { used: st.spaceUsed, cap: st.spaceCap })} inSpace={true} />

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">手牌</h3>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {state.hand.map((c) => {
            const d = cardDefs.get(c.defId)!
            return (
              <li key={c.instanceId} className={`rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]}`}>
                <div>{cardName(c)}</div>
                <div className="text-zinc-500">{lt(d.desc)}</div>
                {d.kind === 'intel' && <button className="mt-1 rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.useIntel(s, c.instanceId))}>使用</button>}
              </li>
            )
          })}
          {!state.hand.length && <p className="text-xs text-zinc-500">没有情报、技能或麻烦卡。</p>}
        </ul>
      </section>
    </div>
  )
}
