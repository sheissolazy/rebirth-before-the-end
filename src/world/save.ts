// 2.5D 原型的自动存档：时钟、存货、防线、每个人的需求和位置、日记、出门的人。
// 打丧尸的时候不存（刷新后从开打前重新来）。
import { FLOOR_H, type Floor } from './layout'
import type { Household, LogEntry, Trip } from './residents'
import { TRIPS, tripHours } from './expedition'
import { shopFor } from './shop'
import { PROLOGUE_DAYS } from './life'
import type { Barriers } from './siege'
import type { Clock, Needs, Stock } from './life'

const PREFIX = (import.meta.env.VITE_SAVE_PREFIX as string | undefined) ?? 'rbte'
const KEY = `${PREFIX}-world-v1`
/** 每天早上存的一份"今早"的档，"重过今天"读它 */
const DAY_KEY = `${PREFIX}-world-daystart`

interface ActorSave {
  name: string
  /** 住进来的人用哪个模型、什么特质（原来的三个人不用） */
  model?: string
  trait?: string
  x: number
  z: number
  floor: Floor
  needs: Needs
  health: number
  away: boolean
  lost: boolean
  dead?: boolean
  runaway: { back: number } | null
  lowMood: number
  fitness?: number
  injured?: number
}

export interface WorldSave {
  v: 1
  clock: Clock
  stock: Stock
  money: number
  ammo: number
  cores: number
  medkits: number
  forageDay?: Record<string, number>
  herbs?: number
  bamboo?: number
  spikes?: number[]
  pump?: [number, number]
  fedDay?: number
  /** 网购在路上的单子、今天给谁打过电话、最后一天提醒过没有 */
  orders?: { id: number; cart: Record<string, number>; total: number; arrive: number }[]
  calls?: Record<string, number>
  phoneReminded?: number
  /** 今天请过谁、请的人什么时候到 */
  inviteDay?: number
  /** 今天的菜 */
  menu?: string
  invited?: { id: string; at: number } | null
  /** 干到一半的工程（旧存档是一项 project，新的是 projects） */
  project?: { id: 'trap' | 'wall' | 'garden'; done: number; worker: string } | null
  projects?: { id: 'trap' | 'wall' | 'garden'; done: number; worker: string }[]
  gateBonus: number
  barriers: Barriers
  nightDone: number
  log: LogEntry[]
  actors: ActorSave[]
  trip: { id: string; members: string[]; back: number; van?: boolean } | null
  /** 好几拨人同时在外面（新存档用这个） */
  trips?: { id: string; members: string[]; back: number; van?: boolean; phase?: 'away' | 'shop'; shopAt?: number; shopped?: boolean; cargo?: Record<string, number | boolean>; spent?: number }[]
  seen?: Record<string, number>
  helpedNeighbor?: boolean
  raidTonight?: boolean
  tip?: string | null
  storm?: number
  space?: Stock
  spaceCap?: number
  molotovs?: number
  fuel?: number
  vanKit?: boolean
  vanArmor?: boolean
  laundryOut?: boolean
  laundryDay?: number
  noiseDay?: number
  vanAt?: { x: number; z: number; rot: number } | null
  affection?: Record<string, number>
  warnedJiangye?: boolean
  heroAxe?: boolean
  guchenMet?: boolean
  helmet?: boolean
  xielinNotes?: number
  garden?: { built: boolean; growth: number; watered: number }
  cameoSeen?: boolean
  /** 一天只发生一次的事：暴雨后进水、早上送东西、今天来过访客；街上哪里搜过；今晚少来丧尸 */
  flooded?: number
  careDay?: number
  visitDay?: number
  searched?: Record<string, number>
  fishCaught?: number
  over?: { day: number; hour: number; cause: string } | null
  trap?: number
  kills?: number
  hard?: boolean
  hardHalved?: boolean
  jiangyeHome?: boolean
  shenyanHome?: boolean
  crossbow?: boolean
  medicTomorrow?: number
  lent?: { name: string; back: number } | null
  fewerTonight?: boolean
  wall?: boolean
}

