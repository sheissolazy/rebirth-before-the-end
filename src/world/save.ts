// 2.5D 原型的自动存档：时钟、存货、防线、每个人的需求和位置、日记、出门的人。
// 打丧尸的时候不存（刷新后从开打前重新来）。
import { FLOOR_H, type Floor } from './layout'
import type { Household, LogEntry } from './residents'
import { TRIPS } from './expedition'
import type { Barriers } from './siege'
import type { Clock, Needs, Stock } from './life'

const PREFIX = (import.meta.env.VITE_SAVE_PREFIX as string | undefined) ?? 'rbte'
const KEY = `${PREFIX}-world-v1`

interface ActorSave {
  name: string
  x: number
  z: number
  floor: Floor
  needs: Needs
  health: number
  away: boolean
  lost: boolean
  runaway: { back: number } | null
  lowMood: number
}

export interface WorldSave {
  v: 1
  clock: Clock
  stock: Stock
  money: number
  ammo: number
  cores: number
  medkits: number
  gateBonus: number
  barriers: Barriers
  nightDone: number
  log: LogEntry[]
  actors: ActorSave[]
  trip: { id: string; members: string[]; back: number } | null
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
    gateBonus: life.gateBonus,
    barriers: { ...life.barriers },
    nightDone: life.nightDone,
    log: [...life.log],
    actors: life.actors.map((a) => ({
      name: a.name, x: a.anchor?.x ?? a.root.position.x, z: a.anchor?.z ?? a.root.position.z, floor: a.anchor?.floor ?? a.floor,
      needs: { ...a.needs }, health: a.health, away: a.away, lost: a.lost, runaway: a.runaway, lowMood: a.lowMood,
    })),
    trip: life.trip ? { id: life.trip.def.id, members: life.trip.members.map((m) => m.name), back: life.trip.back } : null,
  }
}

export function restore(life: Household, s: WorldSave): void {
  life.clock = { ...s.clock }
  life.stock = { ...s.stock }
  life.money = s.money
  life.ammo.n = s.ammo
  life.cores = s.cores
  life.medkits = s.medkits
  life.gateBonus = s.gateBonus
  life.barriers = { ...s.barriers }
  life.nightDone = s.nightDone
  life.log.splice(0, life.log.length, ...s.log)
  for (const as of s.actors) {
    const a = life.actors.find((x) => x.name === as.name)
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
    a.runaway = as.runaway
    a.lowMood = as.lowMood
  }
  if (s.trip) {
    const def = TRIPS.find((t) => t.id === s.trip!.id)
    const members = life.actors.filter((a) => s.trip!.members.includes(a.name))
    if (def && members.length) {
      for (const m of members) m.away = true
      life.trip = { def, members, phase: 'away', back: s.trip.back }
    }
  }
}

export function saveWorld(life: Household): void {
  if (life.siege && !life.siege.done) return
  try { localStorage.setItem(KEY, JSON.stringify(snapshot(life))) } catch { /* 隐私模式或存满了 */ }
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

export function clearWorld(): void {
  try { localStorage.removeItem(KEY) } catch { /* 没关系 */ }
}
