// 音效全部用 WebAudio 现场合成（不用下载音频文件）：枪声、丧尸低吼、砸门、倒塌，
// 还有环境声：白天鸟叫、夜里蛐蛐、远处的江水。浏览器要求第一次点击/按键之后才能出声。

const MUTE_KEY = 'rbte-proto-mute'

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private river: GainNode | null = null
  private nextCricket = 0
  private nextBird = 0
  private lastBash = 0
  muted: boolean

  constructor() {
    let m = false
    try { m = localStorage.getItem(MUTE_KEY) === '1' } catch { /* 隐私模式 */ }
    this.muted = m
  }

  /** 第一次点击或按键时调用 */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.7
    this.master.connect(ctx.destination)
    const len = ctx.sampleRate
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    // 远处的江水：一直开着的低通噪声
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    this.river = ctx.createGain()
    this.river.gain.value = 0.035
    src.connect(lp).connect(this.river).connect(this.master)
    src.start()
  }

  setMuted(m: boolean): void {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* 隐私模式 */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.7
  }

  private get ready(): AudioContext | null {
    return this.ctx && this.master && !this.muted ? this.ctx : null
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private noiseBurst(t: number, type: BiquadFilterType, freq: number, q: number, peak: number, decay: number, sweepTo?: number): void {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + decay)
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, t, peak, 0.004, decay)
    src.connect(f).connect(g).connect(this.master!)
    src.start(t, Math.random() * 0.5)
    src.stop(t + decay + 0.05)
  }

  private tone(t: number, type: OscillatorType, from: number, to: number, peak: number, decay: number, attack = 0.005): void {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + decay)
    const g = ctx.createGain()
    this.env(g, t, peak, attack, decay)
    o.connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + attack + decay + 0.05)
  }

  /** 霰弹枪：一声闷响 + 噼啪的噪声 */
  shot(vol = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'lowpass', 5000, 0.7, 0.9 * vol, 0.32, 260)
    this.tone(t, 'sine', 95, 38, 0.8 * vol, 0.22)
  }

  /** 丧尸的低吼：带颤音的锯齿波过两个共振峰 */
  groan(vol = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    const dur = 0.9 + Math.random() * 0.7
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    const base = 75 + Math.random() * 45
    o.frequency.setValueAtTime(base, t)
    o.frequency.linearRampToValueAtTime(base * 0.8, t + dur)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 4 + Math.random() * 3
    const lg = ctx.createGain()
    lg.gain.value = 6
    lfo.connect(lg).connect(o.frequency)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.25)
    g.gain.linearRampToValueAtTime(0.0001, t + dur)
    for (const [f, q] of [[420, 3], [950, 5]] as const) {
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = f + Math.random() * 80
      bp.Q.value = q
      o.connect(bp).connect(g)
    }
    g.connect(this.master!)
    o.start(t)
    lfo.start(t)
    o.stop(t + dur + 0.05)
    lfo.stop(t + dur + 0.05)
  }

  /** 砸门：铁门是金属哐哐声，木门和箱子是闷闷的咚 */
  bash(metal: boolean, vol = 1): void {
    const ctx = this.ready
    if (!ctx || ctx.currentTime - this.lastBash < 0.18) return
    this.lastBash = ctx.currentTime
    const t = ctx.currentTime
    if (metal) {
      for (const [f, a] of [[410, 0.22], [1090, 0.12], [2230, 0.06]] as const) this.tone(t, 'sine', f, f * 0.98, a * vol, 0.45)
      this.noiseBurst(t, 'highpass', 2500, 0.7, 0.18 * vol, 0.06)
    } else {
      this.noiseBurst(t, 'lowpass', 380, 0.8, 0.5 * vol, 0.16)
      this.tone(t, 'sine', 110, 60, 0.45 * vol, 0.18)
    }
  }

  /** 一层防线倒了 */
  crash(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'lowpass', 2200, 0.6, 0.8, 0.9, 200)
    this.tone(t, 'sine', 70, 30, 0.7, 0.6)
  }

  /** 打倒一只 */
  squelch(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'bandpass', 700, 3, 0.35, 0.2, 250)
    this.tone(t + 0.05, 'triangle', 1500, 2600, 0.05, 0.25) // 晶核叮的一声
  }

  /** 有人受伤 */
  hurt(): void {
    const ctx = this.ready
    if (!ctx) return
    this.noiseBurst(ctx.currentTime, 'bandpass', 1300, 2, 0.25, 0.08)
  }

  /** 每帧：环境声。night 0~1；outdoors 表示镜头在屋外 */
  ambience(night: number, calm: boolean): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    // 夜里的蛐蛐：一串很快的高音
    if (night > 0.3 && calm && t > this.nextCricket) {
      this.nextCricket = t + 0.35 + Math.random() * 0.9
      const f = 4300 + Math.random() * 500
      for (let k = 0; k < 3; k++) this.tone(t + k * 0.045, 'sine', f, f, 0.018 * night, 0.025, 0.003)
    }
    // 白天的鸟：两三声往上滑的啾啾
    if (night < 0.5 && calm && t > this.nextBird) {
      this.nextBird = t + 2.5 + Math.random() * 5
      const n = 2 + Math.floor(Math.random() * 3)
      const f = 2300 + Math.random() * 1200
      for (let k = 0; k < n; k++) this.tone(t + k * 0.14, 'sine', f, f * 1.45, 0.035 * (1 - night), 0.09, 0.01)
    }
  }
}