export function snapshot(life: Household): WorldSave {
  return {
    v: 1,
    clock: { ...life.clock },
    stock: { ...life.stock },
    money: life.money,
    ammo: life.ammo.n,
    cores: life.cores,
    medkits: life.medkits,
    forageDay: { ...life.forageDay },
    herbs: life.herbs,
    bamboo: life.bamboo,
    spikes: life.spikes.map((r) => r.hits),
    pump: [life.pumpDay, life.pumpCount],
    fedDay: life.fedDay,
    // 快递小哥还在路上（东西放下时才到账）：这一单存回去，读档后重新送
    orders: [...life.orders, ...(life.courier?.order ? [{ id: 0, cart: life.courier.order.cart, total: 0, arrive: life.absHour }] : [])],
    calls: { ...life.calls },
    phoneReminded: life.phoneReminded,
    inviteDay: life.inviteDay,
    menu: life.menu,
    invited: life.invited,
    projects: life.projects.map((p) => ({ ...p })),
    gateBonus: life.gateBonus,
    barriers: { ...life.barriers },
    nightDone: life.nightDone,
    // 送东西的人还在路上：日志等放下了才写，这时候刷新页面的话先把它记上（东西已经到账了）
    log: life.courier?.pending
      ? [...life.log, { day: life.clock.day, hour: life.clock.hour, key: life.courier.pending.key, vars: life.courier.pending.vars }]
      : [...life.log],
    actors: life.actors.filter((a) => !a.guest).map((a) => ({
      name: a.name, model: a.model, trait: a.trait, x: a.anchor?.x ?? a.root.position.x, z: a.anchor?.z ?? a.root.position.z, floor: a.anchor?.floor ?? a.floor,
      needs: { ...a.needs }, health: a.health, away: a.away, lost: a.lost, dead: a.dead, runaway: a.runaway, lowMood: a.lowMood, fitness: a.fitness, injured: a.injured,
    })),
    trip: null,
    trips: life.trips.map((t) => ({ id: t.def.id, members: t.members.map((m) => m.name), back: t.back, van: t.van, phase: t.phase === 'shop' ? 'shop' as const : 'away' as const, shopAt: t.shopAt, shopped: t.shopped, cargo: t.cargo as Record<string, number | boolean> | undefined, spent: t.spent })),
    seen: { ...life.seen },
    helpedNeighbor: life.helpedNeighbor,
    raidTonight: life.raidTonight,
    tip: life.tip,
    storm: life.storm,
    space: { ...life.space },
    spaceCap: life.spaceCap,
    molotovs: life.molotovs,
    fuel: life.fuel,
    vanKit: life.vanKit,
    vanArmor: life.vanArmor,
    laundryOut: life.laundryOut,
    laundryDay: life.laundryDay,
    noiseDay: life.noiseDay,
    vanAt: life.vanAt,
    affection: { ...life.affection },
    warnedJiangye: life.warnedJiangye,
    heroAxe: life.actors[0]?.sidearm === 'axe',
    guchenMet: life.guchenMet,
    helmet: life.helmet,
    xielinNotes: life.xielinNotes,
    garden: { ...life.garden },
    cameoSeen: life.cameoSeen,
    flooded: life.flooded,
    careDay: life.careDay,
    visitDay: life.visitDay,
    searched: { ...life.searched },
    fishCaught: life.fishCaught,
    over: life.over,
    trap: life.trap.hp,
    kills: life.kills,
    hard: life.hard,
    hardHalved: life.hardHalved,
    jiangyeHome: life.jiangyeHome,
    shenyanHome: life.shenyanHome,
    crossbow: life.crossbow,
    medicTomorrow: life.medicTomorrow,
    lent: life.lent,
    fewerTonight: life.fewerTonight,
    wall: life.wall,
  }
}

