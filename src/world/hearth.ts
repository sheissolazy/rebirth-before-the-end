// 堂屋的电视和火炉，还有买回来的发电机、空调。
// 卡通画风用代码搭（电视柜、方盒子老电视、铁皮炉子、小板凳）；世外桃源画风换成 Poly Haven 模型，电视柜、烟囱、火光、屏幕两边共用。
// 灯一直在场景里（关着时亮度 0），免得灯的数量变了、所有材质重新编译。
import * as THREE from 'three'

const std = (color: THREE.ColorRepresentation, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })

function shadows(g: THREE.Object3D): THREE.Object3D {
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y + h / 2, z)
  return m
}

/** 电视柜的高度（电视放在上面） */
export const TV_STAND_H = 0.5

/** 矮电视柜：胡桃色，两个抽屉、两个铜把手。原点在底面中间，正面朝 +z */
export function tvStand(): THREE.Group {
  const g = new THREE.Group()
  const wood = std('#6b4a30', 0.65)
  const dark = std('#3e2a1a', 0.7)
  const brass = std('#b8913f', 0.35, 0.8)
  g.add(box(0.84, 0.06, 0.42, wood, 0, TV_STAND_H - 0.06, 0))
  g.add(box(0.8, TV_STAND_H - 0.14, 0.38, wood, 0, 0.08, 0))
  for (const x of [-0.36, 0.36]) for (const z of [-0.15, 0.15]) g.add(box(0.05, 0.08, 0.05, dark, x, 0, z))
  for (const x of [-0.2, 0.2]) {
    g.add(box(0.36, 0.15, 0.01, dark, x, 0.24, 0.195))
    g.add(box(0.07, 0.02, 0.02, brass, x, 0.3, 0.205))
  }
  return shadows(g) as THREE.Group
}

/** 卡通画风的老电视：方盒子、深灰外壳、右边一排旋钮。原点在底面中间，屏幕朝 +z */
export function crtTv(): THREE.Group {
  const g = new THREE.Group()
  const shell = std('#4a4744', 0.55)
  g.add(box(0.5, 0.42, 0.4, shell, 0, 0, -0.02))
  // 屏幕边框
  g.add(box(0.4, 0.32, 0.02, std('#1d1c1b', 0.4), -0.03, 0.05, 0.19))
  for (const y of [0.3, 0.2]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 12), std('#b9b4aa', 0.4, 0.5))
    knob.rotation.x = Math.PI / 2
    knob.position.set(0.21, y, 0.19)
    g.add(knob)
  }
  // 兔耳朵天线
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), std('#c9c9c9', 0.3, 0.9))
    rod.position.set(s * 0.07, 0.56, -0.05)
    rod.rotation.z = -s * 0.5
    g.add(rod)
  }
  return shadows(g) as THREE.Group
}

/** 卡通画风的铁皮炉子：黑色圆筒、炉门在 +z 那面。原点在底面中间 */
export function ironStove(): THREE.Group {
  const g = new THREE.Group()
  const iron = std('#2b2a29', 0.55, 0.6)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.95, 20), iron)
  body.position.y = 0.6
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), iron)
  top.position.y = 1.1
  g.add(body, top)
  for (let k = 0; k < 3; k++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), iron)
    const a = (k / 3) * Math.PI * 2
    leg.position.set(Math.sin(a) * 0.24, 0.07, Math.cos(a) * 0.24)
    g.add(leg)
  }
  g.add(box(0.26, 0.2, 0.04, std('#1a1918', 0.5, 0.7), 0, 0.32, 0.3))
  return shadows(g) as THREE.Group
}

/** 卡通画风的小板凳：方木凳。原点在底面中间 */
export function stool(): THREE.Group {
  const g = new THREE.Group()
  const wood = std('#8a6440', 0.75)
  g.add(box(0.36, 0.05, 0.28, wood, 0, 0.38, 0))
  for (const x of [-0.14, 0.14]) for (const z of [-0.1, 0.1]) g.add(box(0.04, 0.38, 0.04, wood, x, 0, z))
  return shadows(g) as THREE.Group
}

/** 炉子的烟囱：从炉顶竖着上去，穿进天花板（屋里的隔墙在家里视角会压低，拐进墙里会悬空，所以直着上） */
export function flue(top: number, up: number): THREE.Group {
  const g = new THREE.Group()
  const iron = std('#1f1f1f', 0.5, 0.7)
  const r = 0.06
  const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r, up - top, 12), iron)
  v.position.y = (top + up) / 2
  // 半中间一道箍
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.04, 12), iron)
  ring.position.y = top + (up - top) * 0.45
  g.add(v, ring)
  return shadows(g) as THREE.Group
}

/** 空调室内机：白色长条，挂在墙上。原点在机身中间，出风口朝 +z */
export function acIndoor(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.27, 0.2), std('#f1f0ec', 0.4))
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.02), std('#c9c8c2', 0.5))
  vent.position.set(0, -0.09, 0.1)
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.012), new THREE.MeshBasicMaterial({ color: '#5fd17a' }))
  led.position.set(0.32, 0.02, 0.101)
  g.add(body, vent, led)
  return shadows(g) as THREE.Group
}

/** 卡通画风的发电机：红色机身、黑色管架。原点在底面中间 */
export function generatorBox(): THREE.Group {
  const g = new THREE.Group()
  const frame = std('#222', 0.5, 0.6)
  g.add(box(0.55, 0.32, 0.36, std('#c0392b', 0.5), 0, 0.12, 0))
  g.add(box(0.3, 0.14, 0.26, std('#e0b23a', 0.5), -0.06, 0.44, 0))
  for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.2]) g.add(box(0.03, 0.56, 0.03, frame, x, 0, z))
  return shadows(g) as THREE.Group
}

