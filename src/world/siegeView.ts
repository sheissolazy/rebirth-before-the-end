// 丧尸夜的画面：丧尸模型、枪口火光、弹道、血花、晶核、铁门倒下、防线血条、镜头震动。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import type { Pt } from './nav'
import { LAYERS, Zombie, type LayerId, type SiegeEvent } from './siege'
import type { Household } from './residents'

interface Fx { obj: THREE.Object3D; t: number; life: number; update: (k: number, dt: number) => void }

/** 头顶的小血条（画在 canvas 上的精灵） */
class Bar {
  readonly sprite: THREE.Sprite
  private readonly ctx: CanvasRenderingContext2D
  private readonly tex: THREE.CanvasTexture
  private last = -1

  constructor(at: THREE.Vector3) {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 20
    this.ctx = c.getContext('2d')!
    this.tex = new THREE.CanvasTexture(c)
    this.tex.colorSpace = THREE.SRGBColorSpace
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }))
    this.sprite.scale.set(1.4, 0.22, 1)
    this.sprite.position.copy(at)
    this.sprite.renderOrder = 10
  }

  set(ratio: number): void {
    const r = Math.round(ratio * 100) / 100
    if (r === this.last) return
    this.last = r
    const g = this.ctx
    g.clearRect(0, 0, 128, 20)
    g.fillStyle = 'rgba(20,20,20,0.75)'
    g.fillRect(0, 0, 128, 20)
    g.fillStyle = r > 0.5 ? '#5bd16a' : r > 0.25 ? '#f2b84b' : '#e5533d'
    g.fillRect(3, 3, Math.max(0, 122 * r), 14)
    this.tex.needsUpdate = true
  }
}

const BAR_AT: Record<LayerId, THREE.Vector3> = {
  gate: new THREE.Vector3(4, 2.7, 13),
  door: new THREE.Vector3(3.5, 2.9, 6.05),
  stairs: new THREE.Vector3(4.6, 1.7, 4.5),
}

