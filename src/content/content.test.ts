import { describe, expect, it } from 'vitest'
import { content } from './index'
import type { Effect, Condition } from '../engine/types'

/** 内容校验：所有引用的 id 必须存在，槽位/结果结构合法。 */
const cardIds = new Set(content.cards.map((c) => c.id))
const eventIds = new Set(content.events.map((e) => e.id))
const npcIds = new Set(content.npcs.map((n) => n.id))
const lootIds = new Set(content.lootTables.map((l) => l.id))
const moduleIds = new Set(content.modules.map((m) => m.id))
const petIds = new Set(content.pets.map((p) => p.id))
const factionIds = new Set(content.factions.map((f) => f.id))
const powerIds = new Set(content.powers.map((p) => p.id))
const locationIds = new Set(content.locations.map((l) => l.id))

function checkEffect(where: string, ef: Effect, problems: string[]) {
  switch (ef.type) {
    case 'gainCard': case 'loseCard': if (!cardIds.has(ef.cardId)) problems.push(`${where}: card ${ef.cardId}`); break
    case 'gainRandom': if (!lootIds.has(ef.table)) problems.push(`${where}: loot ${ef.table}`); break
    case 'affection': case 'npcJoin': case 'npcLeave': if (!npcIds.has(ef.npcId)) problems.push(`${where}: npc ${ef.npcId}`); break
    case 'injure': case 'kill': if (ef.target !== 'hero' && ef.target !== 'self' && !npcIds.has(ef.target)) problems.push(`${where}: target ${ef.target}`); break
    case 'unlockEvent': if (!eventIds.has(ef.eventId)) problems.push(`${where}: event ${ef.eventId}`); break
    case 'relation': if (!factionIds.has(ef.factionId)) problems.push(`${where}: faction ${ef.factionId}`); break
    case 'buildModule': case 'damageModule': if (ef.moduleId && !moduleIds.has(ef.moduleId)) problems.push(`${where}: module ${ef.moduleId}`); break
    case 'adoptPet': case 'losePet': if (!petIds.has(ef.petId)) problems.push(`${where}: pet ${ef.petId}`); break
    case 'powerUp': if (!powerIds.has(ef.powerId)) problems.push(`${where}: power ${ef.powerId}`); break
    default: break
  }
}
function checkCondition(where: string, c: Condition, problems: string[]) {
  if ('npcId' in c && !npcIds.has(c.npcId)) problems.push(`${where}: npc ${c.npcId}`)
  if ('factionId' in c && !factionIds.has(c.factionId)) problems.push(`${where}: faction ${c.factionId}`)
  if ('moduleId' in c && !moduleIds.has(c.moduleId)) problems.push(`${where}: module ${c.moduleId}`)
  if ('cardId' in c && !cardIds.has(c.cardId)) problems.push(`${where}: card ${c.cardId}`)
  if (c.type === 'not') checkCondition(where, c.cond, problems)
}

describe('content integrity', () => {
  it('has unique ids', () => {
    expect(cardIds.size).toBe(content.cards.length)
    expect(eventIds.size).toBe(content.events.length)
  })
  it('events reference existing things', () => {
    const problems: string[] = []
    for (const e of content.events) {
      if (!locationIds.has(e.locationId)) problems.push(`${e.id}: location ${e.locationId}`)
      if (!e.outcomes.fine) problems.push(`${e.id}: missing fine outcome`)
      if (e.check && !e.outcomes.fail) problems.push(`${e.id}: check without fail outcome`)
      if (e.storylineNpcId && !npcIds.has(e.storylineNpcId)) problems.push(`${e.id}: storyline ${e.storylineNpcId}`)
      if (!e.slots.some((s) => s.required)) problems.push(`${e.id}: no required slot`)
      for (const c of e.conditions) checkCondition(e.id, c, problems)
      for (const [k, b] of Object.entries(e.outcomes)) for (const ef of b?.effects ?? []) checkEffect(`${e.id}.${k}`, ef, problems)
    }
    expect(problems).toEqual([])
  })
  it('cards, npcs, modules reference existing things', () => {
    const problems: string[] = []
    for (const c of content.cards) {
      if (c.kind === 'skill' && c.ownerId !== 'hero' && !npcIds.has(c.ownerId)) problems.push(`${c.id}: owner ${c.ownerId}`)
      if (c.kind === 'trouble') for (const id of c.resolvedByEventIds) if (!eventIds.has(id)) problems.push(`${c.id}: resolvedBy ${id}`)
    }
    for (const n of content.npcs) {
      if (n.powerId && !powerIds.has(n.powerId)) problems.push(`${n.id}: power ${n.powerId}`)
      for (const s of n.skillCardIds) if (!cardIds.has(s)) problems.push(`${n.id}: skill ${s}`)
      if (n.factionId && !factionIds.has(n.factionId)) problems.push(`${n.id}: faction ${n.factionId}`)
    }
    for (const m of content.modules) for (const e of m.provides) if (e.type === 'produce' && !cardIds.has(e.cardId)) problems.push(`${m.id}: produce ${e.cardId}`)
    for (const l of content.lootTables) for (const e of l.entries) if (!cardIds.has(e.cardId)) problems.push(`${l.id}: ${e.cardId}`)
    for (const f of content.factions) if (f.leaderNpcId && !npcIds.has(f.leaderNpcId)) problems.push(`${f.id}: leader ${f.leaderNpcId}`)
    expect(problems).toEqual([])
  })
  it('has all 20 crisis cards and 12 memories', () => {
    const crises = content.cards.filter((c) => c.kind === 'crisis')
    expect(crises.length).toBe(20)
    expect(content.memories.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
  it('every apocalypse month has at least one crisis-resolving event kind', () => {
    const kinds = new Set(content.events.filter((e) => e.resolvesCrisis).map((e) => e.resolvesCrisis))
    expect([...kinds].sort()).toEqual(['climate', 'horde', 'human', 'plague', 'scarcity'])
  })
})
