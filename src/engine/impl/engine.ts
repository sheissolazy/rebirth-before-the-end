import type {
  ContentPack, GameState, NewGameOptions, Placement, WeekReport, EventDef, CompanionJob, MetaProgress, PersonState, Rarity,
} from '../types'
import { RARITY_POINTS, RARITY_ORDER } from '../types'
import { EngineError, turnToTime, PROLOGUE_DEFAULT_WEEKS, type GameEngine } from '../api'
import { ContentIndex } from './content'
import { Rng, seedToState } from './rng'
import { availableEvents, eligibleCards, place, unplace, drawEvents, diceFor, drawChoice, resolveChoice, eventEnergyFor } from './events'
import { endWeek } from './week'
import { grantCard, type EffectCtx } from './effects'
import {
  hasRoom, cardSize, findCard, removeCard, isRomanceable, isCompanion, rarityIndex, shiftRarity, clamp, cardPoints, effectiveRarity,
  baseDefense, usedStorage, baseStorage, spaceStorage, crisisPoints, energyMax, supplyPoints, hasCold, crisisBreakdown, population, populationCap, affectionCap, reservedStorage,
} from './helpers'
import { applyEffects, nextAffectionBoundary } from './effects'
import { CRISIS_POINTS } from '../types'

const BUILDS: Record<NewGameOptions['build'], { strength: number; mind: number; charm: number }> = {
  balanced: { strength: 3, mind: 3, charm: 3 },
  strength: { strength: 5, mind: 2, charm: 2 },
  mind: { strength: 2, mind: 5, charm: 2 },
  charm: { strength: 2, mind: 2, charm: 5 },
}

