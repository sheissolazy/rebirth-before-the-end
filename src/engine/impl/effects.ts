import type { Effect, GameState, CardInstance, Rarity, SupplyKind, PersonState, WeekReport } from '../types'
import { RARITY_POINTS, RARITY_ORDER } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { clamp, hasRoom, cardSize, rarityIndex, shiftRarity, isCompanion, personName, hasCold, affectionCap } from './helpers'

export interface EffectCtx {
  ci: ContentIndex
  state: GameState
  rng: Rng
  report?: WeekReport
  /** 效果里 target 为 'self' 时指向谁（事件里放进槽位的人） */
  actorId?: string
  /** 女主是否在场；不在场时 target 'hero' 的伤害/属性效果落到 actor 头上 */
  heroPresent?: boolean
  /** 来自男主剧情事件：允许好感跨档。其它来源（送礼、同行、关怀）只能推到下一档门槛前一格 */
  fromStory?: boolean
}

/** 好感下一档门槛（20/40/60/80），已满 100 */
export function nextAffectionBoundary(a: number): number {
  for (const th of [20, 40, 60, 80]) if (a < th) return th
  return 101
}

/** 生成一张卡的实例并放进仓库/手牌；仓库满则丢弃并返回 null */
export function grantCard(ctx: EffectCtx, defId: string, opts: { affix?: boolean; inSpace?: boolean } = {}): CardInstance | null {
  const { ci, state, rng } = ctx
  const def = ci.card(defId)
  const inst: CardInstance = { instanceId: rng.id('c'), defId }
  if (def.kind === 'supply' && def.shelfLifeWeeks) inst.expiresAtTurn = state.turn + def.shelfLifeWeeks * (def.shelfLifeWeeks <= 8 && hasCold(ci, state) ? 2 : 1)
  if (def.kind === 'supply' && (def.supplyKind === 'food' || def.supplyKind === 'water' || def.units !== undefined)) inst.unitsLeft = def.units ?? 1
  if (def.kind === 'equipment' && opts.affix && ci.pack.affixes.length && rng.chance(0.5)) {
    inst.affixIds = [rng.pick(ci.pack.affixes).id]
  }
  const toHand = def.kind === 'intel' || def.kind === 'skill' || def.kind === 'trouble'
  if (toHand) { state.hand.push(inst); return inst }
  const size = cardSize(ci, inst)
  if (hasRoom(ci, state, size, false)) { state.warehouse.push(inst); return inst }
  if (hasRoom(ci, state, size, true)) { inst.inSpace = true; state.warehouse.push(inst); return inst }
  if (ctx.report && !ctx.report.news.some((n) => n.zh.startsWith('仓库和空间都满了'))) ctx.report.news.push({ zh: `仓库和空间都满了，${def.name.zh}等东西放不下，只能丢在原地。去仓库页丢掉没用的，或者扩容。` })
  return null
}

export function grantFromLoot(ctx: EffectCtx, tableId: string, count: number): CardInstance[] {
  const table = ctx.ci.loot.get(tableId) ?? ctx.ci.pack.lootTables[0]
  const out: CardInstance[] = []
  if (!table) return out
  for (let i = 0; i < count; i++) {
    const entry = ctx.rng.weighted(table.entries, (e) => e.weight)
    if (!entry) break
    const n = entry.count ? entry.count[0] + ctx.rng.int(entry.count[1] - entry.count[0] + 1) : 1
    for (let k = 0; k < n; k++) {
      const c = grantCard(ctx, entry.cardId, { affix: (table.affixChance ?? 0) > 0 })
      if (c) out.push(c)
    }
  }
  return out
}

function findPerson(state: GameState, target: string): PersonState | undefined {
  return state.people[target]
}

const SURVIVOR_FALLBACK_NAMES = [{ zh: '小林' }, { zh: '老陈' }, { zh: '阿伟' }, { zh: '小雨' }, { zh: '大壮' }, { zh: '阿芳' }]

