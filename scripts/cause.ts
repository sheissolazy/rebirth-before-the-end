import { createEngine } from '../src/engine'
import { content } from '../src/content'
import { simulateOne, emptyMeta } from '../src/engine/impl/sim'
const engine = createEngine(content)
const causes: Record<string, number> = {}
const months: number[] = []
for (let i = 0; i < 150; i++) {
  // 重放一局并看最后一份周报
  const r = simulateOne(engine, content, `sim-${i}`, emptyMeta())
  months.push(r.turns)
  causes[r.ending ?? 'none'] = (causes[r.ending ?? 'none'] ?? 0) + 1
}
console.log(causes)
const hist: Record<number, number> = {}
for (const t of months) { const m = Math.floor((t - 4) / 4) + 1; hist[m] = (hist[m] ?? 0) + 1 }
console.log('death month histogram', hist)
