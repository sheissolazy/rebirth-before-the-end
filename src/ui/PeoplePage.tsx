import { useState } from 'react'
import type { GameState, CompanionJob, PersonState } from '../engine/types'
import { GiftModal } from './GiftModal'
import { EquipModal } from './EquipModal'
import { AFFECTION_THRESHOLDS } from '../engine/types'
import { engine, type Store } from './store'
import { t, lt } from '../i18n'
import { content } from '../content'
import { npcDefs, personName, personRarity, isRomanceable, RARITY_CLASS, petDefs, cardDefs } from './lookup'

const JOBS: CompanionJob[] = ['idle', 'guard', 'farm', 'scavenge', 'train']

function rank(v: number) {
  let r = 'stranger'
  for (const [k, th] of Object.entries(AFFECTION_THRESHOLDS)) if (v >= th) r = k
  return t(`affection.${r as keyof typeof AFFECTION_THRESHOLDS}`)
}

export function PeoplePage({ state, store }: { state: GameState; store: Store }) {
  const [gifting, setGifting] = useState<PersonState | null>(null)
  const [equipping, setEquipping] = useState<PersonState | 'hero' | null>(null)
  const equipLine = (eq: Partial<Record<string, string>>) => Object.values(eq).map((id) => { const c = state.warehouse.find((x) => x.instanceId === id); return c ? lt(cardDefs.get(c.defId)!.name) : '' }).filter(Boolean).join('、') || '无'
  const people = Object.values(state.people)
  const leads = people.filter((p) => isRomanceable(p))
  const companions = people.filter((p) => !isRomanceable(p) && (p.inBase || p.generated))
  const others = people.filter((p) => !isRomanceable(p) && !p.inBase && !p.generated)
  const Attr = ({ p }: { p: typeof people[number] }) => <span className="text-xs text-zinc-400">💪{p.attrs.strength} 🧠{p.attrs.mind} 💬{p.attrs.charm}</span>
  return (
    <div className="space-y-4 p-4">
      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">{lt(state.hero.name)}（你）</h3>
        <p className="text-sm">💪{state.hero.attrs.strength} 🧠{state.hero.attrs.mind} 💬{state.hero.attrs.charm} · {t('stat.health')} {state.hero.health} · {t('stat.exposure')} {state.hero.exposure} · {t('stat.butterfly')} {state.hero.butterfly} · 空间 {t(`rarity.${state.hero.spaceRarity}`)}</p>
        <p className="flex items-center justify-between text-xs text-zinc-500"><span>装备：{equipLine(state.hero.equipment)}{state.time.phase === 'prologue' && ` · ${state.hero.employed ? '在职' : '失业'}`}</span><button className="rounded bg-zinc-700 px-2 py-0.5 text-zinc-200" onClick={() => setEquipping('hero')}>{t('action.equip')}</button></p>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">男主</h3>
        <ul className="mt-2 space-y-2">
          {leads.map((p) => {
            const d = npcDefs.get(p.defId!)!
            return (
              <li key={p.id} className={`rounded border p-2 text-sm ${RARITY_CLASS[personRarity(p)]} ${!p.alive ? 'opacity-40' : ''}`}>
                <div className="flex justify-between"><span>{d.icon} {personName(p)} <span className="text-xs text-zinc-400">{lt(d.title)}</span></span><Attr p={p} /></div>
                <div className="text-xs text-zinc-400">{lt(d.bio)}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span>好感 {p.affection}（{rank(p.affection)}）{p.inBase ? ' · 在基地' : ''}{p.injury ? ` · 受伤${p.injury}` : ''}{!p.alive ? ' · 已死亡' : ''} · 缺 {t(`supply.${d.needs}`)}</span>
                  <span className="flex gap-1">
                    {p.alive && p.inBase && <button className="rounded bg-zinc-700 px-2 py-0.5" onClick={() => setEquipping(p)}>{t('action.equip')}</button>}
                    {p.alive && <button className="rounded bg-pink-900 px-2 py-0.5" onClick={() => setGifting(p)}>{t('action.gift')}</button>}
                  </span>
                </div>
                {p.inBase && <div className="text-xs text-zinc-500">装备：{equipLine(p.equipment)}</div>}
                <div className="h-1 w-full rounded bg-zinc-800"><div className="h-1 rounded bg-pink-500" style={{ width: `${p.affection}%` }} /></div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">伙伴</h3>
        <ul className="mt-2 space-y-2">
          {companions.map((p) => (
            <li key={p.id} className={`rounded border p-2 text-sm ${RARITY_CLASS[personRarity(p)]} ${!p.alive ? 'opacity-40' : ''}`}>
              <div className="flex justify-between"><span>{personName(p)} <span className="text-xs text-zinc-400">{p.generated ? lt(content.survivorTraits.find((x) => x.id === p.generated!.traitId)?.name ?? { zh: '' }) : lt(npcDefs.get(p.defId!)?.title ?? { zh: '' })}</span></span><Attr p={p} /></div>
              <div className="flex items-center justify-between text-xs">
                <span>{t('stat.loyalty')} {p.loyalty}{p.injury ? ` · 受伤${p.injury}` : ''}{!p.alive ? ' · 已死亡' : !p.inBase ? ' · 已离开' : ''}{p.generated?.powerId ? ` · 异能 ${lt(content.powers.find((x) => x.id === p.generated!.powerId)?.name ?? { zh: '' })}` : ''} · 缺 {t(`supply.${p.generated?.needs ?? npcDefs.get(p.defId ?? '')?.needs ?? 'daily'}`)}</span>
                <span className="flex gap-1">
                  {p.alive && p.inBase && <button className="rounded bg-zinc-700 px-2 py-0.5" onClick={() => setEquipping(p)}>{t('action.equip')}</button>}
                  {p.alive && p.inBase && <button className="rounded bg-pink-900 px-2 py-0.5" onClick={() => setGifting(p)}>{t('action.gift')}</button>}
                </span>
              </div>
              {p.alive && p.inBase && <div className="text-xs text-zinc-500">装备：{equipLine(p.equipment)}</div>}
              {p.alive && p.inBase && (
                <label className="mt-1 block text-xs">派工：
                  <select className="rounded border border-zinc-700 bg-zinc-800 p-1" value={p.job} disabled={!!p.busyWithEventId} onChange={(e) => store.act((s) => engine.assignJob(s, p.id, e.target.value as CompanionJob))}>
                    {JOBS.map((j) => <option key={j} value={j}>{t(`job.${j}`)}</option>)}
                  </select>
                  {p.busyWithEventId && ' （正在事件中）'}
                </label>
              )}
            </li>
          ))}
          {!companions.length && <p className="text-xs text-zinc-500">还没有伙伴。通过事件收容幸存者。</p>}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 p-3">
        <h3 className="font-semibold">宠物</h3>
        <ul className="mt-1 text-sm">
          {state.pets.map((p) => <li key={p.id} className={!p.alive ? 'opacity-40' : ''}>{petDefs.get(p.defId)?.icon} {lt(petDefs.get(p.defId)!.name)}{!p.alive && '（已死亡）'}</li>)}
          {!state.pets.length && <li className="text-xs text-zinc-500">没有宠物。</li>}
        </ul>
      </section>

      {gifting && <GiftModal state={state} person={gifting} store={store} onClose={() => setGifting(null)} />}
      {equipping && <EquipModal state={state} person={equipping} store={store} onClose={() => setEquipping(null)} />}
      {others.length > 0 && (
        <section className="rounded-lg border border-zinc-800 p-3">
          <h3 className="font-semibold">其他人</h3>
          <ul className="mt-1 text-sm">{others.map((p) => <li key={p.id}>{npcDefs.get(p.defId!)?.icon} {personName(p)} · {lt(npcDefs.get(p.defId!)!.title)}{!p.alive && '（已死亡）'}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
