import type { GameState, WeekReport, CardInstance } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { turnToTime } from '../api'
import { drawEvents, resolvePlacement } from './events'
import { drawCrisis, resolveCrisis } from './crisis'
import { grantCard, grantFromLoot, loseRandomCards, type EffectCtx } from './effects'
import { isCompanion, isRomanceable, baseDefense, supplyPoints, cardPoints, personName, clamp } from './helpers'
import { checkAll } from './conditions'

function emptyReport(state: GameState): WeekReport {
  return { time: state.time, news: [], eventResults: [], upkeep: { money: 0, food: 0, water: 0, health: 0, loyalty: 0 }, spoiled: [], produced: [], deaths: [] }
}

export function endWeek(ci: ContentIndex, state: GameState, rng: Rng): WeekReport {
  const report = emptyReport(state)
  const wasPrologue = state.time.phase === 'prologue'

  // 1. 上班考勤（序章）
  if (wasPrologue && state.hero.employed) {
    const worked = state.placements.some((p) => p.eventId === 'ev_office_work' && p.startedTurn === state.turn)
    if (!worked) { state.hero.skippedWorkStreak++; if (state.hero.skippedWorkStreak >= 3) { state.hero.employed = false; report.news.push({ zh: '你被裁了。HR 的邮件很客气。' }) } }
  }

  // 2. 推进时间
  state.turn += 1
  state.time = turnToTime(state.turn, state.prologueWeeks)
  report.time = state.time
  if (state.hero.incapacitatedWeeks > 0) state.hero.incapacitatedWeeks--

  // 3. 结算到期事件
  const due = state.placements.filter((p) => p.resolvesAtTurn <= state.turn)
  state.placements = state.placements.filter((p) => p.resolvesAtTurn > state.turn)
  for (const p of due) report.eventResults.push(resolvePlacement(ci, state, rng, p, report))

  // 4. 派工
  runJobs(ci, state, rng, report)

  // 5. 生产
  produce(ci, state, rng, report)

  // 6. 消耗与忠诚
  upkeep(ci, state, rng, report)

  // 7. 过期
  spoil(ci, state, report)

  // 8. 序章 → 末日 过渡
  if (wasPrologue && state.time.phase === 'apocalypse') apocalypseBegins(ci, state, rng, report)

  // 9. 危机：月末结算 / 月初抽卡
  if (state.time.phase === 'apocalypse') {
    if (state.crisis && state.turn > state.crisis.dueTurn) resolveCrisis(ci, state, rng, report)
    if (!state.crisis && state.time.week === 1 && state.hero.health > 0) drawCrisis(ci, state, rng, report)
  }

  // 10. 序章物价、贷款利息
  if (state.time.phase === 'prologue') {
    state.priceMultiplier = +(state.priceMultiplier * 1.05).toFixed(3)
    if (state.hero.debt > 0) state.hero.debt = Math.round(state.hero.debt * 1.02)
  }

  // 11. 伙伴叛逃
  desertions(ci, state, rng, report)

  // 11b. 多线：两位男主同时 ≥ 暧昧 → 触发修罗场标记
  const crushes = Object.values(state.people).filter((p) => p.alive && isRomanceable(ci, p) && p.affection >= 60)
  if (crushes.length >= 2 && !state.flags.two_crushes) state.flags.two_crushes = true

  // 12. 生存点与死亡/结局
  state.rebirthPointsEarned += 1
  if (state.hero.health <= 0) {
    state.ending = 'death'
    report.ending = 'death'
  } else if (state.time.phase === 'apocalypse' && state.time.year >= 2) {
    state.ending = pickEnding(ci, state, rng)
    report.ending = state.ending
  }

  // 13. 日记 & 抽新事件
  if (report.eventResults.length) state.diary.push({ turn: state.turn, text: report.eventResults[0].text })
  if (!state.ending) drawEvents(ci, state, rng)
  else state.drawnEvents = {}
  state.lastReport = report
  return report
}