export function restore(life: Household, s: WorldSave): void {
  life.clock = { ...s.clock }
  life.stock = { ...s.stock }
  life.money = s.money
  life.ammo.n = s.ammo
  life.cores = s.cores
  life.medkits = s.medkits
  life.forageDay = { ...(s.forageDay ?? {}) }
  life.herbs = s.herbs ?? 0
  life.bamboo = s.bamboo ?? 0
  if (s.pump) { life.pumpDay = s.pump[0]; life.pumpCount = s.pump[1] }
  life.fedDay = s.fedDay ?? -1
  life.orders = (s.orders ?? []).map((o) => ({ ...o, cart: { ...o.cart } }))
  life.calls = { ...(s.calls ?? {}) }
  life.phoneReminded = s.phoneReminded ?? -1
  life.inviteDay = s.inviteDay ?? -1
  life.menu = s.menu ?? 'rice'
  life.invited = s.invited ?? null
  life.projects = (s.projects ?? (s.project ? [s.project] : [])).map((p) => ({ ...p }))
  ;(s.spikes ?? []).forEach((h, k) => { if (life.spikes[k]) life.spikes[k].hits = h })
  life.gateBonus = s.gateBonus
  life.barriers = { ...s.barriers }
  life.nightDone = s.nightDone
  life.log.splice(0, life.log.length, ...s.log)
  life.seen = { ...(s.seen ?? {}) }
  life.helpedNeighbor = !!s.helpedNeighbor
  life.raidTonight = !!s.raidTonight
  life.tip = s.tip ?? null
  life.storm = s.storm ?? -1
  life.space = { ...(s.space ?? { food: 0, water: 0 }) }
  life.spaceCap = s.spaceCap ?? 6
  life.molotovs = s.molotovs ?? 2
  life.fuel = s.fuel ?? 3
  life.vanKit = !!s.vanKit
  life.vanArmor = !!s.vanArmor
  life.laundryOut = !!s.laundryOut
  life.laundryDay = s.laundryDay ?? -1
  life.noiseDay = s.noiseDay ?? -1
  life.vanAt = s.vanAt ?? null
  life.affection = { jiangye: 40, guchen: 0, shenyan: 0, xielin: 0, neighbor: 20, ...(s.affection ?? {}) }
  life.xielinNotes = s.xielinNotes ?? 0
  if (s.garden) life.garden = { ...s.garden }
  life.cameoSeen = !!s.cameoSeen
  life.flooded = s.flooded ?? -1
  life.careDay = s.careDay ?? -1
  life.visitDay = s.visitDay ?? -1
  life.searched = { ...(s.searched ?? {}) }
  life.fishCaught = s.fishCaught ?? 0
  life.over = s.over ?? null
  if (life.over) { life.actors[0].pose = 'down'; life.speed = 0 }
  life.trap.hp = s.trap ?? 0
  life.kills = s.kills ?? 0
  life.hard = !!s.hard
  life.hardHalved = !!s.hardHalved
  life.jiangyeHome = !!s.jiangyeHome
  life.shenyanHome = !!s.shenyanHome
  life.crossbow = !!s.crossbow
  life.medicTomorrow = s.medicTomorrow ?? -1
  life.lent = s.lent ?? null
  life.fewerTonight = !!s.fewerTonight
  life.wall = !!s.wall
  life.guchenMet = !!s.guchenMet
  life.helmet = !!s.helmet
  if (life.helmet && life.actors[0]) life.actors[0].helmet = true
  life.warnedJiangye = !!s.warnedJiangye
  if (s.heroAxe && life.actors[0]) life.actors[0].sidearm = 'axe'
  for (const as of s.actors) {
    let a = life.actors.find((x) => x.name === as.name)
    // 后来住进来的人：重新请进门
    if (!a && as.model) a = life.addResident(as.name, as.model, { x: as.x, z: as.z }, as.trait) ?? undefined
    if (!a) continue
    // 存档时可能坐在沙发里（家具占的格子），挪到最近能站的地方
    const nav = life.navs[as.floor]
    const cell = nav.nearestFree(as.x, as.z)
    const p = cell ? nav.centerOf(cell[0], cell[1]) : { x: as.x, z: as.z }
    const exact = !nav.isBlockedAt(as.x, as.z)
    a.root.position.set(exact ? as.x : p.x, as.floor * FLOOR_H, exact ? as.z : p.z)
    a.floor = as.floor
    a.needs = { ...as.needs }
    a.health = as.health
    a.away = as.away || as.lost || !!as.runaway
    a.lost = as.lost
    a.dead = !!as.dead
    a.runaway = as.runaway
    a.lowMood = as.lowMood
    if (as.fitness !== undefined) a.fitness = as.fitness
    a.injured = as.injured ?? 0
  }
  // 在外面的几拨人（老存档只有一拨）
  life.trips = []
  for (const st of s.trips ?? (s.trip ? [s.trip] : [])) {
    const def = TRIPS.find((t) => t.id === st.id)
    const members = life.actors.filter((a) => st.members.includes(a.name))
    if (!def || !members.length) continue
    for (const m of members) m.away = true
    const x = st as NonNullable<WorldSave['trips']>[number]
    // 存档时正走去店里的（还没定到店时间）：照出发时的来回时间补上，不然会跳过店、白拿东西
    const shopAt = x.shopAt ?? (shopFor(def.id, life.clock.day < PROLOGUE_DAYS) && !x.shopped ? st.back - tripHours(def, !!st.van) / 2 : undefined)
    life.trips.push({
      id: life.nextTripId(), def, members, phase: x.phase ?? 'away', back: st.back, van: st.van,
      shopAt, shopped: x.shopped, cargo: x.cargo as Trip['cargo'], spent: x.spent,
    })
    // 开车出去的：车也不在家（回来时从街口开进来）
    if (st.van) life.vanAway = true
  }
  // 弩：等每个人的生死都恢复好了再交到手上（不然会交给已经去世的爸爸）
  life.equipCrossbow()
}