/** 电视屏幕：一块贴在屏幕前面的面片。开着的时候画面在动（末日前是新闻主播，末日后是应急广播的字幕卡），旁边一盏蓝白的小灯照亮前面 */
export class TvScreen {
  readonly mesh: THREE.Mesh
  readonly light = new THREE.PointLight('#bcd6ff', 0, 3.2, 2)
  private readonly canvas: HTMLCanvasElement | null
  private readonly tex: THREE.CanvasTexture | null
  private readonly mat: THREE.MeshBasicMaterial
  private t = 0
  private shown: 'off' | 'tv' | 'radio' = 'off'
  private frameT = 0

  constructor(w: number, h: number) {
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
    if (this.canvas) {
      this.canvas.width = 96
      this.canvas.height = 72
      this.tex = new THREE.CanvasTexture(this.canvas)
      this.tex.colorSpace = THREE.SRGBColorSpace
    } else this.tex = null
    this.mat = new THREE.MeshBasicMaterial({ color: '#141516', toneMapped: false })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat)
    this.mesh.userData.noClick = true
  }

  /** 每帧调用。mode：off 关着；tv 新闻频道；radio 应急广播 */
  update(dt: number, mode: 'off' | 'tv' | 'radio'): void {
    this.t += dt
    if (mode !== this.shown) {
      this.shown = mode
      if (mode === 'off' || !this.tex) {
        this.mat.map = null
        this.mat.color.set(mode === 'off' ? '#141516' : '#9fb8d8')
      } else {
        this.mat.map = this.tex
        this.mat.color.set('#ffffff')
      }
      this.mat.needsUpdate = true
      this.frameT = 0
    }
    if (mode === 'off') { this.light.intensity = 0; return }
    // 画面一明一暗地闪（换镜头）
    this.light.intensity = 0.7 + Math.sin(this.t * 7.3) * 0.12 + (Math.sin(this.t * 1.7) > 0.93 ? 0.35 : 0)
    this.frameT -= dt
    if (this.frameT > 0 || !this.canvas || !this.tex) return
    this.frameT = 0.12
    const g = this.canvas.getContext('2d')!
    const W = this.canvas.width
    const H = this.canvas.height
    if (mode === 'tv') {
      // 演播室：蓝色背景、主播（头和肩膀）、下面一条红色滚动字幕
      const grd = g.createLinearGradient(0, 0, 0, H)
      grd.addColorStop(0, '#2b5c9e')
      grd.addColorStop(1, '#173762')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
      g.fillStyle = '#d9e4f2'
      g.fillRect(6, 8, 30, 18)
      g.fillStyle = '#26272b'
      g.beginPath()
      g.ellipse(W * 0.62, H * 0.8, 22, 16, 0, Math.PI, 0)
      g.fill()
      g.fillStyle = '#e8c3a2'
      g.beginPath()
      g.arc(W * 0.62, H * 0.42 + Math.sin(this.t * 3) * 0.6, 8, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#1b1b1b'
      g.fillRect(W * 0.62 - 8, H * 0.42 - 9, 16, 5)
      g.fillStyle = '#c0282d'
      g.fillRect(0, H - 14, W, 14)
      g.fillStyle = '#fff'
      const off = (this.t * 28) % (W + 60)
      for (let k = 0; k < 4; k++) g.fillRect(W - off + k * 22, H - 10, 16, 5)
    } else {
      // 应急广播：黄底黑字的字幕卡，一行行在闪
      g.fillStyle = '#e8b923'
      g.fillRect(0, 0, W, H)
      g.fillStyle = '#1a1a1a'
      g.fillRect(8, 8, W - 16, 12)
      g.fillStyle = '#e8b923'
      g.fillRect(12, 12, 30, 4)
      g.fillStyle = '#1a1a1a'
      for (let k = 0; k < 4; k++) if (Math.floor(this.t * 2) % 5 !== k) g.fillRect(10, 28 + k * 10, W - 20 - ((k * 17) % 30), 5)
    }
    // 扫描线
    g.fillStyle = 'rgba(0,0,0,0.18)'
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1)
    this.tex.needsUpdate = true
  }
}

/** 炉门里的火光：一块橘红色的发光面片 + 一盏一闪一闪的暖灯 */
export class FireGlow {
  readonly group = new THREE.Group()
  readonly light = new THREE.PointLight('#ff8c3a', 0, 5.5, 1.7)
  private readonly mat = new THREE.MeshBasicMaterial({ color: '#ff7a1f', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })
  private t = Math.random() * 10
  private level = 0

  constructor(w: number, h: number) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat)
    door.userData.noClick = true
    this.group.add(door, this.light)
    this.light.position.set(0, 0.1, 0.35)
  }

  update(dt: number, lit: boolean): void {
    this.t += dt
    // 点着、熄灭都慢慢来
    this.level = THREE.MathUtils.damp(this.level, lit ? 1 : 0, 1.5, dt)
    const flick = 0.82 + Math.sin(this.t * 11) * 0.08 + Math.sin(this.t * 23.7) * 0.06 + Math.sin(this.t * 3.1) * 0.05
    this.light.intensity = this.level * 4.2 * flick
    this.mat.opacity = this.level * (0.75 + flick * 0.25)
  }
}
