import type { GameState } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { moduleDefs, cardDefs } from './lookup'

export function BasePage({ state, store }: { state: GameState; store: Store }) {
  const st = engine.stats(state)
  const base = content.bases.find((b) => b.type === state.base.type)!
  const built = new Map(state.base.modules.map((m) => [m.moduleId, m]))
  const available = content.modules.filter((m) => m.baseType === state.base.type)
  const crisisDef = state.crisis ? cardDefs.get(state.crisis.cardDefId) : undefined
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{base.icon} {lt(base.name)} <span className="text-xs text-zinc-500">{lt(base.desc)}</span></h3>
        <p className="text-sm text-zinc-300">{t('stat.defense')} {st.defense} · {t('warehouse.capacity', { used: st.storageUsed, cap: st.storageCap })} · 人口上限 {base.population}</p>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{t('crisis.title')}</h3>
        {state.crisis ? (
          <div className="text-sm">
            <p>{crisisDef?.icon} {crisisDef ? lt(crisisDef.name) : t(`crisisKind.${state.crisis.crisisKind}`)} · {state.crisis.revealed ? t(`rarity.${state.crisis.rarity}`) : '档位未知'}</p>
            <p className="text-zinc-400">{crisisDef && crisisDef.kind === 'crisis' ? lt(crisisDef.onDraw) : ''}</p>
            <p className="mt-1">{t('crisis.points', { need: state.crisis.revealed ? st.crisisNeed : '?', have: st.crisisHave })} {state.crisis.resolved && '· 已通过剧情/借力解决'}</p>
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
        <h3 className="font-semibold">模块</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {available.map((m) => {
            const b = built.get(m.id)
            return (
              <li key={m.id} className="flex items-start justify-between gap-2">
                <div>
                  <div>{m.icon} {lt(m.name)} {b && <span className={`text-xs ${b.damaged ? 'text-red-400' : 'text-emerald-400'}`}>{b.damaged ? '已损毁' : '已建'}</span>}</div>
                  <div className="text-xs text-zinc-500">{lt(m.desc)} · 材料 {m.cost.materialPoints} 分{m.cost.money ? ` · ￥${m.cost.money}` : ''}</div>
                </div>
                {(!b || b.damaged) && <button className="shrink-0 rounded bg-zinc-700 px-3 py-1" onClick={() => store.act((s) => engine.build(s, m.id))}>{b ? '修复' : t('action.build')}</button>}
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">材料 = 仓库里"材料"维度物资的分值。{Object.keys(moduleDefs).length ? '' : ''}</p>
      </section>
    </div>
  )
}
