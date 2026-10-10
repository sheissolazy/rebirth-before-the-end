// 女主的手机：网购（第二天上午送到）、在路上的快递、通讯录（打电话）。
// 像一部真手机：黑色边框、亮色屏幕、底部三个标签；末日后整块屏幕"无服务"。
import { useState } from 'react'
import { t, type UiKey } from '../i18n'
import type { PhoneView } from './World'
import { TONE } from './ui'

type Tab = 'shop' | 'orders' | 'contacts' | 'stocks' | 'lottery'

export function PhonePanel({ view, onOrder, onCall, onInvite, onTrade, onTicket, onClaim, onClose }: {
  view: PhoneView
  onOrder: (cart: Record<string, number>) => string
  onCall: (id: string) => { r: string; line?: string }
  onInvite: (id: string) => string
  onTrade: (id: string, lots: number) => string
  onTicket: (back2: number, mult: number) => string
  onClaim: () => number
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('shop')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [calling, setCalling] = useState<{ name: string; line: string } | null>(null)
  const [back2, setBack2] = useState<number>(view.lottery.back2Maybe[0])
  const [mult, setMult] = useState(1)
  const yuan = (n: number) => `¥${Math.round(n).toLocaleString()}`
  const trade = (id: string, lots: number) => {
    const r = onTrade(id, lots)
    setMsg(r === 'ok' ? null : { text: { money: '钱不够', closed: '现在没开市（末日前每天 9:30～15:00）', none: '手上没有这只股票' }[r] ?? r, ok: false })
  }
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
              {tab === 'stocks' && (
                <div className="pt-1">
                  <div className="flex items-baseline justify-between px-1 pb-1">
                    <div className="text-[20px] font-bold">股票</div>
                    <div className="text-[11px] font-semibold" style={{ color: view.market === 'open' ? '#d0571f' : '#8a7f74' }}>{view.market === 'open' ? '● 交易中' : view.market === 'gone' ? '股市没了' : '休市（9:30～15:00 开）'}</div>
                  </div>
                  <div className="px-1 pb-2 text-[11px] text-[#8a7f74]">重生的人知道后面几天会怎样——但记忆有清楚有模糊。末日一到股市就没了，记得卖掉。</div>
                  <div className="space-y-2">
                    {view.stocks.map((st) => {
                      const ch = st.prev ? (st.price / st.prev - 1) * 100 : 0
                      const up = ch >= 0
                      const value = st.shares * st.price
                      const pl = value - st.cost
                      return (
                        <div key={st.id} className="rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-black/5">
                          <div className="flex items-baseline justify-between">
                            <div><span className="text-[14px] font-bold">{st.name}</span> <span className="text-[11px] text-[#8a7f74]">{st.code}</span></div>
                            <div className="text-right">
                              <span className="text-[16px] font-bold tabular-nums" style={{ color: up ? '#d23a2a' : '#2f9a4a' }}>{st.price.toFixed(2)}</span>
                              <span className="ml-1.5 text-[11px] font-semibold tabular-nums" style={{ color: up ? '#d23a2a' : '#2f9a4a' }}>{up ? '+' : ''}{ch.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="mt-1 rounded-md bg-[#f6f1e8] px-2 py-1 text-[11px] italic leading-snug text-[#6b5f53]">
                            <span className="mr-1 not-italic font-semibold" style={{ color: st.clarity === 'clear' ? '#3f8a2c' : st.clarity === 'half' ? '#b07d10' : '#c0533a' }}>{st.clarity === 'clear' ? '记得清' : st.clarity === 'half' ? '有印象' : '记不清'}</span>{st.memory}
                          </div>
                          {st.shares > 0 && (
                            <div className="mt-1 flex justify-between text-[11px]">
                              <span>持有 {st.shares} 股 · 市值 {yuan(value)}</span>
                              <span className="font-semibold" style={{ color: pl >= 0 ? '#d23a2a' : '#2f9a4a' }}>{pl >= 0 ? '+' : ''}{yuan(pl).replace('¥-', '-¥')}</span>
                            </div>
                          )}
                          <div className="mt-1.5 flex gap-1.5">
                            <button disabled={view.market !== 'open'} onClick={() => trade(st.id, 1)} className="flex-1 rounded-full py-1 text-[11px] font-semibold text-white disabled:opacity-35" style={{ background: '#d23a2a' }}>买一手 {yuan(st.price * 100)}</button>
                            <button disabled={view.market !== 'open' || st.shares <= 0} onClick={() => trade(st.id, -1)} className="flex-1 rounded-full py-1 text-[11px] font-semibold text-white disabled:opacity-35" style={{ background: '#2f9a4a' }}>卖一手</button>
                            <button disabled={view.market !== 'open' || st.shares <= 0} onClick={() => trade(st.id, -st.shares / 100)} className="rounded-full bg-[#f1ebe2] px-2.5 py-1 text-[11px] font-semibold disabled:opacity-35">全卖</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {tab === 'lottery' && (
                <div className="pt-1">
                  <div className="px-1 pb-2 text-[20px] font-bold">彩票</div>
                  <div className="rounded-xl bg-gradient-to-b from-[#fff7ea] to-[#fde9c8] px-3 py-3 shadow-sm ring-1 ring-[#e8b36a]">
                    <div className="text-[13px] font-bold text-[#8a4b12]">超级大乐透 第 {view.lottery.issue} 期</div>
                    <div className="text-[11px] text-[#a0703a]">{view.lottery.drawText}，第二天能兑奖</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {view.lottery.front.map((n) => <span key={n} className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: '#d23a2a' }}>{String(n).padStart(2, '0')}</span>)}
                      <span className="mx-0.5 text-[#c9a46a]">|</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: '#2a6fd2' }}>{String(view.lottery.back).padStart(2, '0')}</span>
                      {(view.lottery.ticket ? [view.lottery.ticket.back2] : view.lottery.back2Maybe).map((n) => (
                        <button key={n} disabled={!view.lottery.canBuy} onClick={() => setBack2(n)}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${(view.lottery.ticket?.back2 ?? back2) === n ? 'text-white' : 'text-[#2a6fd2] ring-1 ring-[#2a6fd2]'}`}
                          style={{ background: (view.lottery.ticket?.back2 ?? back2) === n ? '#2a6fd2' : 'transparent' }}>{String(n).padStart(2, '0')}</button>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] italic leading-snug text-[#6b5f53]">前世这一期的号码背得滚瓜烂熟……就是后区最后一个，是 {view.lottery.back2Maybe.join(' 还是 ')}？</div>
                    {view.lottery.canBuy && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[12px]">
                          <span>倍数</span>
                          {Array.from({ length: view.lottery.maxMult }, (_, k) => k + 1).map((k) => (
                            <button key={k} onClick={() => setMult(k)} className={`h-6 w-6 rounded-full text-[11px] font-bold ${mult === k ? 'bg-[#e2793a] text-white' : 'bg-white ring-1 ring-black/10'}`}>{k}</button>
                          ))}
                        </div>
                        <button onClick={() => { const r = onTicket(back2, mult); setMsg(r === 'ok' ? null : { text: r === 'money' ? '钱不够' : '已经截止了', ok: false }) }}
                          className="rounded-full bg-[#e2793a] px-3 py-1 text-[12px] font-bold text-white">买一注 ¥{view.lottery.price * mult}</button>
                      </div>
                    )}
                    {view.lottery.canBuy && <div className="mt-1 text-[10px] text-[#8a7f74]">倍数越高中得越多，也越扎眼（彩票站最多给打 {view.lottery.maxMult} 倍）</div>}
                    {view.lottery.ticket && !view.lottery.drawn && <div className="mt-2 text-[12px] font-semibold text-[#8a4b12]">已买 {view.lottery.ticket.mult} 倍，等开奖。</div>}
                    {view.lottery.drawn && (
                      <div className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-[12px]">
                        <div>开奖号码：后区最后一个是 <b>{String(view.lottery.real).padStart(2, '0')}</b></div>
                        {view.lottery.ticket ? (
                          <div className="mt-0.5 font-semibold" style={{ color: '#d23a2a' }}>{view.lottery.claimed ? `已兑奖 ${yuan(view.lottery.prize)}` : view.lottery.prize ? `中了 ${yuan(view.lottery.prize)}（税后）` : ''}</div>
                        ) : <div className="mt-0.5 text-[#8a7f74]">这一期没买。</div>}
                        {view.lottery.canClaim && (
                          <button onClick={() => { const n = onClaim(); if (n) setMsg({ text: `${yuan(n)} 到账了`, ok: true }) }}
                            className="mt-1.5 w-full rounded-full py-1.5 text-[13px] font-bold text-white" style={{ background: '#d23a2a' }}>去兑奖</button>
                        )}
                      </div>
                    )}
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
          {signal && (tab === 'contacts' || tab === 'stocks' || tab === 'lottery') && msg && (
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
            {(['shop', 'orders', 'stocks', 'lottery', 'contacts'] as const).map((k) => (
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
