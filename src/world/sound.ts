// 音效全部用 WebAudio 现场合成（不用下载音频文件）：枪声、丧尸低吼、砸门、倒塌，
// 还有环境声：白天鸟叫、夜里蛐蛐、远处的江水。浏览器要求第一次点击/按键之后才能出声。

const MUTE_KEY = 'rbte-proto-mute'
const MUSIC_KEY = 'rbte-proto-music'

/** 和弦（MIDI 音高）：白天温柔一点，夜里低一点暗一点 */
const DAY_CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] // Am F C G
const NIGHT_CHORDS = [[45, 48, 52], [40, 43, 47], [41, 45, 48], [40, 43, 47]] // Am Em F Em
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private river: GainNode | null = null
  private nextCricket = 0
  private nextBird = 0
  private lastBash = 0
  muted: boolean
  music: boolean
  private musicBus: GainNode | null = null
  private nextChord = 0
  private chordIdx = 0
  private nextBeat = 0

  constructor() {
    let m = false
    let mu = true
    try {
      m = localStorage.getItem(MUTE_KEY) === '1'
      mu = localStorage.getItem(MUSIC_KEY) !== '0'
    } catch { /* 隐私模式 */ }
    this.muted = m
    this.music = mu
  }

  setMusic(on: boolean): void {
    this.music = on
    try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0') } catch { /* 隐私模式 */ }
  }

  /** 背景音乐：白天四个和弦慢慢换（Am F C G），夜里更低更暗；打丧尸时换成低沉的嗡鸣 + 心跳 */
  private musicTick(ctx: AudioContext, mode: 'day' | 'night' | 'siege'): void {
    if (!this.musicBus) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1100
      this.musicBus = ctx.createGain()
      this.musicBus.gain.value = 0
      this.musicBus.connect(lp).connect(this.master!)
    }
    const want = !this.music ? 0 : mode === 'siege' ? 0.09 : mode === 'night' ? 0.05 : 0.06
    this.musicBus.gain.setTargetAtTime(want, ctx.currentTime, 1.2)
    if (!this.music) return
    const t = ctx.currentTime
    if (mode === 'siege') {
      // 心跳一样的低音，一秒一下
      if (t > this.nextBeat) {
        this.nextBeat = t + 1.05
        for (const [dt, f] of [[0, 55], [0.22, 49]] as const) {
          const o = ctx.createOscillator()
          o.type = 'sine'
          o.frequency.setValueAtTime(f * 1.4, t + dt)
          o.frequency.exponentialRampToValueAtTime(f, t + dt + 0.15)
          const g = ctx.createGain()
          this.env(g, t + dt, 0.9, 0.01, 0.3)
          o.connect(g).connect(this.musicBus)
          o.start(t + dt)
          o.stop(t + dt + 0.4)
        }
      }
      this.nextChord = Math.min(this.nextChord, t + 0.5)
      return
    }
    if (t < this.nextChord) return
    const chords = mode === 'night' ? NIGHT_CHORDS : DAY_CHORDS
    const chord = chords[this.chordIdx++ % chords.length]
    const len = 7
    this.nextChord = t + len - 1.5
    for (const m of chord) for (const detune of [-4, 4]) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = hz(m)
      o.detune.value = detune
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.16, t + 2.2)
      g.gain.linearRampToValueAtTime(0.0001, t + len)
      o.connect(g).connect(this.musicBus)
      o.start(t)
      o.stop(t + len + 0.1)
    }
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
  /** pitch < 1 更低沉（大块头） */
  groan(vol = 1, pitch = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    const dur = (0.9 + Math.random() * 0.7) / Math.sqrt(pitch)
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    const base = (75 + Math.random() * 45) * pitch
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

  /** 有人敲铁门：哐、哐、哐 */
  knock(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    for (let k = 0; k < 3; k++) {
      this.tone(t + k * 0.28, 'sine', 520, 500, 0.12, 0.25)
      this.noiseBurst(t + k * 0.28, 'bandpass', 1800, 2, 0.12, 0.05)
    }
  }

  /** 燃烧瓶：玻璃碎的一声，呼地烧起来，然后噼啪噼啪 */
  fire(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'highpass', 3500, 0.8, 0.35, 0.12)
    this.noiseBurst(t + 0.05, 'bandpass', 500, 0.7, 0.6, 1.2, 1600)
    for (let k = 0; k < 14; k++) this.noiseBurst(t + 0.3 + Math.random() * 2.6, 'highpass', 2500 + Math.random() * 2000, 1, 0.12 + Math.random() * 0.1, 0.03)
  }

  /** 说不清的诡异：一个慢慢升高、带颤音的低音 */
  eerie(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(98, t)
    o.frequency.exponentialRampToValueAtTime(196, t + 4)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 6
    const lg = ctx.createGain()
    lg.gain.value = 4
    lfo.connect(lg).connect(o.frequency)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.12, t + 1.5)
    g.gain.linearRampToValueAtTime(0.0001, t + 4.5)
    o.connect(g).connect(this.master!)
    o.start(t)
    lfo.start(t)
    o.stop(t + 4.6)
    lfo.stop(t + 4.6)
  }

  /** 远处的防空警报：两个音高来回爬升，响几轮慢慢消失（末日降临那一刻） */
  siren(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    for (let k = 0; k < 4; k++) {
      o.frequency.setValueAtTime(380, t + k * 2.4)
      o.frequency.linearRampToValueAtTime(620, t + k * 2.4 + 1.6)
      o.frequency.linearRampToValueAtTime(380, t + k * 2.4 + 2.4)
    }
    // 远处的声音：低通滤掉刺耳的高频
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.07, t + 1.5)
    g.gain.setValueAtTime(0.07, t + 7)
    g.gain.linearRampToValueAtTime(0.0001, t + 9.6)
    o.connect(lp).connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 9.7)
  }

  /** 弩：咔哒一声、弦嗡地一响 */
  twang(vol = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'highpass', 2500, 1, 0.05, 0.12 * vol)
    this.tone(t + 0.01, 'triangle', 180, 120, 0.18, 0.18 * vol)
  }

  /** 水花 */
  splash(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'bandpass', 1400, 0.8, 0.3, 0.35, 500)
    this.tone(t + 0.02, 'sine', 900, 400, 0.05, 0.15)
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

  private rainGain: GainNode | null = null
  private nextThunder = 0

  /** 雨声：一直开着的带通噪声，音量跟着雨势；大雨偶尔打雷 */
  private rainSound(ctx: AudioContext, amount: number): void {
    if (!this.rainGain) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      src.loop = true
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 2400
      bp.Q.value = 0.4
      this.rainGain = ctx.createGain()
      this.rainGain.gain.value = 0
      src.connect(bp).connect(this.rainGain).connect(this.master!)
      src.start()
    }
    this.rainGain.gain.setTargetAtTime(amount * 0.16, ctx.currentTime, 0.4)
    const t = ctx.currentTime
    if (amount > 0.8 && t > this.nextThunder) {
      this.nextThunder = t + 18 + Math.random() * 25
      this.noiseBurst(t + Math.random(), 'lowpass', 180, 0.5, 0.55, 2.4, 60)
    }
  }

  /** 面包车到门口按两下喇叭：滴滴（两个方波音叠在一起，有点破的老车喇叭） */
  honk(vol = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    for (const [at, len] of [[0, 0.16], [0.24, 0.22]]) {
      for (const f of [415, 523]) {
        const o = ctx.createOscillator()
        o.type = 'square'
        o.frequency.value = f
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1800
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t + at)
        g.gain.exponentialRampToValueAtTime(0.06 * vol, t + at + 0.015)
        g.gain.setValueAtTime(0.06 * vol, t + at + len - 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + len)
        o.connect(lp).connect(g).connect(this.master!)
        o.start(t + at)
        o.stop(t + at + len + 0.02)
      }
    }
  }

  /** 铁门吱呀一声：窄带噪声慢慢往上滑 */
  creak(vol = 1): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    this.noiseBurst(t, 'bandpass', 900, 18, 0.12 * vol, 0.7, 1500)
    this.tone(t + 0.05, 'sawtooth', 260, 330, 0.02 * vol, 0.6, 0.15)
  }

  /** 喵：一声往上挑再落下的"咪——呜"（锯齿波过两个共振峰） */
  meow(): void {
    const ctx = this.ready
    if (!ctx) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(520, t)
    o.frequency.linearRampToValueAtTime(820, t + 0.18)
    o.frequency.linearRampToValueAtTime(600, t + 0.55)
    const f1 = ctx.createBiquadFilter()
    f1.type = 'bandpass'
    f1.Q.value = 6
    f1.frequency.setValueAtTime(900, t)
    f1.frequency.linearRampToValueAtTime(1500, t + 0.2)
    f1.frequency.linearRampToValueAtTime(800, t + 0.55)
    const g = ctx.createGain()
    this.env(g, t, 0.22, 0.05, 0.55)
    o.connect(f1).connect(g).connect(this.master!)
    o.start(t)
    o.stop(t + 0.7)
  }

  /** 呼噜：很低的噪声，一秒二十几下地一鼓一鼓 */
  purr(): void {
    const ctx = this.ready
    if (!ctx || !this.noise) return
    const t = ctx.currentTime + 0.5
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 160
    const g = ctx.createGain()
    g.gain.value = 0
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 24
    const depth = ctx.createGain()
    depth.gain.value = 0.18
    lfo.connect(depth).connect(g.gain)
    src.connect(lp).connect(g).connect(this.master!)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(1, t + 0.3)
    env.gain.setValueAtTime(1, t + 1.6)
    env.gain.linearRampToValueAtTime(0, t + 2.2)
    g.disconnect()
    g.connect(env).connect(this.master!)
    src.start(t)
    lfo.start(t)
    src.stop(t + 2.3)
    lfo.stop(t + 2.3)
  }

  private eng: { a: OscillatorNode; b: OscillatorNode; lp: BiquadFilterNode; gain: GainNode } | null = null

  /** 每帧：面包车发动机。level 0 = 熄火 / 听不见，1 = 就在院子里；rev 0~1 = 油门 */
  engine(level: number, rev = 0): void {
    const ctx = this.ready
    if (!ctx) return
    if (!this.eng) {
      if (level <= 0) return
      // 两个低频锯齿/方波叠在一起、低通掉高频：老面包车那种突突突
      const a = ctx.createOscillator()
      a.type = 'sawtooth'
      a.frequency.value = 36
      const b = ctx.createOscillator()
      b.type = 'square'
      b.frequency.value = 18.5
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 240
      const gain = ctx.createGain()
      gain.gain.value = 0
      a.connect(lp)
      b.connect(lp)
      lp.connect(gain).connect(this.master!)
      a.start()
      b.start()
      this.eng = { a, b, lp, gain }
    }
    const t = ctx.currentTime
    this.eng.gain.gain.setTargetAtTime(level * 0.07, t, 0.25)
    this.eng.a.frequency.setTargetAtTime(36 + rev * 34, t, 0.3)
    this.eng.b.frequency.setTargetAtTime(18.5 + rev * 16, t, 0.3)
    this.eng.lp.frequency.setTargetAtTime(240 + rev * 260, t, 0.3)
  }

  /** 每帧：环境声。night 0~1；calm = 没在打仗；rain 0~1 */
  ambience(night: number, calm: boolean, rain = 0): void {
    const ctx = this.ready
    if (!ctx) return
    this.rainSound(ctx, rain)
    this.musicTick(ctx, !calm ? 'siege' : night > 0.5 ? 'night' : 'day')
    const t = ctx.currentTime
    if (rain > 0.3) return // 下雨天没有鸟和蛐蛐
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
