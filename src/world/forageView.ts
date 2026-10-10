// 野外能采的东西长什么样：代码捏的小模型（野菜、野花、草药、蘑菇、红伞伞、竹笋、野果丛、挂着蜂窝的树），
// 能采的时候头顶飘一个小亮点；采过了只剩一点点茬，过几天再长出来。
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FORAGE, ripe, type ForageKind, type ForageSpot } from './forage'
import { variants, type ParadiseKit } from './paradise'

const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra })

const M = {
  leaf: mat('#5f8f3e'),
  leafDark: mat('#3f6b2c'),
  leafGrey: mat('#8aa07a'),
  stem: mat('#6d8a45'),
  white: mat('#f4efe2'),
  yellow: mat('#f2c94c'),
  purple: mat('#b07cc6'),
  pink: mat('#e48fb0'),
  cap: mat('#b98a5e'),
  capRed: mat('#c8372d'),
  shoot: mat('#a5793f'),
  shootTip: mat('#d9c48a'),
  berryRed: mat('#c2263a'),
  berryDark: mat('#4b1f45'),
  bark: mat('#6b4f37'),
  crown: mat('#4e7a36'),
  hive: mat('#c99a45'),
  hiveDark: mat('#8a6326'),
  stub: mat('#7a6a4a'),
  glint: new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.9 }),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
}

const G = {
  blob: new THREE.IcosahedronGeometry(0.1, 0),
  leaf: new THREE.ConeGeometry(0.05, 0.32, 4),
  stem: new THREE.CylinderGeometry(0.008, 0.01, 0.34, 4),
  petal: new THREE.IcosahedronGeometry(0.045, 0),
  capHalf: new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  mStem: new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6),
  dot: new THREE.IcosahedronGeometry(0.018, 0),
  shoot: new THREE.ConeGeometry(0.06, 0.32, 6),
  cane: new THREE.CylinderGeometry(0.025, 0.03, 2.6, 5),
  bush: new THREE.IcosahedronGeometry(0.32, 1),
  berry: new THREE.IcosahedronGeometry(0.03, 0),
  trunk: new THREE.CylinderGeometry(0.14, 0.2, 2.6, 6),
  crown: new THREE.IcosahedronGeometry(1.2, 1),
  hive: new THREE.SphereGeometry(0.2, 8, 6),
  stub: new THREE.CylinderGeometry(0.04, 0.05, 0.05, 5),
  glint: new THREE.OctahedronGeometry(0.1, 0),
  hit: new THREE.SphereGeometry(0.55, 8, 6),
}

/** 0..1 的伪随机，按位置定（每次打开长得一样） */
function seeded(seed: number): () => number {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function add(g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, s = 1, rx = 0, rz = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.scale.setScalar(s)
  o.rotation.set(rx, 0, rz)
  o.castShadow = true
  g.add(o)
  return o
}

/** 一丛竹子：一节一节的竹竿（竹节深一点），上半截一簇簇细长的竹叶；按材质合成两个网格，省绘制次数 */
function bambooGrove(r: () => number, canes: number, spread: number): THREE.Group {
  const stalks: THREE.BufferGeometry[] = []
  const nodes: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const put = (geo: THREE.BufferGeometry, list: THREE.BufferGeometry[], x: number, y: number, z: number, rx: number, ry: number, rz: number, sx = 1, sy = 1, sz = 1) => {
    q.setFromEuler(e.set(rx, ry, rz, 'YXZ'))
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz))
    list.push(geo.clone().applyMatrix4(m))
  }
  const seg = new THREE.CylinderGeometry(0.032, 0.036, 0.5, 6)
  const ring = new THREE.CylinderGeometry(0.042, 0.042, 0.035, 6)
  const leaf = new THREE.ConeGeometry(0.05, 0.42, 3)
  leaf.translate(0, 0.21, 0)
  for (let i = 0; i < canes; i++) {
    const x = (r() - 0.5) * spread
    const z = (r() - 0.5) * spread * 0.7
    const h = 2.8 + r() * 1.4
    const lean = (r() - 0.5) * 0.12
    const n = Math.round(h / 0.5)
    for (let k = 0; k < n; k++) {
      const y = 0.25 + k * 0.5
      put(seg, stalks, x + lean * y, y, z, 0, 0, -lean)
      put(ring, nodes, x + lean * (y + 0.25), y + 0.25, z, 0, 0, -lean)
    }
    // 上半截：几簇竹叶，每簇 4 片朝外、往下垂
    // 上半截：很多簇细小的竹叶，各朝各的方向、往下垂（从高处看是一团叶子，不是一根羽毛）
    for (let t = 0; t < 12; t++) {
      const y = h * (0.45 + t * 0.045)
      const yaw = r() * Math.PI * 2
      const reach = 0.08 + r() * 0.22
      for (let l = 0; l < 4; l++) {
        const a = yaw + (l / 4) * Math.PI * 2 + (r() - 0.5) * 0.8
        put(leaf, leaves, x + lean * y + Math.sin(a) * reach, y, z + Math.cos(a) * reach, 1.9 + r() * 0.7, a, 0, 1, 1, 0.3)
      }
    }
  }
  const g = new THREE.Group()
  for (const [list, mat] of [[stalks, M.leaf], [nodes, M.leafDark], [leaves, M.crown]] as const) {
    const merged = mergeGeometries(list)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    g.add(mesh)
  }
  return g
}

