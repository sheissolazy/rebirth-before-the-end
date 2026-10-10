// 女主的手机：网购（第二天上午送到）、在路上的快递、通讯录（打电话）。
// 像一部真手机：黑色边框、亮色屏幕、底部三个标签；末日后整块屏幕"无服务"。
import { useState } from 'react'
import { t, type UiKey } from '../i18n'
import type { PhoneView } from './World'
import { TONE } from './ui'

type Tab = 'shop' | 'orders' | 'contacts'

export function PhonePanel({ view, onOrder, onCall, onInvite, onClose }: {
  view: PhoneView
  onOrder: (cart: Record<string, number>) => string
  onCall: (id: string) => { r: string; line?: string }
  onInvite: (id: string) => string
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('shop')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [calling, setCalling] = useState<{ name: string; line: string } | null>(null)
  const cost = view.items.reduce((s, it) => s + (cart[it.id] ?? 0) * it.price, 0)
  const total = cost > 0 ? cost + view.fee : 0
  const signal = view.state !== 'nosignal'
  const hh = String(Math.floor(view.hour)).padStart(2, '0')
  const mm = String(Math.floor((view.hour % 1) * 60)).padStart(2, '0')

  const bump = (id: string, d: number, max: number) => {
    setMsg(null)
    setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(max, (c[id] ?? 0) + d)) }))
  }
  const buy = () => {
    const r = onOrder(cart)
    setMsg({ text: t(`world.phone.r.${r}` as UiKey), ok: r === 'ok' })
    if (r === 'ok') { setCart({}); setTab('orders') }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45" onClick={onClose}>
      <div className="relative h-[min(640px,92vh)] w-[340px] rounded-[2.4rem] bg-[#111] p-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.9rem] bg-[#f6f3ee] text-[#2a2420]">
          {/* 状态栏：时间、信号、电量；顶上一道刘海 */}
          <div className="relative flex items-center justify-between px-6 pb-1 pt-2.5 text-[12px] font-semibold tabular-nums">
            <span>{hh}:{mm}</span>
            <div className="absolute left-1/2 top-1.5 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#111]" />
            <span className="flex items-center gap-1.5">
              {signal ? (
                <span className="flex items-end gap-[2px]">{[5, 7, 9, 11].map((h) => <i key={h} className="block w-[3px] rounded-sm bg-[#2a2420]" style={{ height: h }} />)}</span>
              ) : <span className="text-[11px] text-[#9a8f84]">{t('world.phone.nosignal')}</span>}
              <span className="ml-1 inline-block h-[11px] w-[22px] rounded-[3px] ring-1 ring-[#2a2420]/70"><i className="m-[1.5px] block h-[6px] w-[14px] rounded-[1px] bg-[#2a2420]" /></span>
            </span>
          </div>

          {!signal ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="text-5xl opacity-50">📵</div>
              <div className="text-[15px] font-semibold">{t('world.phone.nosignal')}</div>
              <div className="text-[13px] leading-relaxed text-[#7b7066]">{t('world.phone.nosignalBody')}</div>
            </div>
          ) : (
            <div className="relative flex-1 overflow-y-auto px-3 pb-3">
              {tab === 'shop' && (
                <>
                  <div className="sticky top-0 z-10 -mx-3 bg-[#f6f3ee]/95 px-4 pb-2 pt-1 backdrop-blur">
                    <div className="text-[20px] font-bold">{t('world.phone.tab.shop').replace(/^\S+\s/, '')}</div>
                    <div className="text-[11px] text-[#8a7f74]">{t('world.phone.shopHint', { fee: view.fee })}</div>
                    {view.lastDay && <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#5a4000]" style={{ background: `${TONE.warn}55` }}>{t('world.phone.lastDayBanner')}</div>}
                    {view.state === 'closed' && <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ background: TONE.bad }}>{t('world.phone.closed')}</div>}
                  </div>
                  <div className="space-y-1.5">
                    {view.items.map((it) => {
                      const n = cart[it.id] ?? 0
                      return (
                        <div key={it.id} className={`flex items-center gap-2.5 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ${n ? 'ring-[#e0a96d]' : 'ring-black/5'}`}>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f1ebe2] text-[22px]">{it.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold">{it.name}</div>
                            <div className="truncate text-[11px] text-[#8a7f74]" title={it.desc}>{it.desc}</div>
                            <div className="text-[13px] font-bold text-[#d0571f]">¥{it.price}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {n > 0 && <button onClick={() => bump(it.id, -1, it.max)} className="h-7 w-7 rounded-full bg-[#f1ebe2] text-[15px] font-bold leading-none">−</button>}
                            {n > 0 && <span className="w-5 text-center text-[13px] font-semibold tabular-nums">{n}</span>}
                            <button disabled={view.state !== 'ok' || n >= it.max} onClick={() => bump(it.id, 1, it.max)}
                              className="h-7 w-7 rounded-full bg-[#e2793a] text-[15px] font-bold leading-none text-white disabled:opacity-30">+</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {tab === 'orders' && (
                <div className="pt-1">
                  <div className="px-1 pb-2 text-[20px] font-bold">{t('world.phone.tab.orders').replace(/^\S+\s/, '')}</div>
                  {view.orders.length === 0 && <div className="px-1 text-[13px] text-[#8a7f74]">{t('world.phone.noOrders')}</div>}
                  <div className="space-y-1.5">
                    {view.orders.map((o) => (
                      <div key={o.id} className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
                        <div className="flex items-center justify-between text-[12px] text-[#8a7f74]">
                          <span>🚚 {t(o.day === view.day ? 'world.phone.arriveToday' : 'world.phone.arrive', { h: o.hour })}</span>
                          <span className="font-semibold text-[#2a2420]">¥{o.total}</span>
                        </div>
                        <div className="mt-1 text-[13px] leading-snug">{o.what}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'contacts' && (
                <div className="pt-1">
                  <div className="px-1 pb-2 text-[20px] font-bold">{t('world.phone.tab.contacts').replace(/^\S+\s/, '')}</div>
                  <div className="divide-y divide-black/5 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                    {view.contacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-2.5 px-3 py-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1ebe2] text-[20px]">{c.icon}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                            {c.name}
                            {c.aff !== undefined && <span className="text-[11px] font-semibold text-[#d0571f]" title={t('world.phone.aff')}>❤ {c.aff}</span>}
                          </div>
                          <div className="truncate text-[11px] text-[#8a7f74]">{c.status}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {c.can === 'ok' ? (
                            <button onClick={() => { const r = onCall(c.id); if (r.line) setCalling({ name: c.name, line: r.line }) }}
                              className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: TONE.good }}>📞 {t('world.phone.call')}</button>
                          ) : (
                            <span className="text-[11px] text-[#a99d92]">{t(c.can === 'home' ? 'world.phone.atHome' : c.can === 'done' ? 'world.phone.called' : 'world.phone.nosignal')}</span>
                          )}
                          {!c.id.startsWith('fam:') && c.can !== 'home' && c.can !== 'nosignal' && (
                            <button disabled={view.invited} onClick={() => { const r = onInvite(c.id); setMsg({ text: t(`world.invite.r.${r}` as UiKey, { who: c.name }), ok: r === 'ok' }) }}
                              className="rounded-full bg-[#e2793a] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-35">🏠 {t('world.phone.invite')}</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 联系人页的提示（请了谁、什么时候到） */}
          {signal && tab === 'contacts' && msg && (
            <div className="border-t border-black/5 bg-white px-4 py-2 text-[12px] font-semibold" style={{ color: msg.ok ? '#3f8a2c' : TONE.bad }}>{msg.text}</div>
          )}
          {/* 网购的结账条 */}
          {signal && tab === 'shop' && (
            <div className="border-t border-black/5 bg-white px-4 py-2.5">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-semibold">{t('world.phone.total', { n: total })}</span>
                <span className="text-[#8a7f74]" style={{ color: total > view.money ? TONE.bad : undefined }}>{t('world.phone.wallet', { n: view.money.toLocaleString() })}</span>
              </div>
              {msg && <div className="mt-1 text-[12px] font-semibold" style={{ color: msg.ok ? '#3f8a2c' : TONE.bad }}>{msg.text}</div>}
              <button disabled={view.state !== 'ok' || total <= 0} onClick={buy}
                className="mt-1.5 w-full rounded-full bg-[#e2793a] py-2 text-[14px] font-bold text-white disabled:opacity-35">{t('world.phone.buy')}</button>
            </div>
          )}

          {/* 底部标签 */}
          <div className="flex border-t border-black/5 bg-[#fbf9f6] pb-3 pt-1.5">
            {(['shop', 'orders', 'contacts'] as const).map((k) => (
              <button key={k} onClick={() => { setTab(k); setMsg(null) }}
                className={`flex-1 text-center text-[11px] font-semibold ${tab === k ? 'text-[#e2793a]' : 'text-[#9a8f84]'}`}>
                {t(`world.phone.tab.${k}`)}{k === 'orders' && view.orders.length > 0 ? ` (${view.orders.length})` : ''}
              </button>
            ))}
          </div>

          {/* 通话中 */}
          {calling && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-gradient-to-b from-[#3b4a44] to-[#1d2422] px-7 pb-10 pt-16 text-white">
              <div className="text-center">
                <div className="text-[26px] font-semibold">{calling.name}</div>
                <div className="mt-1 text-[12px] text-white/60">{t('world.phone.calling', { name: calling.name })}</div>
              </div>
              <div className="text-center text-[15px] leading-relaxed">{calling.line}</div>
              <button onClick={() => setCalling(null)} className="flex h-14 w-14 items-center justify-center rounded-full text-[22px]" style={{ background: TONE.bad }} title={t('world.phone.hangup')}>📞</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