export function saveWorld(life: Household): void {
  if (life.siege && !life.siege.done) return
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot(life)))
  } catch { /* 隐私模式或存满了 */ }
}

export function loadWorld(life: Household): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return false
    const s = JSON.parse(raw) as WorldSave
    if (s.v !== 1) return false
    restore(life, s)
    return true
  } catch {
    return false
  }
}

/** 存一份"今早"的档（打丧尸的时候不存） */
export function saveDayStart(life: Household): void {
  if (life.siege && !life.siege.done) return
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify(snapshot(life)))
  } catch { /* 没关系 */ }
}

/** "今早"那份档是几点存的；没有就是 null */
export function dayStartClock(): Clock | null {
  try {
    const raw = localStorage.getItem(DAY_KEY)
    return raw ? (JSON.parse(raw) as WorldSave).clock : null
  } catch {
    return null
  }
}

/** 重过今天：把"今早"的档拷成当前存档，刷新后就从今早开始 */
export function rewindToDayStart(): boolean {
  try {
    const raw = localStorage.getItem(DAY_KEY)
    if (!raw) return false
    localStorage.setItem(KEY, raw)
    return true
  } catch {
    return false
  }
}

export function clearWorld(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(DAY_KEY)
    // 清档重来 / 进入下一世：这一局死了还能再拿重生点
    localStorage.removeItem(`${PREFIX}-awarded`)
  } catch { /* 没关系 */ }
}

const LIVES = `${PREFIX}-lives`

/** 现在是第几世（女主每死一次 +1；清档重来不算） */
export function currentLife(): number {
  try { return Math.max(1, Number(localStorage.getItem(LIVES)) || 1) } catch { return 1 }
}

// --- 重生点（设计文档 §14 的第一版）：女主死了按撑过的天数和打倒的丧尸得点，买下一世的开局加成 ---

const POINTS = `${PREFIX}-points`
const PERKS = `${PREFIX}-perks`
const AWARDED = `${PREFIX}-awarded`