/** 长着的样子 */
function plant(kind: ForageKind, r: () => number): THREE.Group {
  const g = new THREE.Group()
  const around = (n: number, rad: number, f: (x: number, z: number, i: number) => void) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.6
      const d = rad * (0.4 + r() * 0.6)
      f(Math.cos(a) * d, Math.sin(a) * d, i)
    }
  }
  if (kind === 'greens') {
    around(9, 0.22, (x, z) => add(g, G.blob, r() < 0.5 ? M.leaf : M.leafDark, x, 0.04, z, 0.8 + r() * 0.5).scale.y = 0.35)
  } else if (kind === 'flowers') {
    const cols = [M.yellow, M.white, M.purple, M.pink]
    around(11, 0.3, (x, z) => {
      const h = 0.25 + r() * 0.15
      const st = add(g, G.stem, M.stem, x, h / 2, z)
      st.scale.y = h / 0.34
      add(g, G.petal, cols[Math.floor(r() * cols.length)], x, h, z, 0.9 + r() * 0.5)
    })
    around(6, 0.25, (x, z) => add(g, G.blob, M.leaf, x, 0.03, z, 0.7).scale.y = 0.3)
  } else if (kind === 'herb') {
    around(10, 0.18, (x, z) => add(g, G.leaf, r() < 0.5 ? M.leafGrey : M.leaf, x, 0.14, z, 0.8 + r() * 0.5, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5))
  } else if (kind === 'mushroom' || kind === 'toadstool') {
    const red = kind === 'toadstool'
    around(red ? 3 : 5, 0.16, (x, z) => {
      const s = 0.8 + r() * 0.6
      add(g, G.mStem, M.white, x, 0.06 * s, z, s)
      add(g, G.capHalf, red ? M.capRed : M.cap, x, 0.11 * s, z, s).scale.y = s * 0.55
      if (red) for (let k = 0; k < 4; k++) add(g, G.dot, M.white, x + (r() - 0.5) * 0.12 * s, 0.15 * s, z + (r() - 0.5) * 0.12 * s, s)
    })
  } else if (kind === 'shoots') {
    // 后面一小丛竹子，前面地里冒出几根笋
    const grove = bambooGrove(r, 6, 0.9)
    grove.position.set(-0.9, 0, -0.5)
    grove.scale.setScalar(1 / 1.4)
    g.add(grove)
    around(4, 0.22, (x, z) => {
      add(g, G.shoot, M.shoot, x, 0.14, z, 0.8 + r() * 0.5)
      add(g, G.dot, M.shootTip, x, 0.3, z, 1.5)
    })
  } else if (kind === 'bamboo') {
    g.add(bambooGrove(r, 9, 1.4))
    // 能砍的几根砍好了放在前面
    for (let i = 0; i < 3; i++) add(g, G.cane, M.shoot, (i - 1) * 0.07, 0.05, 0.45, 0.5, 0, Math.PI / 2)
  } else if (kind === 'berries') {
    add(g, G.bush, M.leafDark, 0, 0.26, 0, 1).scale.y = 0.75
    add(g, G.bush, M.leaf, 0.22, 0.2, 0.1, 0.7).scale.y = 0.7
    const c = r() < 0.5 ? M.berryRed : M.berryDark
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2
      const up = 0.15 + r() * 0.3
      add(g, G.berry, c, Math.cos(a) * 0.3, up, Math.sin(a) * 0.26 + 0.05, 1)
    }
  } else if (kind === 'honey') {
    add(g, G.trunk, M.bark, 0, 1.3, 0)
    add(g, G.crown, M.crown, 0, 3.1, 0, 1).scale.y = 0.8
    add(g, G.crown, M.leafDark, 0.6, 2.7, 0.3, 0.6)
    const hive = new THREE.Group()
    add(hive, G.hive, M.hive, 0, 0, 0, 1).scale.y = 1.35
    for (let k = -1; k <= 1; k++) add(hive, G.hive, M.hiveDark, 0, k * 0.09, 0, 1.02).scale.set(1.02, 0.08, 1.02)
    hive.position.set(0.1, 1.7, 0.32)
    hive.name = 'hive'
    g.add(hive)
  }
  return g
}

