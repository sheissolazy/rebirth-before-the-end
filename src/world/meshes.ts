// 卡通材质和用代码画的低多边形物件。所有东西底面中心在原点，正面朝 +z。
import * as THREE from 'three'
import type { Prop } from './layout'

let gradient: THREE.DataTexture | null = null

/** 三档明暗的卡通光照贴图 */
function gradientMap(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255])
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
    gradient.minFilter = THREE.NearestFilter
    gradient.magFilter = THREE.NearestFilter
    gradient.generateMipmaps = false
    gradient.needsUpdate = true
  }
  return gradient
}

const cache = new Map<string, THREE.MeshToonMaterial>()

/** 同一种颜色共用一个材质；`own` 为 true 时返回独立材质（需要单独淡入淡出的屋顶等） */
export function toon(color: THREE.ColorRepresentation, opts: { own?: boolean; opacity?: number } = {}): THREE.MeshToonMaterial {
  const c = new THREE.Color(color)
  const key = `${c.getHexString()}|${opts.opacity ?? 1}`
  if (!opts.own) {
    const hit = cache.get(key)
    if (hit) return hit
  }
  const mat = new THREE.MeshToonMaterial({ color: c, gradientMap: gradientMap() })
  if (opts.opacity !== undefined && opts.opacity < 1) {
    mat.transparent = true
    mat.opacity = opts.opacity
  }
  if (!opts.own) cache.set(key, mat)
  return mat
}

/** 把 Blender 导出的 `pal_*` 材质换成同色的卡通材质 */
export function toonify(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const swap = (m: THREE.Material) => {
      const std = m as THREE.MeshStandardMaterial
      const glass = m.name === 'pal_glass'
      return toon(std.color ?? 0xffffff, glass ? { opacity: 0.55 } : {})
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

export function box(w: number, h: number, d: number, color: THREE.ColorRepresentation,
  at: [number, number, number] = [0, 0, 0], mat?: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat ?? toon(color))
  m.position.set(at[0], at[1] + h / 2, at[2])
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group()
  g.add(...children)
  return g
}

export const COLORS = {
  wall: '#e8d1b0',
  wood: '#a3683d',
  woodDark: '#6b4428',
  linen: '#f4efe4',
  fabric: '#4c85b8',
  roof: '#c0613f',
  grass: '#86bf5e',
  grassDark: '#6fa84c',
  road: '#5d6266',
  sidewalk: '#c7c1b4',
  stone: '#b4b8ba',
  leaf: '#5e9e47',
  skin: '#f1c7a5',
}

// --- 屋里缺的家具（Blender 组件里还没有的先用代码画） -----------------------

export function sofa(): THREE.Group {
  return group(
    box(1.8, 0.4, 0.85, COLORS.fabric, [0, 0.1, 0]),
    box(1.8, 0.5, 0.25, COLORS.fabric, [0, 0.4, 0.3]),
    box(0.22, 0.35, 0.85, COLORS.fabric, [-0.8, 0.4, 0]),
    box(0.22, 0.35, 0.85, COLORS.fabric, [0.8, 0.4, 0]),
    box(1.7, 0.1, 0.8, COLORS.woodDark, [0, 0, 0]),
  )
}

export function counter(): THREE.Group {
  return group(
    box(3.0, 0.85, 0.65, '#d9d4c7', [0, 0, 0]),
    box(3.05, 0.06, 0.7, '#8d9599', [0, 0.85, 0]),
    box(0.5, 0.04, 0.4, '#3c3f42', [0.8, 0.91, 0]),
  )
}

export function fridge(): THREE.Group {
  return group(
    box(0.75, 1.8, 0.7, '#eef0ee', [0, 0, 0]),
    box(0.04, 0.5, 0.04, '#8d9599', [0.28, 1.1, 0.37]),
    box(0.04, 0.3, 0.04, '#8d9599', [0.28, 0.5, 0.37]),
  )
}

export function desk(): THREE.Group {
  return group(
    box(1.2, 0.06, 0.6, COLORS.wood, [0, 0.72, 0]),
    box(0.06, 0.72, 0.55, COLORS.woodDark, [-0.55, 0, 0]),
    box(0.06, 0.72, 0.55, COLORS.woodDark, [0.55, 0, 0]),
    // 重生日记：桌上那本红色的本子
    box(0.24, 0.05, 0.32, '#b23a3a', [0.15, 0.78, 0.05]),
    box(0.12, 0.3, 0.12, '#e9c46a', [-0.4, 0.78, -0.12]),
  )
}

export function shelf(): THREE.Group {
  const g = group(box(0.9, 1.8, 0.35, COLORS.woodDark, [0, 0, 0]))
  const books = ['#c0613f', '#4c85b8', '#e9c46a', '#5e9e47', '#8a6fb0']
  for (let s = 0; s < 4; s++)
    for (let b = 0; b < 5; b++)
      g.add(box(0.12, 0.28, 0.25, books[(s + b) % books.length], [-0.32 + b * 0.16, 0.12 + s * 0.42, 0.06]))
  return g
}

/** 客厅墙上的临江市地图，正面朝 +x */
export function wallMap(): THREE.Group {
  const g = group(box(0.04, 1.0, 1.4, '#efe3c4', [0, 1.0, 0]))
  const dots: [number, number, string][] = [[1.2, -0.4, '#b23a3a'], [1.6, 0.3, '#b23a3a'], [1.35, 0.1, '#2d6aa0'], [1.75, -0.2, '#2d6aa0']]
  for (const [y, z, c] of dots) g.add(box(0.03, 0.08, 0.08, c, [0.03, y, z]))
  g.add(box(0.03, 0.04, 1.2, '#7a8a96', [0.025, 1.45, 0]))
  return g
}

/** 楼梯：沿 +x 往上，只是样子 */
export function stairs(rise: number): THREE.Group {
  const g = new THREE.Group()
  const n = 10
  for (let k = 0; k < n; k++) {
    const h = (rise / n) * (k + 1)
    g.add(box(0.28, h, 1.1, k % 2 ? COLORS.wood : '#b37847', [-1.26 + k * 0.28, 0, 0]))
  }
  return g
}

// --- 屋外的东西 ------------------------------------------------------------

function gableRoof(w: number, d: number, baseY: number, rise: number, color: THREE.ColorRepresentation,
  mat?: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const over = 0.4
  const half = d / 2 + over
  const slope = Math.hypot(half, rise)
  const angle = Math.atan2(rise, half)
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w + over * 2, 0.16, slope), mat ?? toon(color))
    m.position.set(0, baseY + rise / 2, (side * half) / 2)
    m.rotation.x = side * angle
    m.castShadow = true
    m.receiveShadow = true
    g.add(m)
  }
  return g
}

