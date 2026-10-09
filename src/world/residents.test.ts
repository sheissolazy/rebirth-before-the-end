import { describe, expect, it } from 'vitest'
import { navFloors } from './nav'
import { Actor, Household } from './residents'
import { DAY_SECONDS, PROLOGUE_DAYS } from './life'
import { Zombie } from './siege'
import { restore, snapshot } from './save'
import { Courier, VISITORS, Visitor } from './visitors'
import { SCAVENGE } from './scavenge'
import { settleTrip } from './expedition'
import { rainAt } from './weather'
import { FLOOR_H, SPOTS } from './layout'

/** 不渲染，只跑逻辑：让一家人自己过几天，看看会不会卡住、饿着、不睡觉 */
function simulate(style: 'toon' | 'paradise', days: number) {
  const actors = [
    new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 6.5, z: 4.4 }, { hunger: 72, thirst: 66, energy: 92, mood: 64 }),
    new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 5.3, z: 4.2 }, { hunger: 78, thirst: 58, energy: 88, mood: 72 }),
    new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 7.0, z: 1.5 }, { hunger: 70, thirst: 75, energy: 85, mood: 60 }),
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
        // 女主睡二楼自己的房间，爸妈睡一楼
        if (key === 'sleep:use' && a.floor === (k === 0 ? 1 : 0)) s.sleptUpstairs++
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
        // 妈妈白天要压水、喂鸡，偶尔累到 7 左右才去睡（能睡下就行，不是卡住）
        expect(s.minNeed).toBeGreaterThan(6)
        // 走一趟（含上下楼、穿过院子）不超过两个游戏小时，超过就是卡住了
        expect(s.longestGo).toBeLessThan(DAY_SECONDS / 12)
      }
      // 两天、三个人：吃掉大约 4~8 份食物
      // 鸡圈每天捡的蛋也算进吃的里，这里只看吃掉了多少
      const eaten = 12 - life.stock.food + life.eggs * Household.EGGS_FOOD
      expect(eaten).toBeGreaterThan(4.5)
      expect(eaten).toBeLessThan(7.5)
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

describe('家里人会说话', () => {
  it('一天里：饭做好了有人喊开饭，晚上躺下有人说晚安，早上起来有人打招呼', () => {
    const { life } = simulate('paradise', 0)
    life.speed = 3
    const said = new Set<string>()
    const dt = 0.1
    for (let i = 0; i < (1.2 * DAY_SECONDS) / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) {
        a.follow(dt * life.speed, 2.2)
        a.updateSettle(dt * life.speed)
        if (a.line) said.add(a.line.text)
      }
    }
    const all = [...said].join('|')
    expect(all).toMatch(/开饭啦|吃饭咯|趁热吃/)
    expect(all).toMatch(/晚安|早点睡|明天见/)
    expect(all).toMatch(/早呀|睡得真香|天气不错/)
  })
})

describe('晾衣服', () => {
  function run(life: Household, hours: number, each?: () => void) {
    const dt = 0.1
    for (let i = 0; i < (hours * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      each?.()
    }
  }
  it('晴天上午有人去院子里晾衣服，傍晚收回来', () => {
    const { life } = simulate('paradise', 0)
    // 找一个不下雨的白天
    let day = 0
    while ([8, 10, 12, 14, 16, 18].some((h) => rainAt(day, h) > 0.05)) day++
    life.clock = { day, hour: 7.6 }
    life.speed = 3
    let hung = false
    run(life, 13, () => { if (life.laundryOut) hung = true })
    expect(hung).toBe(true)
    expect(life.laundryOut).toBe(false)
  })

  it('衣服晾在外面突然下雨：有人冒雨跑去收，喊一声', () => {
    const { life } = simulate('paradise', 0)
    let start = -1
    for (let h = 7 * 4; h < 24 * 30 * 4 && start < 0; h++) {
      const day = Math.floor(h / 96)
      const hour = (h % 96) / 4
      if (hour > 9 && hour < 16 && rainAt(day, hour) > 0.1 && rainAt(day, hour - 0.25) <= 0.1) start = day * 24 + hour
    }
    life.clock = { day: Math.floor(start / 24), hour: (start % 24) - 0.3 }
    life.laundryOut = true
    life.laundryDay = life.clock.day
    life.speed = 3
    let said = ''
    run(life, 1.5, () => { for (const a of life.actors) if (a.line?.text.includes('收衣服')) said = a.line.text })
    expect(said).toBe('下雨啦，快收衣服！')
    expect(life.laundryOut).toBe(false)
  })
})

describe('女主自己开车', () => {
  it('开车在街上时不会被围（不算走在街上）；不能被派出门', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 9 }
    life.speed = 3
    const hero = life.actors[0]
    life.cancel(hero)
    hero.root.position.set(14, 0, 18)
    hero.floor = 0
    life.heroDriving = true
    const dt = 0.1
    for (let i = 0; i < (8 * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a) && a !== hero)
      hero.root.position.set(14, 0, 18)
    }
    expect(life.siege).toBeNull()
    expect(life.startTrip('river', [hero])).toBe(false)
  })
})

describe('陪聊', () => {
  it('妈妈坐在沙发上歇着：爸爸能找到她身边一块空地过去陪她说话（不会站进墙里、桌子里）', () => {
    for (const style of ['paradise', 'toon'] as const) {
      const { life } = simulate(style, 0)
      life.clock = { day: 0, hour: 15 }
      const [, mom, dad] = life.actors
      // 二楼小客厅的沙发
      const sofa = SPOTS.find((s) => s.kind === 'relax' && s.floor === 1)!
      life.cancel(mom)
      mom.root.position.set(sofa.x, FLOOR_H, sofa.z)
      mom.floor = 1
      mom.anchor = { x: sofa.ax!, z: sofa.az!, y: FLOOR_H, floor: 1 }
      mom.task = { kind: 'relax', spot: sofa, phase: 'use', hours: 2, manual: false } as never
      mom.pose = 'sit'
      dad.root.position.set(6, FLOOR_H, 3.6)
      dad.floor = 1
      let found = 0
      for (let i = 0; i < 20; i++) {
        const t = (life as unknown as { companyTask(a: unknown): { spot: { x: number; z: number; floor: 0 | 1 } } | null }).companyTask(dad)
        if (!t) continue
        found++
        expect(life.navs[t.spot.floor].isBlockedAt(t.spot.x, t.spot.z)).toBe(false)
      }
      expect(found).toBeGreaterThan(0)
    }
  })
})

