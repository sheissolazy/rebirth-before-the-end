import { describe, expect, it } from 'vitest'
import { navFloors } from './nav'
import { Actor, Household } from './residents'
import { DAY_SECONDS, PROLOGUE_DAYS } from './life'
import { Zombie } from './siege'
import { restore, snapshot } from './save'
import { VISITORS, Visitor } from './visitors'

/** 不渲染，只跑逻辑：让一家人自己过几天，看看会不会卡住、饿着、不睡觉 */
function simulate(style: 'toon' | 'paradise', days: number) {
  const actors = [
    new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 }),
    new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 }),
    new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 3.8, z: 2.0 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 }),
  ]
  // 和 World 里一样：女主拿枪，妈妈擀面杖，爸爸撬棍、会修门
  actors[0].weapon = 'shotgun'
  actors[2].weapon = 'crowbar'
  actors[2].handy = true
  const life = new Household(actors, navFloors(style), style)
  life.speed = 3
  const dt = 0.1
  const steps = Math.round((days * DAY_SECONDS) / (dt * life.speed))
  const stats = actors.map(() => ({ chats: 0, minFood: 100, meals: 0, drinks: 0, sleptUpstairs: 0, minNeed: 100, longestGo: 0, kinds: new Set<string>() }))
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
      if (a.chatting) s.chats++
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
        expect(s.chats).toBeGreaterThan(0) // 饭桌上会聊天
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

  it('三只丧尸：一家人在铁门守住，用了几发子弹，捡到晶核', () => {
    const { life, events } = siegeNight(3, false)
    expect(events).toContain('end')
    expect(events.filter((e) => e === 'kill').length).toBe(3)
    expect(events.some((e) => e.startsWith('broken'))).toBe(false)
    // 铁门挨了砸，或者守门的人被抓伤
    expect(life.barriers.gate < 180 || life.actors.some((a) => a.health < 100)).toBe(true)
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

describe('出门', () => {
  function run(life: Household, hours: number) {
    const dt = 0.1
    const steps = (hours * DAY_SECONDS) / 24 / (dt * life.speed)
    let sawAway = false
    for (let i = 0; i < steps; i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      if (life.actors.some((a) => a.away)) sawAway = true
    }
    return sawAway
  }

  it('末日前派两个人去超市：真的走出去、消失、几个小时后扛着吃的回来，钱扣掉', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 9 }
    life.speed = 3
    const [hero, mom] = life.actors
    expect(life.tripCheck('supermarket')).toBe('ok')
    expect(life.startTrip('supermarket', [hero, mom])).toBe(true)
    expect(life.money).toBe(18000 - 1200)
    const food0 = life.stock.food
    const sawAway = run(life, 4.5)
    expect(sawAway).toBe(true)
    expect(life.trip).toBeNull()
    expect(life.stock.food).toBeGreaterThan(food0 + 5)
    expect(hero.away || mom.away).toBe(false)
    expect(life.log.some((l) => l.key === 'world.trip.supermarket')).toBe(true)
  })

  it('天黑前回不来就不让出门；末日后不能去超市买东西', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 17.5 }
    expect(life.tripCheck('supermarket')).toBe('late')
    life.clock = { day: PROLOGUE_DAYS, hour: 9 }
    expect(life.tripCheck('supermarket')).toBe('phase')
    expect(life.tripCheck('river')).toBe('ok')
  })

  it('五金店加固铁门：耐久上限变高', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 8 }
    life.speed = 3
    life.startTrip('hardware', [life.actors[2]])
    run(life, 5)
    expect(life.maxOf('gate')).toBe(240)
    expect(life.barriers.gate).toBe(240)
  })
})

describe('需求归零的后果', () => {
  it('家里断粮断水：饿着渴着掉健康，熬久了有人抑郁离家出走（女主不会走）', () => {
    const { life } = simulate('paradise', 0)
    life.stock = { food: 0, water: 0 }
    life.clock = { day: 0, hour: 8 }
    life.speed = 3
    for (const a of life.actors) a.needs = { hunger: 10, thirst: 10, energy: 60, mood: 30 }
    const dt = 0.1
    for (let i = 0; i < (3 * DAY_SECONDS) / (dt * 3); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * 3, 2.2); a.updateSettle(dt * 3) }
    }
    const keys = life.log.map((l) => l.key)
    expect(keys).toContain('world.log.thirsty')
    expect(keys).toContain('world.log.runaway')
    expect(life.actors[0].runaway).toBeNull()
    expect(life.actors[0].lost).toBe(false)
    expect(life.actors.slice(1).some((a) => a.runaway || a.lost)).toBe(true)
  })
})

