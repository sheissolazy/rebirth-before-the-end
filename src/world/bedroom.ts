// 每间卧室一张不一样的床：Poly Haven 没有的几种用代码搭——
// 铁架床上铺的褥子和被子、客房一的木框矮床（深蓝被子）、备用的行军床（军绿帆布、交叉腿）。
// 都是"床头朝北（-z）"，原点在床的正中间、地面上。
import * as THREE from 'three'

const std = (color: THREE.ColorRepresentation, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough })

/** 圆角的软块（褥子、被子、枕头）：盒子的顶面四边往下压一点，看着是软的 */
function soft(w: number, h: number, d: number, mat: THREE.Material, sag = 0.35): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d, 6, 2, 8)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2)
    const y = p.getY(i)
    const z = p.getZ(i) / (d / 2)
    if (y > 0) {
      // 越靠边越往下塌（中间鼓、边上软软地垂下来）
      const edge = Math.max(Math.abs(x), Math.abs(z)) ** 4
      p.setY(i, y - edge * h * sag)
    }
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function shadows(g: THREE.Object3D): void {
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
}

/** 床上用品：褥子 + 被子（盖住下面三分之二）+ 枕头，铺在 top 那个高度上 */
function bedding(w: number, l: number, top: number, quilt: string, sheet: string, pillow: string, pillows = 1): THREE.Group {
  const g = new THREE.Group()
  const mattress = soft(w, 0.14, l, std(sheet), 0.25)
  mattress.position.y = top + 0.07
  const q = soft(w + 0.06, 0.07, l * 0.68, std(quilt, 0.95), 0.6)
  q.position.set(0, top + 0.15, l * 0.16)
  // 被子在床尾折一道
  const fold = soft(w + 0.06, 0.06, 0.18, std(quilt, 0.95), 0.5)
  fold.position.set(0, top + 0.2, l * 0.16 - l * 0.34 + 0.09)
  g.add(mattress, q, fold)
  for (let k = 0; k < pillows; k++) {
    const pw = pillows === 1 ? w * 0.62 : w * 0.42
    const p = soft(pw, 0.12, 0.34, std(pillow), 0.7)
    p.position.set(pillows === 1 ? 0 : (k - 0.5) * w * 0.48, top + 0.2, -l / 2 + 0.26)
    p.rotation.x = -0.12
    g.add(p)
  }
  return g
}

/** 铁架床（Poly Haven 的 old_bed_frame 只有架子）上铺的东西：灰白褥子、旧军绿毯子 */
export function ironBedBedding(): THREE.Group {
  return bedding(0.84, 1.86, 0.43, '#6f7552', '#d8d2c2', '#cfc6b0')
}

/** 客房一的木框矮床：胡桃色床架、高一点的床头板，深蓝被子、灰枕头 */
export function platformBed(): THREE.Group {
  const g = new THREE.Group()
  const wood = std('#5b3f2a', 0.7)
  const W = 1.0
  const L = 2.05
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.22, L), wood)
  frame.position.y = 0.2
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.62, 0.07), wood)
  head.position.set(0, 0.5, -L / 2 + 0.035)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, 0.04, 0.1), wood)
  cap.position.set(0, 0.83, -L / 2 + 0.035)
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.07), wood)
    leg.position.set(x * (W / 2), 0.05, z * (L / 2 - 0.05))
    g.add(leg)
  }
  g.add(frame, head, cap, bedding(W, L - 0.1, 0.31, '#2f4a6b', '#e8e4da', '#9aa3ad'))
  shadows(g)
  return g
}

/** 行军床：两根铁管、交叉的腿、绷着一块军绿帆布，叠好的毯子放在床头 */
export function campBed(): THREE.Group {
  const g = new THREE.Group()
  const canvas = std('#5d6b45', 0.95)
  const metal = new THREE.MeshStandardMaterial({ color: '#3b3d3a', roughness: 0.5, metalness: 0.6 })
  const W = 0.7
  const L = 1.9
  const top = 0.4
  const cloth = soft(W, 0.03, L, canvas, -0.6)
  cloth.position.y = top
  g.add(cloth)
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 8), metal)
    rail.rotation.x = Math.PI / 2
    rail.position.set(s * W / 2, top, 0)
    g.add(rail)
  }
  // 三组 X 形的腿
  for (const z of [-L / 2 + 0.12, 0, L / 2 - 0.12]) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, Math.hypot(W, top) , 6), metal)
      leg.position.set(0, top / 2, z)
      leg.rotation.z = s * Math.atan2(W, top)
      g.add(leg)
    }
  }
  const blanket = soft(0.5, 0.12, 0.34, std('#8c6a4a'), 0.5)
  blanket.position.set(0, top + 0.08, -L / 2 + 0.3)
  g.add(blanket)
  shadows(g)
  return g
}

/** 跑步机：黑色底座和跑带（跑带贴一张条纹图，有人在跑时往后滚）、两边扶手、前面的仪表盘。原点在跑带中间、地面上，面朝 -z（仪表盘在北边） */
export function treadmill(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.5, metalness: 0.3 })
  const metal = new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.35, metalness: 0.8 })
  const accent = new THREE.MeshStandardMaterial({ color: '#d9663a', roughness: 0.6 })
  // 跑带的条纹贴图
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null
  let beltMat: THREE.Material = new THREE.MeshStandardMaterial({ color: '#1a1b1d', roughness: 0.95 })
  if (c) {
    c.width = 16
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#18191b'
    ctx.fillRect(0, 0, 16, 64)
    ctx.fillStyle = '#2a2c30'
    for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 16, 3)
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 6)
    beltMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
    g.userData.belt = tex
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 1.7), body)
  base.position.y = 0.06
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 1.5), beltMat)
  belt.position.set(0, 0.12, 0.05)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.26), accent)
  hood.position.set(0, 0.1, -0.78)
  g.add(base, belt, hood)
  // 两根立柱、两根扶手、仪表盘
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 8), metal)
    post.position.set(s * 0.33, 0.68, -0.72)
    post.rotation.x = 0.12
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), metal)
    rail.rotation.x = Math.PI / 2
    rail.position.set(s * 0.33, 1.0, -0.5)
    g.add(post, rail)
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.08), body)
  panel.position.set(0, 1.25, -0.8)
  panel.rotation.x = -0.5
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ color: '#7fd1c1' }))
  screen.position.set(0, 1.27, -0.755)
  screen.rotation.x = -0.5
  g.add(panel, screen)
  shadows(g)
  return g
}
