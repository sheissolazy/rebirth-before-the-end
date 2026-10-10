// 菜园的样子：每块地一个木板围的高床，土浇过水颜色深一点；种什么长什么样（代码搭的低面数小菜），按长到哪了慢慢长高；
// 地头插一块木牌写着种的什么、熟了没有。开地的时候先翻出一块土，再围上木板。
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { PLOT_SLOTS, cropOf, type CropId, type Plot } from './garden'

const M = (c: THREE.ColorRepresentation, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r })
const MAT = {
  leaf: Object.assign(M('#6aa84f'), { side: THREE.DoubleSide }), dark: Object.assign(M('#3f7a35'), { side: THREE.DoubleSide }), pale: M('#d3e6ad'), stem: M('#eef3df'), red: M('#d8432f', 0.5), unripe: M('#7fae45', 0.6),
  yellow: M('#e9c24a', 0.6), husk: M('#9cbf5a'), stake: M('#8a6a45'), flower: M('#f6f2e4'), sage: M('#8fa889'), wood: M('#8a6440', 0.85), woodDark: M('#6b4a2e', 0.85),
}
const WET = new THREE.Color('#3b2819')
const DRY = new THREE.Color('#6b4a32')

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

interface Built { root: THREE.Group; ripe: THREE.Object3D[]; unripe: THREE.Object3D[] }

/** 玉米叶：一条长丝带，从原点往 +z 拱出去、叶尖往下垂（两面都画） */
let cornLeafGeo: THREE.BufferGeometry | null = null
function cornLeaf(): THREE.BufferGeometry {
  if (cornLeafGeo) return cornLeafGeo
  const geo = new THREE.PlaneGeometry(0.07, 0.6, 1, 8)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) / 0.6 + 0.5 // 0（叶根）～1（叶尖）
    const w = p.getX(i) * (1 - v * 0.8)
    p.setXYZ(i, w, Math.sin(v * Math.PI * 0.8) * 0.18, v * 0.55)
  }
  geo.computeVertexNormals()
  cornLeafGeo = geo
  return geo
}

/** 一棵菜（原点在土面上）。ripe 里的东西熟了才露出来，unripe 里的熟了就藏起来（比如青番茄） */
function plant(crop: CropId, seed: number): Built {
  const g = new THREE.Group()
  const ripe: THREE.Object3D[] = []
  const unripe: THREE.Object3D[] = []
  const rnd = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5 + 0.5
  if (crop === 'bokchoy') {
    // 一圈勺子形的叶子，白色的梗
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rnd(k)
      const leaf = mesh(new THREE.SphereGeometry(1, 8, 6), k % 2 ? MAT.leaf : MAT.dark)
      leaf.scale.set(0.06, 0.018, 0.13)
      leaf.position.set(Math.sin(a) * 0.07, 0.11, Math.cos(a) * 0.07)
      // 先转到朝外的方向，再往上翘
      leaf.rotation.order = 'YXZ'
      leaf.rotation.set(-0.95, a, 0)
      const stem = mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.1, 5), MAT.stem, Math.sin(a) * 0.025, 0.05, Math.cos(a) * 0.025)
      stem.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4)
      g.add(leaf, stem)
    }
  } else if (crop === 'scallion') {
    for (let k = 0; k < 7; k++) {
      const h = 0.3 + rnd(k) * 0.12
      const s = mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 5), k % 3 ? MAT.dark : MAT.leaf, (rnd(k + 9) - 0.5) * 0.08, h / 2, (rnd(k + 3) - 0.5) * 0.08)
      s.rotation.set((rnd(k + 1) - 0.5) * 0.35, 0, (rnd(k + 2) - 0.5) * 0.35)
      g.add(s)
    }
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6), MAT.stem, 0, 0.02, 0))
  } else if (crop === 'potato') {
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const r = k === 5 ? 0 : 0.08
      g.add(mesh(new THREE.SphereGeometry(0.075 + rnd(k) * 0.03, 7, 5), k % 2 ? MAT.dark : MAT.leaf, Math.sin(a) * r, 0.09 + (k === 5 ? 0.06 : 0), Math.cos(a) * r))
    }
    // 熟了开小白花
    for (let k = 0; k < 3; k++) {
      const f = mesh(new THREE.SphereGeometry(0.022, 6, 4), MAT.flower, (rnd(k + 4) - 0.5) * 0.14, 0.22, (rnd(k + 7) - 0.5) * 0.14)
      ripe.push(f)
      g.add(f)
    }
  } else if (crop === 'mugwort') {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      const c = mesh(new THREE.ConeGeometry(0.035, 0.3 + rnd(k) * 0.1, 5), MAT.sage, Math.sin(a) * 0.04, 0.15, Math.cos(a) * 0.04)
      c.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35)
      g.add(c)
    }
  } else if (crop === 'tomato') {
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 5), MAT.stake, 0.03, 0.47, 0))
    for (let k = 0; k < 5; k++) g.add(mesh(new THREE.SphereGeometry(0.07, 7, 5), k % 2 ? MAT.dark : MAT.leaf, (rnd(k) - 0.5) * 0.12, 0.15 + k * 0.15, (rnd(k + 5) - 0.5) * 0.12))
    for (let k = 0; k < 4; k++) {
      const x = (rnd(k + 11) - 0.5) * 0.16
      const y = 0.25 + k * 0.15
      const z = 0.07 + rnd(k + 13) * 0.03
      const red = mesh(new THREE.SphereGeometry(0.045, 8, 6), MAT.red, x, y, z)
      const green = mesh(new THREE.SphereGeometry(0.04, 8, 6), MAT.unripe, x, y, z)
      ripe.push(red)
      unripe.push(green)
      g.add(red, green)
    }
  } else {
    // 玉米：一根高秆子、几片长叶子往外弯；熟了腰上一根黄玉米棒子
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.5, 6), MAT.leaf, 0, 0.75, 0))
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd(k)
      // 一片弯下来的长叶子：从秆子上长出来往外拱、叶尖往下垂
      const leaf = mesh(cornLeaf(), k % 2 ? MAT.leaf : MAT.dark, 0, 0.3 + k * 0.18, 0)
      leaf.rotation.y = a
      g.add(leaf)
    }
    const cob = new THREE.Group()
    cob.add(mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.18, 8), MAT.yellow, 0, 0, 0))
    const husk = mesh(new THREE.ConeGeometry(0.045, 0.14, 6), MAT.husk, 0, -0.1, 0)
    husk.rotation.x = Math.PI
    cob.add(husk)
    cob.position.set(0.05, 0.8, 0.02)
    cob.rotation.z = -0.5
    ripe.push(cob)
    g.add(cob)
  }
  return { root: g, ripe, unripe }
}

