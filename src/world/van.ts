// 家里那辆旧面包车（五菱那种）：全用代码拼出来，不下载模型。
// 平时停在院子西南角，出门搜刮时一家人上车、开出铁门；回来时倒车进院子停好，车顶绑着搜来的箱子。
// 车怎么动全看游戏时间（Household.van），这里只负责摆姿势，快进、存档读档都不会对不上。
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { VAN_IN_H, VAN_OUT_H, VAN_PARK, type VanMove } from './layout'

const L = 1.8 // 半车长（车身轮廓 x 从 -L 到 L）
const W = 1.5 // 车宽
const BEVEL = 0.05
const WHEEL_R = 0.3
const WHEELS_Z = [-1.12, 1.05]
const SEAM = 1.02 // 下半截黄、上半截奶白的分界

const mat = (color: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })

/** 车身侧面轮廓（x 朝车头，y 朝上），挖掉两个轮拱 */
function lowerShape(): THREE.Shape {
  const s = new THREE.Shape()
  const y0 = 0.32
  const arch = WHEEL_R + 0.07
  s.moveTo(-L, y0)
  for (const wz of WHEELS_Z) {
    s.lineTo(wz - arch, y0)
    s.absarc(wz, y0 - 0.02, arch, Math.PI, 0, true)
  }
  s.lineTo(L + 0.02, y0)
  s.lineTo(L + 0.05, SEAM - 0.04)
  s.lineTo(-L - 0.01, SEAM - 0.04)
  s.closePath()
  return s
}

function upperShape(): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-L - 0.01, SEAM)
  s.lineTo(L + 0.04, SEAM)
  s.lineTo(L - 0.06, SEAM + 0.1)
  s.lineTo(1.18, 1.76) // 前挡风玻璃斜着往后
  s.quadraticCurveTo(1.1, 1.82, 0.95, 1.82)
  s.lineTo(-L + 0.08, 1.82)
  s.quadraticCurveTo(-L, 1.82, -L, 1.72)
  s.closePath()
  return s
}

/** 把侧面轮廓挤成车身：轮廓 x → 车的 +z（车头），挤出方向 → 车的 x（左右） */
function extrude(shape: THREE.Shape, material: THREE.Material): THREE.Mesh {
  const depth = W - 2 * BEVEL
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: BEVEL, bevelThickness: BEVEL, bevelSegments: 3, curveSegments: 14 })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, material)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function roundRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

/** 贴在车身侧面的一块（车窗、门缝……）：pts 是侧面轮廓坐标（x 朝车头），side = ±1 */
function sidePatch(pts: [number, number][], material: THREE.Material, side: number, out = 0.004): THREE.Mesh {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))))
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, side * (W / 2 + out), pos.getY(i), pos.getX(i))
  // (x,y) → (z,y) 是镜像，翻一下三角形让正面朝外
  if (side > 0) {
    const idx = g.index!
    for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a) }
  }
  g.computeVertexNormals()
  return new THREE.Mesh(g, material)
}

let glassCanvas: HTMLCanvasElement | null = null
/** 车窗玻璃：上亮下暗的天光，加两道斜着的反光（不然像一块黑板） */
function glassMaterial(repeat: [number, number], offset: [number, number]): THREE.MeshStandardMaterial {
  if (!glassCanvas) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, '#8fa6b4')
    g.addColorStop(0.45, '#46606f')
    g.addColorStop(1, '#1d2a33')
    x.fillStyle = g
    x.fillRect(0, 0, 256, 128)
    x.globalAlpha = 0.22
    x.fillStyle = '#ffffff'
    for (const [x0, w] of [[40, 34], [96, 12], [178, 22]]) {
      x.beginPath()
      x.moveTo(x0, 0)
      x.lineTo(x0 + w, 0)
      x.lineTo(x0 + w - 60, 128)
      x.lineTo(x0 - 60, 128)
      x.fill()
    }
    glassCanvas = c
  }
  const t = new THREE.CanvasTexture(glassCanvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(...repeat)
  t.offset.set(...offset)
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.15, metalness: 0.3 })
}

function plateTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 80
  const x = c.getContext('2d')!
  x.fillStyle = '#1f4fa8'
  x.fillRect(0, 0, 256, 80)
  x.strokeStyle = '#e8eef8'
  x.lineWidth = 5
  x.strokeRect(6, 6, 244, 68)
  x.fillStyle = '#f4f7fb'
  x.font = 'bold 46px "PingFang SC", "Noto Sans SC", sans-serif'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(text, 128, 43)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface VanParts {
  root: THREE.Group
  /** 车身（跟着颠一颠） */
  body: THREE.Group
  wheels: THREE.Object3D[]
  /** 车顶绑着的箱子：回来的路上才有 */
  load: THREE.Group
  /** 车灯：天黑开车时亮 */
  lamps: THREE.MeshStandardMaterial
  beam: THREE.SpotLight
  /** 末日改装：车窗铁栏、车头防撞杠、车门钢板、车顶备胎（改装好了才显示） */
  armor: THREE.Group
}

export function buildVan(): VanParts {
  const root = new THREE.Group()
  root.name = 'van'
  const body = new THREE.Group()
  root.add(body)

  const paint = mat('#e2b04c', 0.45, 0.05)
  const cream = mat('#f2ecdc', 0.45, 0.05)
  // 侧窗的 uv 是侧面轮廓坐标（米）：y 1.13~1.68 对到贴图的上下
  const glass = glassMaterial([0.55, 1 / 0.55], [0, -1.13 / 0.55])
  // 前后窗的 uv 以窗中心为原点
  const glassFront = glassMaterial([0.6, 1 / 0.62], [0.5, 0.5])
  const dark = mat('#3a3a38', 0.7)
  const chrome = mat('#d4d7da', 0.35, 0.35)

  body.add(extrude(lowerShape(), paint))
  body.add(extrude(upperShape(), cream))

  // 车窗：前门、推拉门、后排；车窗下一条细门缝
  const win = (x0: number, x1: number, slant = 0): [number, number][] => [[x0, 1.13], [x1, 1.13], [x1 - slant, 1.68], [x0, 1.68]]
  for (const side of [1, -1]) {
    body.add(sidePatch(win(0.56, 1.52, 0.36), glass, side))
    body.add(sidePatch(win(-0.42, 0.44), glass, side))
    body.add(sidePatch(win(-1.66, -0.54), glass, side))
    // 门缝：前门后沿、推拉门前后沿
    for (const z of [0.5, -0.48]) body.add(sidePatch([[z - 0.012, 0.42], [z + 0.012, 0.42], [z + 0.012, 1.7], [z - 0.012, 1.7]], dark, side, 0.006))
    // 推拉门的滑轨
    body.add(sidePatch([[-1.72, 1.06], [-0.48, 1.06], [-0.48, 1.085], [-1.72, 1.085]], dark, side, 0.006))
    // 门把手
    for (const z of [0.36, -0.36]) body.add(sidePatch([[z - 0.08, 0.92], [z + 0.08, 0.92], [z + 0.08, 0.96], [z - 0.08, 0.96]], chrome, side, 0.008))
    // 后视镜
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.11), dark)
    mirror.position.set(side * (W / 2 + 0.1), 1.38, 1.42)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.025), dark)
    arm.position.set(side * (W / 2 + 0.04), 1.3, 1.44)
    body.add(mirror, arm)
  }

  // 前挡风玻璃：贴在斜面上
  {
    const a = new THREE.Vector2(L - 0.06 + BEVEL * 0.7, SEAM + 0.12)
    const b = new THREE.Vector2(1.2, 1.74)
    const len = a.distanceTo(b)
    const g = new THREE.ShapeGeometry(roundRect(W - 0.2, len - 0.08, 0.05))
    const m = new THREE.Mesh(g, glassFront)
    const n = new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize() // 斜面朝外的法线（侧面轮廓里）
    const mid = a.clone().add(b).multiplyScalar(0.5).add(n.clone().multiplyScalar(BEVEL + 0.006))
    m.position.set(0, mid.y, mid.x)
    // ShapeGeometry 法线是 +z，绕 x 轴转到斜面的法线方向
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, n.y, n.x).normalize())
    body.add(m)
  }

  // 车头：大灯、格栅、保险杠、车牌
  const front = L + 0.05 + BEVEL
  const lamps = new THREE.MeshStandardMaterial({ color: '#fff6dc', roughness: 0.2, emissive: '#fff1c4', emissiveIntensity: 0.05 })
  for (const side of [1, -1]) {
    const lamp = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(0.3, 0.17, 0.05)), lamps)
    lamp.position.set(side * 0.5, 0.82, front + 0.004)
    body.add(lamp)
    const tail = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(0.13, 0.36, 0.03)), mat('#c2352e', 0.3))
    tail.position.set(side * 0.6, 0.86, -L - 0.01 - BEVEL - 0.006)
    tail.rotation.y = Math.PI
    body.add(tail)
  }
  const grille = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(0.56, 0.13, 0.04)), dark)
  grille.position.set(0, 0.7, front - 0.008)
  body.add(grille)
  for (const z of [front + 0.02, -L - 0.01 - BEVEL - 0.03]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.16, 0.12), dark)
    bumper.position.set(0, 0.4, z)
    bumper.castShadow = true
    body.add(bumper)
  }
  const plateTex = plateTexture('囤A·0001')
  for (const [z, ry] of [[front + 0.085, 0], [-L - BEVEL - 0.105, Math.PI]] as const) {
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.125), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }))
    plate.position.set(0, 0.42, z)
    plate.rotation.y = ry
    body.add(plate)
  }
  // 后窗
  const rear = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(W - 0.3, 0.5, 0.05)), glassFront)
  rear.position.set(0, 1.42, -L - BEVEL - 0.016)
  rear.rotation.y = Math.PI
  body.add(rear)

  // 车顶行李架
  const rack = new THREE.Group()
  for (const x of [-0.56, 0.56]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 2.7), dark)
    rail.position.set(x, 1.95, -0.3)
    rack.add(rail)
    for (const z of [-1.5, 0.9]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), dark)
      foot.position.set(x, 1.9, z)
      rack.add(foot)
    }
  }
  for (const z of [-1.3, -0.3, 0.7]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.035, 0.04), dark)
    bar.position.set(0, 1.97, z)
    rack.add(bar)
  }
  body.add(rack)

  // 末日改装（平时藏着）：所有铁条合成一个网格，省绘制次数
  const armor = new THREE.Group()
  const steel = mat('#4a4c4e', 0.55, 0.6)
  const plateMat = mat('#8a8f94', 0.55, 0.15)
  const bars: THREE.BufferGeometry[] = []
  const bar = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d)
    if (rx) g.rotateX(rx)
    g.translate(x, y, z)
    bars.push(g)
  }
  for (const side of [1, -1]) {
    const x = side * (W / 2 + 0.03)
    // 侧窗竖铁条 + 上下两根横条
    for (let z = -1.6; z <= 1.42; z += 0.13) if (Math.abs(z - 0.5) > 0.05 && Math.abs(z + 0.48) > 0.05) bar(0.018, 0.56, 0.018, x, 1.405, z)
    bar(0.022, 0.025, 3.08, x, 1.13, -0.12)
    bar(0.022, 0.025, 3.08, x, 1.68, -0.12)
    // 车门下半截焊一块钢板，四边一圈铆钉
    armor.add(sidePatch([[-0.72, 0.44], [0.62, 0.44], [0.62, 0.95], [-0.72, 0.95]], plateMat, side, 0.012))
    const rx = side * (W / 2 + 0.018)
    for (let z = -0.66; z <= 0.57; z += 0.123) { bar(0.012, 0.025, 0.025, rx, 0.48, z); bar(0.012, 0.025, 0.025, rx, 0.91, z) }
    for (const z of [-0.66, 0.57]) bar(0.012, 0.025, 0.025, rx, 0.695, z)
  }
  // 前挡风玻璃的铁栏：顺着斜面
  {
    const a = new THREE.Vector2(L - 0.06, SEAM + 0.12)
    const b = new THREE.Vector2(1.2, 1.74)
    const len = a.distanceTo(b)
    const n = new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize()
    const mid = a.clone().add(b).multiplyScalar(0.5).add(n.clone().multiplyScalar(BEVEL + 0.035))
    const tilt = Math.atan2(b.x - a.x, b.y - a.y)
    for (let x = -0.6; x <= 0.61; x += 0.15) bar(0.018, len - 0.04, 0.018, x, mid.y, mid.x, tilt)
  }
  // 车头防撞杠：两根竖管 + 两根横管
  for (const x of [-0.5, 0.5]) bar(0.05, 0.62, 0.05, x, 0.58, front + 0.16)
  bar(W + 0.1, 0.05, 0.05, 0, 0.36, front + 0.17)
  bar(W - 0.2, 0.05, 0.05, 0, 0.86, front + 0.16)
  for (const x of [-0.5, 0.5]) bar(0.04, 0.04, 0.2, x, 0.6, front + 0.07)
  armor.add(new THREE.Mesh(mergeGeometries(bars), steel))
  // 车顶前头一个备胎
  const spare = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 10, 20), mat('#232220', 0.9))
  spare.rotation.x = Math.PI / 2
  spare.position.set(0, 2.05, 0.75)
  armor.add(spare)
  armor.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true })
  armor.visible = false
  body.add(armor)

  // 回来时车顶的货：两个纸箱 + 一桶油，捆一根带子
  const load = new THREE.Group()
  const cardboard = mat('#b98c5a', 0.85)
  for (const [x, z, w, h, d, r] of [[-0.22, -0.75, 0.55, 0.36, 0.5, 0.1], [0.24, -0.15, 0.5, 0.3, 0.55, -0.15], [-0.2, 0.35, 0.42, 0.26, 0.4, 0.3]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cardboard)
    box.position.set(x, 1.99 + h / 2, z)
    box.rotation.y = r
    box.castShadow = true
    load.add(box)
  }
  const can = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.3), mat('#c8432f', 0.5))
  can.position.set(0.32, 2.16, 0.55)
  load.add(can)
  const strap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.05), mat('#d9cd3a', 0.7))
  strap.position.set(0, 2.33, -0.2)
  load.add(strap)
  load.visible = false
  body.add(load)

  // 轮子：黑轮胎 + 银色轮毂
  const tire = mat('#232220', 0.9)
  const wheels: THREE.Object3D[] = []
  for (const z of WHEELS_Z) {
    for (const side of [1, -1]) {
      const w = new THREE.Group()
      const t = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.2, 24), tire)
      t.rotation.z = Math.PI / 2
      t.castShadow = true
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.21, 16), chrome)
      hub.rotation.z = Math.PI / 2
      const nut = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), dark)
      w.add(t, hub, nut)
      w.position.set(side * (W / 2 - 0.08), WHEEL_R, z)
      root.add(w)
      wheels.push(w)
    }
  }

  // 天黑开车时的车灯光（不投影子，省性能）
  const beam = new THREE.SpotLight('#fff0c8', 0, 16, 0.6, 0.6, 1.2)
  beam.position.set(0, 0.85, front)
  beam.target.position.set(0, 0, front + 6)
  beam.castShadow = false
  body.add(beam, beam.target)

  root.position.set(VAN_PARK.x, 0, VAN_PARK.z)
  root.rotation.y = VAN_PARK.rot
  return { root, body, wheels, load, lamps, beam, armor }
}