describe('存档', () => {
  it('存了再读：时钟、存货、防线、每个人的需求和日记都还在', () => {
    const a = simulate('paradise', 0.3).life
    a.money = 12345
    a.barriers.gate = 77
    a.actors[1].needs.mood = 33
    a.log.push({ day: 1, hour: 2, key: 'world.log.won', vars: { kills: 2 } })
    const s = snapshot(a)
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(s)))
    expect(b.clock).toEqual(a.clock)
    expect(b.money).toBe(12345)
    expect(b.barriers.gate).toBe(77)
    expect(b.actors[1].needs.mood).toBe(33)
    expect(b.log.at(-1)?.key).toBe('world.log.won')
    for (const p of b.actors) expect(b.navs[p.floor].isBlockedAt(p.root.position.x, p.root.position.z)).toBe(false)
  })
})

describe('调整守位', () => {
  it('把妈妈换到后排，女主就去她原来贴门的位置', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS, hour: 21.1 }
    life.startSiege(2, false)
    const s = life.siege!
    const [hero, mom] = life.actors
    expect(s.post(hero)).toBe(0)
    const momPost = s.post(mom)
    s.assign(mom, 0)
    expect(s.post(mom)).toBe(0)
    expect(s.post(hero)).toBe(momPost)
  })
})

describe('战报', () => {
  it('打完一晚有战报：打倒几只、用了几发子弹', () => {
    const { life, events } = siegeNight(3, false)
    expect(events).toContain('end')
    expect(life.report?.won).toBe(true)
    expect(life.report?.kills).toBe(3)
    expect(life.report?.ammo).toBeGreaterThan(0)
  })
})

describe('来敲门的人', () => {
  function tickUntil(life: Household, cond: () => boolean, max = 4000) {
    const dt = 0.05
    for (let i = 0; i < max && !cond(); i++) {
      life.tick(dt, () => false)
      if (life.visitor) life.visitor.follow(dt * life.speed, 1.7)
      for (const z of life.siege?.zombies ?? []) z.follow(dt * life.speed, z.speed)
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
  }

  it('王阿姨走到门口敲门，借她米：少一份吃的，末日后她会回礼', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: 1, hour: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'neighbor_rice')!)
    tickUntil(life, () => !!life.talking)
    expect(life.talking?.id).toBe('neighbor_rice')
    const food = life.stock.food
    life.answerVisitor('give')
    expect(life.stock.food).toBeCloseTo(food - 1)
    expect(life.helpedNeighbor).toBe(true)
    tickUntil(life, () => !life.visitor)
    expect(life.visitor).toBeNull()
  })

  it('拒绝黑鸦：当晚来的是黑鸦的人，打倒一大半剩下的就跑，身上搜出子弹', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.spawnZombie = (at) => new Zombie(at)
    const kinds: string[] = []
    life.onSiege = (e) => { if (e.kind === 'start') kinds.push(e.raid ? 'raid' : 'zombies'); if (e.kind === 'end') kinds.push(e.won ? 'won' : 'lost') }
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 12 }
    life.startVisit(VISITORS.find((v) => v.id === 'crow_tax')!)
    tickUntil(life, () => !!life.talking)
    life.answerVisitor('refuse')
    expect(life.raidTonight).toBe(true)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 20.95 }
    const ammo0 = life.ammo.n
    tickUntil(life, () => kinds.includes('won') || kinds.includes('lost'), 30000)
    expect(kinds[0]).toBe('raid')
    expect(kinds).toContain('won')
    expect(life.log.some((l) => l.key === 'world.log.raid')).toBe(true)
    expect(life.ammo.n).toBeGreaterThan(ammo0 - 20)
  })
})

