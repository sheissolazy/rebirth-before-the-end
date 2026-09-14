import { createEngine } from '../src/engine'
import { content } from '../src/content'
import { emptyMeta } from '../src/engine/impl/sim'
const engine = createEngine(content)
let s = engine.newGame(content, { seed: 'chk', build: 'balanced', meta: emptyMeta() })
// 走到末日后，让江野在基地并触发 ev_jiangye_02
for (let i = 0; i < 4; i++) { if (s.pendingChoice) { const e = content.events.find((x) => x.id === s.pendingChoice)!; s = engine.choose(s, e.choices![e.choices!.length - 1].id).state } s = engine.endWeek(s).state }
if (s.pendingChoice) { const e = content.events.find((x) => x.id === s.pendingChoice)!; s = engine.choose(s, e.choices![e.choices!.length - 1].id).state }
console.log('phase', s.time.phase, 'events with jiangye_02:', engine.availableEvents(s).some((e) => e.id === 'ev_jiangye_02'))
// 直接用引擎内部：模拟 rare 结果的效果
import { applyEffects } from '../src/engine/impl/effects'
import { ContentIndex } from '../src/engine/impl/content'
import { Rng } from '../src/engine/impl/rng'
const ci = new ContentIndex(content)
const st = structuredClone(s)
const rng = new Rng(st)
const e = ci.event('ev_jiangye_02')
applyEffects({ ci, state: st, rng, actorId: 'hero', heroPresent: true }, e.outcomes.rare!.effects)
console.log('pets', st.pets, 'pending', st.pendingRecruits.map((p) => p.generated?.name.zh), 'jiangye inBase', st.people.jiangye.inBase, 'bolts', st.warehouse.filter((c) => c.defId === 'supply_bolts').length)