/** 一块地种几棵、怎么排（高的种得稀一点） */
function layout(crop: CropId, w: number, d: number): { x: number; z: number }[] {
  const tall = crop === 'corn' || crop === 'tomato'
  const cols = tall ? 3 : 5
  const rows = 2
  const out: { x: number; z: number }[] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: -w / 2 + 0.35 + (c * (w - 0.7)) / (cols - 1), z: -d / 2 + 0.5 + (r * (d - 1.0)) / (rows - 1) })
  return out
}

/** 地头的木牌：写着种的什么、长到哪了 */
function signTexture(text: string, sub: string, hot: boolean): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#c9a26b'
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = '#7a5a34'
  g.lineWidth = 6
  g.strokeRect(4, 4, 248, 120)
  g.fillStyle = '#3b2a18'
  g.font = 'bold 46px "PingFang SC", "Songti SC", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 48)
  g.font = 'bold 30px "PingFang SC", sans-serif'
  g.fillStyle = hot ? '#b8321f' : '#5a4228'
  g.fillText(sub, 128, 96)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

interface Bed {
  root: THREE.Group
  soil: THREE.Mesh
  soilMat: THREE.MeshStandardMaterial
  frame: THREE.Group
  furrows: THREE.Group
  /** 一块地的菜合并成几块网格（按材质分，熟了才露的、熟了就藏的各一组），省绘制次数 */
  plants: THREE.Group
  plantKey: string
  sign: THREE.Group
  signMat: THREE.MeshStandardMaterial
  signKey: string
}

/** 把一块地的菜按"哪一组（平常/熟了才有/没熟才有）+ 材质"合并成几块网格 */
function mergePlants(crop: CropId, i: number, w: number, d: number, scale: number): THREE.Group {
  const tmp = new THREE.Group()
  const tags = new Map<THREE.Object3D, 'ripe' | 'unripe'>()
  layout(crop, w, d).forEach((at, k) => {
    const pl = plant(crop, i * 10 + k)
    pl.root.position.set(at.x, 0, at.z)
    pl.root.rotation.y = k * 1.7
    pl.root.scale.setScalar(scale * (0.92 + (k % 3) * 0.05))
    for (const o of pl.ripe) tags.set(o, 'ripe')
    for (const o of pl.unripe) tags.set(o, 'unripe')
    tmp.add(pl.root)
  })
  tmp.updateMatrixWorld(true)
  const buckets = new Map<string, { tag: string; mat: THREE.Material; geos: THREE.BufferGeometry[] }>()
  tmp.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    let tag = 'base'
    for (let q: THREE.Object3D | null = m; q; q = q.parent) { const t = tags.get(q); if (t) { tag = t; break } }
    const mat = m.material as THREE.Material
    const key = `${tag}|${mat.uuid}`
    const b = buckets.get(key) ?? { tag, mat, geos: [] }
    b.geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld))
    buckets.set(key, b)
    m.geometry.dispose()
  })
  const out = new THREE.Group()
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos)
    for (const g of b.geos) g.dispose()
    if (!geo) continue
    const mesh = new THREE.Mesh(geo, b.mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.tag = b.tag
    out.add(mesh)
  }
  return out
}

export class GardenView {
  readonly group = new THREE.Group()
  private readonly beds: Bed[] = []