describe('下雨', () => {
  it('刚下起雨来：院子里溜达的人放下手里的事往屋里走，有人喊一声', () => {
    const { life } = simulate('paradise', 0)
    // 找第一场雨开始的时刻
    let start = -1
    for (let h = 7 * 4; h < 24 * 30 * 4 && start < 0; h++) {
      const day = Math.floor(h / 96)
      const hour = (h % 96) / 4
      if (hour > 8 && hour < 18 && rainAt(day, hour) > 0.1 && rainAt(day, hour - 0.25) <= 0.1) start = day * 24 + hour
    }
    expect(start).toBeGreaterThan(0)
    life.clock = { day: Math.floor(start / 24), hour: (start % 24) - 0.3 }
    life.speed = 3
    const mom = life.actors[1]
    life.cancel(mom)
    mom.root.position.set(9.5, 0, 10.2)
    mom.floor = 0
    mom.task = { kind: 'stroll', spot: null, phase: 'use', hours: 3, manual: false } as never
    let said = ''
    const dt = 0.1
    for (let i = 0; i < (1.2 * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed); if (a.line?.text.includes('下雨')) said = a.line.text }
    }
    expect(said).toBe('下雨啦，快进屋！')
    expect(mom.pos.z).toBeLessThan(7)
  })
})

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
    // 到了店里弹交易界面：这里替玩家挑两袋米、三箱水
    let shopped = 0
    life.onShop = (t) => { shopped++; expect(life.checkout(t.id, { rice: 2, water: 3 })).toBe('ok') }
    expect(life.startTrip('supermarket', [hero, mom])).toBe(true)
    // 出门不先付钱，钱在店里花
    expect(life.money).toBe(18000)
    const food0 = life.stock.food
    const water0 = life.stock.water
    // 3 小时 + 从街口扛着箱子走回客厅
    const sawAway = run(life, 5.5)
    expect(sawAway).toBe(true)
    expect(shopped).toBe(1)
    expect(life.trip).toBeNull()
    expect(life.stock.food).toBeGreaterThan(food0 + 5)
    expect(life.stock.water).toBeGreaterThan(water0 + 4)
    expect(hero.away || mom.away).toBe(false)
    expect(life.log.some((l) => l.key === 'world.trip.bought')).toBe(true)
    // 两袋米 150、三箱水 60
    expect(life.money).toBe(18000 - 480)
    // 文字版超市事件里的一段见闻
    const scene = life.log.find((l) => l.key === 'world.log.scene')
    expect(scene?.vars?.title).toBeTruthy()
  })

  it('天黑前回不来就不让出门；末日后不能去超市买东西', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 17.5 }
    expect(life.tripCheck('supermarket')).toBe('late')
    life.clock = { day: PROLOGUE_DAYS, hour: 9 }
    expect(life.tripCheck('supermarket')).toBe('phase')
    expect(life.tripCheck('river')).toBe('ok')
  })

  it('开面包车去超市：上车、车开走、回来倒进车位，烧一桶油，更快、多装一半', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 17 }
    life.speed = 3
    const [hero, mom] = life.actors
    // 走路去天黑前回不来，开车来得及
    expect(life.tripCheck('supermarket')).toBe('late')
    expect(life.tripCheck('supermarket', true)).toBe('ok')
    life.clock = { day: 0, hour: 9 }
    expect(life.fuel).toBe(3)
    expect(life.startTrip('supermarket', [hero, mom], true)).toBe(true)
    expect(life.fuel).toBe(2)
    expect(life.trip!.back - life.absHour).toBe(2)
    const food0 = life.stock.food
    // 两个人加面包车能装 36 件：开车去能多买
    expect(life.tripCapacity(life.trip!)).toBe(36)
    life.onShop = (t) => { expect(life.checkout(t.id, { rice: 4, cans: 4, water: 6 })).toBe('ok') }
    // 走到车门边上车，车开出去
    let sawOut = false
    let sawAwayVan = false
    let sawIn = false
    const dt = 0.1
    for (let i = 0; i < (3.5 * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      if (life.vanMove?.dir === 'out') sawOut = true
      if (life.vanAway && hero.away) sawAwayVan = true
      if (life.vanMove?.dir === 'in') { sawIn = true; expect(hero.away).toBe(true) }
    }
    expect(sawOut && sawAwayVan && sawIn).toBe(true)
    expect(life.trip).toBeNull()
    expect(life.vanAway).toBe(false)
    expect(life.vanMove).toBeNull()
    // 4 袋米 + 4 箱罐头 = 20 份吃的（在家的爸爸这几个小时也吃了点）
    expect(life.log.some((l) => l.key === 'world.trip.bought')).toBe(true)
    expect(life.stock.food).toBeGreaterThan(food0 + 18)
  })

  it('车开回来时，在家闲着的人出来迎：走到院子里，看见人下车就挥手喊一声，卸完货就散', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 9.5 }
    life.speed = 3
    const [hero, mom, dad] = life.actors
    life.startTrip('supermarket', [mom, dad], true)
    let greeted = false
    let waved = false
    let helped = false
    let said = ''
    let back = ''
    const dt = 0.1
    for (let i = 0; i < (4.2 * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      // 女主在家闲着（不是在吃饭睡觉）
      if (!life.trip || life.trip.phase === 'out') hero.needs = { hunger: 90, thirst: 90, energy: 90, mood: 80 }
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      if (hero.task?.kind === 'greet') greeted = true
      if (hero.pose === 'wave') waved = true
      if (hero.carrying && hero.task?.kind === 'help') helped = true
      if (hero.line) said = hero.line.text
      if (mom.line) back = mom.line.text
    }
    expect(greeted).toBe(true)
    expect(waved).toBe(true)
    // 挥完手接过一个箱子帮着搬进屋，放下以后手里就空了
    expect(helped).toBe(true)
    expect(hero.carrying).toBe(false)
    expect(said).toBeTruthy()
    expect(back).toBe('我们回来啦～')
    expect(life.trip).toBeNull()
    expect(hero.task?.kind).not.toBe('greet')
  })

  it('末日后去趟工厂带回钢板：爸爸找个白天把面包车改装了，存档后还在；改装过的车出门更安全', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 8 }
    life.speed = 3
    const [hero, mom, dad] = life.actors
    life.startTrip('factory', [hero, mom], true)
    let modded = false
    const dt = 0.1
    // 开车去工厂来回 + 爸爸找个空改装（新房子里他白天还要压水、喂鸡），一般 10 个多小时
    for (let i = 0; i < (14 * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      if (dad.task?.kind === 'modvan') modded = true
      if (life.vanArmor) break
    }
    expect(life.log.some((l) => l.key === 'world.log.vanKit')).toBe(true)
    expect(modded).toBe(true)
    expect(life.vanArmor).toBe(true)
    expect(life.log.some((l) => l.key === 'world.log.vanArmor')).toBe(true)
    const snap = JSON.parse(JSON.stringify(snapshot(life)))
    const { life: again } = simulate('paradise', 0)
    restore(again, snap)
    expect(again.vanArmor).toBe(true)
  })

  it('改装过的面包车：撞上丧尸、受重伤都少很多', () => {
    let seed = 7
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const hurt = (armored: boolean) => {
      let n = 0
      for (let i = 0; i < 4000; i++) if (settleTrip('hospital', 2, false, r, true, false, armored).hurt.some((h) => h >= 15)) n++
      return n
    }
    expect(hurt(true)).toBeLessThan(hurt(false) * 0.55)
  })

  it('末日后白天开过车：发动机的动静当晚多引来一只丧尸', () => {
    const { life } = simulate('paradise', 0)
    // 找一个普通的丧尸夜（不是月底危机夜）
    let day = PROLOGUE_DAYS + 1
    while (Household.crisisKind({ day, hour: 21 }) || Household.nightCount({ day, hour: 21 }).count === 0) day++
    const base = Household.nightCount({ day, hour: 21 }).count
    life.spawnZombie = (at) => new Zombie(at)
    let tonight = 0
    life.onSiege = (e) => { if (e.kind === 'start') tonight = e.count }
    life.clock = { day, hour: 9 }
    life.speed = 3
    life.startTrip('river', [life.actors[2]], true)
    const dt = 0.1
    for (let i = 0; i < (12.3 * DAY_SECONDS) / 24 / (dt * life.speed) && !life.siege; i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
    expect(life.siege).toBeTruthy()
    expect(tonight).toBe(base + 1)
    expect(life.log.some((l) => l.key === 'world.log.vanNoise')).toBe(true)
  })

  it('没油、车不在家、去上班都不能开车；加油站末日前花钱买油，末日后不要钱', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 8 }
    expect(life.tripCheck('office', true)).toBe('fuel')
    life.fuel = 0
    expect(life.tripCheck('supermarket', true)).toBe('fuel')
    expect(life.tripCheck('gasstation')).toBe('ok')
    life.speed = 3
    // 走路去：一个人只背得动 3 桶（6 件）
    life.onShop = (t) => { expect(life.checkout(t.id, { fuel: 4 })).toBe('heavy'); expect(life.checkout(t.id, { fuel: 3 })).toBe('ok') }
    life.startTrip('gasstation', [life.actors[2]])
    run(life, 4)
    expect(life.fuel).toBe(3)
    expect(life.money).toBe(18000 - 450)
    life.onShop = null
    life.clock = { day: PROLOGUE_DAYS, hour: 9 }
    const money = life.money
    // 末日后加油站没人卖了：去抢剩下的，不要钱
    life.startTrip('gasstation', [life.actors[2]], true)
    expect(life.money).toBe(money)
    expect(life.fuel).toBe(2)
  })

  it('开车出去时存档：读档后车也不在家，到点开回来', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 9 }
    life.speed = 3
    life.startTrip('pharmacy', [life.actors[2]], true)
    run(life, 1.1)
    expect(life.vanAway).toBe(true)
    const snap = JSON.parse(JSON.stringify(snapshot(life)))
    const { life: again } = simulate('paradise', 0)
    restore(again, snap)
    expect(again.vanAway).toBe(true)
    expect(again.fuel).toBe(2)
    again.speed = 3
    run(again, 3)
    expect(again.trip).toBeNull()
    expect(again.vanAway).toBe(false)
    expect(again.medkits).toBeGreaterThanOrEqual(3)
  })

  it('五金店加固铁门：耐久上限变高', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 8 }
    life.speed = 3
    life.onShop = (t) => { expect(life.checkout(t.id, { plate: 2 })).toBe('ok') }
    life.startTrip('hardware', [life.actors[2]])
    run(life, 6)
    expect(life.maxOf('gate')).toBe(240)
    expect(life.barriers.gate).toBe(240)
  })
})

