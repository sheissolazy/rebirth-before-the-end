/** mulberry32：带状态的确定性随机数。所有随机都走这里，state 存在 GameState.rngState。 */
export function seedToState(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h >>> 0) || 1
}

export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, state: t }
}

/** 挂在 state 上的便捷随机器：每次调用推进 rngState。 */
export class Rng {
  private holder: { rngState: number }
  constructor(holder: { rngState: number }) { this.holder = holder }
  float(): number {
    const r = nextRandom(this.holder.rngState)
    this.holder.rngState = r.state
    return r.value
  }
  int(maxExclusive: number): number { return Math.floor(this.float() * maxExclusive) }
  chance(p: number): boolean { return this.float() < p }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)] }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    const total = items.reduce((s, it) => s + Math.max(0, weight(it)), 0)
    if (total <= 0) return undefined
    let r = this.float() * total
    for (const it of items) {
      r -= Math.max(0, weight(it))
      if (r < 0) return it
    }
    return items[items.length - 1]
  }
  /** 掷 n 个骰子，返回成功数 */
  roll(n: number, p: number): number {
    let s = 0
    for (let i = 0; i < n; i++) if (this.chance(p)) s++
    return s
  }
  id(prefix: string): string { return `${prefix}_${this.int(1e9).toString(36)}${this.int(1e6).toString(36)}` }
}
