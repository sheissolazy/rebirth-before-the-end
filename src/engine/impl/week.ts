import type { GameState, WeekReport, CardInstance } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { turnToTime } from '../api'
import { drawEvents, resolvePlacement, drawChoice } from './events'
import { energyMax, hasCold } from './helpers'
import { drawCrisis, resolveCrisis } from './crisis'
import { grantCard, grantFromLoot, loseRandomCards, applyEffects, type EffectCtx } from './effects'
import { isCompanion, isRomanceable, baseDefense, supplyPoints, cardPoints, personName, clamp } from './helpers'
import { checkAll } from './conditions'
import { EngineError } from '../api'

function emptyReport(state: GameState): WeekReport {
  return { time: state.time, news: [], eventResults: [], upkeep: { money: 0, food: 0, water: 0, health: 0, loyalty: 0 }, spoiled: [], produced: [], delivered: [], deaths: [], changes: [] }
}

/** 记录一段逻辑前后 健康/忠诚/好感 的变化 */
function track(ci: ContentIndex, state: GameState, report: WeekReport, reason: string, fn: () => void): void {
  const h0 = state.hero.health
  const loy = Object.fromEntries(Object.values(state.people).map((p) => [p.id, p.loyalty]))
  const aff = Object.fromEntries(Object.values(state.people).map((p) => [p.id, p.affection]))
  fn()
  if (state.hero.health !== h0) report.changes.push({ label: { zh: '健康' }, delta: state.hero.health - h0, reason: { zh: reason } })
  for (const p of Object.values(state.people)) {
    const name = personName(ci, p).zh
    if (p.loyalty !== loy[p.id] && isCompanion(ci, p)) report.changes.push({ label: { zh: `${name} 忠诚` }, delta: p.loyalty - loy[p.id], reason: { zh: reason } })
    if (p.affection !== aff[p.id] && isRomanceable(ci, p)) report.changes.push({ label: { zh: `${name} 好感` }, delta: p.affection - aff[p.id], reason: { zh: reason } })
  }
}

export function endWeek(ci: ContentIndex, state: GameState, rng: Rng): WeekReport {
  if (state.pendingChoice) throw new EngineError('PENDING_CHOICE', '先处理这周的突发事件')
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
  for (const p of due) track(ci, state, report, `事件「${ci.event(p.eventId).title.zh}」`, () => { report.eventResults.push(resolvePlacement(ci, state, rng, p, report)) })

  // 3b. 网购到货（序章；末日当周先到货再断）与建造进度
  deliverOrders(ci, state, rng, report, wasPrologue)
  state.orderedThisWeek = {}
  if (state.base.building) {
    state.base.building.weeksLeft -= 1
    if (state.base.building.weeksLeft <= 0) {
      const id = state.base.building.moduleId
      const existing = state.base.modules.find((m) => m.moduleId === id)
      if (existing) existing.damaged = false
      else state.base.modules.push({ moduleId: id, damaged: false })
      report.builtModuleId = id
      state.base.building = undefined
    }
  }

  // 4. 派工
  track(ci, state, report, '派工（搜刮受伤 / 训练）', () => runJobs(ci, state, rng, report))

  // 5. 生产
  track(ci, state, report, '医务室治疗', () => produce(ci, state, rng, report))

  // 6. 消耗与忠诚
  upkeep(ci, state, rng, report)

  // 7. 过期
  spoil(ci, state, report)

  // 8. 序章 → 末日 过渡
  if (wasPrologue && state.time.phase === 'apocalypse') track(ci, state, report, '末日降临第一晚', () => apocalypseBegins(ci, state, rng, report))

  // 9. 危机：月末结算 / 月初抽卡
  if (state.time.phase === 'apocalypse') {
    if (state.crisis && state.turn > state.crisis.dueTurn) track(ci, state, report, '月末危机结算', () => resolveCrisis(ci, state, rng, report))
    if (!state.crisis && state.time.week === 1 && state.hero.health > 0) drawCrisis(ci, state, rng, report)
  }

  // 10. 序章物价、贷款利息
  if (state.time.phase === 'prologue') {
    state.priceMultiplier = +(state.priceMultiplier * 1.05).toFixed(3)
    if (state.hero.debt > 0) { const before = state.hero.debt; state.hero.debt = Math.round(state.hero.debt * 1.02); report.changes.push({ label: { zh: '负债' }, delta: state.hero.debt - before, reason: { zh: '贷款利息 2%/周' } }) }
  }

  // 10b. 不出风头就慢慢被遗忘：暴露每周 -1；状态的每周效果与到期
  if (state.hero.exposure > 0) state.hero.exposure -= 1
  for (const st of state.statuses) {
    const d = ci.statuses.get(st.id)
    if (!d || st.untilTurn <= state.turn) continue
    if (d.weeklyExposure) { const e0 = state.hero.exposure; state.hero.exposure = clamp(state.hero.exposure + d.weeklyExposure, 0, 100); if (state.hero.exposure !== e0) report.changes.push({ label: { zh: '暴露' }, delta: state.hero.exposure - e0, reason: { zh: `状态「${d.name.zh}」` } }) }
  }
  const expired = state.statuses.filter((st) => st.untilTurn <= state.turn)
  for (const st of expired) report.news.push({ zh: `状态「${ci.statuses.get(st.id)?.name.zh ?? st.id}」结束了。` })
  state.statuses = state.statuses.filter((st) => st.untilTurn > state.turn)

  // 11. 伙伴叛逃
  desertions(ci, state, rng, report)

  // 11b. 多线：两位男主都住进基地且都 ≥ 暧昧 → 触发修罗场标记
  const crushes = Object.values(state.people).filter((p) => p.alive && p.inBase && isRomanceable(ci, p) && p.affection >= 60)
  state.flags.two_crushes = crushes.length >= 2

  // 11c. 男主关怀：暧昧以上、末日后，每周 25% 送点东西
  if (state.time.phase === 'apocalypse') {
    for (const p of Object.values(state.people)) {
      if (!p.alive || !isRomanceable(ci, p) || p.affection < 60 || !p.defId) continue
      const def = ci.npcs.get(p.defId)
      if (!def?.care?.length || !rng.chance(0.25)) continue
      const care = rng.pick(def.care)
      const c = grantCard({ ci, state, rng, report }, care.cardId)
      report.news.push({ zh: `${def.name.zh}：${care.text.zh}${c ? `（收到 ${ci.card(care.cardId).name.zh}）` : '（仓库满了，没收下）'}` })
      const a0 = p.affection
      applyEffects({ ci, state, rng, report, fromStory: false }, [{ type: 'affection', npcId: p.id, delta: 1 }])
      if (p.affection !== a0) report.changes.push({ label: { zh: `${def.name.zh} 好感` }, delta: p.affection - a0, reason: { zh: '他的关怀' } })
    }
  }

  // 12. 生存点与死亡/结局
  state.rebirthPointsEarned += 1
  if (state.hero.health <= 0) {
    state.ending = 'death'
    report.ending = 'death'
  } else if (state.time.phase === 'apocalypse' && state.time.year >= 2) {
    state.ending = pickEnding(ci, state, rng)
    report.ending = state.ending
  }

  // 13. 精力恢复、日记、抽新事件与突发选择
  state.hero.energy = state.hero.incapacitatedWeeks > 0 ? 0 : energyMax(state)
  if (!state.ending) { drawEvents(ci, state, rng); drawChoice(ci, state, rng) }
  else { state.drawnEvents = {}; state.pendingChoice = null }
  state.lastReport = report
  return report
}