describe('好几拨人同时出门 + 店里挑东西', () => {
  it('妈妈走路去超市的同时，爸爸开车去药店；车只有一辆，第三拨不能再开车；钱不够买不了', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 8 }
    life.speed = 3
    const [hero, mom, dad] = life.actors
    const shops: string[] = []
    life.onShop = (t) => {
      shops.push(t.def.id)
      if (t.def.id === 'pharmacy') {
        // 钱不够：一次买 30 个急救包
        life.money = 1000
        expect(life.checkout(t.id, { medkit: 4 })).toBe('money')
        life.money = 18000
        expect(life.checkout(t.id, { medkit: 2 })).toBe('ok')
      } else expect(life.checkout(t.id, { water: 2 })).toBe('ok')
    }
    expect(life.startTrip('supermarket', [mom])).toBe(true)
    // 有人在外面不耽误别人出门
    expect(life.tripCheck('pharmacy', true)).toBe('ok')
    expect(life.startTrip('pharmacy', [dad], true)).toBe(true)
    expect(life.trips.length).toBe(2)
    // 车被开走了：第三拨只能走路
    expect(life.tripCheck('hardware', true)).toBe('fuel')
    expect(life.tripCheck('hardware')).toBe('ok')
    // 同一个人不能同时出两趟门
    expect(life.startTrip('hardware', [mom])).toBe(false)
    const kits = life.medkits
    const dt = 0.1
    for (let i = 0; i < 20000 && life.trips.length; i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
    expect(life.trips.length).toBe(0)
    expect(shops.sort()).toEqual(['pharmacy', 'supermarket'])
    expect(life.medkits).toBe(kits + 2)
    expect(hero.away || mom.away || dad.away).toBe(false)
    expect(life.log.filter((l) => l.key === 'world.trip.bought').length).toBe(2)
  })
})

describe('野外采集（点了以后）', () => {
  it('女主走过去蹲下采，回来家里多了吃的；刚采过的再点就说"过两天"；三份草药捣成一个急救包', () => {
    const { life } = simulate('paradise', 0)
    const h = life.actors[0]
    life.clock = { day: 1, hour: 9 }
    life.speed = 3
    const run = (id: string) => {
      expect(life.commandForage(h, id)).toBe('ok')
      for (let i = 0; i < 4000 && h.task?.kind === 'forage'; i++) {
        life.tick(0.1, (a) => life.isHomeBody(a))
        for (const a of life.actors) { a.follow(0.3, 2.2); a.updateSettle(0.3) }
      }
      expect(h.task?.kind).not.toBe('forage')
    }
    const food = life.stock.food
    run('greens_w')
    expect(life.stock.food).toBeGreaterThan(food)
    expect(life.forageDay.greens_w).toBe(life.clock.day)
    expect(life.commandForage(h, 'greens_w')).toBe('picked')
    const kits = life.medkits
    run('herb_river')
    run('herb_w')
    run('herb_e')
    expect(life.medkits).toBe(kits + 1)
    expect(life.herbs).toBe(0)
  })
})

describe('需求归零的后果', () => {
  it('读档后同一天不会把"渴得嘴唇裂开"再记一遍', () => {
    const { life } = simulate('paradise', 0)
    life.stock = { food: 0, water: 0 }
    life.medkits = 40
    life.clock = { day: 0, hour: 8 }
    life.speed = 3
    for (const a of life.actors) a.needs = { hunger: 0, thirst: 0, energy: 60, mood: 60 }
    const step = () => { for (let i = 0; i < 40; i++) life.tick(0.1, (a) => life.isHomeBody(a)) }
    step()
    const count = () => life.log.filter((l) => l.key === 'world.log.thirsty' && l.vars?.who === life.actors[0].name).length
    expect(count()).toBe(1)
    // 刷新页面 = "今天警告过谁"的记忆丢了，但日记还在
    ;(life as unknown as { warned: Map<string, number> }).warned.clear()
    step()
    expect(count()).toBe(1)
  })

  it('家里断粮断水：饿着渴着掉健康，（有急救包吊着命）熬久了有人抑郁离家出走（女主不会走）', () => {
    const { life } = simulate('paradise', 0)
    life.stock = { food: 0, water: 0 }
    life.medkits = 40
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

describe('压水井和鸡圈', () => {
  it('家里水不多：闲着的人自己去压水，一天最多压 3 回；早上有人去喂鸡捡蛋，一天一回', () => {
    const { life } = simulate('paradise', 0)
    life.stock = { food: 10, water: 2 }
    life.clock = { day: 1, hour: 7.2 }
    life.speed = 3
    for (let i = 0; i < 9000 && (life.pumpCount < 3 || life.fedDay !== 1) && life.clock.day === 1; i++) {
      life.tick(0.1, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(0.3, 2.2); a.updateSettle(0.3) }
    }
    expect(life.pumpCount).toBe(3)
    expect(life.pumpsLeft()).toBe(0)
    expect(life.fedDay).toBe(1)
    expect(life.log.some((l) => l.key === 'world.log.eggs')).toBe(true)
  })

  it('点压水井：选中的人去压；今天压满了就说明天再来', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 10 }
    const mom = life.actors[1]
    expect(life.commandChore(mom, 'pump')).toBe('ok')
    expect(mom.task?.kind).toBe('pump')
    life.pumpCount = 3
    life.cancel(mom)
    expect(life.commandChore(mom, 'pump')).toBe('done')
  })
})

describe('竹尖刺', () => {
  it('砍竹子 → 爸爸削一个小时 → 铁门里插上一排；丧尸冲进院子踩上去掉血，扎够 8 只就烂', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 9 }
    expect(life.craftSpikes()).toBe('bamboo')
    life.bamboo = 3
    expect(life.craftSpikes()).toBe('ok')
    const dad = life.actors[2]
    expect(dad.task?.kind).toBe('craft')
    expect(life.bamboo).toBe(0)
    for (let i = 0; i < 6000 && dad.task?.kind === 'craft'; i++) {
      life.tick(0.1, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(0.3, 2.2); a.updateSettle(0.3) }
    }
    expect(life.spikes[0].hits).toBe(8)
    expect(life.nextSpikeRow()).toBe(1)
    // 削第二排削到一半被打断：竹子退回来
    life.bamboo = 3
    expect(life.craftSpikes()).toBe('ok')
    life.cancel(dad)
    life.tick(0.1, (a) => life.isHomeBody(a))
    expect(life.bamboo).toBe(3)
    expect(life.craftSpikes()).toBe('ok')
    expect(life.log.some((l) => l.key === 'world.log.spikes')).toBe(true)
    // 存档里带着
    const s = snapshot(life)
    const { life: other } = simulate('paradise', 0)
    restore(other, s)
    expect(other.spikes[0].hits).toBe(8)
  })

  it('丧尸走过一排竹尖刺：先扎一下再一路掉血', () => {
    const { life } = simulate('paradise', 0)
    life.spikes[0].hits = 8
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 21.2 }
    life.startSiege(1, false)
    // 丧尸是陆续冒出来的：等第一只出来，把它放到铁门里面，让它往堂屋走
    for (let i = 0; i < 400 && !life.siege?.zombies.length; i++) life.tick(0.05, () => false)
    const z = life.siege!.zombies[0]
    z.root.position.set(4, 0, 12.6)
    const hp0 = z.hp
    for (let i = 0; i < 60; i++) {
      z.setPath([{ x: 4, y: 0, z: 10.4, floor: 0 }])
      z.follow(0.05, z.speed * (z.slowed ? 0.55 : 1))
      life.tick(0.05, () => false)
    }
    expect(life.spikes[0].hits).toBe(7)
    expect(z.hp).toBeLessThan(hp0 - 14)
  })
})

