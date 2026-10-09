// 让外婆的老宅更像个家：地毯、窗帘、墙上的画、桌上的花、羊皮纸地图。
// 全部是代码画的（贴图用 canvas 现画），不用下载素材；两种画风都能用。
import * as THREE from 'three'
import { FLOOR_H } from './layout'

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const mat = (map: THREE.Texture, rough = 0.95) => new THREE.MeshStandardMaterial({ map, roughness: rough })

/** 地毯：暖红底、几圈花边、中间一个菱形花纹（中式老宅的感觉） */
function rugTexture(base: string, edge: string, accent: string): THREE.CanvasTexture {
  return canvasTex(512, 384, (g) => {
    g.fillStyle = base
    g.fillRect(0, 0, 512, 384)
    // 细细的织物纹理
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
      g.fillRect(Math.random() * 512, Math.random() * 384, 2, 1)
    }
    const band = (inset: number, width: number, color: string) => {
      g.strokeStyle = color
      g.lineWidth = width
      g.strokeRect(inset, inset, 512 - inset * 2, 384 - inset * 2)
    }
    band(14, 14, edge)
    band(34, 4, accent)
    band(46, 8, edge)
    // 回纹一样的小方块
    g.fillStyle = accent
    for (let x = 60; x < 452; x += 28) { g.fillRect(x, 24, 10, 10); g.fillRect(x, 350, 10, 10) }
    // 中间的菱形
    g.save()
    g.translate(256, 192)
    for (const [s, c] of [[110, edge], [86, accent], [60, base], [36, edge]] as const) {
      g.fillStyle = c
      g.beginPath()
      g.moveTo(0, -s * 0.75)
      g.lineTo(s, 0)
      g.lineTo(0, s * 0.75)
      g.lineTo(-s, 0)
      g.closePath()
      g.fill()
    }
    g.restore()
  })
}

function rug(w: number, d: number, tex: THREE.Texture, x: number, z: number, floor: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), [null, null, mat(tex), null, null, null].map((x) => x ?? new THREE.MeshStandardMaterial({ color: '#5a2a24' })))
  m.position.set(x, floor * FLOOR_H + 0.008, z)
  m.receiveShadow = true
  return m
}

/** 风景画：夕阳、远山、湖 */
function paintingTexture(seed: number): THREE.CanvasTexture {
  return canvasTex(320, 240, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 240)
    const palettes = [['#f7c98b', '#f3a283', '#8fb6c9'], ['#bfe0f0', '#e8f1df', '#88b38a'], ['#f4d6a6', '#e9b9a5', '#9fb5a0']]
    const p = palettes[seed % palettes.length]
    sky.addColorStop(0, p[0])
    sky.addColorStop(0.55, p[1])
    sky.addColorStop(1, p[2])
    g.fillStyle = sky
    g.fillRect(0, 0, 320, 240)
    g.fillStyle = 'rgba(255,240,210,0.9)'
    g.beginPath()
    g.arc(220 - seed * 40, 90, 22, 0, Math.PI * 2)
    g.fill()
    const hill = (y: number, amp: number, color: string, ph: number) => {
      g.fillStyle = color
      g.beginPath()
      g.moveTo(0, 240)
      for (let x = 0; x <= 320; x += 8) g.lineTo(x, y + Math.sin(x / 50 + ph) * amp + Math.sin(x / 19 + ph * 2) * amp * 0.3)
      g.lineTo(320, 240)
      g.fill()
    }
    hill(140, 18, '#8aa6a0', seed)
    hill(170, 14, '#6e8f6a', seed + 1.3)
    hill(205, 10, '#4e7351', seed + 2.1)
  })
}

function painting(seed: number, w: number, h: number): THREE.Group {
  const g = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.035), new THREE.MeshStandardMaterial({ color: '#6b4428', roughness: 0.6 }))
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(paintingTexture(seed), 0.85))
  art.position.z = 0.019
  g.add(frame, art)
  return g
}

/** 窗帘：窗户两边各一片，上面一根杆 */
function curtains(color: string): THREE.Group {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  for (const s of [-1, 1]) {
    // 布有褶：用几条竖着的细长方块错开
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.3, 0.035), cloth)
      p.position.set(s * (0.45 + k * 0.065), 1.35, (k % 2) * 0.02)
      p.castShadow = true
      g.add(p)
    }
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 8), new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.5 }))
  rod.rotation.z = Math.PI / 2
  rod.position.y = 2.02
  g.add(rod)
  return g
}

