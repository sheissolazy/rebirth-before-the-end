// 出门采购：到了店里弹出交易界面，自己挑要买什么。末日前花钱；末日后只有军区基地还在"做生意"，收晶核。
// 价格越接近末日越贵（大家开始抢购）；能带回来多少看去了几个人、开没开车。
import type { TripStock } from './expedition'

export type ShopCat = 'food' | 'water' | 'med' | 'defense' | 'other'

export interface ShopItem {
  id: string
  name: string
  icon: string
  cat: ShopCat
  desc: string
  /** 单价（元；军区收晶核） */
  price: number
  /** 一份占几"件"（背包 / 后备厢的格子） */
  weight: number
  /** 这家店一趟最多卖几份 */
  stock: number
  /** 买一份得到什么 */
  give: Partial<TripStock> & { gate?: number; trap?: number; bamboo?: number; crossbow?: boolean; helmet?: boolean }
  /** 只能买一次（家里有了就不卖了） */
  once?: boolean
}

/** 店里收的东西（卖给店家）：一次卖一"份"（lot 个单位），换 price 钱或晶核 */
export interface SellItem {
  key: 'food' | 'water' | 'medkits' | 'ammo' | 'fuel' | 'molotovs'
  name: string
  icon: string
  /** 一份是多少（吃的喝的按"份"，子弹按发……） */
  lot: number
  price: number
  desc: string
}

export interface ShopDef {
  /** 和 TRIPS 的 id 一样 */
  id: string
  currency: 'money' | 'cores'
  /** 末日前 / 末日后开不开门 */
  phase: 'prologue' | 'apocalypse'
  items: ShopItem[]
  /** 这家店收什么 */
  buys?: SellItem[]
}

