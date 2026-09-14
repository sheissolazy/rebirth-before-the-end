/** 用法：npx tsx scripts/sim.ts [runs] */
import { createEngine } from '../src/engine'
import { content } from '../src/content'
import { simulateOne, summarize } from '../src/engine/impl/sim'

const runs = Number(process.argv[2] ?? 200)
const engine = createEngine(content)
const t0 = Date.now()
const results = Array.from({ length: runs }, (_, i) => simulateOne(engine, content, `sim-${i}`))
console.log(JSON.stringify(summarize(results), null, 1))
console.log(`${runs} runs in ${Date.now() - t0}ms`)
console.log('sample:', JSON.stringify(results.slice(0, 3)))
