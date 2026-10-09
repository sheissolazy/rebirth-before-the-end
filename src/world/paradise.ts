// "世外桃源"画风：Poly Haven（CC0）的真实材质 + 代码生成的草、樱花、远山和江面。
// 和卡通画风共用同一套场景，只是在加载后把材质换掉、再加一些景物。
import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { HOUSE, STREET, WORLD, YARD, GATE, PROPS } from './layout'

export type ArtStyle = 'toon' | 'paradise'

const STYLE_KEY = 'rbte-proto-style'

export function loadStyle(): ArtStyle {
  const q = new URLSearchParams(location.search).get('style')
  if (q === 'toon' || q === 'paradise') return q
  try {
    const v = localStorage.getItem(STYLE_KEY)
    if (v === 'toon' || v === 'paradise') return v
  } catch { /* 隐私模式下读不了，就用默认 */ }
  return 'toon'
}

export function saveStyle(s: ArtStyle): void {
  try { localStorage.setItem(STYLE_KEY, s) } catch { /* 存不了也不影响玩 */ }
}

/** 材质角色 → Poly Haven 贴图。tile = 一张贴图铺多少米 */
const SURFACES: Record<string, { slug: string; tile: number; rough: number; tint?: string; normal?: number }> = {
  wall: { slug: 'white_plaster_02', tile: 2.5, rough: 0.95 },
  trim: { slug: 'weathered_brown_planks', tile: 1, rough: 0.85, tint: '#6b4d38' },
  floor: { slug: 'wood_floor', tile: 2, rough: 0.6 },
  wood: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85 },
  wood_dark: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85, tint: '#8a6a52' },
  woodDark: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85, tint: '#8a6a52' },
  roof: { slug: 'grey_roof_tiles_02', tile: 2, rough: 0.8, normal: 1.4 },
  grass: { slug: 'leafy_grass', tile: 3, rough: 0.95, tint: '#c8e6a0' },
  grassDark: { slug: 'aerial_grass_rock', tile: 9, rough: 0.95, tint: '#b9d98f' },
  wallTinted: { slug: 'white_plaster_02', tile: 2.5, rough: 0.95 },
  road: { slug: 'asphalt_02', tile: 4, rough: 0.9 },
  sidewalk: { slug: 'stone_tiles_02', tile: 2, rough: 0.9 },
  stone: { slug: 'cobblestone_floor_04', tile: 1, rough: 0.9 },
  bark: { slug: 'bark_brown_02', tile: 1, rough: 0.95 },
  sakuraBark: { slug: 'sakura_bark', tile: 1, rough: 0.95 },
}

export interface ParadiseKit {
  maps: Map<string, { diff: THREE.Texture; nor: THREE.Texture }>
  env: THREE.Texture
}

export async function loadParadiseKit(renderer: THREE.WebGLRenderer): Promise<ParadiseKit> {
  const base = `${import.meta.env.BASE_URL}textures/ph/`
  const loader = new THREE.TextureLoader()
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const slugs = [...new Set(Object.values(SURFACES).map((s) => s.slug))]
  const maps = new Map<string, { diff: THREE.Texture; nor: THREE.Texture }>()
  await Promise.all(slugs.map(async (slug) => {
    const [diff, nor] = await Promise.all([
      loader.loadAsync(`${base}${slug}_diff.jpg`),
      loader.loadAsync(`${base}${slug}_nor.jpg`),
    ])
    diff.colorSpace = THREE.SRGBColorSpace
    for (const t of [diff, nor]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = aniso
    }
    maps.set(slug, { diff, nor })
  }))
  const hdr = await new HDRLoader().loadAsync(`${base}kloofendal_sky.hdr`)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(hdr).texture
  hdr.dispose()
  pmrem.dispose()
  return { maps, env }
}

/** 按顶点法线把 UV 设成"米"为单位的盒式投影，贴图就不会被拉伸 */
const projected = new WeakSet<THREE.BufferGeometry>()
function boxProjectUV(geo: THREE.BufferGeometry): void {
  if (projected.has(geo)) return
  projected.add(geo)
  if (!geo.attributes.normal) geo.computeVertexNormals()
  const pos = geo.attributes.position
  const nrm = geo.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i))
    const ny = Math.abs(nrm.getY(i))
    const nz = Math.abs(nrm.getZ(i))
    let u: number
    let v: number
    if (nx >= ny && nx >= nz) { u = pos.getZ(i); v = pos.getY(i) }
    else if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i) }
    else { u = pos.getX(i); v = pos.getY(i) }
    uv[i * 2] = u
    uv[i * 2 + 1] = v
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