export function generateSurvivor(ctx: EffectCtx, weights?: Partial<Record<Rarity, number>>): PersonState {
  const { ci, rng } = ctx
  const w = { common: 55, fine: 30, rare: 12, legendary: 3, ...weights }
  const rarity = rng.weighted(RARITY_ORDER, (r) => w[r] ?? 0) ?? 'common'
  const total = { common: 4, fine: 6, rare: 8, legendary: 10 }[rarity]
  const attrs = { strength: 1, mind: 1, charm: 1 }
  for (let i = 3; i < total; i++) attrs[rng.pick(['strength', 'mind', 'charm'] as const)]++
  const trait = ci.pack.survivorTraits.length ? rng.pick(ci.pack.survivorTraits) : undefined
  if (trait?.attrDelta) for (const [k, v] of Object.entries(trait.attrDelta)) attrs[k as keyof typeof attrs] = clamp(attrs[k as keyof typeof attrs] + (v ?? 0), 1, 10)
  const pool = ci.pack.survivorNames.length ? ci.pack.survivorNames : SURVIVOR_FALLBACK_NAMES
  const used = new Set(Object.values(ctx.state.people).map((p) => p.generated?.name.zh))
  const free = pool.filter((n) => !used.has(n.zh))
  const names = free.length ? free : pool.map((n) => ({ zh: `${n.zh}${['二', '三', '四', '五'][ctx.rng.int(4)]}` }))
  const needs: SupplyKind = rng.pick(['food', 'water', 'medicine', 'energy', 'weapon', 'material', 'daily'])
  const powerId = rng.chance(0.05) ? rng.pick(ci.pack.powers.filter((p) => p.kind !== 'space'))?.id : undefined
  return {
    id: rng.id('p'),
    generated: { name: rng.pick(names), rarity, traitId: trait?.id ?? '', needs, powerId },
    attrs, alive: true, injury: 0, inBase: true, affection: 0, loyalty: 50, job: 'idle', harmony: false, equipment: {},
    powerRarity: powerId ? 'common' : undefined,
  }
}

