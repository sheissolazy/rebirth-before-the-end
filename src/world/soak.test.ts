// 长跑测试：不渲染，所有系统一起开，跑 10 个游戏日，看会不会崩、卡住、出 NaN。
import { describe, expect, it } from 'vitest'
import { navFloors } from './nav'
import { Actor, Household } from './residents'
import { Zombie } from './siege'
import { Courier, Visitor } from './visitors'
import { DAY_SECONDS } from './life'
import { TRIPS } from './expedition'
import { WORLD } from './layout'

function family() {
  const actors = [
    new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 }),
    new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 }),
    new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 3.8, z: 2.0 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 }),
  ]
  actors[0].weapon = 'shotgun'
  actors[2].weapon = 'crowbar'
  actors[2].handy = true
  return actors
}

describe('长跑', () => {
  for (const [seed, days] of [[1, 10], [2, 10], [3, 10], [4, 30]] as const) {
    it(`所有系统一起跑 ${days} 天（随机种子 ${seed}）`, () => {
      let r = seed * 9301
      const rand = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648 }
      const life = new Household(family(), navFloors('paradise'), 'paradise')
      life.spawnZombie = (at) => new Zombie(at)
      life.spawnVisitor = (def, at) => new Visitor(def, at)
      life.makeActor = (name, _m, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 50, thirst: 50, energy: 60, mood: 55 })
      life.spawnCourier = (who, at) => new Courier(who, at)
      life.guchenMet = true
      let couriers = 0
      let courierSince = -1
      life.speed = 3
      life.stock = { food: 30, water: 30 }
      const dt = 0.1
      const steps = Math.round(((days + 4) * DAY_SECONDS) / dt)
      const goSince = new Map<Actor, number>()
      let t = 0
      let sieges = 0
      let trips = 0
      let visits = 0
      for (let i = 0; i < steps && life.clock.day < days; i++) {
        // 打完丧尸会自动切回 1 倍速，玩家再调回 3 倍
        if (!life.siege && life.speed !== 3) life.speed = 3
        // 玩家的随机操作
        if (life.talking) {
          const def = life.talking
          const ctx = life.visitorCtx()
          const ok = def.choices.filter((c) => !c.need || c.need(ctx))
          life.answerVisitor(ok[Math.floor(rand() * ok.length)].id)
          visits++
        }
        if (i % 500 === 0 && !life.trip) {
          const trip = TRIPS[Math.floor(rand() * TRIPS.length)]
          const who = life.actors.filter((a) => !a.away && !a.lost && !a.runaway && rand() < 0.5)
          if (who.length && life.startTrip(trip.id, who)) trips++
        }
        if (i % 700 === 0) life.moveToSpace(rand() < 0.5 ? 'food' : 'water', rand() < 0.6 ? 1 : -1)
        if (life.siege && !life.siege.done && rand() < 0.002) life.throwMolotov()
        // 偶尔花钱 / 晶核：钉板、院墙、菜地
        if (i % 900 === 0) { life.buildTrap(); if (rand() < 0.3) life.buildWall(); if (rand() < 0.3) life.buildGarden() }
        if (life.report) { sieges++; life.report = null }
        life.tick(dt, (a) => life.isHomeBody(a))
        t += dt * life.speed
        const sim = dt * life.speed
        for (const a of life.actors) { a.follow(sim, 2.2); a.updateSettle(sim) }
        for (const z of life.siege?.zombies ?? []) z.follow(sim, z.speed)
        life.visitor?.follow(sim, 1.7)
        if (life.courier) {
          if (courierSince < 0) { courierSince = t; couriers++ }
          life.courier.follow(sim, 1.8)
          expect(t - courierSince, '送东西的人卡住了').toBeLessThan(DAY_SECONDS / 4)
        } else courierSince = -1
        // 检查
        for (const a of life.actors) {
          for (const v of [...Object.values(a.needs), a.health]) expect(Number.isFinite(v)).toBe(true)
          const p = a.root.position
          expect(p.x >= WORLD.x0 - 1 && p.x <= WORLD.x1 + 1 && p.z >= WORLD.z0 - 1 && p.z <= WORLD.z1 + 1, `${a.name} 走出地图 ${p.x},${p.z}`).toBe(true)
          const going = !!a.task && a.task.phase === 'go'
          if (going && !goSince.has(a)) goSince.set(a, t)
          if (!going) goSince.delete(a)
          if (going) expect(t - goSince.get(a)!, `${a.name} 卡在路上（${a.task?.kind}）`).toBeLessThan(DAY_SECONDS / 8)
        }
        for (const v of [life.stock.food, life.stock.water, life.space.food, life.space.water, life.ammo.n]) {
          expect(Number.isFinite(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(-1e-6)
        }
      }
      expect(life.clock.day).toBeGreaterThanOrEqual(days)
      expect(Number.isFinite(life.trap.hp)).toBe(true)
      console.log(`seed ${seed}: day ${life.clock.day}, sieges ${sieges}, trips ${trips}, visits ${visits}, couriers ${couriers}, residents ${life.residents}, food ${life.stock.food.toFixed(1)}, trap ${life.trap.hp.toFixed(0)}, log ${life.log.length}`)
    }, 60000)
  }
})
