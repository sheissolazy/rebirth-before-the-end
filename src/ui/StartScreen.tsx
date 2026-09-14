import { useState } from 'react'
import type { NewGameOptions } from '../engine/types'
import type { Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'

export function StartScreen({ store }: { store: Store }) {
  const [build, setBuild] = useState<NewGameOptions['build']>('balanced')
  const [seed, setSeed] = useState('')
  const [bonusNpc, setBonusNpc] = useState('guchen')
  const [traits, setTraits] = useState<string[]>([])
  const m = store.meta
  const budget = m.traitPoints + (m.purchased['shop_trait'] ?? 0)
  const spent = traits.reduce((s, id) => s + (content.startTraits.find((x) => x.id === id)?.cost ?? 0), 0)
  const toggle = (id: string) => setTraits(traits.includes(id) ? traits.filter((x) => x !== id) : [...traits, id])
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-3xl font-bold">{t('app.title')} <span className="text-xs font-normal text-zinc-500">{import.meta.env.VITE_SAVE_PREFIX === 'rbte-next' ? 'next 开发版' : '测试版'}</span></h1>
      <p className="text-zinc-400">你死在末日第三年。睁开眼，是末日前四周。</p>
      {m.rebirths > 0 && <p className="text-sm text-zinc-400">这是第 {m.rebirths + 1} 世 · {t('shop.title')} {m.rebirthPoints} · 特质预算 {budget}</p>}

      {store.state && (
        <div className="rounded-lg border border-amber-700 p-3">
          <p className="text-sm">有一局没打完的存档。</p>
          <div className="mt-2 flex gap-2">
            <button className="rounded bg-amber-600 px-4 py-2 font-semibold" onClick={() => (window.location.hash = '#game')}>继续</button>
            <button className="rounded border border-zinc-700 px-4 py-2" onClick={store.abandon}>放弃这一世</button>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-zinc-800 p-3">
        <h2 className="font-semibold">新的一世</h2>
        <label className="mt-2 block text-sm">开局倾向
          <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2" value={build} onChange={(e) => setBuild(e.target.value as NewGameOptions['build'])}>
            <option value="balanced">均衡（体2 脑2 魅2）</option>
            <option value="strength">体力（体4 脑1 魅1）</option>
            <option value="mind">头脑（体1 脑4 魅1）</option>
            <option value="charm">魅力（体1 脑1 魅4）</option>
          </select>
        </label>
        {(m.purchased['shop_affection'] ?? 0) > 0 && (
          <label className="mt-2 block text-sm">他好像记得你
            <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2" value={bonusNpc} onChange={(e) => setBonusNpc(e.target.value)}>
              {content.npcs.filter((n) => n.romanceable).map((n) => <option key={n.id} value={n.id}>{lt(n.name)}</option>)}
            </select>
          </label>
        )}
        <div className="mt-3">
          <div className="flex justify-between text-sm"><span>{t('trait.title')}</span><span className={spent > budget ? 'text-red-400' : 'text-zinc-400'}>{t('trait.budget', { have: budget, spent })}</span></div>
          <p className="text-xs text-zinc-500">正面特质花点数，负面特质给点数。第一世预算 0，每过一世 +1。</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {content.startTraits.map((tr) => (
              <li key={tr.id}>
                <button onClick={() => toggle(tr.id)} className={`w-full rounded border p-1.5 text-left ${traits.includes(tr.id) ? 'border-amber-500 bg-amber-950/30' : 'border-zinc-800'} ${tr.cost > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  <div>{lt(tr.name)} <span className="text-zinc-500">{tr.cost > 0 ? `-${tr.cost}` : `+${-tr.cost}`}</span></div>
                  <div className="text-zinc-500">{lt(tr.desc)}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <label className="mt-2 block text-sm">种子（可选）
          <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 p-2" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="留空随机" />
        </label>
        <button className="mt-3 w-full rounded bg-amber-600 py-2 font-semibold disabled:opacity-40" disabled={spent > budget} onClick={() => { store.newGame({ build, seed: seed || undefined, bonusNpcId: bonusNpc, traits }); window.location.hash = '#game' }}>睁开眼</button>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h2 className="font-semibold">{t('shop.title')}：{m.rebirthPoints}</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {content.rebirthShop.map((item) => {
            const n = m.purchased[item.id] ?? 0
            const maxed = n >= item.cost.length
            const cost = item.cost[Math.min(n, item.cost.length - 1)]
            return (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <div><div>{lt(item.name)} <span className="text-xs text-zinc-500">×{n}</span></div><div className="text-xs text-zinc-500">{lt(item.desc)}</div></div>
                <button className="shrink-0 rounded bg-zinc-700 px-3 py-1 disabled:opacity-40" disabled={maxed || m.rebirthPoints < cost} onClick={() => store.buyShop(item.id)}>{maxed ? '已满' : `${cost} 点`}</button>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}