export class ParadiseMaterials {
  private readonly cache = new Map<string, THREE.Material>()
  private readonly kit: ParadiseKit

  constructor(kit: ParadiseKit) {
    this.kit = kit
  }

  textured(role: string): THREE.MeshStandardMaterial | null {
    const s = SURFACES[role]
    const m = s && this.kit.maps.get(s.slug)
    if (!s || !m) return null
    const diff = m.diff.clone()
    const nor = m.nor.clone()
    diff.repeat.set(1 / s.tile, 1 / s.tile)
    nor.repeat.copy(diff.repeat)
    return new THREE.MeshStandardMaterial({
      map: diff, normalMap: nor, normalScale: new THREE.Vector2(s.normal ?? 1, s.normal ?? 1),
      roughness: s.rough, color: s.tint ?? '#ffffff',
    })
  }

  /** 把一个卡通材质换成对应的写实材质；own 为 true 时不共用（要单独淡出的屋顶） */
  convert(src: THREE.Material, own: boolean): { mat: THREE.Material; textured: boolean } {
    const role = src.name.replace(/^pal_/, '')
    const key = `${role}|${(src as THREE.MeshToonMaterial).color?.getHexString() ?? ''}|${src.transparent ? src.opacity : 1}`
    if (!own) {
      const hit = this.cache.get(key)
      if (hit) return { mat: hit, textured: !!(hit as THREE.MeshStandardMaterial).map }
    }
    let mat: THREE.Material | null = this.textured(role)
    const textured = !!mat
    if (mat && role === 'wallTinted') {
      const src2 = (src as THREE.MeshToonMaterial).color
      if (src2) (mat as THREE.MeshStandardMaterial).color.copy(src2).lerp(new THREE.Color('#ffffff'), 0.35)
    }
    if (!mat) {
      const color = (src as THREE.MeshToonMaterial).color ?? new THREE.Color('#ffffff')
      const glass = role === 'glass'
      mat = new THREE.MeshStandardMaterial({
        color, roughness: glass ? 0.08 : 0.85, metalness: 0,
        transparent: src.transparent || glass, opacity: glass ? 0.45 : src.opacity,
      })
    }
    mat.name = src.name
    if (!own) this.cache.set(key, mat)
    return { mat, textured }
  }

  /** 遍历一棵子树，把所有卡通材质换掉 */
  apply(root: THREE.Object3D, own = false, skip?: THREE.Object3D): void {
    const visit = (o: THREE.Object3D) => {
      if (o === skip) return
      const mesh = o as THREE.Mesh
      if (mesh.isMesh && !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh) {
        const swap = (m: THREE.Material) => {
          if (!(m as THREE.MeshToonMaterial).isMeshToonMaterial) return m
          const { mat, textured } = this.convert(m, own)
          if (textured) boxProjectUV(mesh.geometry)
          return mat
        }
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
      }
      for (const c of o.children) visit(c)
    }
    visit(root)
  }
}

// --- 只在世外桃源画风里出现的景物 ------------------------------------------

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一簇草：5 片叶子，根部深、叶尖浅 */
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const base = new THREE.Color('#3d6e2b')
  const tip = new THREE.Color('#93c95e')
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2
    const lean = 0.09
    const w = 0.03
    const h = 0.12 + (k % 3) * 0.05
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    pos.push(-w * cz, 0, w * cx, w * cz, 0, -w * cx, cx * lean, h, cz * lean)
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function blocked(x: number, z: number): boolean {
  if (x > HOUSE.x0 - 0.3 && x < HOUSE.x1 + 0.3 && z > HOUSE.z0 - 0.3 && z < HOUSE.z1 + 0.3) return true
  if (Math.abs(x - GATE.x) < 0.7 && z > HOUSE.z1 && z < GATE.z + 0.5) return true
  if (z > STREET.z0 - 1.4 && z < STREET.z1 + 1.4) return true
  for (const p of PROPS) if (p.kind !== 'tree' && Math.abs(x - p.x) < p.w / 2 + 0.6 && Math.abs(z - p.z) < p.d / 2 + 0.6) return true
  if (Math.abs(z - YARD.z0) < 0.25 || Math.abs(z - YARD.z1) < 0.25 || Math.abs(x - YARD.x0) < 0.25 || Math.abs(x - YARD.x1) < 0.25) return true
  return false
}

