import type { Condition, GameState } from '../types'
import type { ContentIndex } from './content'
import { Rng } from './rng'
import { affectionRank, rankIndex, supplyPoints, rarityIndex, baseDefense, hasStatus } from './helpers'

export function checkCondition(ci: ContentIndex, state: GameState, c: Condition, rng?: Rng): boolean {
  const t = state.time
  switch (c.type) {
    case 'phase': return t.phase === c.phase
    case 'weeksBeforeEnd': return t.phase === 'prologue' && t.weeksBeforeEnd >= c.from && t.weeksBeforeEnd <= c.to
    case 'month': return t.phase === 'apocalypse' && t.month >= c.from && t.month <= c.to
    case 'year': return t.phase === 'apocalypse' && t.year >= c.from && t.year <= c.to
    case 'flag': return !!state.flags[c.flag] === (c.value ?? true)
    case 'affectionAtLeast': {
      const p = state.people[c.npcId]
      return !!p && rankIndex(affectionRank(p.affection)) >= rankIndex(c.rank)
    }
    case 'npcAlive': return !!state.people[c.npcId]?.alive
    case 'npcInBase': return !!state.people[c.npcId] && state.people[c.npcId].inBase === c.value
    case 'moneyAtLeast': return state.money >= c.amount
    case 'statAtLeast': return state.hero[c.stat] >= c.value
    case 'statAtMost': return state.hero[c.stat] <= c.value
    case 'attrAtLeast': return state.hero.attrs[c.attr] >= c.value
    case 'hasSupplyKind': return supplyPoints(ci, state, [c.supplyKind]) >= c.minPoints
    case 'crisisActive': return !!state.crisis && !state.crisis.resolved && state.crisis.crisisKind === c.crisisKind
    case 'baseType': return state.base.type === c.baseType
    case 'hasModule': return state.base.modules.some((m) => m.moduleId === c.moduleId && !m.damaged)
    case 'relationAtLeast': return (state.factions[c.factionId]?.relation ?? 0) >= c.value
    case 'powerAtLeast': {
      if (c.powerId === 'power_space') return rarityIndex(state.hero.spaceRarity) >= rarityIndex(c.rarity)
      const p = Object.values(state.people).find((x) => x.defId && ci.npcs.get(x.defId)?.powerId === c.powerId)
      return !!p?.powerRarity && rarityIndex(p.powerRarity) >= rarityIndex(c.rarity)
    }
    case 'employed': return state.hero.employed === c.value
    case 'hasPet': return state.pets.some((p) => p.alive && ci.pets.get(p.defId)?.species === c.species)
    case 'defenseAtMost': return baseDefense(ci, state) <= c.value
    case 'defenseAtLeast': return baseDefense(ci, state) >= c.value
    case 'crushesInBase': return Object.values(state.people).filter((p) => p.alive && p.inBase && p.defId && ci.npcs.get(p.defId)?.romanceable && p.affection >= 60).length >= c.min
    case 'status': return hasStatus(state, c.id) === (c.value ?? true)
    case 'hasCard': return state.warehouse.some((x) => x.defId === c.cardId) || state.hand.some((x) => x.defId === c.cardId)
    case 'not': return !checkCondition(ci, state, c.cond, rng)
    case 'random': return rng ? rng.chance(c.chance) : c.chance >= 1
  }
}

export function checkAll(ci: ContentIndex, state: GameState, conds: Condition[], rng?: Rng): boolean {
  return conds.every((c) => checkCondition(ci, state, c, rng))
}
