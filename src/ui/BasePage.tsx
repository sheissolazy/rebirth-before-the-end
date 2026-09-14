import type { GameState } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { moduleDefs, cardDefs } from './lookup'
import { lt as L } from '../i18n'

export function BasePage({ state, store }: { state: GameState; store: Store }) {
  const st = engine.stats(state)
  const base = content.bases.find((b) => b.type === state.base.type)!
  const built = new Map(state.base.modules.map((m) => [m.moduleId, m]))
  const available = content.modules.filter((m) => m.baseType === state.base.type)
  const crisisDef = state.crisis ? cardDefs.get(state.crisis.cardDefId) : undefined
  const ledger = engine.crisisBreakdown(state)
  const GUESS: Record<string, number> = { common: 2, fine: 4, rare: 8, legendary: 16 }
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{base.icon} {lt(base.name)} <span className="text-xs text-zinc-500">{lt(base.desc)}</span></h3>
        <p className="text-sm text-zinc-300">{t('stat.defense')} {st.defense} · {t('warehouse.capacity', { used: st.storageUsed, cap: st.storageCap })} · 人口上限 {base.population}{base.travelPenalty ? ` · 进城每事件 +${base.travelPenalty} 精力` : ''}{base.deliveryDelay ? ` · 网购多等 ${base.deliveryDelay} 周` : ''}</p>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{t('crisis.title')}</h3>
        {state.crisis ? (
          <div className="text-sm">
            <p>{crisisDef?.icon} {crisisDef ? lt(crisisDef.name) : t(`crisisKind.${state.crisis.crisisKind}`)} · {state.crisis.revealed ? t(`rarity.${state.crisis.rarity}`) : '档位未知'}</p>
            <p className="text-zinc-400">{crisisDef && crisisDef.kind === 'crisis' ? lt(crisisDef.onDraw) : ''}</p>
            <p className={`mt-2 font-semibold ${state.crisis.resolved || (ledger.need !== null && ledger.have >= ledger.need) ? 'text-emerald-400' : ledger.need === null ? 'text-amber-300' : 'text-red-400'}`}>
              {state.crisis.resolved ? '已通过剧情或借力解决' : ledger.need !== null ? t('crisis.ledger', { have: ledger.have, need: ledger.need }) : t('crisis.ledgerUnknown', { have: ledger.have, baseline: ledger.baseline ? t(`rarity.${ledger.baseline}`) : '？', guess: ledger.baseline ? GUESS[ledger.baseline] : '?' })}
            </p>
            <ul className="mt-1 text-xs text-zinc-400">
              {ledger.items.map((it, i) => <li key={i} className={it.points > 0 ? '' : 'text-zinc-600'}>{lt(it.label)}：+{it.points}</li>)}
            </ul>
            <p className="mt-1 text-xs text-zinc-500">{t(`crisis.tips.${state.crisis.crisisKind}`)}</p>
            <p className="text-xs text-zinc-500">{t('crisis.resolveHint')}{state.hand.some((c) => { const d = cardDefs.get(c.defId); return d?.kind === 'skill' && d.counters === state.crisis?.crisisKind }) ? ' 你手里正好有能顶这类危机的技能卡，去仓库页"手牌"用。' : ''}</p>
          </div>
        ) : <p className="text-sm text-zinc-500">{state.time.phase === 'prologue' ? '末日还没来。' : '本月无危机。'}</p>}
        <h4 className="mt-3 text-sm font-semibold">{t('crisis.memory')}</h4>
        <ul className="mt-1 space-y-1 text-xs text-zinc-400">
          {state.forecast.map((f) => (
            <li key={f.month} className={state.time.phase === 'apocalypse' && f.month === state.time.month ? 'text-amber-300' : ''}>
              {f.month}月 · {t(`crisisKind.${f.crisisKind}`)}{f.rarity ? ` · ${t(`rarity.${f.rarity}`)}` : ''} — {lt(f.memory)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{t('upkeep.title')}</h3>
        <p className="text-sm text-zinc-300">{state.time.phase === 'prologue' ? t('upkeep.prologue') : t('upkeep.line', { mouths: st.mouths, pets: st.petMouths, food: st.weeklyFood, water: st.weeklyWater, foodUnits: st.foodUnits, foodWeeks: Math.floor(st.foodUnits / Math.max(1, st.weeklyFood)), waterUnits: st.waterUnits, waterWeeks: Math.floor(st.waterUnits / Math.max(1, st.weeklyWater)) })}</p>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">模块 <span className="text-xs font-normal text-zinc-400">{t('base.materials', { have: st.materialPoints })}{st.cold ? ' · 有冰箱' : ' · 没电，没冰箱'}</span></h3>
        <p className="text-xs text-zinc-500">{t('base.buildHint')}</p>
        {state.base.building && <p className="mt-1 text-xs text-amber-300">{t('base.building', { name: lt(moduleDefs.get(state.base.building.moduleId)?.name ?? { zh: '' }), n: state.base.building.weeksLeft })}</p>}
        <ul className="mt-2 space-y-2 text-sm">
          {available.map((m) => {
            const b = built.get(m.id)
            return (
              <li key={m.id} className="flex items-start justify-between gap-2">
                <div>
                  <div>{m.icon} {lt(m.name)} {b && <span className={`text-xs ${b.damaged ? 'text-red-400' : 'text-emerald-400'}`}>{b.damaged ? '已损毁' : '已建'}</span>}</div>
                  <div className="text-xs text-zinc-500">{lt(m.desc)} · 材料 {m.cost.materialPoints} 分 · {m.cost.weeks} 周{m.cost.money ? ` · ￥${m.cost.money}` : ''}{st.materialPoints < m.cost.materialPoints ? ` · 还差 ${m.cost.materialPoints - st.materialPoints} 分` : ''}
                    {(m.cost.requires ?? []).map((r) => { const have = state.warehouse.filter((c) => c.defId === r.cardId).length; return <span key={r.cardId} className={have >= r.count ? '' : 'text-red-400'}> · 需要 {L(cardDefs.get(r.cardId)?.name ?? { zh: r.cardId })} ×{r.count}（有 {have}）</span> })}
                  </div>
                </div>
                {(!b || b.damaged) && state.base.building?.moduleId !== m.id && <button className="shrink-0 rounded bg-zinc-700 px-3 py-1 disabled:opacity-40" disabled={!!state.base.building || st.materialPoints < m.cost.materialPoints || (m.cost.requires ?? []).some((r) => state.warehouse.filter((c) => c.defId === r.cardId).length < r.count)} onClick={() => store.act((s) => engine.build(s, m.id))}>{b ? '修复' : t('action.build')}</button>}
                {state.base.building?.moduleId === m.id && <span className="shrink-0 text-xs text-amber-300">在建</span>}
              </li>
            )
          })}
        </ul>

      </section>
    </div>
  )
}