// --- 开车路线 ------------------------------------------------------------------

/** 开出去：从车位往东开、右拐出铁门、上街往东开走 */
const OUT_PATH = new THREE.CatmullRomCurve3([
  [VAN_PARK.x, VAN_PARK.z], [2.0, 11.95], [3.25, 12.35], [3.95, 13.4], [4.15, 15.2], [5.6, 17.3], [9, 17.6], [18, 17.6], [40, 17.6],
].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')

/** 回来：从街西头开过来，过了铁门停下，再倒车进门、车尾往西甩进车位 */
const IN_DRIVE = new THREE.CatmullRomCurve3([
  [-34, 17.9], [-10, 17.9], [2, 17.9], [6.8, 17.9],
].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
const IN_REVERSE = new THREE.CatmullRomCurve3([
  [6.8, 17.9], [6.1, 17.86], [4.95, 17.2], [4.2, 15.6], [4.0, 13.6], [3.4, 12.45], [2.0, 11.95], [VAN_PARK.x, VAN_PARK.z],
].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')

const ease = (u: number) => u * u * (3 - 2 * u)

export interface VanPose { x: number; z: number; rot: number; visible: boolean; speed: number; loaded: boolean }

/** 现在车在哪：按游戏时间算（absHour = day*24+hour） */
export function vanPose(move: VanMove | null, away: boolean, absHour: number): VanPose {
  if (!move) {
    return away
      ? { x: 0, z: 0, rot: 0, visible: false, speed: 0, loaded: false }
      : { x: VAN_PARK.x, z: VAN_PARK.z, rot: VAN_PARK.rot, visible: true, speed: 0, loaded: false }
  }
  const dur = move.dir === 'out' ? VAN_OUT_H : VAN_IN_H
  const u = Math.min(1, Math.max(0, (absHour - move.t0) / dur))
  if (move.dir === 'out') {
    // 前一半时间在院子里慢慢开出铁门（路线的前 20%），上了街再一路加速开走（速度接得上）
    const s = u < 0.5 ? 0.2 * (u / 0.5) ** 1.4 : 0.2 + 0.8 * (0.35 * ((u - 0.5) / 0.5) + 0.65 * ((u - 0.5) / 0.5) ** 2)
    const p = OUT_PATH.getPointAt(s)
    const d = OUT_PATH.getTangentAt(s)
    return { x: p.x, z: p.z, rot: Math.atan2(d.x, d.z), visible: u < 1, speed: 0.5 + 3 * s, loaded: false }
  }
  // 开到门口（减速停下）→ 停一下挂倒挡 → 慢慢倒进车位
  if (u < 0.42) {
    const k = u / 0.42
    const s = 1 - (1 - k) * (1 - k)
    const p = IN_DRIVE.getPointAt(s)
    const d = IN_DRIVE.getTangentAt(s)
    return { x: p.x, z: p.z, rot: Math.atan2(d.x, d.z), visible: true, speed: 2 * (1 - k) + 0.1, loaded: true }
  }
  const k = ease(Math.max(0, (u - 0.47) / 0.53))
  const p = IN_REVERSE.getPointAt(k)
  const d = IN_REVERSE.getTangentAt(k)
  // 倒车：车头朝着走的反方向
  return { x: p.x, z: p.z, rot: Math.atan2(-d.x, -d.z), visible: true, speed: u < 0.47 ? 0.05 : -0.5 * Math.sin(Math.PI * k) - 0.05, loaded: true }
}

/** 每帧摆好车：位置、朝向、轮子转、车身轻轻颠 */
export class VanView {
  private spin = 0
  private t = 0
  private last = new THREE.Vector3()
  readonly parts: VanParts

  constructor(parts: VanParts) {
    this.parts = parts
    this.last.copy(parts.root.position)
  }

  update(dt: number, pose: VanPose, dark: number, armored = false): void {
    const { root, body, wheels, load, lamps, beam, armor } = this.parts
    armor.visible = armored
    root.visible = pose.visible
    if (!pose.visible) return
    root.position.set(pose.x, 0, pose.z)
    // 朝向用最短角度慢慢转过去（倒车切换那一下不会猛地一甩）
    let dr = pose.rot - root.rotation.y
    dr = Math.atan2(Math.sin(dr), Math.cos(dr))
    root.rotation.y += Math.abs(dr) > 1.2 ? dr : dr * Math.min(1, dt * 12)
    const moved = this.last.distanceTo(root.position)
    this.last.copy(root.position)
    const dir = pose.speed < 0 ? -1 : 1
    this.spin += (dir * Math.min(moved, 1)) / WHEEL_R
    for (const w of wheels) w.rotation.x = this.spin
    this.t += dt
    const moving = moved > 0.001
    body.position.y = moving ? Math.sin(this.t * 17) * 0.012 + Math.sin(this.t * 5.3) * 0.008 : 0
    body.rotation.z = moving ? Math.sin(this.t * 3.1) * 0.012 : 0
    load.visible = pose.loaded
    const on = moving && dark > 0.35
    lamps.emissiveIntensity = on ? 2.2 : 0.05
    beam.intensity = on ? 18 : 0
  }
}
