import { describe, expect, it } from 'vitest'
import { navFloors } from './nav'
import { Actor, Household } from './residents'
import { DAY_SECONDS, PROLOGUE_DAYS } from './life'
import { Zombie } from './siege'

/** 不渲染，只跑逻辑：让一家人自己过几天，看看会不会卡住、饿着、不睡觉 */
function simulate(style: 'toon' | 'paradise', days: number) {
  const actors = [
    new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 }),
    new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 }),
    new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 3.8, z: 2.0 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 }),
  ]
  const life = new Household(actors, navFloors(style), style)
  life.speed = 3
  const dt = 0.1
  const steps = Math.round((days * DAY_SECONDS) / (dt * life.speed))
  const stats = actors.map(() => ({ minFood: 100, meals: 0, drinks: 0, sleptUpstairs: 0, minNeed: 100, longestGo: 0, kinds: new Set<string>() }))
  const goSince = actors.map(() => 0)
  const last = actors.map(() => '')
  let t = 0
  for (let i = 0; i < steps; i++) {
    life.tick(dt, (a) => life.isHomeBody(a))
    t += dt * life.speed
    actors.forEach((a, k) => {
      a.follow(dt * life.speed, 2.2)
      a.updateSettle(dt * life.speed)
      const s = stats[k]
      const n = a.needs
      s.minFood = Math.min(s.minFood, n.hunger, n.thirst)
      const lo = Math.min(n.hunger, n.thirst, n.energy)
      if (lo < s.minNeed) { s.minNeed = lo; (s as Record<string, unknown>).at = `${life.clock.day}d${life.clock.hour.toFixed(1)}h ${JSON.stringify(Object.fromEntries(Object.entries(n).map(([q, v]) => [q, Math.round(v)])))} ${key0(a)}` }
      const key = a.task ? `${a.task.kind}:${a.task.phase}` : 'none'
      if (key !== last[k]) {
        if (key === 'eat:use') s.meals++
        if (key === 'drink:use') s.drinks++
        if (key === 'sleep:use' && a.floor === (style === 'paradise' || k < 2 ? 1 : 0)) s.sleptUpstairs++
        if (a.task) s.kinds.add(a.task.kind)
        if (key.endsWith(':go')) goSince[k] = t
        last[k] = key
      }
      if (key.endsWith(':go') && t - goSince[k] > s.longestGo) {
        s.longestGo = t - goSince[k]
        ;(s as Record<string, unknown>).goAt = `${key} ${a.task?.spot?.kind}@${a.task?.spot?.x},${a.task?.spot?.z} f${a.task?.spot?.floor} pos ${a.root.position.toArray().map((v) => v.toFixed(2))} path ${a.path.length} settling ${a.settling}`
      }
    })
  }
  return { life, stats }
}

const key0 = (a: Actor) => (a.task ? `${a.task.kind}:${a.task.phase}` : "none")
describe('一家人自己过日子', () => {
  for (const style of ['paradise', 'toon'] as const) {
    it(`${style}：两天里会吃饭喝水、晚上上楼睡觉，不会卡住`, () => {
      const { life, stats } = simulate(style, 2)
      for (const s of stats) {
        expect(s.meals).toBeGreaterThanOrEqual(5)
        expect(s.drinks).toBeGreaterThanOrEqual(3)
        expect(s.sleptUpstairs).toBeGreaterThanOrEqual(1)
        expect(s.minFood).toBeGreaterThan(20)
        expect(s.minNeed).toBeGreaterThan(8)
        // 走一趟（含上下楼、穿过院子）不超过两个游戏小时，超过就是卡住了
        expect(s.longestGo).toBeLessThan(DAY_SECONDS / 12)
      }
      // 两天、三个人：吃掉大约 4~8 份食物
      expect(12 - life.stock.food).toBeGreaterThan(4.5)
      expect(12 - life.stock.food).toBeLessThan(7.5)
    })
  }
})

/** 丧尸夜：不渲染，直接跑一晚 */
function siegeNight(count: number, crisis: boolean, ammo = 24) {
  const { life } = simulate('paradise', 0)
  life.ammo.n = ammo
  const actors = life.actors
  life.spawnZombie = (at) => new Zombie(at)
  life.clock = { day: PROLOGUE_DAYS, hour: 20.9 }
  life.speed = 1
  const events: string[] = []
  life.onSiege = (e) => { if (e.kind !== 'hit' && e.kind !== 'shot') events.push(e.kind === 'broken' ? `broken:${e.layer}` : e.kind) }
  const dt = 0.05
  let started = false
  for (let i = 0; i < 20000; i++) {
    if (i === 10 && !life.siege) { started = true; life.startSiege(count, crisis) }
    life.tick(dt, () => false)
    for (const a of actors) { a.follow(dt, 2.2); a.updateSettle(dt) }
    for (const z of life.siege?.zombies ?? []) z.follow(dt, 0.95)
    if (life.siege === null && events.includes('end')) break
  }
  return { life, events, started }
}

describe('丧尸夜', () => {
  it('末日前没有丧尸，平时两三只，月底危机夜一大群', () => {
    expect(Household.nightCount({ day: 1, hour: 21 }).count).toBe(0)
    const n = Household.nightCount({ day: PROLOGUE_DAYS, hour: 21 })
    expect(n.count).toBeGreaterThanOrEqual(2)
    expect(n.crisis).toBe(false)
    const c = Household.nightCount({ day: PROLOGUE_DAYS + 3, hour: 21 })
    expect(c.crisis).toBe(true)
    expect(c.count).toBeGreaterThan(8)
  })

  it('三只丧尸：一家人在铁门守住，铁门掉点血，用了几发子弹，捡到晶核', () => {
    const { life, events } = siegeNight(3, false)
    expect(events).toContain('end')
    expect(events.filter((e) => e === 'kill').length).toBe(3)
    expect(events.some((e) => e.startsWith('broken'))).toBe(false)
    expect(life.barriers.gate).toBeLessThan(180)
    expect(life.ammo.n).toBeLessThan(24)
    expect(life.cores).toBe(3)
    expect(life.log.some((l) => l.key === 'world.log.won')).toBe(true)
  })

  it('危机夜一大群、子弹又少：铁门被撞开，一家人退进屋里继续守', () => {
    const { life, events } = siegeNight(14, true, 4)
    expect(events).toContain('broken:gate')
    expect(life.log.some((l) => l.key === 'world.log.broken.gate')).toBe(true)
    expect(events).toContain('end')
    console.log('crisis', events.join(' '), life.barriers, life.actors.map((a) => Math.round(a.health)))
  })

  it('白天爸爸会去把砸坏的铁门修好', () => {
    const { life } = simulate('paradise', 0)
    life.barriers.gate = 40
    life.clock = { day: 1, hour: 9 }
    life.speed = 3
    for (const a of life.actors) a.needs = { hunger: 95, thirst: 95, energy: 95, mood: 95 }
    const dt = 0.1
    for (let i = 0; i < 3000 && life.barriers.gate < 180; i++) {
      life.tick(dt, () => true)
      for (const a of life.actors) { a.follow(dt * 3, 2.2); a.updateSettle(dt * 3) }
    }
    expect(life.barriers.gate).toBe(180)
  })
})