export function grassField(count: number): THREE.InstancedMesh {
  const r = rng(7)
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 })
  const mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const c = new THREE.Color()
  let n = 0
  const area = { x0: WORLD.x0 - 6, z0: WORLD.z0 - 4, x1: WORLD.x1 + 6, z1: WORLD.z1 + 6 }
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    // 院子是草坪，只在围栏和墙根留一些草丛；外面是野地，草丛多
    const inYard = r() < 0.35
    const x = inYard ? YARD.x0 + r() * (YARD.x1 - YARD.x0) : area.x0 + r() * (area.x1 - area.x0)
    const z = inYard ? YARD.z0 + r() * (YARD.z1 - YARD.z0) : area.z0 + r() * (area.z1 - area.z0)
    if (blocked(x, z) || (z < WORLD.z0 - 2 && z > -16)) continue
    if (inYard) {
      const edge = Math.min(x - YARD.x0, YARD.x1 - x, z - YARD.z0, YARD.z1 - z)
      const nearHouse = x > HOUSE.x0 - 1.2 && x < HOUSE.x1 + 1.2 && z > HOUSE.z0 - 1.2 && z < HOUSE.z1 + 1.2
      if (edge > 1.6 && !nearHouse && r() > 0.12) continue
    }
    const s = 0.7 + r() * 0.9
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2)
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s * (0.8 + r() * 0.6), s))
    mesh.setMatrixAt(n, m)
    mesh.setColorAt(n, c.setHSL(0.25 + r() * 0.05, 0.5 + r() * 0.2, 0.55 + r() * 0.15))
    n++
  }
  mesh.count = n
  mesh.receiveShadow = true
  return mesh
}

export function flowers(count: number): THREE.InstancedMesh {
  const r = rng(11)
  const geo = new THREE.IcosahedronGeometry(0.06, 0)
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), count)
  const palette = ['#fff7e8', '#ffd84d', '#f6a6c8', '#c9a7f2', '#ffffff']
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  let n = 0
  for (let tries = 0; n < count && tries < count * 5; tries++) {
    const x = YARD.x0 + r() * (YARD.x1 - YARD.x0)
    const z = YARD.z0 + r() * (YARD.z1 - YARD.z0)
    if (blocked(x, z)) continue
    m.makeTranslation(x, 0.22 + r() * 0.12, z)
    mesh.setMatrixAt(n, m)
    mesh.setColorAt(n, c.set(palette[Math.floor(r() * palette.length)]))
    n++
  }
  mesh.count = n
  return mesh
}

/** 樱花树：弯一点的树干 + 几根枝 + 一团团粉色花冠 */
export function sakuraTree(bark: THREE.Material, seed: number, scale = 1): THREE.Group {
  const r = rng(seed)
  const g = new THREE.Group()
  const seg = (from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number) => {
    const len = from.distanceTo(to)
    const geo = new THREE.CylinderGeometry(r1, r0, len, 7)
    geo.translate(0, len / 2, 0)
    const m = new THREE.Mesh(geo, bark)
    m.position.copy(from)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    m.castShadow = true
    g.add(m)
  }
  const top = new THREE.Vector3(0.3, 2.2, 0.1)
  seg(new THREE.Vector3(0, 0, 0), top, 0.22, 0.14)
  const pinks = ['#f2a0bf', '#f6b8cf', '#ec8fb1', '#fbd0df', '#f7c2d6'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, flatShading: true }))
  const blob = new THREE.IcosahedronGeometry(1, 0)
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + r()
    const end = new THREE.Vector3(top.x + Math.cos(a) * (1.0 + r() * 0.8), top.y + 0.5 + r() * 0.9, top.z + Math.sin(a) * (1.0 + r() * 0.8))
    seg(top, end, 0.1, 0.045)
    for (let k = 0; k < 9; k++) {
      const m = new THREE.Mesh(blob, pinks[Math.floor(r() * pinks.length)])
      m.position.set(end.x + (r() - 0.5) * 1.3, end.y + (r() - 0.35) * 0.9, end.z + (r() - 0.5) * 1.3)
      m.rotation.set(r() * 3, r() * 3, r() * 3)
      m.scale.setScalar(0.28 + r() * 0.3)
      m.castShadow = true
      g.add(m)
    }
  }
  g.scale.setScalar(scale)
  return g
}

