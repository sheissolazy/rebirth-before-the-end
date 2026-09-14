import { createEngine } from '../src/engine'
import { content } from '../src/content'
import { simulateOne, emptyMeta } from '../src/engine/impl/sim'
const engine = createEngine(content)
const seed = process.argv[2] ?? 'sim-0'
const r = simulateOne(engine, content, seed, emptyMeta(), 60, (s, rep) => {
  const st = engine.stats(s)
  const hp = rep.changes.filter((c) => c.label.zh === '健康').map((c) => `${c.delta}:${c.reason.zh}`).join(' ')
  const cr = rep.crisisResult ? `CRISIS ${rep.crisisResult.crisisKind}/${rep.crisisResult.rarity} ${rep.crisisResult.survived ? 'OK' : 'FAIL'}` : ''
  console.log(`t${s.turn} ${s.time.phase === 'prologue' ? 'P' : `${s.time.month}m${s.time.week}w`} hp=${s.hero.health} inc=${s.hero.incapacitatedWeeks} food=${st.foodUnits}/${st.weeklyFood} water=${st.waterUnits}/${st.weeklyWater} pop=${st.population} def=${st.defense} need=${st.crisisHave}/${st.crisisNeed} ${hp} ${cr} ${rep.eventResults.map((x) => `${x.eventId}:${x.outcome}`).join(' ')}`)
})
console.log('ENDING', r.ending)