describe('来踩点的陌生人', () => {
  function tickUntil(life: Household, cond: () => boolean, max = 4000) {
    const dt = 0.05
    for (let i = 0; i < max && !cond(); i++) {
      life.tick(dt, () => false)
      if (life.visitor) life.visitor.follow(dt * life.speed, 1.7)
      for (const z of life.siege?.zombies ?? []) z.follow(dt * life.speed, z.speed)
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
  }
  const meet = (r: number) => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 11 }
    life.stock = { food: 10, water: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'scout')!)
    tickUntil(life, () => !!life.talking)
    ;(life as unknown as { rand: () => number }).rand = () => r
    return life
  }
  it('给了水：六成是来踩点的，当晚黑鸦来抢（日记里有门柱上的记号）', () => {
    const life = meet(0.3)
    life.answerVisitor('water')
    expect(life.raidTonight).toBe(true)
    expect(life.stock.water).toBe(9)
    expect(life.log.some((l) => l.key === 'world.visit.scout.log.marked')).toBe(true)
  })
  it('亮出猎枪：吓退，没事', () => {
    const life = meet(0.3)
    life.answerVisitor('gun')
    expect(life.raidTonight).toBe(false)
    expect(life.siege).toBeNull()
  })
  it('隔着门撵走：一半当场翻墙打起来，大白天也不会因为"天亮了"就散', () => {
    const life = meet(0.3)
    let raid = false
    life.onSiege = (e) => { if (e.kind === 'start') raid = !!e.raid }
    life.answerVisitor('shut')
    expect(life.siege).not.toBeNull()
    tickUntil(life, () => raid, 2000)
    expect(raid).toBe(true)
    // 上午 11 点开打：过一会儿仗还在打（没被"天亮"提前结束）
    tickUntil(life, () => false, 200)
    expect(life.siege?.done ?? false).toBe(false)
    expect(life.log.some((l) => l.key === 'world.visit.scout.log.fight')).toBe(true)
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
    expect(newcomer.name.length).toBeGreaterThan(0)
    expect(newcomer.trait).toMatch(/^trait_/)
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
    expect(b.actors.map((a) => a.name)).toContain(newcomer.name)
    expect(b.actors.find((a) => a.name === newcomer.name)?.weapon).toBe('machete')
    expect(b.actors.find((a) => a.name === newcomer.name)?.trait).toBe(newcomer.trait)
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

describe('上街搜东西', () => {
  it('末日后站在车旁边搜一会儿：翻到东西、记日记；刚搜过的地方要等几天；末日前不让搜', () => {
    const { life } = simulate('paradise', 0)
    const car = SCAVENGE.find((s) => s.id === 'car_w')!
    life.clock = { day: 1, hour: 10 }
    expect(life.canSearch(car)).toBe('prologue')
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 10 }
    life.actors[0].root.position.set(car.at.x, 0, car.at.z)
    const safe = { ...car, danger: 0 }
    const water = life.stock.water
    expect(life.startSearch(safe)).toBe(true)
    for (let i = 0; i < 400 && life.search; i++) life.tick(0.05, () => false)
    expect(life.search).toBeNull()
    expect(life.stock.water).toBeGreaterThan(water)
    expect(life.log.at(-1)?.key).toBe('world.log.scavenged')
    expect(life.canSearch(car)).toBe('empty')
  })

  it('动静太大引来丧尸：女主就地开枪把它打倒', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    const house = SCAVENGE.find((s) => s.id === 'house_m')!
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 11 }
    const hero = life.actors[0]
    hero.root.position.set(house.at.x, 0, house.at.z)
    life.startSearch({ ...house, danger: 1 })
    const dt = 0.05
    for (let i = 0; i < 8000 && !life.log.some((l) => l.key.startsWith('world.log.ambush') && l.key !== 'world.log.ambush'); i++) {
      life.tick(dt, () => false)
      for (const z of life.siege?.zombies ?? []) z.follow(dt, z.speed)
      for (const a of life.actors) a.follow(dt, 2.2)
    }
    const keys = life.log.map((l) => l.key)
    expect(keys).toContain('world.log.ambush')
    expect(keys).toContain('world.log.ambushWon')
    expect(life.report).toBeNull()
  })
})

describe('江野', () => {
  it('序章把末日告诉他：好感 +15、给子弹；末日后他会来送东西，送斧子的话没子弹时女主用斧子', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: 1, hour: 10 }
    const go = (id: string) => {
      life.startVisit(VISITORS.find((v) => v.id === id)!)
      for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    }
    go('jiangye_meet')
    const ammo = life.ammo.n
    life.answerVisitor('warn')
    expect(life.warnedJiangye).toBe(true)
    expect(life.affection.jiangye).toBe(55)
    expect(life.ammo.n).toBe(ammo + 6)
    for (let i = 0; i < 4000 && life.visitor; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 10 }
    expect(VISITORS.find((v) => v.id === 'jiangye_care')!.when(life.visitorCtx())).toBe(true)
    go('jiangye_care')
    life.careVariant = 1
    life.answerVisitor('thanks')
    expect(life.actors[0].sidearm).toBe('axe')
    expect(life.affection.jiangye).toBe(60)
  })
})

describe('顾沉 / 军区', () => {
  function run(life: Household, hours: number) {
    const dt = 0.1
    for (let i = 0; i < (hours * DAY_SECONDS) / 24 / (dt * life.speed); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
  }
  it('末日前去军区门口见到顾沉；末日后用晶核在军区换子弹，见过他的话多给', () => {
    const { life } = simulate('paradise', 0)
    life.speed = 3
    life.clock = { day: 1, hour: 8 }
    expect(life.startTrip('armygate', [life.actors[0]])).toBe(true)
    run(life, 5.5)
    expect(life.guchenMet).toBe(true)
    expect(life.affection.guchen).toBe(8)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 8 }
    life.cores = 0
    expect(life.tripCheck('armygate')).toBe('cores')
    life.cores = 6
    const ammo = life.ammo.n
    // 军区收晶核：两盒子弹 4 颗；见过顾沉的话兵多塞一盒
    life.onShop = (t) => { expect(life.checkout(t.id, { army_ammo: 2 })).toBe('ok') }
    expect(life.startTrip('armygate', [life.actors[2]])).toBe(true)
    run(life, 5.5)
    expect(life.cores).toBe(2)
    expect(life.ammo.n).toBe(ammo + 18)
  })
})