/** 三角形山墙，用来封住人字屋顶两头 */
function gable(d: number, baseY: number, rise: number, color: THREE.ColorRepresentation, mat?: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape()
  shape.moveTo(-d / 2, 0)
  shape.lineTo(d / 2, 0)
  shape.lineTo(0, rise)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false })
  geo.rotateY(Math.PI / 2)
  geo.translate(-0.1, baseY, 0)
  const m = new THREE.Mesh(geo, mat ?? toon(color))
  m.castShadow = true
  return m
}

/** 自家别墅的屋顶（独立材质，能淡出） */
export function villaRoof(w: number, d: number, baseY: number): { root: THREE.Group; mats: THREE.MeshToonMaterial[] } {
  const roofMat = toon(COLORS.roof, { own: true })
  const wallMat = toon(COLORS.wall, { own: true })
  const root = gableRoof(w, d, baseY, 1.8, COLORS.roof, roofMat)
  const left = gable(d, baseY, 1.8, COLORS.wall, wallMat)
  left.position.x = -w / 2 + 0.1
  const right = gable(d, baseY, 1.8, COLORS.wall, wallMat)
  right.position.x = w / 2 - 0.1
  root.add(left, right)
  return { root, mats: [roofMat, wallMat] }
}

export function neighborHouse(p: Prop): THREE.Group {
  const h = 3.4
  const g = group(box(p.w, h, p.d, p.color ?? COLORS.wall, [0, 0, 0]))
  g.add(gableRoof(p.w, p.d, h, 1.6, '#8a5a44'))
  // 朝街（-z）那面的门和窗
  g.add(box(0.9, 2.0, 0.08, COLORS.woodDark, [0, 0, -p.d / 2 - 0.02]))
  for (const x of [-p.w / 3, p.w / 3]) g.add(box(0.9, 0.9, 0.06, '#7fb8c9', [x, 1.2, -p.d / 2 - 0.02]))
  const left = gable(p.d, h, 1.6, p.color ?? COLORS.wall)
  left.position.x = -p.w / 2 + 0.1
  const right = gable(p.d, h, 1.6, p.color ?? COLORS.wall)
  right.position.x = p.w / 2 - 0.1
  g.add(left, right)
  return g
}

export function tree(): THREE.Group {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 6), toon(COLORS.woodDark))
  trunk.position.y = 0.65
  const leaves1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), toon(COLORS.leaf))
  leaves1.position.y = 1.9
  const leaves2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), toon('#6db152'))
  leaves2.position.set(0.25, 2.55, 0.1)
  for (const m of [trunk, leaves1, leaves2]) { m.castShadow = true; m.receiveShadow = true }
  return group(trunk, leaves1, leaves2)
}

export function car(color: string): THREE.Group {
  const g = group(
    box(1.8, 0.6, 4.0, color, [0, 0.3, 0]),
    box(1.6, 0.55, 2.0, color, [0, 0.9, -0.2]),
    box(1.5, 0.45, 0.05, '#9fd0dd', [0, 0.95, 0.82]),
  )
  for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10), toon('#2b2d2f'))
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.34, z)
    g.add(wheel)
  }
  return g
}

export function barrel(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), toon('#9c4a32'))
  m.position.y = 0.45
  m.castShadow = true
  return m
}

/** 占位小人：身体胶囊 + 头 + 头发，正面朝 +z */
export function person(shirt: string, hair: string, height = 1): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), toon(shirt))
  body.position.y = 0.55
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.25, 4, 8), toon('#3d4a5c'))
  legs.position.y = 0.28
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), toon(COLORS.skin))
  head.position.y = 1.18
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), toon(hair))
  hairCap.position.set(0, 1.2, -0.02)
  hairCap.rotation.x = -0.35
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), toon('#e0a988'))
  nose.position.set(0, 1.16, 0.19)
  for (const m of [body, legs, head, hairCap, nose]) { m.castShadow = true; m.receiveShadow = true }
  g.add(legs, body, head, hairCap, nose)
  g.scale.setScalar(height)
  g.userData.body = body
  return g
}