/** 采过以后剩下的茬 */
function stubs(kind: ForageKind, r: () => number): THREE.Group {
  const g = new THREE.Group()
  if (kind === 'honey') {
    add(g, G.trunk, M.bark, 0, 1.3, 0)
    add(g, G.crown, M.crown, 0, 3.1, 0, 1).scale.y = 0.8
    add(g, G.crown, M.leafDark, 0.6, 2.7, 0.3, 0.6)
    return g
  }
  if (kind === 'shoots' || kind === 'bamboo') {
    const grove = bambooGrove(r, kind === 'bamboo' ? 6 : 6, kind === 'bamboo' ? 1.4 : 0.9)
    if (kind === 'shoots') { grove.position.set(-0.9, 0, -0.5); grove.scale.setScalar(1 / 1.4) }
    g.add(grove)
  }
  if (kind === 'berries') {
    add(g, G.bush, M.leafDark, 0, 0.26, 0, 1).scale.y = 0.75
    return g
  }
  for (let i = 0; i < 4; i++) add(g, G.stub, M.stub, (r() - 0.5) * 0.3, 0.02, (r() - 0.5) * 0.3)
  return g
}

/** 把一棵植物里的小零件按材质合成几个大网格（每棵从几十次绘制降到两三次） */
function flatten(g: THREE.Group): THREE.Group {
  g.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert()
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k)
    const mat = m.material as THREE.Material
    const list = buckets.get(mat) ?? []
    list.push(geo)
    buckets.set(mat, list)
  })
  const out = new THREE.Group()
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list)
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, mat)
    mesh.castShadow = true
    out.add(mesh)
  }
  return out
}

interface Item { spot: ForageSpot; full: THREE.Group; empty: THREE.Group; glint: THREE.Mesh; hit: THREE.Mesh; ripe: boolean }

export class ForageView {
  readonly root = new THREE.Group()
  private items: Item[] = []
  private t = 0

  constructor(scene: THREE.Scene, ground: (x: number, z: number) => number = () => 0) {
    for (const s of FORAGE) {
      const r = seeded(Math.round((s.at.x + 50) * 131 + (s.at.z + 50) * 7))
      const holder = new THREE.Group()
      holder.position.set(s.at.x, ground(s.at.x, s.at.z), s.at.z)
      holder.rotation.y = r() * Math.PI * 2
      // 游戏镜头很高：小东西放大一点才看得清（树不用）
      if (s.kind !== 'honey' && s.kind !== 'bamboo') holder.scale.setScalar(1.4)
      const full = flatten(plant(s.kind, r))
      const empty = flatten(stubs(s.kind, seeded(Math.round(s.at.x * 17 + s.at.z * 3 + 999))))
      const glint = new THREE.Mesh(G.glint, M.glint)
      glint.position.y = s.kind === 'honey' ? 2.35 : 0.75
      const hit = new THREE.Mesh(G.hit, M.hit)
      hit.position.y = s.kind === 'honey' ? 1.4 : 0.3
      if (s.kind === 'honey') hit.scale.set(1.2, 2.6, 1.2)
      hit.userData.forage = s.id
      // 只用来点：不画出来（射线照样打得到看不见的物体）
      hit.visible = false
      holder.add(full, empty, glint, hit)
      this.root.add(holder)
      this.items.push({ spot: s, full, empty, glint, hit, ripe: true })
    }
    scene.add(this.root)
  }