export const SHOPS: ShopDef[] = [
  {
    id: 'supermarket', currency: 'money', phase: 'prologue', items: [
      { id: 'rice', name: '大米（10 斤一袋）', icon: '🌾', cat: 'food', desc: '一袋够一个人吃三天。生米放得住，就是费水费柴。', price: 150, weight: 2, stock: 12, give: { food: 3 } },
      { id: 'noodles', name: '方便面（一箱）', icon: '🍜', cat: 'food', desc: '泡一泡就能吃，停气停电也不怕。', price: 90, weight: 1, stock: 10, give: { food: 1.5 } },
      { id: 'cans', name: '肉罐头（一箱）', icon: '🥫', cat: 'food', desc: '放几年都不坏，还顶饿，末日后最硬的硬通货。', price: 180, weight: 1, stock: 8, give: { food: 2 } },
      { id: 'water', name: '矿泉水（一箱 24 瓶）', icon: '💧', cat: 'water', desc: '一箱够一个人喝两天。', price: 60, weight: 2, stock: 15, give: { water: 2 } },
      { id: 'barrel', name: '桶装水（18.9 升）', icon: '🛢️', cat: 'water', desc: '重，但一桶顶一箱半。', price: 80, weight: 3, stock: 10, give: { water: 3 } },
    ],
  },
  {
    id: 'pharmacy', currency: 'money', phase: 'prologue', items: [
      { id: 'medkit', name: '急救包', icon: '🩹', cat: 'med', desc: '纱布、碘伏、止血带。打丧尸受了伤，能把倒下的人救起来。', price: 450, weight: 1, stock: 4, give: { medkits: 1 } },
      { id: 'medbox', name: '家庭药箱', icon: '💊', cat: 'med', desc: '抗生素、退烧药、止泻药，顶两个急救包。疫病那个月用得上。', price: 820, weight: 1, stock: 2, give: { medkits: 2 } },
      { id: 'tablets', name: '净水片（一盒）', icon: '🧪', cat: 'water', desc: '一片能让一桶江水能喝。轻，占地方小。', price: 120, weight: 1, stock: 4, give: { water: 2 } },
    ],
  },
  {
    id: 'hardware', currency: 'money', phase: 'prologue', items: [
      { id: 'plate', name: '钢板和角铁', icon: '🔩', cat: 'defense', desc: '焊在铁门上，铁门能多扛 30 下。', price: 800, weight: 3, stock: 3, give: { gate: 30 } },
      { id: 'wire', name: '钉板和铁丝网', icon: '🪤', cat: 'defense', desc: '铺在铁门外面，丧尸踩上去走得慢、掉血。', price: 1200, weight: 2, stock: 1, give: { trap: 100 } },
      { id: 'bottles', name: '汽油瓶和布条', icon: '🔥', cat: 'defense', desc: '回家灌上油就是两个燃烧瓶。', price: 300, weight: 1, stock: 4, give: { molotovs: 2 } },
      { id: 'bamboo', name: '一捆竹竿', icon: '🎋', cat: 'defense', desc: '三根，爸爸能削成一排竹尖刺。', price: 200, weight: 2, stock: 3, give: { bamboo: 3 } },
      { id: 'crossbow', name: '复合弩', icon: '🏹', cat: 'defense', desc: '没声音，箭能捡回来再用，给爸爸用正合适。', price: 1500, weight: 2, stock: 1, give: { crossbow: true }, once: true },
    ],
  },
  {
    id: 'gasstation', currency: 'money', phase: 'prologue', items: [
      { id: 'fuel', name: '汽油（一桶）', icon: '⛽', cat: 'other', desc: '面包车出门一趟烧 0.2 桶，一桶能跑五趟。', price: 70, weight: 2, stock: 8, give: { fuel: 1 } },
      { id: 'snacks', name: '便利店零食', icon: '🍫', cat: 'food', desc: '小鱼店里的饼干、巧克力，嘴甜的小鱼还会多塞两包。', price: 80, weight: 1, stock: 6, give: { food: 1 } },
    ],
  },
  {
    id: 'blackmarket', currency: 'money', phase: 'prologue',
    buys: [
      { key: 'medkits', name: '急救包', icon: '🩹', lot: 1, price: 320, desc: '黑市收急救包，比药店卖的便宜一截。' },
      { key: 'fuel', name: '汽油', icon: '⛽', lot: 1, price: 50, desc: '一桶（比加油站卖的便宜，倒卖不划算）。' },
      { key: 'molotovs', name: '燃烧瓶', icon: '🍾', lot: 1, price: 250, desc: '有人专门收这个。' },
    ],
    items: [
      { id: 'shells', name: '霰弹（一盒 6 发）', icon: '🔫', cat: 'defense', desc: '猎枪子弹。末日后子弹比命还金贵。', price: 900, weight: 1, stock: 6, give: { ammo: 6 } },
      { id: 'helmet', name: '防暴头盔', icon: '⛑️', cat: 'defense', desc: '被咬的时候少掉一半血。', price: 2000, weight: 2, stock: 1, give: { helmet: true }, once: true },
      { id: 'molotov', name: '现成的燃烧瓶', icon: '🍾', cat: 'defense', desc: '比自己灌的贵，但拿回家就能扔。', price: 400, weight: 1, stock: 4, give: { molotovs: 1 } },
    ],
  },
  {
    id: 'armygate', currency: 'cores', phase: 'apocalypse',
    // 军区什么都缺：吃的喝的药都收，换晶核
    buys: [
      { key: 'food', name: '吃的', icon: '🍚', lot: 3, price: 1, desc: '三份吃的换一颗晶核。军区人多，吃的永远不够。' },
      { key: 'water', name: '水', icon: '💧', lot: 3, price: 1, desc: '三份水换一颗晶核。' },
      { key: 'medkits', name: '急救包', icon: '🩹', lot: 1, price: 1, desc: '一个急救包换一颗晶核。' },
      { key: 'fuel', name: '汽油', icon: '⛽', lot: 1, price: 1, desc: '军车要油，一桶换一颗。' },
    ],
    items: [
      { id: 'army_ammo', name: '制式霰弹（6 发）', icon: '🔫', cat: 'defense', desc: '军区仓库里的，一箱一箱码着。', price: 2, weight: 1, stock: 6, give: { ammo: 6 } },
      { id: 'army_med', name: '军用急救包', icon: '🩹', cat: 'med', desc: '比药店的好，止血粉一撒就住。', price: 2, weight: 1, stock: 3, give: { medkits: 1 } },
      { id: 'army_food', name: '压缩饼干（一箱）', icon: '🍪', cat: 'food', desc: '一块顶一顿，难吃，但管饱。', price: 1, weight: 1, stock: 8, give: { food: 3 } },
      { id: 'army_water', name: '净化水（一桶）', icon: '💧', cat: 'water', desc: '军区自己的净水站打的。', price: 1, weight: 3, stock: 8, give: { water: 3 } },
    ],
  },
]

export function shopFor(id: string, prologue: boolean): ShopDef | null {
  const s = SHOPS.find((x) => x.id === id)
  if (!s) return null
  return (s.phase === 'prologue') === prologue ? s : null
}

/** 末日前一天比一天贵：第 1 天原价，越往后越多人抢，最后一天涨到 1.6 倍（晶核不涨） */
export function priceOf(item: ShopItem, shop: ShopDef, day: number): number {
  if (shop.currency === 'cores') return item.price
  const k = [1, 1.1, 1.3, 1.6][Math.max(0, Math.min(3, day))] ?? 1.6
  return Math.round((item.price * k) / 10) * 10
}

/** 能带回来几件：一个人背 6 件，开面包车再多 24 件 */
export function capacity(people: number, van: boolean): number {
  return people * 6 + (van ? 24 : 0)
}

export type Cart = Record<string, number>
/** 卖掉几份（按 SellItem.key） */
export type SellCart = Partial<Record<SellItem['key'], number>>

/** 卖东西换回多少钱 / 晶核 */
export function sellTotal(shop: ShopDef, sell: SellCart): number {
  return (shop.buys ?? []).reduce((sum, b) => sum + (sell[b.key] ?? 0) * b.price, 0)
}

export function cartTotal(shop: ShopDef, cart: Cart, day: number): { cost: number; weight: number } {
  let cost = 0
  let weight = 0
  for (const it of shop.items) {
    const n = cart[it.id] ?? 0
    cost += n * priceOf(it, shop, day)
    weight += n * it.weight
  }
  return { cost, weight }
}