describe('沈砚和谢临', () => {
  it('家里有人重伤时沈砚会来；请他治伤全家健康 +35；末日后第一个早上门缝里有谢临的纸条', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: PROLOGUE_DAYS, hour: 7.9 }
    life.tick(0.05, () => false)
    for (let i = 0; i < 40; i++) life.tick(0.05, () => false)
    expect(life.log.some((l) => l.key === 'world.xielin.note0')).toBe(true)
    expect(life.xielinNotes).toBe(1)
    const def = VISITORS.find((v) => v.id === 'shenyan_meet')!
    life.clock = { day: PROLOGUE_DAYS, hour: 11 }
    expect(def.when(life.visitorCtx())).toBe(false)
    life.actors[1].health = 30
    expect(def.when(life.visitorCtx())).toBe(true)
    life.startVisit(def)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.answerVisitor('treat')
    expect(life.actors[1].health).toBeGreaterThanOrEqual(65)
    expect(life.affection.shenyan).toBe(10)
  })
})

describe('种田', () => {
  it('开菜地要钱；爸妈会去浇水，两三天熟了收一茬', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 9 }
    life.money = 500
    expect(life.buildGarden()).toBe(false)
    life.money = 2000
    expect(life.buildGarden()).toBe(true)
    expect(life.money).toBe(1200)
    life.speed = 3
    for (const a of life.actors) a.needs = { hunger: 95, thirst: 95, energy: 95, mood: 95 }
    const dt = 0.1
    let watered = 0
    for (let i = 0; i < (3.2 * DAY_SECONDS) / (dt * 3) && !life.log.some((l) => l.key === 'world.log.harvest'); i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * 3, 2.2); a.updateSettle(dt * 3) }
      if (life.garden.watered === life.clock.day) watered++
    }
    expect(watered).toBeGreaterThan(0)
    expect(life.log.some((l) => l.key === 'world.log.harvest')).toBe(true)
  })
})

describe('江野来帮忙守夜', () => {
  it('好感够高：月底危机夜傍晚他来了，一起守，天亮走了；好感不够就不来', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _m, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnZombie = (at) => new Zombie(at)
    life.affection.jiangye = 70
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 19.4 }
    const dt = 0.05
    const step = () => {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
      for (const z of life.siege?.zombies ?? []) z.follow(dt * life.speed, z.speed)
    }
    for (let i = 0; i < 200; i++) step()
    expect(life.guest?.name).toBe('江野')
    expect(life.residents).toBe(3)
    // 打到天亮
    for (let i = 0; i < 60000 && life.guest; i++) { if (!life.siege) life.speed = 3; step() }
    expect(life.guest).toBeNull()
    expect(life.log.some((l) => l.key === 'world.log.guestLeave')).toBe(true)
    expect(life.actors.some((a) => a.name === '江野')).toBe(false)
  })
})

describe('钓鱼', () => {
  it('在江边钓一会儿能钓到鱼（每条半份吃的）；一动就收竿', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 6 }
    const food = life.stock.food
    expect(life.startFishing()).toBe(true)
    expect(life.actors[0].pose).toBe('fish')
    for (let i = 0; i < 1200; i++) life.tick(0.05, () => false)
    expect(life.fishCaught).toBeGreaterThan(0)
    expect(life.stock.food).toBeGreaterThan(food - 1)
    life.stopFishing()
    expect(life.fishing).toBeNull()
  })
})


describe('审查找到的问题（回归测试）', () => {
  it('来帮忙的客人不能派出门', () => {
    const { life } = simulate('paradise', 0)
    const guest = new Actor('江野', '#888', '#222', 1, { x: 4, z: 10 }, { hunger: 90, thirst: 90, energy: 90, mood: 90 })
    guest.guest = true
    life.actors.push(guest)
    life.clock = { day: 1, hour: 8 }
    expect(life.startTrip('supermarket', [guest])).toBe(false)
  })

  it('访客还在路上时存档：读档后他以后还会来（回完话才算来过）', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: 1, hour: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'jiangye_meet')!)
    const s = JSON.parse(JSON.stringify(snapshot(life)))
    expect(s.seen.jiangye_meet).toBeUndefined()
  })

  it('早上在街上遇袭不会被"天亮"直接结束；上一场还在收尾时不会再遇袭', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 7 }
    const house = SCAVENGE.find((x) => x.id === 'house_m')!
    life.actors[0].root.position.set(house.at.x, 0, house.at.z)
    life.startSearch({ ...house, danger: 1, hours: 0.01 })
    for (let i = 0; i < 20 && !life.siege; i++) life.tick(0.05, () => false)
    expect(life.siege?.ambush).toBe(true)
    for (let i = 0; i < 10; i++) life.tick(0.05, () => false)
    expect(life.siege?.done).toBe(false)
    expect(life.canSearch(SCAVENGE[0])).toBe('busy')
  })

  it('调试跳到丧尸夜只往后跳', () => {
    expect(Household.nextNightDay({ day: 1, hour: 9 }, true)).toBe(PROLOGUE_DAYS + 3)
    expect(Household.nextNightDay({ day: 15, hour: 9 }, true)).toBe(15)
    expect(Household.nextNightDay({ day: 15, hour: 22 }, true)).toBe(19)
    expect(Household.nextNightDay({ day: 9, hour: 9 }, false)).toBe(9)
  })

  it('住进来的人名字不会重复', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _m, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    const names: string[] = []
    for (let k = 0; k < 2; k++) {
      life.clock = { day: PROLOGUE_DAYS + 1 + k * 4, hour: 10 }
      life.startVisit(VISITORS.find((v) => v.id === 'beggar')!)
      for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
      life.answerVisitor('invite')
      names.push(life.actors[life.actors.length - 1].name)
    }
    expect(new Set(names).size).toBe(2)
  })
})

describe('石头院墙', () => {
  it('砌墙要钱；铁门上限 +100；隔着栏杆不会被抓伤', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 10 }
    life.money = 5000
    expect(life.buildWall()).toBe(false)
    life.money = 7000
    expect(life.buildWall()).toBe(true)
    expect(life.money).toBe(1000)
    expect(life.maxOf('gate')).toBe(280)
    expect(life.barriers.gate).toBe(280)
    // 守一晚：贴门的人不会掉血
    life.spawnZombie = (at) => new Zombie(at)
    life.ammo.n = 0
    life.clock = { day: PROLOGUE_DAYS, hour: 21.1 }
    life.startSiege(4, false)
    const dt = 0.05
    for (let i = 0; i < 20000 && life.siege && !life.siege.done; i++) {
      life.tick(dt, () => false)
      for (const z of life.siege?.zombies ?? []) z.follow(dt, z.speed)
      for (const a of life.actors) a.follow(dt, 2.2)
    }
    expect(life.actors.every((a) => a.health === 100)).toBe(true)
  })
})

describe('打仗时救人', () => {
  it('倒下的人用急救包能当场救起来', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.medkits = 1
    life.startSiege(2, false)
    const mom = life.actors[1]
    mom.health = 0
    ;(life.siege as unknown as { knockDown: (a: Actor) => void }).knockDown(mom)
    expect(life.siege!.isDown(mom)).toBe(true)
    expect(life.rescue(mom)).toBe(true)
    expect(mom.health).toBe(40)
    expect(life.medkits).toBe(0)
    expect(life.siege!.isDown(mom)).toBe(false)
  })
})

describe('第二轮审查（回归测试）', () => {
  it('钓到的鱼数会存进存档', () => {
    const { life } = simulate('paradise', 0)
    life.fishCaught = 7
    const b = simulate('paradise', 0).life
    b.makeActor = life.makeActor
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.fishCaught).toBe(7)
  })

  it('女主累倒了就不再钓鱼', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 6 }
    expect(life.startFishing()).toBe(true)
    life.actors[0].needs = { ...life.actors[0].needs, energy: 0 }
    life.tick(0.05, () => false)
    expect(life.fishing).toBeNull()
    expect(life.actors[0].pose).toBe('down')
  })

  it('打完仗还站着的人放下武器', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.startSiege(1, false)
    life.actors[0].pose = 'shoot'
    life.actors[1].pose = 'melee'
    ;(life as unknown as { onSiegeEvent: (e: unknown) => void }).onSiegeEvent({ kind: 'end', won: true, kills: 1, broken: [], ambush: true })
    expect(life.actors[0].pose).toBe('idle')
    expect(life.actors[1].pose).toBe('idle')
  })
})