function runJobs(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  if (state.time.phase !== 'apocalypse') return
  const ctx: EffectCtx = { ci, state, rng, report }
  const farmMods = state.base.modules.some((m) => !m.damaged && ci.modules.get(m.moduleId)?.provides.some((e) => e.type === 'produce' && e.supplyKind === 'food'))
  const trainBonus = state.base.modules.reduce((s, m) => s + (m.damaged ? 0 : (ci.modules.get(m.moduleId)?.provides.find((e) => e.type === 'trainBonus')?.type === 'trainBonus' ? 2 : 0)), 0)
  for (const p of Object.values(state.people)) {
    if (!p.alive || !p.inBase || p.busyWithEventId) continue
    switch (p.job) {
      case 'farm': if (farmMods && rng.chance(0.5 + p.attrs.strength * 0.05)) { const c = grantCard(ctx, 'supply_veg'); if (c) report.produced.push(c) } break
      case 'scavenge': {
        const s = rng.roll(p.attrs.strength + p.attrs.mind, 0.5)
        if (s === 0) { p.injury = clamp(p.injury + 1, 0, 3); if (p.injury >= 3) { p.alive = false; p.inBase = false; report.deaths.push(p.id) } }
        else report.produced.push(...grantFromLoot(ctx, 'loot_scavenge', Math.min(3, s)))
        break
      }
      case 'train': {
        const attr = rng.pick(['strength', 'mind', 'charm'] as const)
        if (rng.roll(2 + trainBonus, 0.5) >= 2) p.attrs[attr] = clamp(p.attrs[attr] + 1, 1, 10)
        break
      }
      default: break
    }
  }
}

function produce(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const ctx: EffectCtx = { ci, state, rng, report }
  for (const m of state.base.modules) {
    if (m.damaged) continue
    for (const e of ci.modules.get(m.moduleId)?.provides ?? []) {
      if (e.type === 'produce') for (let i = 0; i < e.perWeek; i++) { const c = grantCard(ctx, e.cardId); if (c) report.produced.push(c) }
      if (e.type === 'heal') {
        state.hero.health = clamp(state.hero.health + e.perWeek, 0, 10)
        for (const p of Object.values(state.people)) if (p.alive && p.inBase && p.injury > 0) p.injury = clamp(p.injury - e.perWeek, 0, 3)
      }
    }
  }
}

function consumeKind(ci: ContentIndex, state: GameState, kind: 'food' | 'water', units: number): number {
  let left = units
  const cards = state.warehouse
    .filter((c) => { const d = ci.card(c.defId); return d.kind === 'supply' && d.supplyKind === kind && (c.spoiled ?? 0) < 2 })
    .sort((a, b) => (a.expiresAtTurn ?? 1e9) - (b.expiresAtTurn ?? 1e9) || cardPoints(ci, a) - cardPoints(ci, b))
  for (const c of cards) {
    if (left <= 0) break
    const units = c.unitsLeft ?? 1
    const take = Math.min(units, left)
    left -= take
    c.unitsLeft = units - take
    if (c.unitsLeft <= 0) state.warehouse.splice(state.warehouse.indexOf(c), 1)
  }
  return left
}

function upkeep(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const mouths = 1 + Object.values(state.people).filter((p) => p.alive && p.inBase).length
  const petFood = state.pets.filter((p) => p.alive).reduce((s, p) => s + (ci.pets.get(p.defId)?.weeklyFood ?? 1), 0)
  let foodShort = 0, waterShort = 0
  if (state.time.phase === 'apocalypse') {
    foodShort = consumeKind(ci, state, 'food', mouths + petFood)
    waterShort = consumeKind(ci, state, 'water', mouths)
    report.upkeep.food = mouths + petFood - foodShort
    report.upkeep.water = mouths - waterShort
    if (foodShort > 0 || waterShort > 0) {
      const dmg = Math.min(3, foodShort + waterShort)
      state.hero.health = clamp(state.hero.health - dmg, 0, 10)
      report.upkeep.health = -dmg
      for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p)) { p.loyalty = clamp(p.loyalty - 8, 0, 100); report.upkeep.loyalty -= 8 }
      if (foodShort > 0) for (const pet of state.pets) if (pet.alive && rng.chance(0.2)) { pet.alive = false; report.news.push({ zh: `${ci.pets.get(pet.defId)?.name.zh ?? '宠物'}饿死了。` }) }
    } else {
      for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p)) p.loyalty = clamp(p.loyalty + 1, 0, 100)
      if (state.hero.health < 10) state.hero.health++
    }
  } else {
    // 序章：吃饭花钱，麻烦卡扣钱
    const cost = Math.round(500 * mouths * state.priceMultiplier)
    state.money = Math.max(0, state.money - cost)
    report.upkeep.money -= cost
  }
  for (const c of state.hand) {
    const d = ci.card(c.defId)
    if (d.kind !== 'trouble') continue
    if (d.weeklyMoneyDelta && state.time.phase === 'prologue') { state.money = Math.max(0, state.money + d.weeklyMoneyDelta); report.upkeep.money += d.weeklyMoneyDelta }
    if (d.weeklyLoyaltyDelta) for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p)) p.loyalty = clamp(p.loyalty + d.weeklyLoyaltyDelta, 0, 100)
    if (d.weeklyExposureDelta) state.hero.exposure = clamp(state.hero.exposure + d.weeklyExposureDelta, 0, 100)
  }
  // 受伤的人慢慢好
  for (const p of Object.values(state.people)) if (p.alive && p.injury > 0 && rng.chance(0.3)) p.injury--
}