/** 买到的东西加在一起（带回家时一次结算） */
export function cartGives(shop: ShopDef, cart: Cart): ShopItem['give'] {
  const out: Record<string, number | boolean> = {}
  for (const it of shop.items) {
    const n = cart[it.id] ?? 0
    if (!n) continue
    for (const [k, v] of Object.entries(it.give)) {
      if (typeof v === 'boolean') out[k] = v
      else out[k] = ((out[k] as number | undefined) ?? 0) + v * n
    }
  }
  return out as ShopItem['give']
}

export interface HomeSnapshot {
  food: number
  water: number
  medkits: number
  ammo: number
  fuel: number
  molotovs?: number
  /** 家里几口人 */
  people: number
  /** 离末日还有几天（末日后是 0） */
  daysToDoom: number
  gateBonus: number
  trap: boolean
  crossbow: boolean
}

/** 交易界面左边的提示：家里缺什么、买完以后够几天 */
export function shopHints(h: HomeSnapshot, gives: ShopItem['give']): { text: string; level: 'bad' | 'warn' | 'ok' }[] {
  const out: { text: string; level: 'bad' | 'warn' | 'ok' }[] = []
  const food = h.food + (gives.food ?? 0)
  const water = h.water + (gives.water ?? 0)
  const days = (v: number) => Math.floor(v / Math.max(1, h.people))
  const fd = days(food)
  const wd = days(water)
  if (wd < 5) out.push({ text: `水只够 ${wd} 天。人三天不喝水就没命，先买水。`, level: 'bad' })
  else if (wd < 15) out.push({ text: `水够 ${wd} 天，前世第一个月就停水了，还得多囤。`, level: 'warn' })
  if (fd < 5) out.push({ text: `吃的只够 ${fd} 天，米和罐头最划算。`, level: 'bad' })
  else if (fd < 15) out.push({ text: `吃的够 ${fd} 天，罐头放得最久。`, level: 'warn' })
  const med = h.medkits + (gives.medkits ?? 0)
  if (med < 2) out.push({ text: `急救包只有 ${med} 个：打丧尸有人倒下，没有急救包就救不回来。`, level: med === 0 ? 'bad' : 'warn' })
  const ammo = h.ammo + (gives.ammo ?? 0)
  if (ammo < 12 && h.daysToDoom <= 1) out.push({ text: `子弹只有 ${ammo} 发，第一个月的尸潮要 12 发以上才守得住。`, level: 'warn' })
  if (!h.trap && !gives.trap && h.daysToDoom > 0) out.push({ text: '铁门外还没铺钉板，五金店有卖。', level: 'warn' })
  if ((h.fuel + (gives.fuel ?? 0)) < 2) out.push({ text: '汽油不到两桶，面包车跑不了几趟。', level: 'warn' })
  if (h.daysToDoom === 1) out.push({ text: '明天就是末日了。钱留着也没用，能买的都买了吧。', level: 'warn' })
  if (!out.length) out.push({ text: `吃的够 ${fd} 天、水够 ${wd} 天，家底挺厚了。`, level: 'ok' })
  return out
}

// --- 网购（手机）-----------------------------------------------------------------
// 末日前在手机上下单，第二天上午快递小哥送到铁门外。比去店里贵一点、还要运费，但不用派人跑一趟，也没有背不动的问题。
// 末日前一天下单就赶不上了（第二天就是末日，快递停运）；末日后手机没信号。

/** 每单运费（元） */
export const ONLINE_FEE = 30
/** 比店里贵多少 */
export const ONLINE_MARKUP = 1.15
/** 第二天几点送到 */
export const DELIVERY_HOUR = 10

const pick = (ids: string[]) => ids.map((id) => {
  const it = SHOPS.flatMap((s) => s.items).find((x) => x.id === id)
  if (!it) throw new Error(`网购找不到 ${id}`)
  return { ...it, price: Math.round((it.price * ONLINE_MARKUP) / 10) * 10 }
})

/** 网上能买的（当成一家"店"，价格已经含加价；一样跟着末日临近涨价） */
export const ONLINE_SHOP: ShopDef = {
  id: 'online', currency: 'money', phase: 'prologue',
  items: pick(['rice', 'noodles', 'cans', 'snacks', 'water', 'barrel', 'medkit', 'medbox', 'tablets', 'bamboo', 'bottles', 'wire']),
}

/** 一单多少钱（含运费） */
export function orderTotal(cart: Cart, day: number): number {
  const { cost } = cartTotal(ONLINE_SHOP, cart, day)
  return cost > 0 ? cost + ONLINE_FEE : 0
}

/** "大米×2、矿泉水×3"（日记、手机里显示） */
export function cartLabel(shop: ShopDef, cart: Cart): string {
  return shop.items.filter((it) => (cart[it.id] ?? 0) > 0).map((it) => `${it.name.replace(/（.*?）/g, '')}×${cart[it.id]}`).join('、')
}