  /** 世外桃源画风：能找到扫描模型的换成 Poly Haven 的真植物（蘑菇、竹子还是自己捏的） */
  useKit(kit: ParadiseKit): void {
    const pick: Record<string, { slug: string; n: number; scale: number }> = {
      greens_w: { slug: 'weed_plant_02', n: 6, scale: 2.0 },
      greens_e: { slug: 'fern_02', n: 3, scale: 1.7 },
      flowers_w: { slug: 'flower_gazania', n: 7, scale: 2.2 },
      flowers_e: { slug: 'periwinkle_plant', n: 6, scale: 2.0 },
      herb_river: { slug: 'dandelion_01', n: 9, scale: 3.0 },
      herb_w: { slug: 'nettle_plant', n: 5, scale: 1.9 },
      herb_e: { slug: 'shrub_sorrel_01', n: 6, scale: 2.0 },
      berries_e: { slug: 'shrub_04', n: 2, scale: 2.0 },
      berries_w: { slug: 'shrub_04', n: 2, scale: 2.0 },
    }
    // 自己捏的（蘑菇、竹子、竹笋、蜂窝）换成不那么"卡通"的颜色：平滑着色、颜色压暗一点
    const natural = new Map<THREE.Material, THREE.Material>()
    const soft = (src: THREE.MeshStandardMaterial, color: string) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: false })
      natural.set(src, m)
    }
    soft(M.leaf, '#56703a')
    soft(M.leafDark, '#3c5229')
    soft(M.crown, '#47612f')
    soft(M.stem, '#62773f')
    soft(M.white, '#e6dccb')
    soft(M.cap, '#94653f')
    soft(M.capRed, '#b0302a')
    soft(M.shoot, '#7d6034')
    soft(M.shootTip, '#c4ad78')
    soft(M.hive, '#b88a43')
    soft(M.hiveDark, '#7a5824')
    const naturalize = (g: THREE.Object3D) => g.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && natural.has(m.material as THREE.Material)) {
        m.material = natural.get(m.material as THREE.Material)!
        // 合成过的网格法线是按面算的：重新算一遍才平滑
        if (m.geometry !== G.berry && m.geometry !== G.dot) { m.geometry = m.geometry.clone(); m.geometry.computeVertexNormals() }
      }
    })
    for (const it of this.items) {
      if (it.spot.kind === 'mushroom' || it.spot.kind === 'toadstool' || it.spot.kind === 'shoots' || it.spot.kind === 'bamboo') {
        naturalize(it.full)
        naturalize(it.empty)
        // 蘑菇在高处的镜头里太小：再大一圈
        if (it.spot.kind === 'mushroom' || it.spot.kind === 'toadstool') it.full.scale.setScalar(1.5)
      }
    }
    // 蜂窝挂在一棵真的树上（Poly Haven 的树，绿叶子）
    const treeSrc = kit.models.get('island_tree_02')
    const honey = this.items.find((x) => x.spot.kind === 'honey')
    if (treeSrc && honey) {
      const tree = treeSrc.clone()
      const box = new THREE.Box3().setFromObject(tree)
      const k = 4.6 / Math.max(0.1, box.max.y - box.min.y)
      tree.scale.setScalar(k)
      const mk = (withHive: boolean) => {
        const g = new THREE.Group()
        g.add(withHive ? tree : tree.clone())
        if (withHive) {
          const hive = new THREE.Group()
          add(hive, G.hive, natural.get(M.hive) ?? M.hive, 0, 0, 0, 1).scale.y = 1.35
          for (let j = -1; j <= 1; j++) add(hive, G.hive, natural.get(M.hiveDark) ?? M.hiveDark, 0, j * 0.09, 0, 1.02).scale.set(1.02, 0.08, 1.02)
          hive.position.set(0.18, 1.75, 0.3)
          g.add(hive)
        }
        return g
      }
      const parent = honey.full.parent!
      parent.remove(honey.full, honey.empty)
      honey.full = mk(true)
      honey.empty = mk(false)
      parent.add(honey.full, honey.empty)
      honey.full.visible = honey.ripe
      honey.empty.visible = !honey.ripe
    }
    for (const it of this.items) {
      const p = pick[it.spot.id]
      const src = p && kit.models.get(p.slug)
      if (!p || !src) continue
      const vs = variants(src)
      if (!vs.length) continue
      const r = seeded(Math.round((it.spot.at.x + 70) * 37 + (it.spot.at.z + 70) * 11))
      const g = new THREE.Group()
      for (let i = 0; i < p.n; i++) {
        const v = vs[Math.floor(r() * vs.length)]
        const part = new THREE.Group()
        for (const q of v.parts) {
          const m = new THREE.Mesh(q.geo, q.mat)
          m.castShadow = true
          m.receiveShadow = true
          part.add(m)
        }
        const a = r() * Math.PI * 2
        const d = i === 0 ? 0 : 0.2 + r() * 0.35
        part.position.set(Math.cos(a) * d, 0, Math.sin(a) * d)
        part.rotation.y = r() * Math.PI * 2
        part.scale.setScalar(p.scale * (0.85 + r() * 0.3))
        g.add(part)
      }
      // 野果丛：叶子上挂一些红的、紫黑的小果子
      if (it.spot.kind === 'berries') {
        const box = new THREE.Box3().setFromObject(g)
        const c = it.spot.id === 'berries_e' ? M.berryRed : M.berryDark
        for (let i = 0; i < 18; i++) {
          const a = r() * Math.PI * 2
          const y = box.min.y + (box.max.y - box.min.y) * (0.35 + r() * 0.55)
          const rx = (box.max.x - box.min.x) / 2
          const rz = (box.max.z - box.min.z) / 2
          const k = 0.75 + r() * 0.25
          add(g, G.berry, c, (box.min.x + box.max.x) / 2 + Math.cos(a) * rx * k, y, (box.min.z + box.max.z) / 2 + Math.sin(a) * rz * k, 1.3)
        }
      }
      const parent = it.full.parent!
      // 原来代码捏的放大过 1.4 倍，扫描植物是真实尺寸：外层缩放归一
      parent.scale.setScalar(1)
      parent.remove(it.full)
      it.full = g
      parent.add(g)
      g.visible = it.ripe
      // 采过以后：野果丛只剩叶子，别的只剩地皮
      const empty = new THREE.Group()
      if (it.spot.kind === 'berries') for (const ch of g.children) if (!(ch as THREE.Mesh).isMesh || (ch as THREE.Mesh).geometry !== G.berry) empty.add(ch.clone())
      parent.remove(it.empty)
      it.empty = empty
      parent.add(empty)
      empty.visible = !it.ripe
      it.hit.scale.setScalar(it.spot.kind === 'honey' ? 1 : 1.3)
    }
  }

  /** 哪些长好了（每帧调用也便宜：只比一下天数） */
  sync(picked: Record<string, number>, day: number): void {
    for (const it of this.items) {
      const ok = ripe(it.spot, picked, day)
      if (ok === it.ripe) continue
      it.ripe = ok
      it.full.visible = ok
      it.empty.visible = !ok
    }
  }

  /** 植物头顶原来有一颗转着的小黄点提示能采；用户说不要（植物本身看得出来，鼠标放上去会变小手） */
  update(dt: number, _showGlints: boolean): void {
    this.t += dt
    for (const it of this.items) it.glint.visible = false
  }

  /** 鼠标下面是哪一处（拿不准就返回 null） */
  pick(ray: THREE.Raycaster): ForageSpot | null {
    const hits = ray.intersectObjects(this.items.map((i) => i.hit), false)
    const id = hits[0]?.object.userData.forage as string | undefined
    return id ? FORAGE.find((s) => s.id === id) ?? null : null
  }
}