function runJobs(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport): void {
  if (state.time.phase !== 'apocalypse') return
  const ctx: EffectCtx = { ci, state, rng, report }
  const farmMods = state.base.modules.some((m) => !m.damaged && ci.modules.get(m.moduleId)?.provides.some((e) => e.type === 'produce' && e.supplyKind === 'food'))
  const hasTrainingGround = state.base.modules.some((m) => !m.damaged && ci.modules.get(m.moduleId)?.provides.some((e) => e.type === 'trainBonus'))
  const trainCap = hasTrainingGround ? 8 : 6
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
        // 约 12%（有训练场 25%）每周 +1，越高越难；上限 6 / 8
        const attr = rng.pick(['strength', 'mind', 'charm'] as const)
        if (p.attrs[attr] >= trainCap) break
        const chance = (hasTrainingGround ? 0.25 : 0.12) * (4 / (p.attrs[attr] + 1))
        if (rng.chance(Math.min(0.5, chance))) p.attrs[attr] = clamp(p.attrs[attr] + 1, 1, trainCap)
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
      const why = `缺${foodShort > 0 ? `食物 ${foodShort} 份` : ''}${foodShort > 0 && waterShort > 0 ? '、' : ''}${waterShort > 0 ? `水 ${waterShort} 份` : ''}`
      const h0 = state.hero.health
      state.hero.health = clamp(state.hero.health - dmg, 0, 10)
      report.upkeep.health = -dmg
      if (state.hero.health !== h0) report.changes.push({ label: { zh: '健康' }, delta: state.hero.health - h0, reason: { zh: why } })
      for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p)) { const l0 = p.loyalty; p.loyalty = clamp(p.loyalty - 8, 0, 100); report.upkeep.loyalty -= 8; if (p.loyalty !== l0) report.changes.push({ label: { zh: `${personName(ci, p).zh} 忠诚` }, delta: p.loyalty - l0, reason: { zh: '挨饿' } }) }
      if (foodShort > 0) for (const pet of state.pets) if (pet.alive && rng.chance(0.2)) { pet.alive = false; report.news.push({ zh: `${ci.pets.get(pet.defId)?.name.zh ?? '宠物'}饿死了。` }) }
    } else {
      for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p) && p.loyalty < 100) { p.loyalty++; report.changes.push({ label: { zh: `${personName(ci, p).zh} 忠诚` }, delta: 1, reason: { zh: '吃饱了' } }) }
      if (state.hero.health < 10) { state.hero.health++; report.changes.push({ label: { zh: '健康' }, delta: 1, reason: { zh: '吃饱休息' } }) }
    }
  } else {
    // 序章：吃饭花钱，麻烦卡扣钱（逐项记录）
    const cost = Math.round(500 * mouths * state.priceMultiplier)
    state.money = Math.max(0, state.money - cost)
    report.upkeep.money -= cost
    report.changes.push({ label: { zh: '钱' }, delta: -cost, reason: { zh: `吃饭（${mouths} 人 × 500 × 物价 ${state.priceMultiplier}）` } })
  }
  for (const c of state.hand) {
    const d = ci.card(c.defId)
    if (d.kind !== 'trouble') continue
    if (d.weeklyMoneyDelta && state.time.phase === 'prologue') { state.money = Math.max(0, state.money + d.weeklyMoneyDelta); report.upkeep.money += d.weeklyMoneyDelta; report.changes.push({ label: { zh: '钱' }, delta: d.weeklyMoneyDelta, reason: { zh: `麻烦卡「${d.name.zh}」` } }) }
    if (d.weeklyLoyaltyDelta) for (const p of Object.values(state.people)) if (p.alive && p.inBase && isCompanion(ci, p)) { const l0 = p.loyalty; p.loyalty = clamp(p.loyalty + d.weeklyLoyaltyDelta, 0, 100); if (p.loyalty !== l0) report.changes.push({ label: { zh: `${personName(ci, p).zh} 忠诚` }, delta: p.loyalty - l0, reason: { zh: `麻烦卡「${d.name.zh}」` } }) }
    if (d.weeklyExposureDelta) state.hero.exposure = clamp(state.hero.exposure + d.weeklyExposureDelta, 0, 100)
  }
  // 受伤的人慢慢好
  for (const p of Object.values(state.people)) if (p.alive && p.injury > 0 && rng.chance(0.3)) p.injury--
}