export function applyEffect(ctx: EffectCtx, ef: Effect): void {
  const { ci, state, rng, report } = ctx
  const h = state.hero
  // 伙伴带队时，指向女主的伤害/属性效果落到带队的人身上
  if (ctx.heroPresent === false && ctx.actorId && ctx.actorId !== 'hero' && (ef.type === 'injure' || ef.type === 'kill' || ef.type === 'attr') && ef.target === 'hero') {
    ef = { ...ef, target: ctx.actorId } as Effect
  }
  switch (ef.type) {
    case 'money': state.money = Math.max(0, state.money + ef.delta); break
    case 'stat': {
      const max = ef.stat === 'health' ? 10 : 100
      h[ef.stat] = clamp(h[ef.stat] + ef.delta, 0, max)
      break
    }
    case 'attr': {
      const target = ef.target === 'hero' ? h : (ef.target === 'self' && ctx.actorId && ctx.actorId !== 'hero' ? findPerson(state, ctx.actorId) : findPerson(state, ef.target))
      if (!target) break
      // 越高越难涨：3 以下必涨，之后概率 3/当前值（4→75%，6→50%，9→33%）
      if (ef.delta > 0 && !rng.chance(Math.min(1, 3 / target.attrs[ef.attr]))) break
      target.attrs[ef.attr] = clamp(target.attrs[ef.attr] + ef.delta, 1, 10)
      break
    }
    case 'gainCard': for (let i = 0; i < (ef.count ?? 1); i++) grantCard(ctx, ef.cardId, { affix: true }); break
    case 'gainRandom': grantFromLoot(ctx, ef.table, ef.count ?? 1); break
    case 'loseCard': {
      for (let i = 0; i < (ef.count ?? 1); i++) {
        const idx = state.warehouse.findIndex((c) => c.defId === ef.cardId)
        if (idx >= 0) state.warehouse.splice(idx, 1)
        else { const hi = state.hand.findIndex((c) => c.defId === ef.cardId); if (hi >= 0) state.hand.splice(hi, 1) }
      }
      break
    }
    case 'affection': {
      const p = findPerson(state, ef.npcId)
      if (!p) break
      let cap = affectionCap(state, ef.npcId)
      if (!ctx.fromStory) cap = Math.min(cap, nextAffectionBoundary(p.affection) - 1)
      p.affection = ef.delta > 0 ? Math.max(p.affection, Math.min(cap, p.affection + ef.delta)) : clamp(p.affection + ef.delta, 0, 100)
      break
    }
    case 'loyalty': {
      const targets = ef.target === 'all' ? Object.values(state.people).filter((p) => p.alive && p.inBase && isCompanion(ci, p)) : [findPerson(state, ef.target)]
      for (const p of targets) if (p) p.loyalty = clamp(p.loyalty + ef.delta, 0, 100)
      break
    }
    case 'npcJoin': { const p = findPerson(state, ef.npcId); if (p && p.alive) p.inBase = true; break }
    case 'npcLeave': { const p = findPerson(state, ef.npcId); if (p) { p.inBase = false; p.job = 'idle' }; break }
    case 'recruitRandom': {
      if (state.pendingRecruits.length >= 3) break
      const p = generateSurvivor(ctx, ef.rarityWeights)
      p.inBase = false
      state.pendingRecruits.push(p)
      report?.news.push({ zh: `${personName(ci, p).zh}想加入你的基地。去人物页决定收不收。` })
      break
    }
    case 'injure': {
      if (ef.target === 'hero') {
        h.health = clamp(h.health - [0, 1, 3, 5][ef.severity], 0, 10)
        h.incapacitatedWeeks = Math.max(h.incapacitatedWeeks, ef.severity - 1)
      } else {
        const p = ef.target === 'self' && ctx.actorId ? findPerson(state, ctx.actorId) : findPerson(state, ef.target)
        if (p) { p.injury = clamp(p.injury + ef.severity, 0, 3); if (p.injury >= 3) killPerson(ctx, p) }
      }
      break
    }
    case 'kill': {
      if (ef.target === 'hero') { h.health = 0; break }
      const p = ef.target === 'self' && ctx.actorId ? findPerson(state, ctx.actorId) : findPerson(state, ef.target)
      if (p) killPerson(ctx, p)
      break
    }
    case 'setFlag': state.flags[ef.flag] = ef.value ?? true; break
    case 'employment': h.employed = ef.value; if (ef.value) h.skippedWorkStreak = 0; break
    case 'resolveCrisis': if (state.crisis) state.crisis.resolved = true; break
    case 'revealCrisis': {
      const m = state.time.phase === 'apocalypse' ? state.time.month + ef.monthsAhead : 1 + ef.monthsAhead
      if (ef.monthsAhead === 0 && state.crisis) state.crisis.revealed = true
      const f = state.forecast.find((x) => x.month === m)
      if (f) { const mem = ci.pack.memories.find((x) => x.month === m); if (mem) f.rarity = f.rarity ?? mem.baseRarity }
      break
    }
    case 'unlockEvent': if (!state.unlockedEvents.includes(ef.eventId)) state.unlockedEvents.push(ef.eventId); break
    case 'relation': { const f = state.factions[ef.factionId] ?? (state.factions[ef.factionId] = { relation: 0 }); f.relation = clamp(f.relation + ef.delta, -100, 100); break }
    case 'moveBase': state.base = { type: ef.baseType, modules: [] }; break
    case 'buildModule': if (!state.base.modules.some((m) => m.moduleId === ef.moduleId)) state.base.modules.push({ moduleId: ef.moduleId, damaged: false }); break
    case 'damageModule': {
      const candidates = state.base.modules.filter((m) => !m.damaged && (!ef.moduleId || m.moduleId === ef.moduleId))
      if (candidates.length) rng.pick(candidates).damaged = true
      break
    }
    case 'powerUp': {
      if (ef.powerId === 'power_space') h.spaceRarity = shiftRarity(h.spaceRarity, 1)
      else { const p = Object.values(state.people).find((x) => x.defId && ci.npcs.get(x.defId)?.powerId === ef.powerId); if (p) p.powerRarity = shiftRarity(p.powerRarity ?? 'common', 1) }
      break
    }
    case 'adoptPet': if (ci.pets.has(ef.petId)) state.pets.push({ id: rng.id('pet'), defId: ef.petId, alive: true }); break
    case 'losePet': { const p = state.pets.find((x) => x.defId === ef.petId && x.alive); if (p) p.alive = false; break }
    case 'rebirthPoints': state.rebirthPointsEarned += ef.delta; break
    case 'energy':
      if (ef.permanent) h.energyBonus += ef.delta
      h.energy = Math.max(0, h.energy + ef.delta)
      break
    case 'ending': state.ending = ef.endingId; break
  }
  void report
}

export function killPerson(ctx: EffectCtx, p: PersonState): void {
  if (!p.alive) return
  p.alive = false; p.inBase = false; p.job = 'idle'; p.busyWithEventId = undefined
  ctx.report?.deaths.push(p.id)
  ctx.state.diary.push({ turn: ctx.state.turn, text: { zh: `${personName(ctx.ci, p).zh}死了。` } })
}

export function applyEffects(ctx: EffectCtx, effects: Effect[]): void {
  for (const ef of effects) applyEffect(ctx, ef)
}

/** 随机丢失 n 张仓库（非空间）的卡 */
export function loseRandomCards(ctx: EffectCtx, n: number): CardInstance[] {
  const lost: CardInstance[] = []
  for (let i = 0; i < n; i++) {
    const candidates = ctx.state.warehouse.filter((c) => !c.inSpace)
    if (!candidates.length) break
    const c = ctx.rng.pick(candidates)
    ctx.state.warehouse.splice(ctx.state.warehouse.indexOf(c), 1)
    lost.push(c)
  }
  return lost
}

export function pointsOf(r: Rarity): number { return RARITY_POINTS[r] }
export { rarityIndex }
