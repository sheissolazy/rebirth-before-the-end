import { useState } from 'react'
import type { GameState, CardInstance, SupplyKind, CardDef } from '../engine/types'
import { SUPPLY_KINDS, RARITY_ORDER } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { cardDefs, cardName, RARITY_CLASS } from './lookup'

const KINDS: SupplyKind[] = SUPPLY_KINDS
const groupOf = (c: CardDef): string => (c.kind === 'supply' ? c.supplyKind : c.kind)
const groupLabel = (k: string) => KINDS.includes(k as SupplyKind) ? t(`supply.${k as SupplyKind}`) : k === 'equipment' ? t('group.equipment') : k === 'core' ? t('group.core') : t('group.other')

export function WarehousePage({ state, store }: { state: GameState; store: Store }) {
  const st = engine.stats(state)
  const [shopOpen, setShopOpen] = useState(state.time.phase === 'prologue')
  const [faction, setFaction] = useState<string>(content.factions[0]?.id ?? '')

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
      <li className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded border px-2 py-1 text-xs ${RARITY_CLASS[d.rarity]} ${equipped ? 'bg-amber-950/30' : 'bg-zinc-900'}`}>
        <span className="font-medium">{cardName(c)} {equipped && '（已装备）'}<span className="ml-1 font-normal text-zinc-500">{c.expiresAtTurn !== undefined && `${Math.max(0, c.expiresAtTurn - state.turn)} 周后过期`}{d.kind === 'supply' && d.supplyKind === 'material' ? `${d.rarity === 'common' ? 1 : d.rarity === 'fine' ? 2 : d.rarity === 'rare' ? 4 : 8} 分` : ''}</span></span>
        <div className="flex flex-wrap gap-1">
          <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.moveToSpace(s, c.instanceId, !c.inSpace))}>{c.inSpace ? t('action.fromSpace') : t('action.toSpace')}</button>
          {d.kind === 'equipment' && <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.equip(s, 'hero', c.instanceId))}>{t('action.equip')}</button>}
          {d.kind === 'supply' && d.onUse && <button className="rounded bg-emerald-900 px-2 py-0.5" onClick={() => store.act((s) => engine.useItem(s, c.instanceId))}>{t('action.use')}</button>}
          {(d.kind === 'supply' || d.kind === 'equipment') && <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.sell(s, c.instanceId, state.time.phase === 'apocalypse' ? faction : undefined))}>{t('action.sell')}</button>}
          <button className="rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.discard(s, c.instanceId))}>{t('action.discard')}</button>
        </div>
      </li>
    )
  }

  const groupSummary = (k: string, cards: CardInstance[]) => {
    if (k === 'food' || k === 'water') return `${cards.reduce((t, c) => t + (c.unitsLeft ?? 1), 0)} 份`
    if (k === 'material') return `${cards.reduce((t, c) => t + ({ common: 1, fine: 2, rare: 4, legendary: 8 }[cardDefs.get(c.defId)!.rarity] ?? 0), 0)} 分`
    return t('wh.summary', { n: cards.length })
  }

  const Section = ({ title, inSpace }: { title: string; inSpace: boolean }) => {
    const g = group(inSpace)
    return (
      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{title}</h3>
        {[...KINDS, 'equipment', 'core', 'other'].map((k) => g[k]?.length ? (
          <details key={k} className="mt-2" open={k === 'food' || k === 'water' || k === 'equipment'}>
            <summary className="cursor-pointer text-xs text-zinc-300">{groupLabel(k)} <span className="text-zinc-500">· {groupSummary(k, g[k])}</span></summary>
            <ul className="mt-1 space-y-1">{g[k].map((c) => <Card key={c.instanceId} c={c} />)}</ul>
          </details>
        ) : null)}
        {!Object.keys(g).length && <p className="text-xs text-zinc-500">空的。</p>}
      </section>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
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
          <h3 className="font-semibold">{state.time.phase === 'prologue' ? `${t('shop.online')}（物价 ×${state.priceMultiplier}）` : '以物易物（用晶核分换）'}</h3>
          <p className={`mt-1 text-xs ${st.storageCap + st.spaceCap - st.storageUsed - st.spaceUsed - st.storageReserved < 5 ? 'text-red-400' : 'text-amber-200'}`}>{t('shop.storage', { used: st.storageUsed + st.spaceUsed, cap: st.storageCap + st.spaceCap, reserved: st.storageReserved, free: st.storageCap + st.spaceCap - st.storageUsed - st.spaceUsed - st.storageReserved })}</p>
          {state.time.phase === 'prologue' && <p className="mt-1 text-xs text-zinc-500">{t('shop.onlineHint')}</p>}
          {state.orders.length > 0 && (
            <div className="mt-1 text-xs text-amber-300">{t('shop.orders')}：
              <ul className="mt-1 space-y-0.5">
                {state.orders.map((o, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-amber-900/50 px-2 py-0.5">
                    <span>{lt(cardDefs.get(o.cardDefId)?.name ?? { zh: o.cardDefId })}×{o.count}（{t('shop.arrives', { n: Math.max(0, o.arrivesAtTurn - state.turn) })}{o.paid ? ` · ￥${o.paid}` : ''}）</span>
                    {state.time.phase === 'prologue' && <button className="rounded bg-zinc-700 px-2 py-0.5 text-zinc-200" onClick={() => store.act((s) => engine.cancelOrder(s, i))}>{t('shop.refund')}</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {[...KINDS, 'equipment'].map((k) => {
            const items = content.cards.filter((c) => c.kind === 'supply' || c.kind === 'equipment').filter((c) => state.time.phase === 'apocalypse' || c.buyable).filter((c) => groupOf(c) === k)
              .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.basePrice - b.basePrice)
            if (!items.length) return null
            return (
          <div key={k} className="mt-3">
          <h4 className="text-xs font-semibold text-zinc-300">{groupLabel(k)}
            {(k === 'food' || k === 'water') && <span className="ml-2 font-normal text-zinc-500">{t('shop.groupFood', { units: k === 'food' ? st.foodUnits : st.waterUnits, weekly: k === 'food' ? st.weeklyFood : st.weeklyWater, weeks: Math.floor((k === 'food' ? st.foodUnits : st.waterUnits) / Math.max(1, k === 'food' ? st.weeklyFood : st.weeklyWater)) })}</span>}
            {k === 'material' && <span className="ml-2 font-normal text-zinc-500">{t('shop.groupMaterial', { have: st.materialPoints, needs: content.modules.filter((m) => m.baseType === state.base.type && !state.base.modules.some((b) => b.moduleId === m.id && !b.damaged)).map((m) => `${lt(m.name)} ${m.cost.materialPoints}`).join('、') })}</span>}
          </h4>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {items.map((c) => {
              const price = state.time.phase === 'prologue' ? Math.round(c.basePrice * state.priceMultiplier * 1.1) : ({ common: 1, fine: 2, rare: 4, legendary: 8 }[c.rarity] * (content.factions.find((f) => f.id === faction)?.tradeRate ?? 2))
              const ordered = state.orderedThisWeek[c.id] ?? 0
              const limit = c.weeklyLimit ?? 5
              const meta = state.time.phase === 'prologue'
                ? [t('shop.arrives', { n: c.deliveryWeeks ?? 1 }), c.kind === 'supply' && c.shelfLifeWeeks ? t('shop.shelf', { n: c.shelfLifeWeeks }) : '', `${t('shop.limit', { n: limit })}${ordered ? ` 已订 ${ordered}` : ''}`].filter(Boolean).join(' · ')
                : ''
              return (
                <li key={c.id} className={`flex items-center justify-between gap-2 rounded border p-2 text-xs ${RARITY_CLASS[c.rarity]}`}>
                  <span>
                    <div>{c.icon} {lt(c.name)} <span className="text-zinc-400">{state.time.phase === 'prologue' ? `￥${price}` : `💎${price}`}</span></div>
                    <div className="text-zinc-500">{lt(c.desc)}{meta && ` · ${meta}`}</div>
                  </span>
                  <button className="shrink-0 rounded bg-amber-700 px-2 py-0.5 disabled:opacity-40" disabled={state.time.phase === 'prologue' && ordered >= limit} title={st.storageCap + st.spaceCap - st.storageUsed - st.spaceUsed - st.storageReserved < (c.kind === 'supply' ? c.size : 1) ? '现在放不下，到货会进快递站' : undefined} onClick={() => store.act((s) => engine.buy(s, c.id, 1, state.time.phase === 'apocalypse' ? faction : undefined))}>{t('action.buy')}</button>
                </li>
              )
            })}
          </ul>
          </div>
            )
          })}
        </section>
      )}

      {state.parcels.length > 0 && (
        <section className="rounded-lg border border-amber-800 p-3">
          <h3 className="font-semibold">{t('parcel.title', { n: state.parcels.length })}</h3>
          <p className="text-xs text-zinc-500">{t('parcel.hint')}</p>
          <ul className="mt-2 space-y-1">
            {state.parcels.map((c) => {
              const d = cardDefs.get(c.defId)!
              return (
                <li key={c.instanceId} className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${RARITY_CLASS[d.rarity]}`}>
                  <span>{cardName(c)}</span>
                  <span className="flex gap-1">
                    <button className="rounded bg-emerald-800 px-2 py-0.5" onClick={() => store.act((s) => engine.pickupParcel(s, c.instanceId))}>{t('parcel.pickup')}</button>
                    <button className="rounded bg-zinc-700 px-2 py-0.5" onClick={() => store.act((s) => engine.discardParcel(s, c.instanceId))}>{t('action.discard')}</button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <Section title={t('warehouse.capacity', { used: st.storageUsed, cap: st.storageCap })} inSpace={false} />
      <Section title={t('space.capacity', { used: st.spaceUsed, cap: st.spaceCap })} inSpace={true} />

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">手牌 <span className="text-xs font-normal text-zinc-500">{t('skill.hint')}</span></h3>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {state.hand.map((c) => {
            const d = cardDefs.get(c.defId)!
            return (
              <li key={c.instanceId} className={`rounded border p-2 text-xs ${RARITY_CLASS[d.rarity]}`}>
                <div>{cardName(c)}</div>
                <div className="text-zinc-500">{lt(d.desc)}</div>
                {d.kind === 'intel' && <button className="mt-1 rounded bg-zinc-800 px-2 py-0.5" onClick={() => store.act((s) => engine.useIntel(s, c.instanceId))}>使用</button>}
                {d.kind === 'skill' && d.counters && <button className="mt-1 rounded bg-red-900 px-2 py-0.5 disabled:opacity-40" disabled={!state.crisis || state.crisis.resolved || state.crisis.crisisKind !== d.counters} onClick={() => store.act((s) => engine.useSkill(s, c.instanceId))}>{t('skill.use')}{state.crisis && state.crisis.crisisKind !== d.counters ? `（只能顶${t(`crisisKind.${d.counters}`)}）` : ''}</button>}
              </li>
            )
          })}
          {!state.hand.length && <p className="text-xs text-zinc-500">没有情报、技能或麻烦卡。</p>}
        </ul>
      </section>
    </div>
  )
}