describe('长得不一样的陌生人、男主送东西上门', () => {
  it('门外是姑娘：住进来用她的模型和女名，日志用"她"', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _model, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'beggar')!)
    life.visitModel = 'survivor_f'
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    expect(life.visitVars().ta).toBe('她')
    life.answerVisitor('invite')
    const a = life.actors[3]
    expect(a.model).toBe('survivor_f')
    expect(['小雨', '阿芳', '晓晓', '小美', '阿花', '小婷', '阿梅']).toContain(a.name)
    expect(life.log.at(-1)?.vars?.ta).toBe('她')
  })

  it('顾沉走到铁门外放下东西再走；日志等放下了才记，东西马上到账', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 9 }
    life.spawnCourier = (who, at) => new Courier(who, at)
    const phases: string[] = []
    life.onCourier = (_c, p) => phases.push(p)
    const before = { food: life.stock.food, aff: life.affection.guchen ?? 0 }
    life.giveCare('guchen')
    expect(life.courier).not.toBeNull()
    expect(life.affection.guchen).toBeGreaterThan(before.aff)
    expect(life.log.some((l) => l.key.startsWith('world.army.care'))).toBe(false)
    for (let i = 0; i < 20000 && life.courier; i++) { life.tick(0.05, () => false); life.courier?.follow(0.05, 1.8) }
    expect(life.courier).toBeNull()
    expect(phases).toEqual(['drop', 'gone'])
    expect(life.log.some((l) => l.key.startsWith('world.army.care'))).toBe(true)
  })
})

describe('铁门外的钉板', () => {
  it('末日前花 1500 元铺；踩烂之前不能重复铺；末日后用 2 颗晶核', () => {
    const { life } = simulate('paradise', 0)
    const money = life.money
    expect(life.buildTrap()).toBe(true)
    expect(life.money).toBe(money - 1500)
    expect(life.trap.hp).toBe(100)
    expect(life.buildTrap()).toBe(false)
    life.trap.hp = 0
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 10 }
    life.cores = 1
    expect(life.buildTrap()).toBe(false)
    life.cores = 2
    expect(life.buildTrap()).toBe(true)
    expect(life.cores).toBe(0)
  })

  it('丧尸砸铁门时站在钉板上：一直掉血、钉板磨损，最后被踩烂', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.ammo.n = 0
    life.trap.hp = 30
    life.clock = { day: PROLOGUE_DAYS, hour: 21.1 }
    life.startSiege(6, false)
    const dt = 0.05
    let slowedSeen = false
    for (let i = 0; i < 40000 && life.siege && !life.siege.done && life.trap.hp > 0; i++) {
      life.tick(dt, () => false)
      for (const z of life.siege?.zombies ?? []) { z.follow(dt, z.speed); if (z.slowed) slowedSeen = true }
      for (const a of life.actors) a.follow(dt, 2.2)
    }
    expect(slowedSeen).toBe(true)
    expect(life.trap.hp).toBe(0)
    expect(life.log.some((l) => l.key === 'world.log.trapGone')).toBe(true)
  })
})

describe('生死', () => {
  it('家人饿到底会死（本世永久），全家心情大跌；女主饿死这一世就结束，时间停住', () => {
    const { life } = simulate('paradise', 0)
    life.medkits = 0
    const mom = life.actors[1]
    mom.needs = { ...mom.needs, hunger: 0, thirst: 0 }
    mom.health = 3
    const moodBefore = life.actors[2].needs.mood
    for (let i = 0; i < 400 && !mom.dead; i++) { mom.needs = { ...mom.needs, hunger: 0, thirst: 0 }; life.tick(0.05, () => false) }
    expect(mom.dead).toBe(true)
    expect(mom.lost).toBe(true)
    expect(life.residents).toBe(2)
    expect(life.actors[2].needs.mood).toBeLessThan(moodBefore - 15)
    expect(life.log.some((l) => l.key === 'world.log.died.thirst')).toBe(true)
    const hero = life.actors[0]
    hero.health = 2
    for (let i = 0; i < 400 && !life.over; i++) { hero.needs = { ...hero.needs, hunger: 0, thirst: 0 }; life.tick(0.05, () => false) }
    expect(life.over?.cause).toBe('thirst')
    expect(hero.pose).toBe('down')
    const clock = { ...life.clock }
    life.speed = 1
    life.tick(0.05, () => false)
    expect(life.clock).toEqual(clock)
    // 存档往返：这一世结束的状态还在
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.over?.cause).toBe('thirst')
    expect(b.actors[1].dead).toBe(true)
  })

  it('月底危机夜没守住：倒下的家人里有一个死了，战报写着', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 21.1 }
    life.startSiege(3, true)
    const s = life.siege as unknown as { knockDown: (a: Actor) => void }
    for (const a of life.actors) { a.health = 0; s.knockDown(a) }
    for (let i = 0; i < 200 && life.siege && !life.report; i++) life.tick(0.05, () => false)
    const dead = life.actors.filter((a) => a.dead)
    expect(dead.length).toBe(1)
    expect(dead[0]).not.toBe(life.actors[0])
    expect(life.over).toBeNull()
    expect(life.report?.died).toEqual([dead[0].name])
    expect(life.report?.trapKills).toBe(0)
  })
})

describe('顾沉上门借人', () => {
  it('借一个人去守防线：跟着出门、不在家时不会饿死、两天后带着子弹和吃的回来', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.guchenMet = true
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 10 }
    expect(life.lendable().length).toBe(2)
    life.startVisit(VISITORS.find((v) => v.id === 'guchen_visit')!)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    expect(life.talking?.id).toBe('guchen_visit')
    const ammo = life.ammo.n
    life.answerVisitor('lend')
    const who = life.actors.find((a) => a.name === life.lent?.name)!
    expect(who).toBeTruthy()
    expect(who).not.toBe(life.actors[0])
    for (let i = 0; i < 4000 && !who.away; i++) { life.tick(0.05, () => false); who.follow(0.05, 2.2) }
    expect(who.away).toBe(true)
    expect(life.hud().find((p) => p.name === who.name)?.gone).toBe('lent')
    // 两天后回来（中间家里不打仗）
    who.needs = { ...who.needs, hunger: 0, thirst: 0 }
    life.clock = { day: life.clock.day + 2, hour: 17 }
    life.tick(0.05, () => false)
    expect(life.lent).toBeNull()
    expect(who.away).toBe(false)
    expect(who.dead).toBe(false)
    expect(life.ammo.n).toBe(ammo + 10)
    expect(life.log.some((l) => l.key === 'world.guchen.back')).toBe(true)
  })
})

describe('重生点', () => {
  it('死了发重生点（同一世只发一次），买的加成在下一世开局用掉', async () => {
    const mem = new Map<string, string>()
    const fake = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
    const { vi } = await import('vitest')
    vi.stubGlobal('localStorage', fake)
    const save = await import('./save')
    save.awardRebirthPoints(5)
    save.awardRebirthPoints(5)
    expect(save.rebirthPoints()).toBe(5)
    save.togglePerk('space') // 3
    save.togglePerk('money') // 2
    save.togglePerk('ammo') // 不够了
    expect(save.boughtPerks()).toEqual(['space', 'money'])
    expect(save.rebirthPoints()).toBe(0)
    save.togglePerk('money') // 退掉
    expect(save.rebirthPoints()).toBe(2)
    save.togglePerk('jiangye')
    save.nextLife()
    expect(save.currentLife()).toBe(2)
    const { life } = simulate('paradise', 0)
    const before = { cap: life.spaceCap, aff: life.affection.jiangye ?? 0 }
    expect(save.applyPerks(life)).toEqual(['space', 'jiangye'])
    expect(life.spaceCap).toBe(before.cap + 4)
    expect(life.affection.jiangye).toBe(before.aff + 20)
    // 马上从商店清掉；同一世再开局（开发模式建两次世界）重用同一份
    expect(save.boughtPerks()).toEqual([])
    const again = simulate('paradise', 0).life
    expect(save.applyPerks(again)).toEqual(['space', 'jiangye'])
    // 这一世死在结束画面时买的，是下一世的，不受影响
    expect(save.awardRebirthPoints(3)).toBe(3)
    save.togglePerk('medkit')
    expect(save.boughtPerks()).toEqual(['medkit'])
    save.togglePerk('medkit')
    // 同一世重复调用返回同样的点数，但只加一次
    expect(save.awardRebirthPoints(9)).toBe(3)
    expect(save.rebirthPoints()).toBe(3)
    vi.unstubAllGlobals()
  })
})

