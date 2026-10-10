// 做饭界面（学《生存日志》的烹饪台）：左边冰柜（生食材 + 做好的饭菜）、中间"这一锅"、右边菜谱。
// 一锅做全家的份，做好了放进冰柜，谁饿了谁去拿；吃完了再来选下一锅。
import { useState } from 'react'
import { t, type UiKey } from '../i18n'
import type { CookView } from './World'
import { TONE } from './ui'

const PANEL = 'rounded-xl bg-[#2a2420]/95 ring-1 ring-[#e8c98a]/25'
const fmt = (n: number) => (Math.round(n * 10) / 10).toString()

export function CookPanel({ view, onCook, onClose }: {
  view: CookView
  onCook: (id: string) => string
  onClose: () => void
}) {
  const [pick, setPick] = useState(() => (view.dishes.find((d) => d.id === view.menu && d.servings > 0) ?? view.dishes.find((d) => d.servings > 0) ?? view.dishes[0]).id)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const d = view.dishes.find((x) => x.id === pick) ?? view.dishes[0]
  const n = d.servings
  const fx = [`饱 +${d.fx.hunger}`, d.fx.mood ? `心情 +${d.fx.mood}` : '', d.fx.energy ? `精力 +${d.fx.energy}` : '', d.fx.health ? `健康 +${d.fx.health}` : ''].filter(Boolean)
  const go = () => {
    const r = onCook(d.id)
    setMsg({ text: t(`world.cook.r.${r}` as UiKey, { who: view.who, dish: d.name }), ok: r === 'ok' })
    if (r === 'ok') onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[92vh] w-[min(980px,96vw)] flex-col gap-3 rounded-2xl bg-[#1d1915]/97 p-4 text-[#efe4d0] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[#e8c98a]/30"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between px-1">
          <div className="text-[18px] font-bold">🍳 {t('world.cook.title')}</div>
          <div className="text-[12px] text-[#bfb29a]">{t('world.cook.hint')}</div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto md:h-[min(520px,72vh)] md:grid-cols-[1fr_1.15fr_1.1fr] md:overflow-hidden">
          {/* 冰柜 */}
          <div className={`${PANEL} min-h-0 overflow-y-auto p-3`}>
            <div className="mb-2 border-l-4 border-[#e8a33a] pl-2 text-[14px] font-bold">🧊 {t('world.cook.fridge')}</div>
            <div className="grid grid-cols-3 gap-2">
              {view.ings.map((g) => (
                <div key={g.id} className="flex aspect-square flex-col items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                  <div className="text-[28px] leading-none">{g.icon}</div>
                  <div className="mt-1 text-[12px]">{g.name}</div>
                  <div className="text-[13px] font-bold tabular-nums" style={{ color: g.n < 1 ? TONE.bad : g.n < 4 ? TONE.warn : TONE.good }}>{fmt(g.n)}</div>
                </div>
              ))}
              <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                <div className="text-[28px] leading-none">🌿</div>
                <div className="mt-1 text-[12px]">草药</div>
                <div className="text-[13px] font-bold tabular-nums">{view.herbs}</div>
              </div>
              <div className="flex aspect-square flex-col items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10">
                <div className="text-[28px] leading-none">💧</div>
                <div className="mt-1 text-[12px]">水</div>
                <div className="text-[13px] font-bold tabular-nums">{fmt(view.water)}</div>
              </div>
            </div>
            <div className="mb-1.5 mt-3 text-[12px] font-semibold text-[#d9ccb4]">{t('world.cook.leftovers')}</div>
            {view.leftovers.length === 0 ? (
              <div className="rounded-lg bg-black/20 px-2.5 py-2 text-[12px] text-[#a99d8a]">{t('world.cook.noLeftovers')}</div>
            ) : (
              <div className="space-y-1">
                {view.leftovers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/25 px-2.5 py-1.5 text-[13px]">
                    <span>{p.icon} {p.name}</span><span className="font-bold tabular-nums">×{Math.floor(p.left)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 这一锅 */}
          <div className={`${PANEL} flex min-h-0 flex-col p-3`}>
            <div className="mb-2 border-l-4 border-[#e8a33a] pl-2 text-[14px] font-bold">🍲 {t('world.cook.pot')}</div>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto rounded-lg bg-gradient-to-b from-[#5a3a1c] to-[#2f2014] px-3 py-3 text-center ring-1 ring-[#e8a33a]/30">
              {view.cooking ? (
                <>
                  <div className="text-[44px]">🔥</div>
                  <div className="mt-1 text-[15px] font-semibold">{t('world.cook.cooking', { who: view.cooking.who, dish: view.cooking.dish })}</div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${Math.round(view.cooking.p * 100)}%`, background: '#f2a93b' }} /></div>
                </>
              ) : (
                <>
                  <div className="text-[52px] leading-none">{d.icon}</div>
                  <div className="mt-2 text-[17px] font-bold">{d.name}</div>
                  <div className="mt-0.5 text-[12px] text-[#d9ccb4]">{n > 0 ? t('world.cook.servings', { n, m: view.mouths }) : t('world.cook.short', { what: d.short.join('、') })}</div>
                  <div className="mt-3 w-full space-y-1 text-left text-[12px]">
                    {d.need.map((x) => (
                      <div key={x.name} className="flex justify-between rounded bg-black/25 px-2 py-1">
                        <span>{x.icon} {x.name} × {fmt(x.per * Math.max(1, n))}</span>
                        <span style={{ color: x.have + 1e-6 >= x.per * Math.max(1, n) ? TONE.good : TONE.bad }}>有 {fmt(x.have)}</span>
                      </div>
                    ))}
                    {d.herbs > 0 && <div className="flex justify-between rounded bg-black/25 px-2 py-1"><span>🌿 草药 × {d.herbs}</span><span style={{ color: view.herbs >= d.herbs ? TONE.good : TONE.bad }}>有 {view.herbs}</span></div>}
                  </div>
                  <div className="mt-2 text-[12px] text-[#f3d9a0]">{fx.join(' · ')}</div>
                  <div className="text-[11px] text-[#a99d8a]">{t('world.cook.time', { h: d.hours })}</div>
                </>
              )}
            </div>
            {msg && <div className="mt-2 text-center text-[12px] font-semibold" style={{ color: msg.ok ? TONE.good : TONE.bad }}>{msg.text}</div>}
            <button disabled={!!view.cooking || n <= 0} onClick={go}
              className="mt-2 shrink-0 rounded-lg py-2.5 text-[15px] font-bold text-[#2a1a08] disabled:opacity-35" style={{ background: '#f2a93b' }}>
              {t('world.cook.go', { n: Math.max(0, n) })}
            </button>
          </div>

          {/* 菜谱 */}
          <div className={`${PANEL} min-h-0 overflow-y-auto p-3`}>
            <div className="mb-2 border-l-4 border-[#e8a33a] pl-2 text-[14px] font-bold">📖 {t('world.cook.recipes')}</div>
            <div className="space-y-1.5">
              {view.dishes.map((x) => (
                <button key={x.id} onClick={() => { setPick(x.id); setMsg(null) }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 transition ${x.id === pick ? 'bg-[#e8a33a]/20 ring-[#e8a33a]/70' : 'bg-black/25 ring-white/5 hover:bg-white/10'}`}>
                  <div className="text-[24px] leading-none">{x.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{x.name}{x.id === view.menu ? ' · 上回做的' : ''}</div>
                    <div className="truncate text-[11px] text-[#bfb29a]">{x.need.map((g) => g.name).join('·')}{x.herbs ? '·草药' : ''}</div>
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold" style={{ color: x.servings > 0 ? TONE.good : TONE.bad }}>
                    {x.servings > 0 ? t('world.cook.ready') : t('world.cook.short', { what: x.short.join('、') })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-semibold hover:bg-white/20">{t('world.cook.close')}</button>
        </div>
      </div>
    </div>
  )
}
