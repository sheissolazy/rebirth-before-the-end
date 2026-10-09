// 到了店里的交易界面（参考成熟生存游戏的商人界面）：左边"家里"（存货、够几天、提示），
// 中间"详情"（选中的东西 + 最小/−/数量/+/最大），右边"货架"（一行一样，图标、库存、单价），
// 顶上是店名、谁来的、钱，底下是背得动多少、合计、结账。游戏在这期间是停着的。
import { useMemo, useState } from 'react'
import { SERIF } from './ui'
import { cartGives, cartTotal, shopHints, type Cart, type HomeSnapshot, type ShopCat, type ShopItem } from './shop'

export interface ShopView {
  tripId: number
  shopId: string
  /** 店名（地图上的名字） */
  name: string
  who: string
  van: boolean
  currency: 'money' | 'cores'
  /** 手上有多少钱 / 晶核 */
  wallet: number
  capacity: number
  /** 第几天（末日前越往后越贵） */
  day: number
  items: (ShopItem & { unit: number; owned: boolean })[]
  home: HomeSnapshot
}

const CATS: { id: ShopCat | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'food', label: '吃的' },
  { id: 'water', label: '喝的' },
  { id: 'med', label: '药' },
  { id: 'defense', label: '防身' },
  { id: 'other', label: '其他' },
]

/** 切角面板（像成熟游戏的金属面板） */
const cut = (n: number) => ({ clipPath: `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, 0 calc(100% - ${n}px), 0 ${n}px)` })
const HATCH = { backgroundImage: 'repeating-linear-gradient(135deg, rgba(232,201,138,0.22) 0 5px, transparent 5px 10px)' }

function Header({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#e8c98a]/15 bg-[#2b2621] px-3 py-1.5">
      <div className="h-3 w-10 shrink-0" style={HATCH} />
      <div className="flex-1 text-center text-[13px] font-bold tracking-[0.3em] text-[#efe4d0]" style={{ fontFamily: SERIF }}>{title}</div>
      <div className="h-3 w-10 shrink-0" style={HATCH} />
      {right && <div className="absolute right-3 text-[11px] text-[#a99d88]">{right}</div>}
    </div>
  )
}

