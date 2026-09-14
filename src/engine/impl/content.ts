import type {
  ContentPack, CardDef, EventDef, NpcDef, ModuleDef, BaseDef, FactionDef, PetDef, PowerDef, LootTableDef, AffixDef, LocationDef,
} from '../types'

/** 内容包索引：按 id 快速查。 */
export class ContentIndex {
  cards = new Map<string, CardDef>()
  events = new Map<string, EventDef>()
  npcs = new Map<string, NpcDef>()
  modules = new Map<string, ModuleDef>()
  bases = new Map<string, BaseDef>()
  factions = new Map<string, FactionDef>()
  pets = new Map<string, PetDef>()
  powers = new Map<string, PowerDef>()
  loot = new Map<string, LootTableDef>()
  affixes = new Map<string, AffixDef>()
  locations = new Map<string, LocationDef>()
  /** 需要被 unlockEvent 解锁才可见的事件 */
  lockedEvents = new Set<string>()

  pack: ContentPack

  constructor(pack: ContentPack) {
    this.pack = pack
    for (const c of pack.cards) this.cards.set(c.id, c)
    for (const e of pack.events) this.events.set(e.id, e)
    for (const n of pack.npcs) this.npcs.set(n.id, n)
    for (const m of pack.modules) this.modules.set(m.id, m)
    for (const b of pack.bases) this.bases.set(b.type, b)
    for (const f of pack.factions) this.factions.set(f.id, f)
    for (const p of pack.pets) this.pets.set(p.id, p)
    for (const p of pack.powers) this.powers.set(p.id, p)
    for (const l of pack.lootTables) this.loot.set(l.id, l)
    for (const a of pack.affixes) this.affixes.set(a.id, a)
    for (const l of pack.locations) this.locations.set(l.id, l)
    for (const e of pack.events) {
      for (const branch of Object.values(e.outcomes)) {
        for (const ef of branch?.effects ?? []) if (ef.type === 'unlockEvent') this.lockedEvents.add(ef.eventId)
      }
    }
  }

  card(id: string): CardDef {
    const c = this.cards.get(id)
    if (!c) throw new Error(`unknown card ${id}`)
    return c
  }
  event(id: string): EventDef {
    const e = this.events.get(id)
    if (!e) throw new Error(`unknown event ${id}`)
    return e
  }
}
