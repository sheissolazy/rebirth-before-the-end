// 野外能采的东西长什么样：代码捏的小模型（野菜、野花、草药、蘑菇、红伞伞、竹笋、野果丛、挂着蜂窝的树），
// 能采的时候头顶飘一个小亮点；采过了只剩一点点茬，过几天再长出来。
import * as THREE from 'three'
import { FORAGE, ripe, type ForageKind, type ForageSpot } from './forage'

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
    for (let i = 0; i < 6; i++) {
      const x = -0.9 + (r() - 0.5) * 0.7
      const z = -0.5 + (r() - 0.5) * 0.8
      add(g, G.cane, M.leaf, x, 1.3, z, 0.9 + r() * 0.3, (r() - 0.5) * 0.12, (r() - 0.5) * 0.12)
      add(g, G.blob, M.leafDark, x, 2.3 + r() * 0.4, z, 3 + r() * 1.5).scale.y = 1.6
    }
    around(4, 0.22, (x, z) => {
      add(g, G.shoot, M.shoot, x, 0.14, z, 0.8 + r() * 0.5)
      add(g, G.dot, M.shootTip, x, 0.3, z, 1.5)
    })
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
  if (kind === 'shoots') {
    for (let i = 0; i < 6; i++) {
      const x = -0.9 + (r() - 0.5) * 0.7
      const z = -0.5 + (r() - 0.5) * 0.8
      add(g, G.cane, M.leaf, x, 1.3, z, 0.9 + r() * 0.3)
      add(g, G.blob, M.leafDark, x, 2.3 + r() * 0.4, z, 3 + r() * 1.5).scale.y = 1.6
    }
  }
  if (kind === 'berries') {
    add(g, G.bush, M.leafDark, 0, 0.26, 0, 1).scale.y = 0.75
    return g
  }
  for (let i = 0; i < 4; i++) add(g, G.stub, M.stub, (r() - 0.5) * 0.3, 0.02, (r() - 0.5) * 0.3)
  return g
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
      if (s.kind !== 'honey') holder.scale.setScalar(1.4)
      const full = plant(s.kind, r)
      const empty = stubs(s.kind, seeded(Math.round(s.at.x * 17 + s.at.z * 3 + 999)))
      const glint = new THREE.Mesh(G.glint, M.glint)
      glint.position.y = s.kind === 'honey' ? 2.35 : 0.75
      const hit = new THREE.Mesh(G.hit, M.hit)
      hit.position.y = s.kind === 'honey' ? 1.4 : 0.3
      if (s.kind === 'honey') hit.scale.set(1.2, 2.6, 1.2)
      hit.userData.forage = s.id
      holder.add(full, empty, glint, hit)
      this.root.add(holder)
      this.items.push({ spot: s, full, empty, glint, hit, ripe: true })
    }
    scene.add(this.root)
  }

  /** 哪些长好了（每帧调用也便宜：只比一下天数） */
  sync(picked: Record<string, number>, day: number): void {
    for (const it of this.items) {
      const ok = ripe(it.spot, picked, day)
      if (ok === it.ripe) continue
      it.ripe = ok
      it.full.visible = ok
      it.empty.visible = !ok
      it.glint.visible = ok
    }
  }

  update(dt: number, showGlints: boolean): void {
    this.t += dt
    for (const [i, it] of this.items.entries()) {
      it.glint.visible = it.ripe && showGlints
      it.glint.position.y = (it.spot.kind === 'honey' ? 2.35 : 0.75) + Math.sin(this.t * 2.2 + i) * 0.06
      it.glint.rotation.y = this.t * 1.5
    }
  }

  /** 鼠标下面是哪一处（拿不准就返回 null） */
  pick(ray: THREE.Raycaster): ForageSpot | null {
    const hits = ray.intersectObjects(this.items.map((i) => i.hit), false)
    const id = hits[0]?.object.userData.forage as string | undefined
    return id ? FORAGE.find((s) => s.id === id) ?? null : null
  }
}