export function TradePanel({ view, onCheckout }: { view: ShopView; onCheckout: (cart: Cart) => string }) {
  const [cart, setCart] = useState<Cart>({})
  const [cat, setCat] = useState<ShopCat | 'all'>('all')
  const [sel, setSel] = useState(view.items[0]?.id ?? '')
  const [err, setErr] = useState('')
  const shop = useMemo(() => ({ id: view.shopId, currency: view.currency, phase: 'prologue' as const, items: view.items.map((it) => ({ ...it, price: it.unit })) }), [view])
  const tot = cartTotal(shop, cart, 0)
  const gives = cartGives(shop, cart)
  const hints = shopHints(view.home, gives)
  const coin = view.currency === 'money' ? '元' : '颗晶核'
  const fmt = (n: number) => (view.currency === 'money' ? n.toLocaleString() : String(n))
  const item = view.items.find((x) => x.id === sel) ?? view.items[0]
  const cats = CATS.filter((c) => c.id === 'all' || view.items.some((it) => it.cat === c.id))
  const shown = view.items.filter((it) => cat === 'all' || it.cat === cat)
  const n = item ? cart[item.id] ?? 0 : 0
  // 这一样最多能买几份：库存、钱、背包三样里最紧的那个
  const maxOf = (it: ShopView['items'][number]) => {
    if (it.owned) return 0
    const others = cartTotal(shop, { ...cart, [it.id]: 0 }, 0)
    const byMoney = Math.floor((view.wallet - others.cost) / Math.max(1, it.unit))
    const byWeight = Math.floor((view.capacity - others.weight) / Math.max(1, it.weight))
    return Math.max(0, Math.min(it.once ? 1 : it.stock, byMoney, byWeight))
  }
  /** "+"按不动的原因 */
  const limitWhy = (it: ShopView['items'][number]) => {
    if (it.owned) return '家里已经有了'
    const others = cartTotal(shop, { ...cart, [it.id]: 0 }, 0)
    const left = (cart[it.id] ?? 0)
    if (left >= (it.once ? 1 : it.stock)) return '店里就这么多了'
    if (others.weight + (left + 1) * it.weight > view.capacity) return view.van ? '车也装满了' : '背不动了（开车来能多装 24 件）'
    if (others.cost + (left + 1) * it.unit > view.wallet) return view.currency === 'money' ? '钱不够了' : '晶核不够了'
    return ''
  }
  const set = (v: number) => {
    if (!item) return
    setErr('')
    setCart((c) => ({ ...c, [item.id]: Math.max(0, Math.min(maxOf(item), v)) }))
  }
  const days = (v: number) => Math.floor(v / Math.max(1, view.home.people))
  const homeRows: { icon: string; label: string; now: number; add: number; unit: string; days?: boolean }[] = [
    { icon: '🍚', label: '吃的', now: view.home.food, add: gives.food ?? 0, unit: '份', days: true },
    { icon: '💧', label: '水', now: view.home.water, add: gives.water ?? 0, unit: '份', days: true },
    { icon: '🩹', label: '急救包', now: view.home.medkits, add: gives.medkits ?? 0, unit: '个' },
    { icon: '🔫', label: '子弹', now: view.home.ammo, add: gives.ammo ?? 0, unit: '发' },
    { icon: '⛽', label: '汽油', now: view.home.fuel, add: gives.fuel ?? 0, unit: '桶' },
  ]
  const checkout = (c: Cart) => {
    const r = onCheckout(c)
    if (r === 'money') setErr(view.currency === 'money' ? '钱不够' : '晶核不够')
    else if (r === 'heavy') setErr('拿不动这么多')
    else if (r !== 'ok') setErr('买不了')
  }
  const heavy = tot.weight / Math.max(1, view.capacity)

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-3">
      <div className="flex h-[min(680px,94vh)] w-[min(1120px,97vw)] flex-col bg-[#1c1916] text-[#efe4d0] shadow-[0_20px_60px_rgba(0,0,0,0.7)]" style={cut(16)}>
        {/* 顶栏：店名、谁来的；中间是钱；右边分类 */}
        <div className="relative flex items-end gap-4 border-b-2 border-[#e8c98a]/25 bg-gradient-to-b from-[#2e2924] to-[#221e1a] px-5 pb-2 pt-3">
          <div className="min-w-0">
            <div className="text-2xl font-black tracking-wider text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{view.name}</div>
            <div className="text-[11px] text-[#a99d88]">{view.who} · {view.van ? '开面包车来的' : '走路来的'} · 能带回 {view.capacity} 件</div>
          </div>
          <div className="mx-auto flex items-center gap-2 bg-[#3a332b] px-5 py-1 text-lg font-bold tabular-nums text-[#f1d8a3] ring-1 ring-[#e8c98a]/40" style={cut(8)}>
            <span>{view.currency === 'money' ? '💰' : '💎'}</span>{fmt(view.wallet - tot.cost)}<span className="text-xs font-normal text-[#cbbfa8]">{coin}</span>
          </div>
          <div className="flex gap-1">
            {cats.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`px-3 py-1 text-xs transition ${cat === c.id ? 'bg-[#e8dcc0] font-bold text-[#1c1916]' : 'bg-[#2b2621] text-[#cbbfa8] hover:bg-[#3a332b]'}`} style={cut(5)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_minmax(0,1.15fr)] gap-3 p-3">
          {/* 左：家里 */}
          <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#24201c] ring-1 ring-white/5" style={cut(10)}>
            <Header title="家 里" />
            <div className="space-y-1.5 px-3 py-2 text-xs">
              {homeRows.map((r) => (
                <div key={r.label}>
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <span className="w-5 text-center">{r.icon}</span>
                    <span className="text-[#cbbfa8]">{r.label}</span>
                    <span className="ml-auto">{fmtNum(r.now)}</span>
                    {r.add > 0 && <span className="font-bold text-[#9cd67a]">→ {fmtNum(r.now + r.add)}</span>}
                    <span className="text-[#8a7f6d]">{r.unit}</span>
                  </div>
                  {r.days && (
                    <div className="ml-6 mt-0.5 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden bg-white/10">
                        <div className="h-full" style={{ width: `${Math.min(100, (days(r.now + r.add) / 30) * 100)}%`, background: days(r.now + r.add) < 5 ? '#e2553f' : days(r.now + r.add) < 15 ? '#e8c98a' : '#9cd67a' }} />
                      </div>
                      <span className="w-14 text-right text-[10px] text-[#a99d88]">够 {days(r.now + r.add)} 天</span>
                    </div>
                  )}
                </div>
              ))}
              <div className="pt-1 text-[10px] text-[#8a7f6d]">家里 {view.home.people} 口人，一人一天吃一份、喝一份{view.home.daysToDoom > 0 ? ` · 离末日还有 ${view.home.daysToDoom} 天` : ''}</div>
            </div>
            <Header title="提 示" />
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2">
              {hints.map((h, k) => (
                <div key={k} className={`border-l-2 pl-2 text-[11.5px] leading-snug ${h.level === 'bad' ? 'border-[#e2553f] text-[#ffb3a3]' : h.level === 'warn' ? 'border-[#e8c98a] text-[#ecdcb6]' : 'border-[#9cd67a] text-[#cfe8bd]'}`}>{h.text}</div>
              ))}
            </div>
          </div>

          {/* 中：详情 */}
          <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#24201c] ring-1 ring-white/5" style={cut(10)}>
            <Header title="详 情" />
            {item && (
              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-gradient-to-br from-[#3d362e] to-[#1f1b17] text-5xl ring-1 ring-[#e8c98a]/30" style={cut(10)}>{item.icon}</div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold" style={{ fontFamily: SERIF }}>{item.name}</div>
                    <span className="mt-0.5 inline-block bg-[#e8c98a] px-1.5 text-[10px] font-bold text-[#1c1916]" style={cut(3)}>{CATS.find((c) => c.id === item.cat)?.label}</span>
                    <div className="mt-1.5 text-xs leading-relaxed text-[#cbbfa8]">{item.desc}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] tabular-nums text-[#a99d88]">
                  <div>单价 <span className="text-[13px] font-bold text-[#f1d8a3]">{fmt(item.unit)}</span> {coin}</div>
                  <div>一份占 <span className="font-bold text-[#efe4d0]">{item.weight}</span> 件</div>
                  <div>{item.owned ? '家里已经有了' : <>店里还有 <span className="font-bold text-[#efe4d0]">{item.once ? 1 : item.stock}</span> 份</>}</div>
                </div>
                <div className="mt-auto">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => set(0)} className="flex-1 bg-[#2f2a24] py-1.5 text-xs hover:bg-[#3a332b]" style={cut(4)}>最小值</button>
                    <button onClick={() => set(n - 1)} className="w-10 bg-[#2f2a24] py-1.5 text-sm hover:bg-[#3a332b]" style={cut(4)}>−</button>
                    <div className="w-16 bg-[#14110f] py-1.5 text-center text-base font-bold tabular-nums ring-1 ring-[#e8c98a]/30">{n}</div>
                    <button onClick={() => set(n + 1)} disabled={n >= maxOf(item)} className="w-10 bg-[#2f2a24] py-1.5 text-sm hover:bg-[#3a332b] disabled:opacity-35" style={cut(4)}>+</button>
                    <button onClick={() => set(maxOf(item))} className="flex-1 bg-[#2f2a24] py-1.5 text-xs hover:bg-[#3a332b]" style={cut(4)}>最大值</button>
                  </div>
                  {item && n >= maxOf(item) && (
                    <div className="mt-1.5 text-center text-[11px] text-[#e8a07a]">{limitWhy(item)}</div>
                  )}
                  <div className="mt-2 bg-gradient-to-r from-[#3b2a20] via-[#5a3a27] to-[#3b2a20] py-1 text-center text-sm font-bold tabular-nums text-[#ffcf9e]" style={cut(4)}>
                    {n > 0 ? `− ${fmt(n * item.unit)} ${coin}` : '还没放进清单'}
                  </div>
                  {n > 0 && <button onClick={() => set(0)} className="mt-1.5 w-full bg-[#2f2a24] py-1.5 text-xs text-[#cbbfa8] hover:bg-[#3a332b]" style={cut(4)}>从清单里拿掉</button>}
                </div>
              </div>
            )}
          </div>

          {/* 右：货架 */}
          <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#24201c] ring-1 ring-white/5" style={cut(10)}>
            <Header title="货 架" />
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              {shown.map((it) => {
                const inCart = cart[it.id] ?? 0
                const on = it.id === item?.id
                return (
                  <button key={it.id} onClick={() => { setSel(it.id); setErr('') }} disabled={it.owned}
                    className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition disabled:opacity-40 ${on ? 'bg-[#e8dcc0] text-[#1c1916]' : 'bg-[#2f2a24] hover:bg-[#3a332b]'}`} style={cut(6)}>
                    <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center text-2xl ${on ? 'bg-[#d6c8a8]' : 'bg-[#1c1916]'}`} style={cut(5)}>
                      {it.icon}
                      <span className={`absolute bottom-0 left-0 px-1 text-[9px] font-bold tabular-nums ${on ? 'bg-[#1c1916] text-[#e8dcc0]' : 'bg-[#e8c98a] text-[#1c1916]'}`}>{it.owned ? '有' : it.once ? 1 : it.stock}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold">{it.name}</div>
                      <div className={`truncate text-[10.5px] ${on ? 'text-[#4a3f30]' : 'text-[#a99d88]'}`}>{it.desc}</div>
                    </div>
                    {inCart > 0 && <span className={`px-1.5 text-[11px] font-bold ${on ? 'bg-[#1c1916] text-[#e8c98a]' : 'bg-[#e8c98a] text-[#1c1916]'}`} style={cut(3)}>×{inCart}</span>}
                    <span className={`w-16 text-right text-[13px] font-bold tabular-nums ${on ? 'text-[#5a3a20]' : 'text-[#f1d8a3]'}`}>{fmt(it.unit)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 底栏：背得动多少、合计、结账 */}
        <div className="flex items-center gap-4 border-t-2 border-[#e8c98a]/25 bg-[#221e1a] px-5 py-2.5">
          <div className="w-64">
            <div className="flex justify-between text-[11px] text-[#a99d88]"><span>{view.van ? '面包车 + 背包' : '背包'}</span><span className="tabular-nums">{tot.weight} / {view.capacity} 件</span></div>
            <div className="mt-1 h-2 overflow-hidden bg-white/10">
              <div className="h-full transition-all" style={{ width: `${Math.min(100, heavy * 100)}%`, background: heavy > 0.9 ? '#e2553f' : '#e8c98a' }} />
            </div>
          </div>
          <div className="text-sm tabular-nums text-[#cbbfa8]">合计 <span className="text-lg font-bold text-[#f1d8a3]">{fmt(tot.cost)}</span> {coin}</div>
          {err && <div className="text-sm font-bold text-[#ff8f7a]">{err}</div>}
          <div className="ml-auto flex gap-2">
            <button onClick={() => checkout({})} className="bg-[#2f2a24] px-5 py-2 text-sm text-[#cbbfa8] hover:bg-[#3a332b]" style={cut(6)}>不买了，回家</button>
            <button onClick={() => checkout(cart)} disabled={tot.cost === 0} className="bg-[#e8c98a] px-6 py-2 text-sm font-bold tracking-widest text-[#1c1916] hover:bg-[#f1d8a3] disabled:opacity-40" style={{ ...cut(6), fontFamily: SERIF }}>结账回家</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