/** 墙上的城市地图：羊皮纸、江、路、几颗图钉 */
export function parchmentMap(): THREE.Group {
  const tex = canvasTex(448, 320, (g) => {
    g.fillStyle = '#ead9b3'
    g.fillRect(0, 0, 448, 320)
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(120,80,40,${Math.random() * 0.06})`
      g.fillRect(Math.random() * 448, Math.random() * 320, 3, 2)
    }
    // 江
    g.strokeStyle = '#6f9fbf'
    g.lineWidth = 16
    g.beginPath()
    g.moveTo(-10, 70)
    g.bezierCurveTo(120, 30, 260, 120, 460, 60)
    g.stroke()
    // 路
    g.strokeStyle = '#b89a6a'
    g.lineWidth = 5
    for (const [x0, y0, x1, y1] of [[40, 300, 420, 150], [90, 110, 160, 310], [230, 100, 300, 310], [20, 200, 440, 230]]) {
      g.beginPath()
      g.moveTo(x0, y0)
      g.lineTo(x1, y1)
      g.stroke()
    }
    // 街区
    g.fillStyle = 'rgba(150,120,80,0.35)'
    for (const [x, y] of [[110, 160], [190, 250], [320, 190], [360, 260], [60, 240]]) g.fillRect(x, y, 34, 24)
    // 图钉（红 = 去过，蓝 = 打算去）
    for (const [x, y, c] of [[120, 170, '#c0392b'], [330, 200, '#c0392b'], [200, 260, '#2e6fa7'], [370, 270, '#2e6fa7']] as const) {
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.beginPath()
      g.arc(x + 3, y + 3, 7, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = c
      g.beginPath()
      g.arc(x, y, 7, 0, Math.PI * 2)
      g.fill()
    }
    g.strokeStyle = '#7a5a36'
    g.lineWidth = 6
    g.strokeRect(3, 3, 442, 314)
  })
  // 立在地上的地图板（两条腿撑着，靠墙放）：屋里的隔墙在家里视角会压低，挂在墙上会悬空
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#5b3d26', roughness: 0.7 })
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.0, 1.4), wood)
  board.position.y = 1.25
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.92), mat(tex, 0.9))
  paper.rotation.y = Math.PI / 2
  paper.position.set(0.017, 1.25, 0)
  g.add(board, paper)
  for (const z of [-0.6, 0.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.75, 0.05), wood)
    leg.position.set(-0.03, 0.875, z)
    leg.rotation.z = 0.08
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.06), wood)
    foot.position.set(0.0, 0.02, z)
    g.add(leg, foot)
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  return g
}

/** 桌上的一瓶花 */
function vase(): THREE.Group {
  const g = new THREE.Group()
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.16, 16), new THREE.MeshStandardMaterial({ color: '#3f6f9a', roughness: 0.35 }))
  pot.position.y = 0.08
  g.add(pot)
  const colors = ['#f2a7b5', '#f6d36b', '#ffffff', '#f08a7e']
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), new THREE.MeshStandardMaterial({ color: '#4e8a43' }))
    stem.position.set(Math.cos(a) * 0.02, 0.22, Math.sin(a) * 0.02)
    stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25)
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), new THREE.MeshStandardMaterial({ color: colors[k % colors.length], roughness: 0.8 }))
    bloom.position.set(Math.cos(a) * 0.05, 0.3 + (k % 3) * 0.015, Math.sin(a) * 0.05)
    g.add(stem, bloom)
  }
  return g
}

/** 把装饰都摆进屋里（只摆在镜头对面的北墙、西墙上，靠近镜头的两面墙在家里视角下会压低） */
export function decorateHouse(scene: THREE.Object3D, upper: THREE.Object3D, tableTop: number): THREE.Group[] {
  const g = new THREE.Group()
  // 二楼的东西挂在二楼那一组下面：只看一楼时跟着楼板一起藏起来
  const g1 = new THREE.Group()
  // 地毯：堂屋八仙桌下一块大的、爸妈屋里一块、二楼小客厅沙发前一块、女主房间床边一块
  g.add(rug(2.6, 2.0, rugTexture('#a8443a', '#6e2a24', '#e2b25c'), 6.0, 2.6, 0))
  g.add(rug(1.5, 1.0, rugTexture('#3f6b6a', '#2a4848', '#e7c98a'), 1.6, 4.9, 0))
  g1.add(rug(1.8, 1.3, rugTexture('#c08b52', '#7a5232', '#f3e3c0'), 6.0, 2.4, 1))
  g1.add(rug(1.3, 1.0, rugTexture('#8a5a7a', '#4e2f45', '#f0d9b5'), 2.2, 4.0, 1))
  // 窗帘：北墙（z=-3）和西墙（x=0）的窗户，往屋里挪一点
  const add = (o: THREE.Object3D, x: number, y: number, z: number, ry: number) => {
    o.position.set(x, y, z)
    o.rotation.y = ry
    ;(y >= FLOOR_H - 0.01 ? g1 : g).add(o)
  }
  for (const [x, f, c] of [[3.5, 0, '#e9cfa0'], [6.5, 0, '#e9cfa0'], [10.5, 0, '#e9cfa0'], [1.5, 1, '#d9b7c4'], [6.5, 1, '#d9b7c4'], [10.5, 1, '#c9d3b4']] as const) {
    add(curtains(c), x, f * FLOOR_H, -2.86, 0)
  }
  add(curtains('#e9cfa0'), 0.14, 0, -1.5, Math.PI / 2)
  add(curtains('#e9cfa0'), 0.14, 0, 3.5, Math.PI / 2)
  add(curtains('#d9b7c4'), 0.14, FLOOR_H, -1.5, Math.PI / 2)
  add(curtains('#d9b7c4'), 0.14, FLOOR_H, 3.5, Math.PI / 2)
  // 墙上的画
  // （只挂在北墙、西墙这两面外墙上：屋里的隔墙在家里视角会压低，挂上去会悬空）
  add(painting(0, 0.5, 0.62), 1.0, 1.65, -2.87, 0) // 厨房灶台上方的挂历
  add(painting(1, 0.7, 0.5), 0.13, 1.55, 5.0, Math.PI / 2) // 爸妈屋里
  add(painting(2, 0.8, 0.55), 0.13, FLOOR_H + 1.5, 2.2, Math.PI / 2) // 女主床头
  add(painting(0, 0.6, 0.45), 2.6, FLOOR_H + 1.6, -2.87, 0) // 客房二
  add(painting(2, 0.55, 0.7), 9.2, FLOOR_H + 1.55, -2.87, 0) // 客房一
  // 桌上的花
  const v = vase()
  v.position.set(6, tableTop, 2.6)
  g.add(v)
  for (const grp of [g, g1]) grp.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).receiveShadow = true })
  scene.add(g)
  upper.add(g1)
  return [g, g1]
}

/** 晾衣绳在院子西边偏南（房子左手、镜头看得见、平时没人走；北边那片草地留给坟）：两根杆子、一根绳 */
export const CLOTHESLINE = { x: -3.3, z0: 6.4, z1: 9.8 }

/** 一件晾着的衣服 / 毛巾：纯色画布 + 一道花边，挂在绳上可以随风摆 */
function cloth(kind: 'shirt' | 'towel' | 'pants' | 'dress', color: string, trim: string): THREE.Object3D {
  const pivot = new THREE.Group()
  let geo: THREE.BufferGeometry
  if (kind === 'shirt') {
    // T 恤：身子 + 两只袖子，用一个形状画出来
    const s = new THREE.Shape()
    s.moveTo(-0.2, 0); s.lineTo(0.2, 0); s.lineTo(0.32, -0.12); s.lineTo(0.24, -0.2); s.lineTo(0.17, -0.14)
    s.lineTo(0.17, -0.55); s.lineTo(-0.17, -0.55); s.lineTo(-0.17, -0.14); s.lineTo(-0.24, -0.2); s.lineTo(-0.32, -0.12); s.closePath()
    geo = new THREE.ShapeGeometry(s)
  } else if (kind === 'pants') {
    const s = new THREE.Shape()
    s.moveTo(-0.17, 0); s.lineTo(0.17, 0); s.lineTo(0.19, -0.62); s.lineTo(0.04, -0.62); s.lineTo(0, -0.2)
    s.lineTo(-0.04, -0.62); s.lineTo(-0.19, -0.62); s.closePath()
    geo = new THREE.ShapeGeometry(s)
  } else if (kind === 'dress') {
    const s = new THREE.Shape()
    s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.14, -0.22); s.lineTo(0.27, -0.7); s.lineTo(-0.27, -0.7); s.lineTo(-0.14, -0.22); s.closePath()
    geo = new THREE.ShapeGeometry(s)
  } else {
    geo = new THREE.PlaneGeometry(0.42, 0.62)
    geo.translate(0, -0.31, 0)
  }
  // 竖条花边贴图（uv 是形状坐标，横着一道道）
  const tex = canvasTex(64, 64, (g) => {
    g.fillStyle = color
    g.fillRect(0, 0, 64, 64)
    g.fillStyle = trim
    for (const y of kind === 'towel' ? [6, 52] : [50]) g.fillRect(0, y, 64, 6)
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.5, 1.5)
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, side: THREE.DoubleSide }))
  m.castShadow = true
  m.rotation.y = Math.PI / 2 // 绳子沿 z 方向，衣服面朝东西
  pivot.add(m)
  // 两个小夹子
  for (const z of [-0.12, 0.12]) {
    const peg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.015), new THREE.MeshStandardMaterial({ color: '#c99a5b', roughness: 0.8 }))
    peg.position.set(0, -0.01, z)
    pivot.add(peg)
  }
  return pivot
}

export interface Clothesline {
  group: THREE.Group
  /** 晾着的衣服（不晾的时候藏起来） */
  clothes: THREE.Group
  update(t: number, wind: number): void
}

/** 院子西边的晾衣绳和一排衣服：每件衣服绕着绳子轻轻摆（风大就摆得厉害） */
export function clothesline(): Clothesline {
  const group = new THREE.Group()
  const { x, z0, z1 } = CLOTHESLINE
  const wood = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.85 })
  for (const z of [z0, z1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.95, 8), wood)
    pole.position.set(x, 0.975, z)
    pole.castShadow = true
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), wood)
    bar.position.set(x, 1.86, z)
    group.add(pole, bar)
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, z1 - z0, 6), new THREE.MeshStandardMaterial({ color: '#efe9da', roughness: 0.9 }))
  rope.rotation.x = Math.PI / 2
  rope.position.set(x, 1.84, (z0 + z1) / 2)
  group.add(rope)
  const clothes = new THREE.Group()
  const items: [Parameters<typeof cloth>[0], string, string][] = [
    ['shirt', '#5b9be0', '#ffffff'], ['towel', '#f6d36b', '#ffffff'], ['dress', '#a8404f', '#f2c4cb'],
    ['pants', '#40639a', '#2f4b78'], ['towel', '#f2f0ea', '#e07a7a'], ['shirt', '#5f7350', '#e9e3cf'],
  ]
  items.forEach(([kind, c, trim], i) => {
    const o = cloth(kind, c, trim)
    o.position.set(x, 1.84, z0 + 0.45 + i * ((z1 - z0 - 0.9) / (items.length - 1)))
    o.userData.phase = i * 1.3
    clothes.add(o)
  })
  clothes.visible = false
  group.add(clothes)
  return {
    group, clothes,
    update(t, wind) {
      if (!clothes.visible) return
      for (const o of clothes.children) {
        const p = o.userData.phase as number
        o.rotation.z = (Math.sin(t * 1.7 + p) * 0.12 + Math.sin(t * 3.1 + p * 2) * 0.04) * wind + 0.05 * wind
      }
    },
  }
}

/** 一张竖条红纸，金字从上往下写 */
function redPaper(text: string, w: number, h: number, vertical: boolean): THREE.Mesh {
  const px = 64
  const c = document.createElement('canvas')
  c.width = Math.round(w * px * 4)
  c.height = Math.round(h * px * 4)
  const g = c.getContext('2d')!
  g.fillStyle = '#b3241f'
  g.fillRect(0, 0, c.width, c.height)
  // 纸边一点点发暗，像贴了一阵子
  const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.2, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(60,0,0,0.35)')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#f2c45a'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const chars = [...text]
  if (vertical) {
    const step = c.height / chars.length
    g.font = `bold ${Math.floor(Math.min(c.width * 0.78, step * 0.82))}px "Kaiti SC","STKaiti","KaiTi","Songti SC",serif`
    chars.forEach((ch, i) => g.fillText(ch, c.width / 2, step * (i + 0.5)))
  } else {
    const step = c.width / chars.length
    g.font = `bold ${Math.floor(Math.min(c.height * 0.78, step * 0.82))}px "Kaiti SC","STKaiti","KaiTi","Songti SC",serif`
    chars.forEach((ch, i) => g.fillText(ch, step * (i + 0.5), c.height / 2))
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
  return m
}

/** 堂屋门口：上联、下联、横批（x 是门洞中心，z 是外墙面） */
export function couplets(x: number, z: number): THREE.Group {
  const g = new THREE.Group()
  const left = redPaper('风雨同舟一家人', 0.3, 1.75, true)
  left.position.set(x - 1.28, 1.15, z)
  const right = redPaper('平安二字值千金', 0.3, 1.75, true)
  right.position.set(x + 1.28, 1.15, z)
  const top = redPaper('家和万事兴', 1.5, 0.3, false)
  top.position.set(x, 2.25, z)
  g.add(left, right, top)
  return g
}

/** 储藏室：米袋、一提提的矿泉水、一箱箱罐头。囤得越多码得越满（最多几十件，实例化很便宜） */
export class StockView {
  private readonly sacks: THREE.InstancedMesh
  private readonly packs: THREE.InstancedMesh
  private readonly boxes: THREE.InstancedMesh
  private readonly slots: { x: number; z: number; y: number; r: number }[] = []
  private shown = ''

  constructor(scene: THREE.Object3D, room: { x0: number; z0: number; x1: number; z1: number }) {
    const MAX = 48
    const sack = new THREE.SphereGeometry(0.22, 10, 7)
    sack.scale(1.25, 0.62, 0.9)
    sack.translate(0, 0.13, 0)
    const pack = new THREE.BoxGeometry(0.38, 0.3, 0.26)
    pack.translate(0, 0.15, 0)
    const crate = new THREE.BoxGeometry(0.4, 0.28, 0.32)
    crate.translate(0, 0.14, 0)
    this.sacks = new THREE.InstancedMesh(sack, new THREE.MeshStandardMaterial({ color: '#d9c9a4', roughness: 0.95 }), MAX)
    this.packs = new THREE.InstancedMesh(pack, new THREE.MeshStandardMaterial({ color: '#8fc3dc', roughness: 0.25, metalness: 0, transparent: true, opacity: 0.85 }), MAX)
    this.boxes = new THREE.InstancedMesh(crate, new THREE.MeshStandardMaterial({ color: '#b58a5a', roughness: 0.9 }), MAX)
    for (const m of [this.sacks, this.packs, this.boxes]) {
      m.count = 0
      // 实例化网格的包围球按原点那一个算，会被当成"不在镜头里"裁掉（只剩影子）
      m.frustumCulled = false
      m.castShadow = true
      m.receiveShadow = true
      scene.add(m)
    }
    // 沿着储藏室西墙（挨着堂屋那面）码两排、两层高；进门那一段留出过道（东墙那边已经有箱子和货架）
    for (let layer = 0; layer < 2; layer++) {
      for (let row = 0; row < 2; row++) {
        for (let z = room.z0 + 0.3; z < room.z1 - 0.2; z += 0.48) {
          if (z > 1.4 && z < 3.6) continue
          this.slots.push({ x: room.x0 + 0.25 + row * 0.5, z, y: layer * 0.3, r: ((z * 13) % 1) * 0.4 - 0.2 })
        }
      }
    }
  }

  /** 按家里的存货决定摆几袋米、几提水、几箱罐头 */
  sync(food: number, water: number): void {
    const sacks = Math.min(32, Math.round(food / 3))
    const cans = Math.min(16, Math.round(food / 6))
    const packs = Math.min(32, Math.round(water / 2))
    const key = `${sacks}|${cans}|${packs}`
    if (key === this.shown) return
    this.shown = key
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    // 一个格子放一件，按 米、水、米、罐头 轮着放，看起来是混着码的
    const want: ('s' | 'p' | 'c')[] = []
    let s = sacks
    let p = packs
    let c = cans
    while (s + p + c > 0 && want.length < this.slots.length) {
      if (s > 0) { want.push('s'); s-- }
      if (p > 0) { want.push('p'); p-- }
      if (c > 0 && want.length % 3 === 0) { want.push('c'); c-- }
      else if (c > 0 && s === 0 && p === 0) { want.push('c'); c-- }
    }
    const n = { s: 0, p: 0, c: 0 }
    want.forEach((kind, i) => {
      const slot = this.slots[i]
      q.setFromAxisAngle(up, slot.r)
      m.compose(new THREE.Vector3(slot.x, slot.y, slot.z), q, new THREE.Vector3(1, 1, 1))
      const mesh = kind === 's' ? this.sacks : kind === 'p' ? this.packs : this.boxes
      mesh.setMatrixAt(n[kind]++, m)
    })
    this.sacks.count = n.s
    this.packs.count = n.p
    this.boxes.count = n.c
    for (const mesh of [this.sacks, this.packs, this.boxes]) mesh.instanceMatrix.needsUpdate = true
  }
}