  constructor() {
    PLOT_SLOTS.forEach((r, i) => {
      const w = r.x1 - r.x0
      const d = r.z1 - r.z0
      const root = new THREE.Group()
      root.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)
      root.userData.slug = 'plot'
      root.userData.plot = i
      root.visible = false
      const soilMat = M(DRY, 1)
      const soil = mesh(new THREE.BoxGeometry(w - 0.12, 0.16, d - 0.12), soilMat, 0, 0.08, 0)
      // 木板框：四块板 + 四根角桩，按材质合并成两块网格（省绘制次数）
      const planks: THREE.BufferGeometry[] = []
      const posts: THREE.BufferGeometry[] = []
      const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z)
      for (const s of [-1, 1]) {
        planks.push(at(new THREE.BoxGeometry(w, 0.22, 0.07), 0, 0.11, s * (d / 2 - 0.035)))
        planks.push(at(new THREE.BoxGeometry(0.07, 0.22, d - 0.14), s * (w / 2 - 0.035), 0.11, 0))
        for (const t of [-1, 1]) posts.push(at(new THREE.BoxGeometry(0.09, 0.28, 0.09), s * (w / 2 - 0.045), 0.14, t * (d / 2 - 0.045)))
      }
      const frame = new THREE.Group()
      frame.add(mesh(mergeGeometries(planks)!, MAT.wood), mesh(mergeGeometries(posts)!, MAT.woodDark))
      for (const g of [...planks, ...posts]) g.dispose()
      const furrows = new THREE.Group()
      for (const z of [-d / 2 + 0.5, d / 2 - 0.5]) furrows.add(mesh(new THREE.BoxGeometry(w - 0.4, 0.05, 0.32), soilMat, 0, 0.18, z))
      const plants = new THREE.Group()
      plants.position.y = 0.17
      // 木牌插在靠镜头的那个角（东南）
      const sign = new THREE.Group()
      const signMat = new THREE.MeshStandardMaterial({ color: '#c9a26b', roughness: 0.9 })
      sign.add(mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), MAT.woodDark, 0, 0.27, 0))
      const board = mesh(new THREE.BoxGeometry(0.4, 0.2, 0.025), signMat, 0, 0.55, 0.02)
      sign.add(board)
      sign.position.set(w / 2 - 0.2, 0, d / 2 + 0.12)
      sign.rotation.y = -0.25
      root.add(soil, frame, furrows, plants, sign)
      this.group.add(root)
      this.beds.push({ root, soil, soilMat, frame, furrows, plants, plantKey: '', sign, signMat, signKey: '' })
    })
  }

  /** dig：正在开的是第几块、开到哪了（-1 = 没在开） */
  update(plots: Plot[], dig: number, digP: number, day: number, elapsed: number): void {
    this.beds.forEach((b, i) => {
      const p = plots[i]
      const digging = !p.built && i === dig && digP >= 0
      b.root.visible = p.built || digging
      if (!b.root.visible) return
      // 开地：先翻出一块土，一半以后围木板、起垄
      b.frame.visible = p.built || digP > 0.5
      b.furrows.visible = p.built || digP > 0.75
      b.soil.scale.set(1, p.built ? 1 : Math.max(0.15, Math.min(1, digP * 2)), 1)
      b.sign.visible = p.built
      b.soilMat.color.copy(p.watered === day ? WET : DRY)
      // 种的菜：换了菜、长了 5%、熟了才重新合并一次（长得很慢，不用每帧动）
      const ripe = !!p.crop && p.growth >= 1
      const step = Math.floor(Math.min(1, p.growth) * 20)
      const pk = p.crop ? `${p.crop}|${step}` : ''
      if (pk !== b.plantKey) {
        b.plantKey = pk
        b.plants.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose() })
        b.plants.clear()
        if (p.crop) {
          const r = PLOT_SLOTS[i]
          b.plants.add(mergePlants(p.crop, i, r.x1 - r.x0, r.z1 - r.z0, 0.15 + (step / 20) * 0.85))
        }
      }
      b.plants.traverse((o) => {
        const tag = o.userData.tag as string | undefined
        if (tag === 'ripe') o.visible = ripe
        else if (tag === 'unripe') o.visible = !ripe && p.growth > 0.5
      })
      // 风吹得整块地的菜轻轻晃
      b.plants.rotation.z = Math.sin(elapsed * 0.9 + i) * 0.006
      // 木牌：种的什么、长到哪了
      const c = cropOf(p.crop)
      const key = c ? `${c.id}|${ripe ? 'ripe' : Math.floor(p.growth * 10)}` : 'empty'
      if (key !== b.signKey) {
        b.signKey = key
        const tex = c ? signTexture(`${c.icon}${c.name}`, ripe ? '熟了，可以收' : `长到 ${Math.floor(p.growth * 100)}%`, ripe) : signTexture('空地', '点我选种什么', false)
        if (tex) {
          b.signMat.map?.dispose()
          b.signMat.map = tex
          b.signMat.color.set('#ffffff')
          b.signMat.needsUpdate = true
        }
      }
    })
  }
}