export class SiegeView {
  private readonly scene: THREE.Scene
  private templates: THREE.Object3D[] = []
  private readonly flash = new THREE.PointLight('#ffd58a', 0, 8, 2)
  private flashT = 0
  private readonly fx: Fx[] = []
  private readonly bars = new Map<LayerId, Bar>()
  private readonly gates: { obj: THREE.Object3D; rot: THREE.Euler; y: number }[] = []
  private door: THREE.Object3D | null = null
  private barricade: THREE.Object3D | null = null
  private doorOpen = 0
  private gateDown = false
  private spawned = 0
  shake = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.add(this.flash)
    for (const l of LAYERS) {
      const b = new Bar(BAR_AT[l.id])
      b.sprite.visible = false
      this.bars.set(l.id, b)
      this.scene.add(b.sprite)
    }
  }

  /** 真人画风：加载两个 MakeHuman 丧尸，皮肤调灰绿、衣服弄脏、加血迹 */
  async loadModels(): Promise<void> {
    const loader = new GLTFLoader()
    const gl = await Promise.all(['zombie_m', 'zombie_f'].map((n) => loader.loadAsync(`${import.meta.env.BASE_URL}models/people/${n}.glb`)))
    this.templates = gl.map((g) => {
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.castShadow = true
        m.frustumCulled = false
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const std = mat as THREE.MeshStandardMaterial
          const n = std.name
          if (/eyebrow|eyelash|short|long|hair/.test(n)) { std.alphaTest = 0.5; std.transparent = false; std.side = THREE.DoubleSide; continue }
          std.transparent = false
          if (n.endsWith('.body')) std.color.set('#9aab8c')
          else if (n.endsWith('low-poly')) std.color.set('#e8e2b8')
          else { std.color.set('#8a7f6f'); bloody(std) }
          if (n.endsWith('.body')) bloody(std, 0.5)
        }
      })
      return g.scene
    })
  }

  /** 加载完先把丧尸和特效的着色器编译好，第一只丧尸出现时就不会卡一下。
   *  要真的渲染一帧（藏在地面下面），因为江面的透射和阴影各自还要再编一套着色器。 */
  prewarm(render: () => void): void {
    const zs = this.templates.map((_, k) => this.spawn({ x: 3 + k, z: 9 }))
    for (const z of zs) {
      z.root.position.y = -1.9
      z.animate(0.016, true)
    }
    this.blood({ x: 4, z: 9 })
    this.core({ x: 4, z: 9 })
    for (const f of this.fx) f.obj.position.y -= 3
    for (const b of this.bars.values()) b.sprite.visible = true
    render()
    for (const z of zs) z.root.removeFromParent()
    for (const b of this.bars.values()) b.sprite.visible = false
    this.spawned = 0
  }

  /** 生成一只丧尸放进场景 */
  spawn(at: Pt): Zombie {
    const t = this.templates[this.spawned++ % Math.max(1, this.templates.length)]
    const z = new Zombie(at, t ? cloneSkinned(t) : undefined)
    z.root.scale.setScalar(0.94 + ((this.spawned * 13) % 10) / 80)
    this.scene.add(z.root)
    return z
  }

  /** 记下铁门、大门、楼梯口的箱子（World 搭好别墅后调用） */
  bind(gates: THREE.Object3D[], door: THREE.Object3D | null, barricade: THREE.Object3D | null): void {
    this.gates.length = 0
    for (const g of gates) this.gates.push({ obj: g, rot: g.rotation.clone(), y: g.position.y })
    this.door = door
    this.barricade = barricade
  }

  onEvent(e: SiegeEvent): void {
    if (e.kind === 'shot') {
      const from = e.from.root.position.clone().add(new THREE.Vector3(0, 1.25, 0))
      const dir = new THREE.Vector3(e.at.x - from.x, 0, e.at.z - from.z).normalize()
      from.addScaledVector(dir, 0.6)
      this.flash.position.copy(from)
      this.flashT = 0.08
      // 三道弹道，散开一点
      for (let k = -1; k <= 1; k++) {
        const to = new THREE.Vector3(e.at.x + dir.z * k * 0.35, 1.1 + k * 0.08, e.at.z - dir.x * k * 0.35)
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]),
          new THREE.LineBasicMaterial({ color: '#fff2b0', transparent: true }))
        this.add(line, 0.09, (k1) => { (line.material as THREE.LineBasicMaterial).opacity = 1 - k1 })
      }
    } else if (e.kind === 'hit') this.blood(e.at)
    else if (e.kind === 'kill') this.core(e.at)
    else if (e.kind === 'broken') this.shake = 0.5
  }

  private add(obj: THREE.Object3D, life: number, update: Fx['update']): void {
    this.scene.add(obj)
    this.fx.push({ obj, t: 0, life, update })
  }

  private blood(at: Pt): void {
    const n = 14
    const pos = new Float32Array(n * 3)
    const vel: THREE.Vector3[] = []
    for (let k = 0; k < n; k++) {
      pos.set([at.x, 1.1, at.z], k * 3)
      vel.push(new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.5) * 2.4))
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ color: '#8f1d1d', size: 0.09, transparent: true })
    const pts = new THREE.Points(geo, mat)
    this.add(pts, 0.5, (k, dt) => {
      const p = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < n; i++) {
        vel[i].y -= 9 * dt
        p.setXYZ(i, p.getX(i) + vel[i].x * dt, Math.max(0.02, p.getY(i) + vel[i].y * dt), p.getZ(i) + vel[i].z * dt)
      }
      p.needsUpdate = true
      mat.opacity = 1 - k
    })
  }

  /** 打死丧尸掉一颗晶核：发着光往上飘，然后飞走 */
  private core(at: Pt): void {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), new THREE.MeshBasicMaterial({ color: '#7ff3ff', transparent: true }))
    m.position.set(at.x, 0.6, at.z)
    this.add(m, 1.6, (k) => {
      m.position.y = 0.6 + k * 1.6
      m.rotation.y += 0.15
      ;(m.material as THREE.MeshBasicMaterial).opacity = 1 - k * k
    })
  }

  /** 每帧：特效、血条、铁门/大门/箱子的样子 */
  update(dt: number, life: Household, actors: { root: THREE.Object3D }[]): void {
    this.flashT -= dt
    this.flash.intensity = this.flashT > 0 ? 9 : 0
    this.shake = Math.max(0, this.shake - dt)
    for (let k = this.fx.length - 1; k >= 0; k--) {
      const f = this.fx[k]
      f.t += dt
      f.update(Math.min(1, f.t / f.life), dt)
      if (f.t >= f.life) {
        f.obj.removeFromParent()
        f.obj.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.geometry) m.geometry.dispose()
        })
        this.fx.splice(k, 1)
      }
    }
    const s = life.siege
    const fighting = !!s && !s.done
    for (const l of LAYERS) {
      const b = this.bars.get(l.id)!
      const hp = life.barriers[l.id]
      b.sprite.visible = fighting && hp > 0 && s?.current?.id === l.id
      b.set(hp / life.maxOf(l.id))
    }
    // 铁门：耐久归零就倒进院子里，修好一半以上才立起来
    if (life.barriers.gate <= 0) this.gateDown = true
    else if (life.barriers.gate >= life.maxOf('gate') * 0.4) this.gateDown = false
    for (const g of this.gates) {
      const gateDown = this.gateDown
      const want = gateDown ? g.rot.x - 1.45 : g.rot.x
      g.obj.rotation.x += (want - g.obj.rotation.x) * Math.min(1, dt * 6)
      g.obj.position.y = g.y + (gateDown ? 0.05 : 0)
    }
    if (this.door) {
      // 有人走近就开门；打仗时关着；被砸开就倒下
      const near = actors.some((a) => Math.hypot(a.root.position.x - 3.5, a.root.position.z - 6) < 1.3 && a.root.position.y < 1)
      const broken = life.barriers.door <= 0
      this.doorOpen += ((near && !fighting ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 8)
      const leaf = this.door.children[0]
      if (leaf) {
        leaf.rotation.y = -this.doorOpen * 1.5
        leaf.rotation.x += ((broken ? -1.45 : 0) - leaf.rotation.x) * Math.min(1, dt * 6)
      }
    }
    if (this.barricade) this.barricade.visible = fighting && (s?.layer ?? 0) >= 2 && life.barriers.stairs > 0
  }
}

/** 衣服和皮肤上加一些深红的血迹和泥点（按 UV 算的斑块） */
function bloody(mat: THREE.MeshStandardMaterial, amount = 1): void {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBlood = { value: amount }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uBlood;
float zh(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
float zn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(zh(i), zh(i+vec2(1,0)), f.x), mix(zh(i+vec2(0,1)), zh(i+vec2(1,1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
  float bn = zn(vMapUv * 9.0) * 0.65 + zn(vMapUv * 23.0) * 0.35;
  float blood = smoothstep(0.68, 0.78, bn) * uBlood;
  float dirt = smoothstep(0.45, 0.7, zn(vMapUv * 5.0 + 3.1)) * 0.35;
  diffuseColor.rgb = mix(diffuseColor.rgb * (1.0 - dirt), vec3(0.32, 0.03, 0.03), blood);
#endif`)
  }
  mat.customProgramCacheKey = () => `bloody${amount}`
}