function deliverOrders(ci: ContentIndex, state: GameState, rng: Rng, report: WeekReport, wasPrologue: boolean): void {
  if (!state.orders.length) {
    if (state.time.phase === 'apocalypse' && state.parcels.length) { report.news.push({ zh: `快递站里还有 ${state.parcels.length} 件没取的东西。快递站被抢了。` }); state.parcels = [] }
    return
  }
  if (state.time.phase === 'apocalypse' && !wasPrologue) {
    const n = state.orders.reduce((t, o) => t + o.count, 0)
    state.orders = []
    report.news.push({ zh: `你还有 ${n} 件快递在路上。它们永远在路上了。` })
    return
  }
  const ctx: EffectCtx = { ci, state, rng, report }
  const keep: typeof state.orders = []
  for (const o of state.orders) {
    if (o.arrivesAtTurn > state.turn) { keep.push(o); continue }
    let left = o.count
    for (let i = 0; i < o.count; i++) {
      const c = grantCard(ctx, o.cardDefId)
      if (!c) break
      report.delivered.push(c)
      left--
    }
    if (left > 0) {
      // 放不下的进快递站待取区
      for (let i = 0; i < left; i++) {
        const def = ci.card(o.cardDefId)
        const inst = { instanceId: rng.id('c'), defId: o.cardDefId } as (typeof state.parcels)[number]
        if (def.kind === 'supply' && def.shelfLifeWeeks) inst.expiresAtTurn = state.turn + def.shelfLifeWeeks
        if (def.kind === 'supply' && (def.supplyKind === 'food' || def.supplyKind === 'water' || def.units !== undefined)) inst.unitsLeft = def.units ?? 1
        state.parcels.push(inst)
      }
      report.news.push({ zh: `仓库放不下，${ci.card(o.cardDefId).name.zh}×${left} 放在快递站待取。去仓库页"快递站"取回或丢弃；末日一到就取不到了。` })
    }
  }
  state.orders = keep
  // 末日当周：到货的到了，没到的永远到不了；快递站里没取的也没了
  if (state.time.phase === 'apocalypse') {
    if (state.orders.length) {
      const n = state.orders.reduce((t, o) => t + o.count, 0)
      state.orders = []
      report.news.push({ zh: `最后一批快递赶在城市失守前送到了。还有 ${n} 件在路上的，永远到不了了。` })
    }
    if (state.parcels.length) {
      report.news.push({ zh: `快递站里还有 ${state.parcels.length} 件没取的东西。快递站被抢了。` })
      state.parcels = []
    }
  }
}

function spoil(ci: ContentIndex, state: GameState, report: WeekReport): void {
  const cold = hasCold(ci, state)
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
  // 序章的麻烦（催收、唠叨、亲戚借钱）随秩序一起消失
  const gone = state.hand.filter((c) => ['trouble_loan', 'trouble_parents', 'trouble_relatives'].includes(c.defId))
  if (gone.length) { state.hand = state.hand.filter((c) => !gone.includes(c)); report.news.push({ zh: `${gone.map((c) => ci.card(c.defId).name.zh).join('、')}：再也没人打这些电话了。` }) }
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