describe('月底危机夜跟着前世记忆走', () => {
  it('1 月尸潮、2 月匮乏', () => {
    expect(Household.crisisKind({ day: PROLOGUE_DAYS + 3, hour: 21 })).toBe('horde')
    expect(Household.crisisKind({ day: PROLOGUE_DAYS + 7, hour: 21 })).toBe('scarcity')
    expect(Household.crisisKind({ day: PROLOGUE_DAYS + 5, hour: 21 })).toBeNull()
  })

  it('2 月底（匮乏）来的是抢粮的人，不是丧尸', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    const starts: boolean[] = []
    life.onSiege = (e) => { if (e.kind === 'start') starts.push(e.raid) }
    life.clock = { day: PROLOGUE_DAYS + 7, hour: 20.99 }
    const dt = 0.05
    for (let i = 0; i < 40 && !starts.length; i++) life.tick(dt, () => false)
    expect(starts).toEqual([true])
    expect(life.log.some((l) => l.key === 'world.log.looters')).toBe(true)
  })

  it('5 月底（气候）是暴雨夜，第二天一楼进水泡坏吃的', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 19, hour: 20.99 }
    const dt = 0.05
    for (let i = 0; i < 40; i++) life.tick(dt, () => false)
    expect(life.storm).toBe(PROLOGUE_DAYS + 19)
    expect(life.rain).toBe(1)
    const food = life.stock.food
    life.siege = null
    life.clock = { day: PROLOGUE_DAYS + 20, hour: 7.2 }
    life.tick(dt, () => false)
    expect(life.stock.food).toBeLessThan(food)
    expect(life.log.some((l) => l.key === 'world.log.flood')).toBe(true)
  })
})

describe('住进来的人', () => {
  it('请门外的陌生人住进来：家里变四个人，晚上睡沙发，守夜站第四个位置，存档后还在', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _model, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'beggar')!)
    const dt = 0.05
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(dt, () => false); life.visitor?.follow(dt, 1.7) }
    life.answerVisitor('invite')
    expect(life.residents).toBe(4)
    const newcomer = life.actors[3]
    expect(newcomer.name).toBe('阿杰')
    expect(newcomer.weapon).toBe('machete')
    // 守夜：第四个人站 3 号位（贴门）
    life.spawnZombie = (at) => new Zombie(at)
    life.startSiege(2, false)
    expect(life.siege!.post(newcomer)).toBe(3)
    life.siege = null
    // 存档往返
    const s = JSON.parse(JSON.stringify(snapshot(life)))
    const b = simulate('paradise', 0).life
    b.makeActor = life.makeActor
    restore(b, s)
    expect(b.actors.map((a) => a.name)).toContain('阿杰')
    expect(b.actors.find((a) => a.name === '阿杰')?.weapon).toBe('machete')
  })
})

describe('空间异能', () => {
  it('放进空间的吃的不会被打翻；外面吃完了会从空间里拿；晶核能扩容', () => {
    const { life } = simulate('paradise', 0)
    expect(life.moveToSpace('food', 4)).toBe(true)
    expect(life.space.food).toBe(4)
    expect(life.moveToSpace('food', 3)).toBe(false) // 超过 6 份
    // 大门被破：只打翻外面的
    life.spawnZombie = (at) => new Zombie(at)
    life.startSiege(1, false)
    const outside = life.stock.food
    ;(life as unknown as { onSiegeEvent: (e: unknown) => void }).onSiegeEvent({ kind: 'broken', layer: 'door' })
    expect(life.stock.food).toBeCloseTo(outside * 0.75)
    expect(life.space.food).toBe(4)
    life.siege = null
    // 外面吃光了，从空间里拿
    life.stock = { food: 0, water: life.stock.water }
    ;(life as unknown as { take: (k: string, n: number) => void }).take('food', 1)
    expect(life.space.food).toBeCloseTo(3)
    life.cores = 3
    expect(life.upgradeSpace()).toBe(true)
    expect(life.spaceCap).toBe(12)
  })
})

describe('燃烧瓶', () => {
  it('扔到砸门的丧尸堆里：烧掉一片，用掉一个', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.ammo.n = 0
    life.clock = { day: PROLOGUE_DAYS, hour: 21.1 }
    life.startSiege(6, true)
    const s = life.siege!
    const dt = 0.05
    // 等丧尸都贴到铁门上
    for (let i = 0; i < 4000 && s.zombies.filter((z) => z.state === 'bash').length < 3; i++) {
      life.tick(dt, () => false)
      for (const z of s.zombies) z.follow(dt, z.speed)
      for (const a of life.actors) a.follow(dt, 2.2)
    }
    const hp = s.zombies.filter((z) => z.alive).reduce((v, z) => v + z.hp, 0)
    expect(life.throwMolotov()).toBe(true)
    expect(life.molotovs).toBe(1)
    const after = s.zombies.filter((z) => z.alive).reduce((v, z) => v + z.hp, 0)
    expect(after).toBeLessThan(hp - 80)
  })
})