describe('第三轮审查（回归测试）', () => {
  it('借出去的人还在往外走时开打：不当守夜的人、也不会被取消路线；不能再借第二个', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    life.spawnZombie = (at) => new Zombie(at)
    life.guchenMet = true
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 10 }
    life.startVisit(VISITORS.find((v) => v.id === 'guchen_visit')!)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.answerVisitor('lend')
    const who = life.actors.find((a) => a.name === life.lent?.name)!
    expect(who.away).toBe(false)
    expect(life.lendable()).toEqual([])
    life.startSiege(2, false)
    expect(who.path.length).toBeGreaterThan(0)
    expect((life.siege as unknown as { o: { defenders: Actor[] } }).o.defenders).not.toContain(who)
    expect(life.commandWalk(who, { x: 2, z: 2, floor: 0 })).toBeNull()
  })

  it('去世的人不再回血、需求也不再变', () => {
    const { life } = simulate('paradise', 0)
    const mom = life.actors[1]
    life.die(mom, 'starve')
    const needs = { ...mom.needs }
    for (let i = 0; i < 200; i++) life.tick(0.05, () => false)
    expect(mom.health).toBe(0)
    expect(mom.needs).toEqual(needs)
  })

  it('女主钓着鱼饿死：还是倒在地上', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 1, hour: 6 }
    expect(life.startFishing()).toBe(true)
    life.die(life.actors[0], 'starve')
    expect(life.actors[0].pose).toBe('down')
    expect(life.fishing).toBeNull()
  })

  it('送东西的人还在路上时存档：日志先记上，刷新也不会丢', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: PROLOGUE_DAYS + 1, hour: 9 }
    life.spawnCourier = (who, at) => new Courier(who, at)
    life.giveCare('xielin')
    expect(life.log.some((l) => l.key === 'world.xielin.note0')).toBe(false)
    const s = JSON.parse(JSON.stringify(snapshot(life)))
    const b = simulate('paradise', 0).life
    restore(b, s)
    expect(b.log.some((l) => l.key === 'world.xielin.note0')).toBe(true)
    expect(b.xielinNotes).toBe(1)
  })
})

describe('危机夜的大块头', () => {
  it('危机夜每五只里有一只大块头（200 血、走得慢），打倒掉 3 颗晶核；普通夜里没有', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 21.05 }
    life.startSiege(10, true)
    for (let i = 0; i < 4000 && (life.siege?.zombies.length ?? 0) < 5; i++) life.tick(0.05, () => false)
    const brute = life.siege!.zombies.find((z) => z.brute)!
    expect(brute.hp).toBe(200)
    expect(brute.speed).toBeLessThan(0.95)
    const cores = life.cores
    ;(life.siege as unknown as { kill: (z: Zombie, by: string) => void }).kill(brute, 'shot')
    expect(life.cores).toBe(cores + 3)
    const b = simulate('paradise', 0).life
    b.spawnZombie = (at) => new Zombie(at)
    b.clock = { day: PROLOGUE_DAYS + 1, hour: 21.05 }
    b.startSiege(6, false)
    for (let i = 0; i < 4000 && (b.siege?.zombies.length ?? 0) < 6; i++) b.tick(0.05, () => false)
    expect(b.siege!.zombies.some((z) => z.brute)).toBe(false)
  })
})

describe('谢临傍晚来访', () => {
  it('塞过两张纸条后傍晚才会来，只来一次；请他吃饭会把楼梯口的箱子堆满', () => {
    const { life } = simulate('paradise', 0)
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    const def = VISITORS.find((v) => v.id === 'xielin_meet')!
    life.clock = { day: PROLOGUE_DAYS + 2, hour: 18 }
    life.xielinNotes = 1
    expect(def.when(life.visitorCtx())).toBe(false)
    life.xielinNotes = 2
    expect(def.when(life.visitorCtx())).toBe(true)
    life.clock = { day: PROLOGUE_DAYS + 2, hour: 11 }
    expect(def.when(life.visitorCtx())).toBe(false)
    life.clock = { day: PROLOGUE_DAYS + 2, hour: 17.2 }
    life.barriers.stairs = 10
    life.startVisit(def)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.answerVisitor('dinner')
    expect(life.barriers.stairs).toBe(life.maxOf('stairs'))
    expect(life.affection.xielin).toBeGreaterThanOrEqual(15)
    expect(def.when(life.visitorCtx())).toBe(false)
  })
})

describe('困难模式', () => {
  it('丧尸多一半，危机夜每三只一只大块头，存档记住', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.hard = true
    life.clock = { day: PROLOGUE_DAYS + 3, hour: 21.05 }
    life.startSiege(10, true)
    for (let i = 0; i < 8000 && (life.siege?.zombies.length ?? 0) < 6; i++) life.tick(0.05, () => false)
    const zs = life.siege!.zombies
    expect(zs.filter((z) => z.brute).map((z) => z.id)).toEqual(zs.filter((z) => z.id % 3 === 2).map((z) => z.id))
    expect((life.siege as unknown as { o: { count: number } }).o.count).toBe(15)
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.hard).toBe(true)
  })
})

describe('防线全破以后', () => {
  it('丧尸能爬上楼梯扑人（以前每秒重新找路会被拉回楼梯口，两边干耗到天亮算"守住了"）', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    life.ammo.n = 0
    life.barriers.gate = 0
    life.barriers.door = 0
    // 楼梯口只剩 1 点：守的人先退到二楼，丧尸一砸就破，然后得爬上来
    life.barriers.stairs = 1
    life.clock = { day: PROLOGUE_DAYS, hour: 21.05 }
    life.startSiege(4, false)
    const dt = 0.05
    let upstairs = false
    for (let i = 0; i < 20000 && !upstairs && life.siege && !life.siege.done; i++) {
      life.tick(dt, () => false)
      for (const z of life.siege?.zombies ?? []) { z.follow(dt, z.speed); if (z.alive && z.floor === 1) upstairs = true }
      for (const a of life.actors) a.follow(dt, 2.2)
    }
    expect(upstairs).toBe(true)
  })
})

describe('疫病夜和沈砚', () => {
  it('跟沈砚有交情：疫病那晚之后，第二天一早他送药来（全家健康 +15）', () => {
    const { life } = simulate('paradise', 0)
    life.spawnZombie = (at) => new Zombie(at)
    // 找到第一个疫病危机夜
    let day = PROLOGUE_DAYS
    while (Household.crisisKind({ day, hour: 21 }) !== 'plague' && day < PROLOGUE_DAYS + 60) day++
    expect(Household.crisisKind({ day, hour: 21 })).toBe('plague')
    life.affection.shenyan = 12
    life.clock = { day, hour: 21.01 }
    life.speed = 1
    life.tick(0.05, () => false)
    expect(life.medicTomorrow).toBe(day + 1)
    life.siege = null
    for (const a of life.actors) a.health = 50
    life.clock = { day: day + 1, hour: 8.2 }
    life.tick(0.05, () => false)
    expect(life.log.some((l) => l.key === 'world.shenyan.care1')).toBe(true)
    expect(life.actors[1].health).toBeGreaterThanOrEqual(64)
  })
})