function spoil(ci: ContentIndex, state: GameState, report: WeekReport): void {
  const cold = state.base.modules.some((m) => !m.damaged && m.moduleId === 'bunker_cold')
  for (const c of state.warehouse) {
    if (c.expiresAtTurn === undefined) continue
    if (c.expiresAtTurn <= state.turn) {
      c.spoiled = (c.spoiled ?? 0) + 1
      const def = ci.card(c.defId)
      c.expiresAtTurn = state.turn + Math.max(2, Math.round((def.kind === 'supply' ? def.shelfLifeWeeks ?? 4 : 4) / 4) * (cold ? 2 : 1))
      report.spoiled.push(c)
    }
  }
  const garbage = state.warehouse.filter((c) => (c.spoiled ?? 0) >= 2)
  for (const g of garbage) state.warehouse.splice(state.warehouse.indexOf(g), 1)
}

function apocalypseBegins(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const ctx: EffectCtx = { ci, state, rng, report }
  state.hero.debt = 0
  state.hero.employed = false
  report.news.push({ zh: '病毒爆发了。一周之内，城市失守。你的贷款再也不用还了。' })
  // 准备度检定：防御 + 武器分 + 食水分
  const readiness = baseDefense(ci, state) + supplyPoints(ci, state, ['weapon']) + Math.min(10, supplyPoints(ci, state, ['food', 'water']) / 2)
  if (readiness < 6) {
    loseRandomCards(ctx, 3)
    state.hero.health = clamp(state.hero.health - 2, 0, 10)
    report.news.push({ zh: '你的门没撑住第一晚。丢了一些东西，也受了伤。' })
  } else if (readiness < 12) {
    loseRandomCards(ctx, 1)
    report.news.push({ zh: '第一晚很吵。你抱着刀坐到天亮。' })
  } else {
    report.news.push({ zh: '你早有准备。门外的声音像是另一个世界的事。' })
    state.rebirthPointsEarned += 5
  }
  state.diary.push({ turn: state.turn, text: { zh: '末日来了。这一次，我准备好了吗？' } })
  // 男主们各归其位
  for (const p of Object.values(state.people)) if (isRomanceable(ci, p) && !p.inBase) p.busyWithEventId = undefined
}

function desertions(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  const ctx: EffectCtx = { ci, state, rng, report }
  for (const p of Object.values(state.people)) {
    if (!p.alive || !p.inBase || !isCompanion(ci, p)) continue
    if (p.loyalty < 30 && rng.chance(0.2)) {
      p.inBase = false; p.job = 'idle'
      const lost = loseRandomCards(ctx, 1)
      report.news.push({ zh: `${personName(ci, p).zh}走了${lost.length ? '，还顺走了一些东西' : ''}。` })
    }
  }
}

function pickEnding(ci: ContentIndex, state: GameState, rng: Rng): string {
  for (const e of ci.pack.endings) if (checkAll(ci, state, e.conditions, rng)) return e.id
  return 'survive_alone'
}

export type { CardInstance }