export const PERK_DEFS = [
  { id: 'money', cost: 2 },
  { id: 'ammo', cost: 2 },
  { id: 'medkit', cost: 1 },
  { id: 'space', cost: 3 },
  { id: 'jiangye', cost: 2 },
  // 设计文档：带一件装备到下一世
  { id: 'bow', cost: 3 },
] as const
export type PerkId = (typeof PERK_DEFS)[number]['id']

const read = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* 没关系 */ } }

export function rebirthPoints(): number {
  return Math.max(0, Number(read(POINTS)) || 0)
}

/** 这一世的重生点（同一世只发一次，刷新页面不会重复拿）；返回这一世实际拿到的点数 */
export function awardRebirthPoints(n: number): number {
  const life = String(currentLife())
  const [was, got] = (read(AWARDED) ?? '').split(':')
  if (was === life) return Number(got) || 0
  write(AWARDED, `${life}:${n}`)
  write(POINTS, String(rebirthPoints() + n))
  return n
}

const HARD = `${PREFIX}-hard`
/** 困难模式是一个设置：换存档、进入下一世都保留 */
export function hardPref(): boolean {
  return read(HARD) === '1'
}
export function setHardPref(on: boolean): void {
  write(HARD, on ? '1' : '0')
}

export function boughtPerks(): PerkId[] {
  try { return JSON.parse(read(PERKS) ?? '[]') as PerkId[] } catch { return [] }
}

/** 买 / 退一个加成（每样只能买一次） */
export function togglePerk(id: PerkId): void {
  const def = PERK_DEFS.find((p) => p.id === id)
  if (!def) return
  const have = boughtPerks()
  if (have.includes(id)) {
    write(PERKS, JSON.stringify(have.filter((p) => p !== id)))
    write(POINTS, String(rebirthPoints() + def.cost))
  } else if (rebirthPoints() >= def.cost) {
    write(PERKS, JSON.stringify([...have, id]))
    write(POINTS, String(rebirthPoints() - def.cost))
  }
}

const USED = `${PREFIX}-perks-used`

/** 新开局：用掉买好的加成。马上从商店清掉、记到这一世名下；
 *  同一世再开局（开发模式建两次世界、第一次存档前刷新页面）就重用同一份，不会丢也不会用两次 */
export function applyPerks(life: Household): PerkId[] {
  const thisLife = currentLife()
  let have: PerkId[]
  try {
    const used = JSON.parse(read(USED) ?? 'null') as { life: number; list: PerkId[] } | null
    if (used && used.life === thisLife) have = used.list
    else {
      have = boughtPerks()
      write(USED, JSON.stringify({ life: thisLife, list: have }))
      write(PERKS, '[]')
    }
  } catch { have = [] }
  for (const id of have) {
    if (id === 'money') life.money += 5000
    else if (id === 'ammo') life.ammo.n += 12
    else if (id === 'medkit') life.medkits += 2
    else if (id === 'space') life.spaceCap += 4
    else if (id === 'jiangye') life.affection.jiangye = Math.min(100, (life.affection.jiangye ?? 0) + 20)
    else if (id === 'bow') { life.crossbow = true; life.equipCrossbow() }
  }
  return have
}

const LAST_DEATH = `${PREFIX}-last-death`

/** 上一世是怎么死的（日记里写） */
export function lastDeath(): { days: number; cause: string } | null {
  try { return JSON.parse(read(LAST_DEATH) ?? 'null') as { days: number; cause: string } | null } catch { return null }
}

/** 女主死了：记下这一世的结局，进入下一世（删掉这一世的存档） */
export function recordDeath(days: number, cause: string): void {
  write(LAST_DEATH, JSON.stringify({ days, cause }))
}

/** 女主死了：进入下一世（删掉这一世的存档） */
export function nextLife(): void {
  try { localStorage.setItem(LIVES, String(currentLife() + 1)) } catch { /* 没关系 */ }
  clearWorld()
}