describe('存档往返（今晚新加的字段）', () => {
  it('钉板、困难模式、击杀数、借人、疫病后送药、钓鱼数、去世的人都能存下来', () => {
    const { life } = simulate('paradise', 0)
    life.trap.hp = 37
    life.hard = true
    life.kills = 41
    life.lent = { name: '妈妈', back: 999 }
    life.medicTomorrow = 12
    life.fishCaught = 3
    life.die(life.actors[2], 'crisis')
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.trap.hp).toBe(37)
    expect(b.hard).toBe(true)
    expect(b.kills).toBe(41)
    expect(b.lent).toEqual({ name: '妈妈', back: 999 })
    expect(b.medicTomorrow).toBe(12)
    expect(b.fishCaught).toBe(3)
    expect(b.actors[2].dead).toBe(true)
    expect(b.actors[2].lost).toBe(true)
    expect(b.over).toBeNull()
  })
})

describe('江野住下来', () => {
  it('好感 70 以上来访时可以请他住下来：成为家里的一员，以后不再来访、危机夜不用另外来帮忙', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _model, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    const def = VISITORS.find((v) => v.id === 'jiangye_care')!
    life.clock = { day: PROLOGUE_DAYS + 2, hour: 10 }
    life.warnedJiangye = true
    life.affection.jiangye = 60
    expect(def.choices.find((c) => c.id === 'stay')!.need!(life.visitorCtx())).toBe(false)
    life.affection.jiangye = 75
    expect(def.choices.find((c) => c.id === 'stay')!.need!(life.visitorCtx())).toBe(true)
    life.startVisit(def)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.answerVisitor('stay')
    const j = life.actors.find((a) => a.name === '江野')!
    expect(j).toBeTruthy()
    expect(j.model).toBe('jiangye')
    expect(j.guest).toBe(false)
    expect(life.jiangyeHome).toBe(true)
    expect(life.residents).toBe(4)
    expect(def.when({ ...life.visitorCtx(), day: life.clock.day + 5 })).toBe(false)
    // 危机夜傍晚不会再"来一个江野"
    let d = PROLOGUE_DAYS
    while (!Household.crisisKind({ day: d, hour: 21 })) d++
    life.clock = { day: d, hour: 19.8 }
    life.tick(0.05, () => false)
    expect(life.guest).toBeNull()
    expect(life.actors.filter((a) => a.name === '江野').length).toBe(1)
  })
})

describe('沈砚留下来', () => {
  it('好感 70 以上：可以请他留下来当家里的医生（护士特质），以后不再上门、也不再送药', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _model, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    life.spawnVisitor = (def, at) => new Visitor(def, at)
    const def = VISITORS.find((v) => v.id === 'shenyan_meet')!
    life.clock = { day: PROLOGUE_DAYS + 2, hour: 10 }
    life.actors[1].health = 40
    life.affection.shenyan = 72
    life.startVisit(def)
    for (let i = 0; i < 4000 && !life.talking; i++) { life.tick(0.05, () => false); life.visitor?.follow(0.05, 1.7) }
    life.answerVisitor('stay')
    const s = life.actors.find((a) => a.name === '沈砚')!
    expect(s.trait).toBe('trait_nurse')
    expect(s.model).toBe('shenyan')
    expect(life.shenyanHome).toBe(true)
    expect(life.hasTrait('trait_nurse')).toBe(true)
    expect(life.actors[1].health).toBeGreaterThanOrEqual(75)
    life.actors[1].health = 30
    expect(def.when({ ...life.visitorCtx(), day: life.clock.day + 10 })).toBe(false)
  })
})

describe('末日降临', () => {
  it('跨进末日第一天：记一笔、通知画面（只一次）', () => {
    const { life } = simulate('paradise', 0)
    let n = 0
    life.onDoomsday = () => n++
    life.clock = { day: PROLOGUE_DAYS - 1, hour: 23.98 }
    life.speed = 1
    for (let i = 0; i < 100; i++) life.tick(0.05, () => false)
    expect(life.clock.day).toBe(PROLOGUE_DAYS)
    expect(n).toBe(1)
    expect(life.log.filter((l) => l.key === 'world.log.doomday').length).toBe(1)
  })
})

describe('弩', () => {
  it('第一次去五金店带回一把弩，爸爸守夜改用弩：射得远、不耗子弹；存档后还在爸爸手上', () => {
    const { life } = simulate('paradise', 0)
    life.clock = { day: 0, hour: 9 }
    life.speed = 3
    const mom = life.actors[1]
    life.onShop = (t) => { expect(life.checkout(t.id, { crossbow: 1 })).toBe('ok') }
    expect(life.startTrip('hardware', [mom])).toBe(true)
    const dt = 0.1
    for (let i = 0; i < 20000 && life.trip; i++) {
      life.tick(dt, (a) => life.isHomeBody(a))
      for (const a of life.actors) { a.follow(dt * life.speed, 2.2); a.updateSettle(dt * life.speed) }
    }
    expect(life.crossbow).toBe(true)
    expect(life.actors[2].weapon).toBe('crossbow')
    expect(life.log.some((l) => l.key === 'world.log.crossbow')).toBe(true)
    // 守夜：爸爸放弩箭，子弹一发不少（女主没子弹）
    life.spawnZombie = (at) => new Zombie(at)
    life.ammo.n = 0
    let bolts = 0
    const emit = life.onSiege
    life.onSiege = (e) => { if (e.kind === 'bolt') bolts++; emit?.(e) }
    life.clock = { day: PROLOGUE_DAYS, hour: 21.05 }
    life.startSiege(3, false)
    for (let i = 0; i < 20000 && life.siege && !life.siege.done; i++) {
      life.tick(0.05, () => false)
      for (const z of life.siege?.zombies ?? []) z.follow(0.05, z.speed)
      for (const a of life.actors) a.follow(0.05, 2.2)
    }
    expect(bolts).toBeGreaterThan(0)
    expect(life.ammo.n).toBe(0)
    // 存档往返：爸爸手上还是弩
    life.siege = null
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.actors[2].weapon).toBe('crossbow')
  })
})

describe('弩的传承', () => {
  it('拿弩的人去世了，弩交给家里别的人', () => {
    const { life } = simulate('paradise', 0)
    life.crossbow = true
    life.equipCrossbow()
    expect(life.actors[2].weapon).toBe('crossbow')
    life.die(life.actors[2], 'crisis')
    expect(life.actors[1].weapon).toBe('crossbow')
  })
})

describe('第五轮审查（回归测试）', () => {
  it('爸爸去世后弩在妈妈手上；存档读档以后还在活着的人手上', () => {
    const { life } = simulate('paradise', 0)
    life.crossbow = true
    life.equipCrossbow()
    life.die(life.actors[2], 'crisis')
    expect(life.actors[1].weapon).toBe('crossbow')
    const b = simulate('paradise', 0).life
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.actors[2].dead).toBe(true)
    expect(b.actors[2].weapon).not.toBe('crossbow')
    expect(b.actors[1].weapon).toBe('crossbow')
  })

  it('住进来的沈砚读档后还是医生的轻武器', () => {
    const { life } = simulate('paradise', 0)
    life.makeActor = (name, _model, at) => new Actor(name, '#888', '#222', 1, at, { hunger: 60, thirst: 60, energy: 70, mood: 60 })
    const s = life.addResident('沈砚', 'shenyan', { x: 4, z: 10 }, 'trait_nurse')!
    expect(s.weapon).toBe('pin')
    const b = simulate('paradise', 0).life
    b.makeActor = life.makeActor
    restore(b, JSON.parse(JSON.stringify(snapshot(life))))
    expect(b.actors.find((a) => a.name === '沈砚')?.weapon).toBe('pin')
  })
})

describe('闲着的时候找点事', () => {
  it('一天里有人会凑到家人身边说话、有人会收拾屋子（不再原地发呆）', () => {
    const { stats } = simulate('paradise', 1.5)
    const kinds = new Set(stats.flatMap((s) => [...s.kinds]))
    expect(kinds.has('company') || kinds.has('tidy')).toBe(true)
  })
})