/** 普通的绿树：真树皮 + 一团团深浅不一的绿叶 */
export function leafyTree(bark: THREE.Material, seed: number, scale = 1): THREE.Group {
  const r = rng(seed)
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.8, 7), bark)
  trunk.position.y = 0.9
  trunk.castShadow = true
  g.add(trunk)
  const greens = ['#4f8a3a', '#5f9c45', '#6aa84c', '#3f7a32', '#76b356'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true }))
  const blob = new THREE.IcosahedronGeometry(1, 0)
  for (let k = 0; k < 22; k++) {
    const a = r() * Math.PI * 2
    const rad = r() * 1.1
    const m = new THREE.Mesh(blob, greens[Math.floor(r() * greens.length)])
    m.position.set(Math.cos(a) * rad, 2.0 + r() * 1.4, Math.sin(a) * rad)
    m.rotation.set(r() * 3, r() * 3, r() * 3)
    m.scale.setScalar(0.4 + r() * 0.35)
    m.castShadow = true
    g.add(m)
  }
  g.scale.setScalar(scale)
  return g
}

/** 飘落的花瓣 */
export class Petals {
  readonly points: THREE.Points
  private readonly vel: Float32Array
  private readonly center: THREE.Vector3
  private readonly radius: number

  constructor(center: THREE.Vector3, radius: number, count = 160) {
    this.center = center
    this.radius = radius
    const pos = new Float32Array(count * 3)
    this.vel = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = center.x + (Math.random() - 0.5) * radius * 2
      pos[i * 3 + 1] = Math.random() * 4.5
      pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * radius * 2
      this.vel[i] = 0.25 + Math.random() * 0.35
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#f7bfd3', size: 0.09, sizeAttenuation: true }))
  }

  update(dt: number, t: number): void {
    const p = this.points.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - this.vel[i] * dt
      let x = p.getX(i) + Math.sin(t * 1.3 + i) * 0.3 * dt + 0.15 * dt
      let z = p.getZ(i) + Math.cos(t * 0.9 + i * 1.7) * 0.2 * dt
      if (y < 0.02) {
        y = 4.5
        x = this.center.x + (Math.random() - 0.5) * this.radius * 2
        z = this.center.z + (Math.random() - 0.5) * this.radius * 2
      }
      p.setXYZ(i, x, y, z)
    }
    p.needsUpdate = true
  }
}

/** 远处的山：压扁的球，被雾吞掉边缘 */
export function hills(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const spots: [number, number, number, number][] = [
    [-30, -48, 34, 9], [10, -55, 40, 12], [48, -44, 30, 8], [-62, -10, 30, 10], [72, 4, 34, 11], [-55, 40, 28, 7], [60, 52, 32, 8],
  ]
  for (const [x, z, r, h] of spots) {
    const geo = new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    const m = new THREE.Mesh(geo, mat)
    m.scale.set(1, h / r, 1)
    m.position.set(x, -0.5, z)
    m.receiveShadow = true
    g.add(m)
  }
  return g
}

/** 屋后的江（临江市的那条江）：会闪光的水面 */
export class River {
  readonly mesh: THREE.Mesh
  private readonly normal: THREE.CanvasTexture

  constructor() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(128, 128)
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const a = (x / 128) * Math.PI * 2
        const b = (y / 128) * Math.PI * 2
        const dx = Math.cos(a * 3 + b) * 0.5 + Math.cos(a * 7 - b * 2) * 0.25
        const dy = Math.cos(b * 4 - a) * 0.5 + Math.sin(b * 6 + a * 3) * 0.25
        const i = (y * 128 + x) * 4
        img.data[i] = 128 + dx * 60
        img.data[i + 1] = 128 + dy * 60
        img.data[i + 2] = 255
        img.data[i + 3] = 255
      }
    ctx.putImageData(img, 0, 0)
    this.normal = new THREE.CanvasTexture(c)
    this.normal.wrapS = this.normal.wrapT = THREE.RepeatWrapping
    this.normal.repeat.set(30, 3)
    const mat = new THREE.MeshStandardMaterial({
      color: '#4f9fb2', roughness: 0.06, metalness: 0.1, normalMap: this.normal,
      normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.93,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 7), mat)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(5, 0.03, WORLD.z0 - 5.5)
    this.mesh.receiveShadow = true
  }

  update(t: number): void {
    this.normal.offset.set(t * 0.02, t * 0.008)
  }
}
