// 厨房的卧式大冰柜和饮水机（Poly Haven 没有，用代码搭）。原点在底面中间，正面朝 +z。
import * as THREE from 'three'

const std = (color: THREE.ColorRepresentation, rough = 0.5, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })

function shadows<T extends THREE.Object3D>(g: T): T {
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}

/** 圆角的盒子（冰柜、饮水机的外壳） */
function rounded(w: number, h: number, d: number, r: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  shape.moveTo(x + r, y)
  shape.lineTo(x + w - r, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + r)
  shape.lineTo(x + w, y + d - r)
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  shape.lineTo(x + r, y + d)
  shape.quadraticCurveTo(x, y + d, x, y + d - r)
  shape.lineTo(x, y + r)
  shape.quadraticCurveTo(x, y, x + r, y)
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 4 })
  geo.rotateX(-Math.PI / 2)
  return new THREE.Mesh(geo, mat)
}

/** 卧式大冰柜：白色长方体、上面一块掀开的盖子（盖子绕后边的合页转，userData.lid）、正面一个把手和温度显示。
 * 长边沿 x（1.2 米），正面朝 +z */
export function freezer(): THREE.Group {
  const g = new THREE.Group()
  const L = 1.2
  const D = 0.62
  const H = 0.86
  const shell = std('#f0eee8', 0.35, 0.05)
  const body = rounded(L, H - 0.1, D, 0.04, shell)
  body.position.y = 0.04
  const base = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.05, D - 0.06), std('#3a3936', 0.6))
  base.position.y = 0.025
  g.add(body, base)
  // 盖子：合页在后边，掀开时往后转
  const lid = new THREE.Group()
  lid.position.set(0, H - 0.06, -D / 2)
  const top = rounded(L + 0.02, 0.06, D + 0.02, 0.04, std('#f7f6f2', 0.3, 0.05))
  top.position.set(0, 0, D / 2)
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.04), std('#b9bcc0', 0.3, 0.7))
  handle.position.set(0, 0.02, D + 0.02)
  lid.add(top, handle)
  g.add(lid)
  g.userData.lid = lid
  // 里面一层冰白色（掀开盖子看得见）、几袋冻货
  const inside = new THREE.Mesh(new THREE.BoxGeometry(L - 0.1, 0.02, D - 0.1), std('#dfeef5', 0.6))
  inside.position.y = H - 0.14
  g.add(inside)
  for (const [x, z, c] of [[-0.35, -0.08, '#c95f4a'], [-0.05, 0.1, '#e8d39a'], [0.3, -0.05, '#7fae6a']] as const) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.2), std(c, 0.8))
    bag.position.set(x, H - 0.1, z)
    g.add(bag)
  }
  // 正面右下的温度显示（亮一点蓝光）
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), new THREE.MeshBasicMaterial({ color: '#7fc4e8' }))
  screen.position.set(L / 2 - 0.14, 0.62, D / 2 + 0.003)
  g.add(screen)
  return shadows(g)
}

/** 饮水机：白色立式机身、顶上倒扣一桶蓝色的桶装水、一红一蓝两个水龙头、下面一个接水盘 */
export function waterDispenser(): THREE.Group {
  const g = new THREE.Group()
  const W = 0.32
  const H = 0.95
  const body = rounded(W, H, W, 0.03, std('#f2f1ee', 0.4))
  g.add(body)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.22, 0.01), std('#d8d6d0', 0.4))
  panel.position.set(0, 0.72, W / 2 + 0.005)
  const tray = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.025, 0.08), std('#6d6f72', 0.4, 0.4))
  tray.position.set(0, 0.42, W / 2 + 0.03)
  g.add(panel, tray)
  for (const [x, c] of [[-0.06, '#d9483b'], [0.06, '#3b7fd9']] as const) {
    const tap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.05), std(c, 0.4))
    tap.position.set(x, 0.66, W / 2 + 0.03)
    g.add(tap)
  }
  // 桶装水：倒扣着，半透明的蓝
  const water = new THREE.MeshStandardMaterial({ color: '#6fb6e6', roughness: 0.15, transparent: true, opacity: 0.72 })
  const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 18), water)
  jug.position.y = H + 0.22
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.05, 0.07, 18), water)
  shoulder.position.y = H + 0.02
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 18), water)
  cap.position.y = H + 0.4
  g.add(jug, shoulder, cap)
  return shadows(g)
}

/** 厨房柜子上的两个竹篮：一篮鸡蛋、一篮青菜，多少跟着家里的蛋和菜变（看得见鸡下的蛋被用掉） */
export class KitchenBaskets {
  readonly group = new THREE.Group()
  private readonly eggs: THREE.Mesh[] = []
  private readonly greens: THREE.Mesh[] = []
  private shown = ''

  constructor() {
    const wicker = std('#b58a52', 0.85)
    const eggMat = std('#f3e6cf', 0.6)
    const leaf = std('#5f9e3c', 0.8)
    const basket = (x: number) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.09, 14, 1, true), wicker)
      b.material.side = THREE.DoubleSide
      b.position.set(x, 0.045, 0)
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), wicker)
      bottom.rotation.x = -Math.PI / 2
      bottom.position.set(x, 0.005, 0)
      this.group.add(b, bottom)
    }
    basket(-0.17)
    basket(0.17)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const r = k < 6 ? 0.07 : 0.02
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eggMat)
      egg.scale.set(1, 1.3, 1)
      egg.position.set(-0.17 + Math.cos(a) * r, 0.04 + (k >= 6 ? 0.04 : 0), Math.sin(a) * r)
      egg.castShadow = true
      this.eggs.push(egg)
      this.group.add(egg)
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 5), leaf)
      g.scale.set(1, 0.7, 1.5)
      g.position.set(0.17 + Math.cos(a) * 0.05, 0.07, Math.sin(a) * 0.05)
      g.rotation.y = a
      g.castShadow = true
      this.greens.push(g)
      this.group.add(g)
    }
  }

  /** egg / veg：家里有几份蛋、几份菜 */
  sync(egg: number, veg: number): void {
    const ne = Math.min(this.eggs.length, Math.round(egg * 4))
    const nv = Math.min(this.greens.length, Math.round(veg * 2))
    const key = `${ne}|${nv}`
    if (key === this.shown) return
    this.shown = key
    this.eggs.forEach((e, k) => { e.visible = k < ne })
    this.greens.forEach((g, k) => { g.visible = k < nv })
  }
}