export function createEngine(content: ContentPack): GameEngine {
  const ci = new ContentIndex(content)

  function withState<T>(state: GameState, fn: (s: GameState, rng: Rng) => T): { state: GameState; result: T } {
    const s = structuredClone(state)
    const rng = new Rng(s)
    const result = fn(s, rng)
    return { state: s, result }
  }
  const mutate = (state: GameState, fn: (s: GameState, rng: Rng) => void): GameState => withState(state, fn).state

  function newGame(_content: ContentPack, options: NewGameOptions): GameState {
    const seed = options.seed ?? Math.random().toString(36).slice(2)
    const meta = options.meta
    const bought = (id: string) => meta.purchased[id] ?? 0
    const prologueWeeks = Math.min(48, PROLOGUE_DEFAULT_WEEKS + bought('shop_weeks') * 4)
    const rngHolder = { rngState: seedToState(seed) }
    const rng = new Rng(rngHolder)
    const attrs = { ...BUILDS[options.build] }
    for (let i = 0; i < bought('shop_attr'); i++) attrs[rng.pick(['strength', 'mind', 'charm'] as const)]++
    const people: Record<string, PersonState> = {}
    for (const n of content.npcs) {
      people[n.id] = {
        id: n.id, defId: n.id, attrs: { ...n.attrs }, alive: true, injury: 0, inBase: n.id === 'dad' || n.id === 'mom',
        affection: n.initialAffection + (n.romanceable && options.bonusNpcId === n.id ? 20 * bought('shop_affection') : 0),
        loyalty: n.id === 'dad' || n.id === 'mom' ? 70 : 50, job: 'idle', harmony: false, equipment: {}, powerRarity: n.powerId ? (n.rarity === 'legendary' ? 'rare' : 'fine') : undefined,
      }
    }
    const state: GameState = {
      seed, rngState: rngHolder.rngState, prologueWeeks, turn: 0, time: turnToTime(0, prologueWeeks),
      hero: {
        name: { zh: '林知夏' }, attrs, energy: 0, energyBonus: 0, health: 10, exposure: 0, butterfly: 0, employed: true, skippedWorkStreak: 0, incapacitatedWeeks: 0,
        equipment: {}, spaceRarity: bought('shop_space') > 0 ? 'fine' : 'common', debt: 0,
      },
      money: 30000 + bought('shop_money') * 50000,
      priceMultiplier: 1,
      base: { type: 'apartment', modules: [] },
      warehouse: [], hand: [],
      people, pets: [],
      factions: Object.fromEntries(content.factions.map((f) => [f.id, { relation: f.initialRelation }])),
      crisis: null,
      forecast: content.memories.map((m) => ({ month: m.month, crisisKind: m.crisisKind, memory: m.memory })),
      drawnEvents: {}, pendingChoice: null, pendingRecruits: [], orders: [], parcels: [], orderedThisWeek: {}, placements: [], flags: {}, unlockedEvents: [], usedOnceEvents: [],
      diary: [{ turn: 0, text: { zh: '我睁开眼。日历上的日期，是末日前四周。' } }],
      lastReport: null, lastNotice: null, noticeSeq: 0, rebirthPointsEarned: 0, ending: null,
    }
    const ctx: EffectCtx = { ci, state, rng }
    // 开局手里有点东西
    for (const id of ['supply_rice_5kg', 'supply_water_box', 'supply_veg', 'trouble_parents']) if (ci.cards.has(id)) grantCard(ctx, id)
    if (bought('shop_dog') > 0 && ci.pets.has('pet_dog')) state.pets.push({ id: rng.id('pet'), defId: 'pet_dog', alive: true })
    // 开局特质
    const traits = (options.traits ?? []).map((id) => content.startTraits.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t)
    const budget = meta.traitPoints + bought('shop_trait')
    const spent = traits.reduce((t, x) => t + x.cost, 0)
    if (spent > budget) throw new EngineError('TRAIT_BUDGET', `特质需要 ${spent} 点，只有 ${budget} 点`)
    for (const t of traits) applyEffects(ctx, t.effects)
    state.hero.energy = energyMax(state)
    drawEvents(ci, state, rng)
    drawChoice(ci, state, rng)
    state.rngState = rngHolder.rngState
    return state
  }

  function buyImpl(s: GameState, rng: Rng, cardDefId: string, count: number, factionId?: string): void {
    const def = ci.card(cardDefId)
    if (def.kind !== 'supply' && def.kind !== 'equipment') throw new EngineError('NOT_FOR_SALE', cardDefId)
    const ctx: EffectCtx = { ci, state: s, rng }
    if (s.time.phase === 'prologue') {
      // 网购：不耗精力，下周到货（大件两周），有运费溢价和每周限购
      if (!def.buyable) throw new EngineError('NOT_BUYABLE', cardDefId)
      const limit = def.weeklyLimit ?? 5
      const already = s.orderedThisWeek[cardDefId] ?? 0
      if (already + count > limit) throw new EngineError('LIMIT', `本周限购 ${limit} 件，已下单 ${already}`)
      const price = Math.round(def.basePrice * s.priceMultiplier * 1.1) * count
      if (s.money < price) throw new EngineError('NO_MONEY', `需要 ${price}`)
      const size = cardSize(ci, { instanceId: '', defId: cardDefId }) * count
      const free = baseStorage(ci, s) + spaceStorage(s) - usedStorage(ci, s, false) - usedStorage(ci, s, true) - reservedStorage(ci, s)
      s.money -= price
      if (size > free) notice(s, `已下单。按现在的仓库，到货时可能放不下（还能放 ${Math.max(0, free)} 格，这单 ${size} 格）：放不下的会进快递站待取，买房或腾地方后再取。`)
      s.orderedThisWeek[cardDefId] = already + count
      s.orders.push({ cardDefId, count, arrivesAtTurn: s.turn + (def.deliveryWeeks ?? 1) + (ci.bases.get(s.base.type)?.deliveryDelay ?? 0), paid: price })
    } else {
      const f = factionId ? ci.factions.get(factionId) : undefined
      if (!f) throw new EngineError('NO_FACTION', 'trade needs a faction')
      if ((s.factions[f.id]?.relation ?? 0) < 0) throw new EngineError('HOSTILE', f.id)
      const cost = RARITY_POINTS[def.rarity] * f.tradeRate * count
      payCores(s, cost)
      for (let i = 0; i < count; i++) grantCard(ctx, cardDefId)
      s.hero.exposure = clamp(s.hero.exposure + count, 0, 100)
    }
  }

  function giftPreview(s: GameState, personId: string, instanceId: string): { raw: number; effective: number; cap: number } {
    const p = s.people[personId]
    const raw = giftRaw(s, personId, instanceId)
    if (!p) return { raw: 0, effective: 0, cap: 100 }
    if (!isRomanceable(ci, p)) return { raw, effective: raw, cap: 100 }
    const cap = Math.min(affectionCap(s, personId), nextAffectionBoundary(p.affection) - 1)
    return { raw, effective: Math.max(0, Math.min(raw, cap - p.affection)), cap }
  }

  /** 送礼价值：他缺的维度翻倍；装备 4×档位；晶核 3×档位；伙伴翻倍算忠诚（未截断） */
  function giftRaw(s: GameState, personId: string, instanceId: string): number {
    const p = s.people[personId]
    const inst = findCard(s, instanceId)
    if (!p || !inst) return 0
    const def = ci.card(inst.defId)
    const rarity = effectiveRarity(ci, inst) ?? 'common'
    const needs = p.generated?.needs ?? ci.npcs.get(p.defId ?? '')?.needs
    let amount = 0
    if (def.kind === 'supply') amount = 3 * (rarityIndex(rarity) + 1) * (def.supplyKind === needs ? 2 : 1)
    else if (def.kind === 'equipment') amount = 4 * (rarityIndex(rarity) + 1)
    else if (def.kind === 'core') amount = 3 * (rarityIndex(rarity) + 1)
    else return 0
    if (isRomanceable(ci, p)) {
      // 暧昧以上收益减半
      if (p.affection >= 60) amount = Math.max(1, Math.floor(amount / 2))
      return amount
    }
    return amount * 2
  }

  function giftValue(s: GameState, personId: string, instanceId: string): number {
    return giftPreview(s, personId, instanceId).effective
  }

  function notice(s: GameState, zh: string): void { s.lastNotice = { zh }; s.noticeSeq += 1 }
  const RZH: Record<string, string> = { common: '普通', fine: '优良', rare: '稀有', legendary: '传说' }

  function payCores(s: GameState, cost: number): void {
    const cores = s.warehouse.filter((c) => ci.card(c.defId).kind === 'core').sort((a, b) => cardPoints(ci, a) - cardPoints(ci, b))
    const total = cores.reduce((t, c) => t + cardPoints(ci, c), 0)
    if (total < cost) throw new EngineError('NO_CORES', `need ${cost} core points`)
    let left = cost
    for (const c of cores) { if (left <= 0) break; left -= cardPoints(ci, c); s.warehouse.splice(s.warehouse.indexOf(c), 1) }
  }

  const engine: GameEngine = {
    newGame,
    availableEvents: (state) => availableEvents(ci, state),
    eligibleCards: (state, eventId, slotId) => eligibleCards(ci, state, eventId, slotId),
    place: (state, placement) => mutate(state, (s) => place(ci, s, placement)),
    unplace: (state, eventId) => mutate(state, (s) => unplace(ci, s, eventId)),
    pickupParcel: (state, instanceId) => mutate(state, (s) => {
      const i = s.parcels.findIndex((c) => c.instanceId === instanceId)
      if (i < 0) throw new EngineError('NO_CARD', instanceId)
      const inst = s.parcels[i]
      const size = cardSize(ci, inst)
      if (hasRoom(ci, s, size, false)) { s.parcels.splice(i, 1); s.warehouse.push(inst) }
      else if (hasRoom(ci, s, size, true)) { s.parcels.splice(i, 1); inst.inSpace = true; s.warehouse.push(inst) }
      else throw new EngineError('NO_ROOM', '仓库和空间都满了，先丢掉点东西')
      notice(s, `取回了${ci.card(inst.defId).name.zh}`)
    }),
    discardParcel: (state, instanceId) => mutate(state, (s) => {
      const i = s.parcels.findIndex((c) => c.instanceId === instanceId)
      if (i < 0) throw new EngineError('NO_CARD', instanceId)
      s.parcels.splice(i, 1)
    }),
    recruit: (state, personId) => mutate(state, (s) => {
      const i = s.pendingRecruits.findIndex((p) => p.id === personId)
      if (i < 0) throw new EngineError('NO_PERSON', personId)
      if (population(s) >= populationCap(ci, s)) throw new EngineError('POP_CAP', `基地住满了（${population(s)}/${populationCap(ci, s)}），换更大的基地或建人口模块`)
      const p = s.pendingRecruits.splice(i, 1)[0]
      p.inBase = true; p.job = 'idle'; p.loyalty = 50
      s.people[p.id] = p
      notice(s, `${p.generated?.name.zh ?? ''}加入了。每周多吃 1 份食物、1 份水。`)
    }),
    dismissRecruit: (state, personId) => mutate(state, (s) => {
      const i = s.pendingRecruits.findIndex((p) => p.id === personId)
      if (i < 0) throw new EngineError('NO_PERSON', personId)
      s.pendingRecruits.splice(i, 1)
    }),
    assignJob: (state, personId, job: CompanionJob) => mutate(state, (s) => {
      const p = s.people[personId]
      if (!p || !p.alive || !p.inBase) throw new EngineError('NO_PERSON', personId)
      if (p.busyWithEventId) throw new EngineError('BUSY', personId)
      p.job = job
    }),
    build: (state, moduleId) => mutate(state, (s) => {
      const m = ci.modules.get(moduleId)
      if (!m) throw new EngineError('NO_MODULE', moduleId)
      if (m.baseType !== s.base.type) throw new EngineError('WRONG_BASE', moduleId)
      if (s.base.modules.some((x) => x.moduleId === moduleId && !x.damaged)) throw new EngineError('ALREADY_BUILT', moduleId)
      if (s.base.building) throw new EngineError('BUSY_BUILDING', s.base.building.moduleId)
      if (m.cost.money && s.money < m.cost.money) throw new EngineError('NO_MONEY', moduleId)
      if (s.hero.energy < 1) throw new EngineError('NO_ENERGY', '开工要 1 点精力')
      for (const req of m.cost.requires ?? []) {
        const have = s.warehouse.filter((c) => c.defId === req.cardId).length
        if (have < req.count) throw new EngineError('NO_REQUIRED', `需要 ${ci.card(req.cardId).name.zh} ×${req.count}，只有 ${have}`)
      }
      // 材料
      const mats = s.warehouse.filter((c) => { const d = ci.card(c.defId); return d.kind === 'supply' && d.supplyKind === 'material' }).sort((a, b) => cardPoints(ci, a) - cardPoints(ci, b))
      const total = mats.reduce((t, c) => t + cardPoints(ci, c), 0)
      if (total < m.cost.materialPoints) throw new EngineError('NO_MATERIAL', `need ${m.cost.materialPoints}`)
      let left = m.cost.materialPoints
      for (const c of mats) { if (left <= 0) break; left -= cardPoints(ci, c); s.warehouse.splice(s.warehouse.indexOf(c), 1) }
      if (m.cost.money) s.money -= m.cost.money
      for (const req of m.cost.requires ?? []) for (let i = 0; i < req.count; i++) { const idx = s.warehouse.findIndex((c) => c.defId === req.cardId); if (idx >= 0) s.warehouse.splice(idx, 1) }
      s.hero.energy -= 1
      s.base.building = { moduleId, weeksLeft: Math.max(1, m.cost.weeks) }
      notice(s, `开工建${m.name.zh}：消耗材料 ${m.cost.materialPoints} 分和 1 点精力，${m.cost.weeks} 周后完工`)
    }),
    endWeek: (state) => {
      const r = withState(state, (s, rng) => endWeek(ci, s, rng))
      return { state: r.state, report: r.result as WeekReport }
    },
    buy: (state, cardDefId, count, factionId) => mutate(state, (s, rng) => buyImpl(s, rng, cardDefId, count, factionId)),
    cancelOrder: (state, orderIndex) => mutate(state, (s) => {
      const o = s.orders[orderIndex]
      if (!o) throw new EngineError('NO_ORDER', String(orderIndex))
      if (s.time.phase !== 'prologue') throw new EngineError('NO_REFUND', '末日了，没人退款')
      s.orders.splice(orderIndex, 1)
      s.money += o.paid ?? 0
      s.orderedThisWeek[o.cardDefId] = Math.max(0, (s.orderedThisWeek[o.cardDefId] ?? 0) - o.count)
      notice(s, `退了 ${ci.card(o.cardDefId).name.zh}×${o.count}，退款 ￥${o.paid ?? 0}`)
    }),
    sell: (state, instanceId, factionId) => mutate(state, (s, rng) => {
      const inst = findCard(s, instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      const def = ci.card(inst.defId)
      if (s.time.phase === 'prologue') {
        if (def.kind !== 'supply' && def.kind !== 'equipment') throw new EngineError('NOT_SELLABLE', instanceId)
        removeCard(s, instanceId)
        s.money += Math.round(def.basePrice * s.priceMultiplier * 0.5)
      } else {
        const f = factionId ? ci.factions.get(factionId) : undefined
        if (!f) throw new EngineError('NO_FACTION', 'trade needs a faction')
        const pts = cardPoints(ci, inst)
        removeCard(s, instanceId)
        const ctx: EffectCtx = { ci, state: s, rng }
        const gained = Math.max(1, Math.floor(pts / f.tradeRate))
        for (let i = 0; i < gained; i++) grantCard(ctx, 'core_common')
      }
    }),
    gift: (state, personId, instanceId) => mutate(state, (s) => {
      const p = s.people[personId]
      if (!p || !p.alive) throw new EngineError('NO_PERSON', personId)
      if (!findCard(s, instanceId)) throw new EngineError('NO_CARD', instanceId)
      const amount = giftValue(s, personId, instanceId)
      const cardName = ci.card(findCard(s, instanceId)!.defId).name.zh
      removeCard(s, instanceId)
      const pname = (p.generated?.name ?? ci.npcs.get(p.defId ?? '')?.name)?.zh ?? ''
      if (isRomanceable(ci, p)) { p.affection = clamp(p.affection + amount, 0, 100); notice(s, `送了${cardName}给${pname}：好感 +${amount}（现在 ${p.affection}）`) }
      else { p.loyalty = clamp(p.loyalty + amount, 0, 100); notice(s, `送了${cardName}给${pname}：忠诚 +${amount}（现在 ${p.loyalty}）`) }
    }),
    giftValue: (state, personId, instanceId) => giftValue(state, personId, instanceId),
    giftPreview: (state, personId, instanceId) => giftPreview(state, personId, instanceId),
    equip: (state, personId, instanceId) => mutate(state, (s) => {
      const inst = findCard(s, instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      const def = ci.card(inst.defId)
      if (def.kind !== 'equipment') throw new EngineError('NOT_EQUIPMENT', instanceId)
      const target = personId === 'hero' ? s.hero : s.people[personId]
      if (!target) throw new EngineError('NO_PERSON', personId)
      if (personId !== 'hero') { const p = s.people[personId]; if (!p.alive || !p.inBase) throw new EngineError('NOT_IN_BASE', '他不在基地，没法给他装备') }
      for (const p of [s.hero, ...Object.values(s.people)]) for (const [slot, id] of Object.entries(p.equipment)) if (id === instanceId) delete p.equipment[slot as keyof typeof p.equipment]
      target.equipment[def.slot] = instanceId
      notice(s, `${personId === 'hero' ? '你' : (s.people[personId].generated?.name ?? ci.npcs.get(s.people[personId].defId ?? '')?.name)?.zh}装备了${def.name.zh}：${def.forAttr ? ['体力', '头脑', '魅力'][['strength', 'mind', 'charm'].indexOf(def.forAttr)] + '检定' : '所有检定'} +${def.bonusDice} 骰`)
    }),
    useSkill: (state, instanceId) => mutate(state, (s) => {
      const inst = findCard(s, instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      const def = ci.card(inst.defId)
      if (def.kind !== 'skill' || !def.counters) throw new EngineError('NOT_SKILL', '这张卡不能顶危机')
      if (!s.crisis || s.crisis.resolved) throw new EngineError('NO_CRISIS', '现在没有要顶的危机')
      if (s.crisis.crisisKind !== def.counters) throw new EngineError('WRONG_KIND', `这张卡只能顶${{ horde: '尸潮', scarcity: '匮乏', climate: '气候', plague: '疫病', human: '人祸' }[def.counters]}`)
      const owner = s.people[def.ownerId]
      if (def.ownerId !== 'hero') {
        if (!owner?.alive) throw new EngineError('OWNER_DEAD', '他已经不在了')
        if (!owner.inBase && owner.affection < 40) throw new EngineError('OWNER_AWAY', '他不在基地，好感也不到朋友，叫不动')
      }
      removeCard(s, instanceId)
      s.crisis.resolved = true
      if (owner && isRomanceable(ci, owner)) owner.affection = clamp(owner.affection + 3, 0, 100)
      notice(s, `${def.name.zh}：本月危机已顶住。技能卡用掉了，他的下一次要等剧情再给`)
    }),
    useIntel: (state, instanceId) => mutate(state, (s) => {
      const inst = findCard(s, instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      const def = ci.card(inst.defId)
      if (def.kind !== 'intel') throw new EngineError('NOT_INTEL', instanceId)
      removeCard(s, instanceId)
      const e = def.effect
      if (e.type === 'revealCrisisRarity') {
        const parts: string[] = []
        if (s.crisis) { s.crisis.revealed = true; const cf = s.forecast.find((x) => x.month === s.time.month); if (cf) cf.rarity = s.crisis.rarity; parts.push(`本月${s.time.month}月危机是${RZH[s.crisis.rarity]}档（需要 ${CRISIS_POINTS[s.crisis.rarity]} 分）`) }
        const month = (s.time.phase === 'apocalypse' ? s.time.month : 0) + e.monthsAhead
        const f = s.forecast.find((x) => x.month === month)
        const mem = ci.pack.memories.find((x) => x.month === month)
        if (f && mem && month !== s.time.month) { f.rarity = mem.baseRarity; parts.push(`${month}月记忆基准是${RZH[mem.baseRarity]}档（需要约 ${CRISIS_POINTS[mem.baseRarity]} 分）`) }
        notice(s, `用了${def.name.zh}：${parts.join('；') || '这个月没有危机可看'}。基地页"前世记忆"已更新`)
      } else if (e.type === 'delayCrisis') { if (s.crisis) s.crisis.dueTurn += 4; notice(s, `用了${def.name.zh}：本月危机结算推迟 4 周`) }
      else if (e.type === 'fixMemory') { s.hero.butterfly = clamp(s.hero.butterfly - 20, 0, 100); notice(s, `用了${def.name.zh}：蝴蝶效应 −20（现在 ${s.hero.butterfly}），危机更接近记忆`) }
      else if (e.type === 'revealFaction') { s.flags[`faction_revealed_${e.factionId}`] = true; notice(s, `用了${def.name.zh}：看清了${ci.factions.get(e.factionId)?.name.zh ?? ''}的底细`) }
    }),
    upgradePower: (state, powerId, coreInstanceIds) => mutate(state, (s) => {
      const power = ci.powers.get(powerId)
      if (!power) throw new EngineError('NO_POWER', powerId)
      const current: Rarity = powerId === 'power_space' ? s.hero.spaceRarity
        : (Object.values(s.people).find((p) => p.defId && ci.npcs.get(p.defId)?.powerId === powerId)?.powerRarity ?? 'common')
      const next = power.levels.find((l) => rarityIndex(l.rarity) > rarityIndex(current))
      if (!next) throw new EngineError('MAX_LEVEL', powerId)
      const cores = coreInstanceIds.map((id) => findCard(s, id)).filter((c) => c && ci.card(c.defId).kind === 'core')
      const pts = cores.reduce((t, c) => t + (c ? cardPoints(ci, c) : 0), 0)
      if (pts < next.upgradeCorePoints) throw new EngineError('NO_CORES', `need ${next.upgradeCorePoints}`)
      for (const id of coreInstanceIds) removeCard(s, id)
      if (powerId === 'power_space') s.hero.spaceRarity = next.rarity
      else { const p = Object.values(s.people).find((x) => x.defId && ci.npcs.get(x.defId)?.powerId === powerId); if (p) p.powerRarity = next.rarity }
      notice(s, `${power.name.zh}升到${RZH[next.rarity]}：${next.desc.zh}（消耗 ${pts} 晶核分）`)
    }),
    moveToSpace: (state, instanceId, inSpace) => mutate(state, (s) => {
      const inst = s.warehouse.find((c) => c.instanceId === instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      if (!!inst.inSpace === inSpace) return
      if (!hasRoom(ci, s, cardSize(ci, inst), inSpace)) throw new EngineError('NO_ROOM', inSpace ? 'space full' : 'warehouse full')
      inst.inSpace = inSpace
      notice(s, inSpace ? `${ci.card(inst.defId).name.zh}放进了空间：抢不走、搜不出` : `${ci.card(inst.defId).name.zh}拿出了空间`)
    }),
    discard: (state, instanceId) => mutate(state, (s) => { if (!removeCard(s, instanceId)) throw new EngineError('NO_CARD', instanceId) }),
    useItem: (state, instanceId) => mutate(state, (s, rng) => {
      const inst = findCard(s, instanceId)
      if (!inst) throw new EngineError('NO_CARD', instanceId)
      const def = ci.card(inst.defId)
      if (def.kind !== 'supply' || !def.onUse) throw new EngineError('NOT_USABLE', instanceId)
      const before = { energy: s.hero.energy, bonus: s.hero.energyBonus }
      applyEffects({ ci, state: s, rng, actorId: 'hero' }, def.onUse)
      if (inst.unitsLeft !== undefined && inst.unitsLeft > 1) inst.unitsLeft--
      else removeCard(s, instanceId)
      notice(s, `用了${def.name.zh}：${s.hero.energyBonus > before.bonus ? `精力上限永久 +${s.hero.energyBonus - before.bonus}` : `本周精力 +${s.hero.energy - before.energy}（现在 ${s.hero.energy}）`}`)
    }),
    choose: (state, choiceId) => {
      const r = withState(state, (s, rng) => resolveChoice(ci, s, rng, choiceId))
      return { state: r.state, result: r.result }
    },
    crisisBreakdown: (state, kind) => {
      const k = kind ?? state.crisis?.crisisKind ?? null
      if (!k) return { kind: null, need: null, have: 0, items: [] }
      const mem = state.time.phase === 'apocalypse' ? ci.pack.memories.find((m) => m.month === state.time.month) : undefined
      const known = state.crisis && state.crisis.crisisKind === k && state.crisis.revealed
      return {
        kind: k,
        need: known && state.crisis ? CRISIS_POINTS[state.crisis.rarity] : null,
        baseline: mem?.crisisKind === k ? mem.baseRarity : undefined,
        have: crisisPoints(ci, state, k),
        items: crisisBreakdown(ci, state, k),
      }
    },
    stats: (state) => ({
      energyMax: energyMax(state),
      population: population(state),
      populationCap: populationCap(ci, state),
      ...(() => {
        const mouths = 1 + Object.values(state.people).filter((p) => p.alive && p.inBase).length
        const petMouths = state.pets.filter((p) => p.alive).reduce((t, p) => t + (ci.pets.get(p.defId)?.weeklyFood ?? 1), 0)
        const units = (kind: 'food' | 'water') => state.warehouse.reduce((t, c) => { const d = ci.card(c.defId); return d.kind === 'supply' && d.supplyKind === kind && (c.spoiled ?? 0) < 2 ? t + (c.unitsLeft ?? 1) : t }, 0)
        return { mouths, petMouths, weeklyFood: mouths + petMouths, weeklyWater: mouths, foodUnits: units('food'), waterUnits: units('water') }
      })(),
      materialPoints: supplyPoints(ci, state, ['material']),
      cold: hasCold(ci, state),
      defense: baseDefense(ci, state),
      storageUsed: usedStorage(ci, state, false), storageCap: baseStorage(ci, state), storageReserved: reservedStorage(ci, state),
      spaceUsed: usedStorage(ci, state, true), spaceCap: spaceStorage(state),
      crisisHave: state.crisis ? crisisPoints(ci, state, state.crisis.crisisKind) : 0,
      crisisNeed: state.crisis ? CRISIS_POINTS[state.crisis.rarity] : 0,
      corePoints: state.warehouse.filter((c) => ci.card(c.defId).kind === 'core').reduce((t, c) => t + cardPoints(ci, c), 0),
    }),
    eventEnergy: (state, eventId) => eventEnergyFor(ci, state, ci.event(eventId)),
    previewDice: (state, eventId, assignments) => diceFor(ci, state, ci.event(eventId), { eventId, assignments, startedTurn: state.turn, resolvesAtTurn: state.turn + 1 }),
    settle: (state, meta) => {
      const ending = state.ending ? ci.pack.endings.find((e) => e.id === state.ending) : undefined
      const pts = state.rebirthPointsEarned + (ending?.rebirthPoints ?? 0)
      return {
        rebirthPoints: meta.rebirthPoints + pts,
        traitPoints: (meta.traitPoints ?? 0) + 1,
        rebirths: meta.rebirths + 1,
        unlockedEndings: state.ending && !meta.unlockedEndings.includes(state.ending) ? [...meta.unlockedEndings, state.ending] : meta.unlockedEndings,
        purchased: { ...meta.purchased },
      }
    },
  }
  return engine
}

export type { EventDef, Placement, MetaProgress }
export { shiftRarity, isCompanion, RARITY_ORDER }
