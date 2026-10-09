// 2.5D 原型的 3D 世界：小别墅 + 门前一条街。
// 家里（院子围栏以内）用固定 45° 视角；出了铁门换成高角度跟拍。两种镜头同一个朝向，
// 切换时用 0.9 秒平滑过渡，同时屋顶淡出、靠近镜头的墙压低。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  FLOOR_H, FURNITURE, GATE, HOUSE, HOUSE_CENTER, PROPS, STREET, WALLS, WORLD, YARD,
  fenceSegments, isHome, type Floor, type Placement,
} from './layout'
import { buildNav, type NavGrid, type Pt } from './nav'
import {
  ParadiseMaterials, Petals, River, flowers, grassField, hills, leafyTree, loadParadiseKit, sakuraTree, type ArtStyle, type ParadiseKit,
} from './paradise'
import {
  COLORS, barrel, box, car, counter, desk, fridge, neighborHouse, person, shelf, sofa, stairs,
  toon, toonify, tree, villaRoof, wallMap,
} from './meshes'

export type ViewMode = 'home' | 'outside'
export interface Hud {
  loading: boolean
  mode: ViewMode
  floor: Floor
  selected: string
  error?: string
}

interface Pose { target: THREE.Vector3; elev: number; dist: number; fov: number }

const YAW = Math.PI / 4
const HOME_VIEW = { elev: THREE.MathUtils.degToRad(40), dist: 30, fov: 24 }
const OUT_VIEW = { elev: THREE.MathUtils.degToRad(52), dist: 15, fov: 38 }
const TWEEN_S = 0.9
const STUB = 0.12
const SKY = '#bfe3f2'

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

class Actor {
  readonly name: string
  readonly root: THREE.Group
  path: Pt[] = []
  private walkT = 0

  constructor(name: string, shirt: string, hair: string, height: number, at: Pt) {
    this.name = name
    this.root = person(shirt, hair, height)
    this.root.position.set(at.x, 0, at.z)
    this.root.userData.actor = this
  }

  get pos(): Pt {
    return { x: this.root.position.x, z: this.root.position.z }
  }

  /** 沿路点走；返回这一帧是否在走 */
  follow(dt: number, speed: number): boolean {
    const next = this.path[0]
    if (!next) return false
    const dx = next.x - this.root.position.x
    const dz = next.z - this.root.position.z
    const d = Math.hypot(dx, dz)
    const step = speed * dt
    if (d <= step) {
      this.root.position.x = next.x
      this.root.position.z = next.z
      this.path.shift()
    } else {
      this.root.position.x += (dx / d) * step
      this.root.position.z += (dz / d) * step
    }
    if (d > 1e-3) this.face(dx, dz, dt)
    return true
  }

  face(dx: number, dz: number, dt: number): void {
    const want = Math.atan2(dx, dz)
    let diff = want - this.root.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.root.rotation.y += diff * Math.min(1, dt * 12)
  }

  animate(dt: number, walking: boolean): void {
    const body = this.root.userData.body as THREE.Object3D
    this.walkT = walking ? this.walkT + dt * 11 : 0
    body.position.y = 0.55 + (walking ? Math.abs(Math.sin(this.walkT)) * 0.05 : 0)
    body.rotation.z = walking ? Math.sin(this.walkT) * 0.06 : 0
  }
}

export class World {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200)
  private readonly sun = new THREE.DirectionalLight('#fff1d6', 2.4)
  private readonly clock = new THREE.Clock()
  private readonly raycaster = new THREE.Raycaster()
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly nav: NavGrid = buildNav()
  private readonly actors: Actor[] = []
  private heroine!: Actor
  private selected!: Actor
  private readonly nearWalls: THREE.Object3D[] = []
  private readonly floor2 = new THREE.Group()
  private roof: THREE.Group | null = null
  private roofMats: THREE.Material[] = []
  private readonly marker: THREE.Mesh
  private readonly ring: THREE.Mesh
  private mode: ViewMode = 'home'
  private viewFloor: Floor = 0
  private tweenT = TWEEN_S
  private tweenFrom: Pose | null = null
  private homeness = 1
  private zoom = { home: 1, outside: 1 }
  private readonly pan = new THREE.Vector3()
  private readonly pose: Pose = { target: new THREE.Vector3(HOUSE_CENTER.x, 0.8, HOUSE_CENTER.z), ...HOME_VIEW }
  private readonly keys = new Set<string>()
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private press: { x: number; y: number; t: number; moved: boolean } | null = null
  private pinchDist = 0
  private followTimer = 0
  private raf = 0
  private disposed = false
  private hud: Hud = { loading: true, mode: 'home', floor: 0, selected: '林知夏' }
  private readonly resize: ResizeObserver
  private readonly listeners: [EventTarget, string, EventListener][] = []
  private readonly host: HTMLElement
  private readonly onHud: (h: Hud) => void
  private keysMoving = false
  private readonly style: ArtStyle
  private readonly hemi = new THREE.HemisphereLight('#dcefff', '#b59b78', 1.5)
  private petals: Petals | null = null
  private river: River | null = null
  private elapsed = 0

  constructor(host: HTMLElement, onHud: (h: Hud) => void, style: ArtStyle = 'toon') {
    this.host = host
    this.onHud = onHud
    this.style = style
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.touchAction = 'none'

    this.scene.background = new THREE.Color(SKY)
    this.scene.fog = new THREE.Fog(SKY, 55, 110)
    this.scene.add(this.hemi)
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048)
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 })
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    this.scene.add(this.sun, this.sun.target)

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.28, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }))
    this.marker.rotation.x = -Math.PI / 2
    this.marker.visible = false
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), new THREE.MeshBasicMaterial({ color: '#ffd166' }))
    this.ring.rotation.x = -Math.PI / 2
    this.scene.add(this.marker, this.ring)

    this.buildGround()
    this.buildStreet()
    this.spawnActors()

    this.resize = new ResizeObserver(() => this.fit())
    this.resize.observe(host)
    this.fit()
    this.bindInput()
    this.loadVilla()
    this.loop()
    // 调试用：网址带 ?debug 时可以在控制台里看场景
    if (location.search.includes('debug')) (window as unknown as { __world: World }).__world = this
  }

  // --- 场景 -------------------------------------------------------------------

  private buildGround(): void {
    const w = WORLD.x1 - WORLD.x0 + 80
    const d = WORLD.z1 - WORLD.z0 + 80
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(COLORS.grassDark))
    ground.rotation.x = -Math.PI / 2
    ground.position.set((WORLD.x0 + WORLD.x1) / 2, -0.02, (WORLD.z0 + WORLD.z1) / 2)
    ground.receiveShadow = true
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(YARD.x1 - YARD.x0, YARD.z1 - YARD.z0), toon(COLORS.grass))
    yard.rotation.x = -Math.PI / 2
    yard.position.set((YARD.x0 + YARD.x1) / 2, -0.01, (YARD.z0 + YARD.z1) / 2)
    yard.receiveShadow = true
    this.scene.add(ground, yard)
    // 大门到铁门的石板路
    for (let z = HOUSE.z1 + 0.6; z < GATE.z - 0.3; z += 0.85) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 8), toon(COLORS.stone))
      s.position.set(GATE.x + (Math.round(z * 3) % 2 ? 0.12 : -0.12), 0, z)
      s.receiveShadow = true
      this.scene.add(s)
    }
  }

  private buildStreet(): void {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(STREET.x1 - STREET.x0 + 40, STREET.z1 - STREET.z0), toon(COLORS.road))
    road.rotation.x = -Math.PI / 2
    road.position.set((STREET.x0 + STREET.x1) / 2, 0.005, (STREET.z0 + STREET.z1) / 2)
    road.receiveShadow = true
    this.scene.add(road)
    for (const z of [STREET.z0 - 0.6, STREET.z1 + 0.6]) {
      const walk = box(STREET.x1 - STREET.x0 + 40, 0.08, 1.2, COLORS.sidewalk, [(STREET.x0 + STREET.x1) / 2, 0, z])
      this.scene.add(walk)
    }
    for (let x = STREET.x0 - 18; x < STREET.x1 + 18; x += 4) {
      this.scene.add(box(2, 0.02, 0.18, '#e8e2cf', [x, 0.006, (STREET.z0 + STREET.z1) / 2]))
    }
    for (const p of PROPS) {
      const obj = p.kind === 'house' ? neighborHouse(p) : p.kind === 'tree' ? tree() : p.kind === 'car' ? car(p.color ?? '#888') : barrel()
      obj.position.set(p.x, 0, p.z)
      obj.rotation.y = THREE.MathUtils.degToRad(p.rot)
      if (p.kind === 'tree') obj.userData.tree = true
      this.scene.add(obj)
    }
  }

  private async loadVilla(): Promise<void> {
    try {
      const [gltf, paradise] = await Promise.all([
        new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/villa_kit.glb`),
        this.style === 'paradise' ? loadParadiseKit(this.renderer) : Promise.resolve(null),
      ])
      if (this.disposed) return
      const kit = new Map<string, THREE.Object3D>()
      for (const child of gltf.scene.children) {
        toonify(child)
        kit.set(child.name, child)
      }
      this.assembleVilla(kit)
      if (paradise) this.applyParadise(paradise)
      this.setHud({ loading: false })
    } catch (e) {
      this.setHud({ loading: false, error: `模型加载失败：${String(e)}` })
    }
  }

  private assembleVilla(kit: Map<string, THREE.Object3D>): void {
    const place = (name: string, x: number, y: number, z: number, rotDeg: number): THREE.Object3D => {
      const src = kit.get(name)
      if (!src) throw new Error(`缺少组件 ${name}`)
      const obj = src.clone()
      obj.position.set(x, y, z)
      obj.rotation.set(0, THREE.MathUtils.degToRad(rotDeg), 0)
      return obj
    }
    const floorGroup = (f: Floor) => (f === 0 ? this.scene : this.floor2)
    // 地板
    for (let i = HOUSE.x0; i < HOUSE.x1; i++)
      for (let j = HOUSE.z0; j < HOUSE.z1; j++) {
        this.scene.add(place('floor_1x1', i + 0.5, 0, j + 0.5, 0))
        this.floor2.add(place('floor_1x1', i + 0.5, FLOOR_H, j + 0.5, 0))
      }
    const w = HOUSE.x1 - HOUSE.x0
    const d = HOUSE.z1 - HOUSE.z0
    this.floor2.add(box(w, 0.2, d, COLORS.wall, [HOUSE.x0 + w / 2, FLOOR_H - 0.3, HOUSE.z0 + d / 2]))
    // 墙
    const piece = { wall: 'wall_1m', window: 'wall_window_1m', door: 'wall_door_1m' } as const
    for (const s of WALLS) {
      const obj = place(piece[s.kind], s.x, s.floor * FLOOR_H, s.z, s.axis === 'z' ? 90 : 0)
      if (s.near) this.nearWalls.push(obj)
      floorGroup(s.floor).add(obj)
    }
    // 家具
    for (const p of FURNITURE) floorGroup(p.floor).add(this.furniture(p, kit, place))
    // 围栏和铁门
    for (const s of fenceSegments()) this.scene.add(place(s.gate ? 'gate_1m' : 'fence_1m', s.x, 0, s.z, s.axis === 'z' ? 90 : 0))
    // 屋顶
    const { root, mats } = villaRoof(w, d, FLOOR_H * 2 - 0.2)
    root.position.set(HOUSE.x0 + w / 2, 0, HOUSE.z0 + d / 2)
    this.roof = root
    this.roofMats = mats
    this.scene.add(this.floor2, root)
  }

  private furniture(p: Placement, kit: Map<string, THREE.Object3D>,
    place: (n: string, x: number, y: number, z: number, r: number) => THREE.Object3D): THREE.Object3D {
    const y = p.floor * FLOOR_H
    if (kit.has(p.piece)) return place(p.piece, p.x, y, p.z, p.rot)
    const made: Record<string, () => THREE.Object3D> = {
      sofa, counter, fridge, desk, shelf, wall_map: wallMap, stairs: () => stairs(FLOOR_H),
    }
    const obj = made[p.piece]?.() ?? box(0.5, 0.5, 0.5, '#ff00ff')
    obj.position.set(p.x, y, p.z)
    obj.rotation.y = p.piece === 'wall_map' ? 0 : THREE.MathUtils.degToRad(p.rot)
    return obj
  }

  /** 世外桃源画风：换成 Poly Haven 材质，开天空光照和雾，再种草、种樱花、加远山和江 */
  private applyParadise(kit: ParadiseKit): void {
    const mats = new ParadiseMaterials(kit)
    if (this.roof) mats.apply(this.roof, true)
    mats.apply(this.scene, false, this.roof ?? undefined)
    if (this.roof) {
      const own = new Set<THREE.Material>()
      this.roof.traverse((o) => {
        const m = (o as THREE.Mesh).material
        if (m) for (const x of Array.isArray(m) ? m : [m]) own.add(x)
      })
      this.roofMats = [...own]
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.scene.environment = kit.env
    this.scene.environmentIntensity = 0.75
    this.scene.background = new THREE.Color('#cfe1e8')
    this.scene.fog = new THREE.FogExp2('#dfe6dd', 0.013)
    this.hemi.intensity = 0.55
    this.sun.color.set('#ffe2b8')
    this.sun.intensity = 2.8
    const coarse = window.matchMedia('(pointer: coarse)').matches
    this.scene.add(grassField(coarse ? 3000 : 6000), flowers(coarse ? 220 : 420))
    // 卡通树换成真树皮的绿树
    const treeBark = mats.textured('bark') ?? new THREE.MeshStandardMaterial({ color: '#5a3d29' })
    const oldTrees: THREE.Object3D[] = []
    this.scene.traverse((o) => { if (o.userData.tree) oldTrees.push(o) })
    oldTrees.forEach((o, k) => {
      const t = leafyTree(treeBark, 20 + k, 0.9 + (k % 3) * 0.15)
      t.position.copy(o.position)
      o.parent?.add(t)
      o.removeFromParent()
    })
    // 樱花种在屋后和两侧，不挡家里视角
    const bark = mats.textured('sakuraBark') ?? treeBark
    const trees: [number, number, number, number][] = [[-2.5, -1.6, 1, 1.05], [6, -2, 2, 0.95], [-2.8, 9.8, 3, 1.1], [-9, 12.5, 4, 1.15], [17, -5, 5, 1.05], [-15, -3, 6, 1]]
    for (const [x, z, seed, sc] of trees) {
      const t = sakuraTree(bark, seed, sc)
      t.position.set(x, 0, z)
      this.scene.add(t)
    }
    this.petals = new Petals(new THREE.Vector3(-2.8, 0, 9.8), 3.5)
    this.scene.add(this.petals.points)
    const hillMat = mats.textured('grassDark') ?? new THREE.MeshStandardMaterial({ color: '#6f9a55' })
    this.scene.add(hills(hillMat))
    this.river = new River()
    this.scene.add(this.river.mesh)
  }

  private spawnActors(): void {
    this.heroine = new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 })
    const mom = new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 })
    const dad = new Actor('爸爸', '#4a78b5', '#262626', 1.05, { x: 3.8, z: 2.0 })
    this.actors.push(this.heroine, mom, dad)
    for (const a of this.actors) this.scene.add(a.root)
    this.selected = this.heroine
  }

  // --- 镜头 -------------------------------------------------------------------

  private desiredPose(mode: ViewMode): Pose {
    const h = this.heroine.root.position
    if (mode === 'outside') {
      return { target: new THREE.Vector3(h.x, 0.8, h.z), elev: OUT_VIEW.elev, dist: OUT_VIEW.dist * this.zoom.outside, fov: OUT_VIEW.fov }
    }
    const baseY = this.viewFloor === 1 ? FLOOR_H + 0.8 : 0.8
    const t = new THREE.Vector3(HOUSE_CENTER.x, baseY, HOUSE_CENTER.z)
    t.x += (h.x - HOUSE_CENTER.x) * 0.35
    t.z += (h.z - HOUSE_CENTER.z) * 0.35
    t.add(this.pan)
    return { target: t, elev: HOME_VIEW.elev, dist: HOME_VIEW.dist * this.zoom.home, fov: HOME_VIEW.fov }
  }

  private updateCamera(dt: number): void {
    const want = this.desiredPose(this.mode)
    if (this.tweenT < TWEEN_S && this.tweenFrom) {
      this.tweenT += dt
      const k = ease(Math.min(1, this.tweenT / TWEEN_S))
      this.pose.target.lerpVectors(this.tweenFrom.target, want.target, k)
      this.pose.elev = THREE.MathUtils.lerp(this.tweenFrom.elev, want.elev, k)
      this.pose.dist = THREE.MathUtils.lerp(this.tweenFrom.dist, want.dist, k)
      this.pose.fov = THREE.MathUtils.lerp(this.tweenFrom.fov, want.fov, k)
      this.homeness = this.mode === 'home' ? k : 1 - k
    } else {
      const a = 1 - Math.exp(-dt * 6)
      this.pose.target.lerp(want.target, a)
      this.pose.elev += (want.elev - this.pose.elev) * a
      this.pose.dist += (want.dist - this.pose.dist) * a
      this.pose.fov += (want.fov - this.pose.fov) * a
      this.homeness = this.mode === 'home' ? 1 : 0
    }
    const { target, elev, dist, fov } = this.pose
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
    this.camera.position.set(
      target.x + Math.sin(YAW) * Math.cos(elev) * dist,
      target.y + Math.sin(elev) * dist,
      target.z + Math.cos(YAW) * Math.cos(elev) * dist,
    )
    this.camera.lookAt(target)
    this.sun.position.set(target.x + 9, target.y + 20, target.z + 5)
    this.sun.target.position.copy(target)
  }

  /** 屋顶淡出、近墙压低、二楼显隐，都跟着镜头过渡走 */
  private updateCutaway(): void {
    const h = this.homeness
    if (this.roof) {
      this.roof.visible = h < 0.98
      for (const m of this.roofMats) {
        m.transparent = h > 0.02
        m.opacity = 1 - h
        m.depthWrite = h < 0.5
      }
    }
    const stub = THREE.MathUtils.lerp(1, STUB, h)
    for (const w of this.nearWalls) w.scale.y = stub
    this.floor2.visible = this.viewFloor === 1 || h < 0.5
  }

  private setMode(mode: ViewMode): void {
    if (mode === this.mode) return
    this.tweenFrom = { target: this.pose.target.clone(), elev: this.pose.elev, dist: this.pose.dist, fov: this.pose.fov }
    this.tweenT = 0
    this.mode = mode
    if (mode === 'outside') {
      this.selected = this.heroine
      this.viewFloor = 0
      this.pan.set(0, 0, 0)
    } else {
      // 回到家里时，跟在后面的人也一起进门
      const h = this.heroine.pos
      this.actors.filter((a) => a !== this.heroine && !isHome(a.pos.x, a.pos.z, false)).forEach((a, k) => {
        a.path = this.nav.findPath(a.pos, { x: h.x + (k ? -1 : 1), z: h.z - 1.2 }) ?? a.path
      })
    }
    this.setHud({ mode, selected: this.selected.name, floor: this.viewFloor })
  }

  setViewFloor(f: Floor): void {
    if (this.mode !== 'home' || f === this.viewFloor) return
    this.tweenFrom = { target: this.pose.target.clone(), elev: this.pose.elev, dist: this.pose.dist, fov: this.pose.fov }
    this.tweenT = TWEEN_S * 0.4
    this.viewFloor = f
    this.setHud({ floor: f })
  }

  // --- 每帧 -------------------------------------------------------------------

  private loop = (): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += dt
    this.petals?.update(dt, this.elapsed)
    this.river?.update(this.elapsed)
    this.updateHeroineKeys(dt)
    this.updateFollowers(dt)
    for (const a of this.actors) {
      const walking = a.follow(dt, a === this.heroine ? 3.4 : 3.2) || (a === this.heroine && this.keysMoving)
      a.animate(dt, walking)
    }
    this.setMode(isHome(this.heroine.pos.x, this.heroine.pos.z, this.mode === 'home') ? 'home' : 'outside')
    this.updateCamera(dt)
    this.updateCutaway()
    this.ring.position.set(this.selected.root.position.x, 0.03, this.selected.root.position.z)
    this.ring.visible = this.mode === 'home' && this.viewFloor === 0
    if (this.marker.visible) {
      const m = this.marker.material as THREE.MeshBasicMaterial
      m.opacity -= dt * 1.5
      this.marker.scale.multiplyScalar(1 + dt)
      if (m.opacity <= 0) this.marker.visible = false
    }
    this.renderer.render(this.scene, this.camera)
  }

  private updateHeroineKeys(dt: number): void {
    let fx = 0
    let fz = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) fz -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) fz += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) fx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) fx += 1
    this.keysMoving = fx !== 0 || fz !== 0
    if (!this.keysMoving) return
    // 屏幕上的"上"是远离镜头的方向
    const fwd = new THREE.Vector2(-Math.sin(YAW), -Math.cos(YAW))
    const right = new THREE.Vector2(Math.cos(YAW), -Math.sin(YAW))
    const dir = fwd.multiplyScalar(-fz).add(right.multiplyScalar(fx)).normalize()
    const step = 3.4 * dt
    const a = this.heroine
    a.path = []
    const p = a.root.position
    const free = (x: number, z: number) =>
      [[0.18, 0], [-0.18, 0], [0, 0.18], [0, -0.18]].every(([ox, oz]) => !this.nav.isBlockedAt(x + ox, z + oz))
    const nx = p.x + dir.x * step
    const nz = p.z + dir.y * step
    if (free(nx, nz)) { p.x = nx; p.z = nz } else if (free(nx, p.z)) p.x = nx
    else if (free(p.x, nz)) p.z = nz
    a.face(dir.x, dir.y, dt)
    if (this.mode === 'home') this.selected = a
  }

  private updateFollowers(dt: number): void {
    this.followTimer -= dt
    if (this.mode !== 'outside' || this.followTimer > 0) return
    this.followTimer = 0.4
    const h = this.heroine.root
    const back = new THREE.Vector2(-Math.sin(h.rotation.y), -Math.cos(h.rotation.y))
    this.actors.filter((a) => a !== this.heroine).forEach((a, k) => {
      const side = k === 0 ? 1 : -1
      const spot = { x: h.position.x + back.x * 1.3 + back.y * side * 0.8, z: h.position.z + back.y * 1.3 - back.x * side * 0.8 }
      const d = Math.hypot(a.pos.x - h.position.x, a.pos.z - h.position.z)
      if (d > 2.2) a.path = this.nav.findPath(a.pos, spot) ?? a.path
    })
  }

  // --- 输入 -------------------------------------------------------------------

  private on(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn)
    this.listeners.push([target, type, fn])
  }

  private bindInput(): void {
    const el = this.renderer.domElement
    this.on(el, 'pointerdown', ((e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
      if (this.pointers.size === 2) { this.pinchDist = this.pointerSpread(); this.press = null }
    }) as EventListener)
    this.on(el, 'pointermove', ((e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId)
      if (!prev) return
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pointers.size === 2) {
        const spread = this.pointerSpread()
        if (this.pinchDist > 0) this.zoomBy(this.pinchDist / spread)
        this.pinchDist = spread
        return
      }
      if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 8) this.press.moved = true
      if (this.press?.moved && this.mode === 'home') this.panBy(e.clientX - prev.x, e.clientY - prev.y)
    }) as EventListener)
    const up = ((e: PointerEvent) => {
      this.pointers.delete(e.pointerId)
      if (this.press && !this.press.moved && performance.now() - this.press.t < 400) this.tap(e.clientX, e.clientY)
      if (this.pointers.size === 0) this.press = null
    }) as EventListener
    this.on(el, 'pointerup', up)
    this.on(el, 'pointercancel', ((e: PointerEvent) => { this.pointers.delete(e.pointerId); this.press = null }) as EventListener)
    this.on(el, 'wheel', ((e: WheelEvent) => { e.preventDefault(); this.zoomBy(1 + e.deltaY * 0.0012) }) as EventListener)
    this.on(window, 'keydown', ((e: KeyboardEvent) => { this.keys.add(e.key.toLowerCase()) }) as EventListener)
    this.on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()) }) as EventListener)
    this.on(window, 'blur', (() => this.keys.clear()) as EventListener)
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y) || 1
  }

  private zoomBy(f: number): void {
    const z = this.zoom[this.mode] * f
    this.zoom[this.mode] = THREE.MathUtils.clamp(z, this.mode === 'home' ? 0.55 : 0.6, this.mode === 'home' ? 1.5 : 1.8)
  }

  private panBy(dx: number, dy: number): void {
    const scale = (this.pose.dist * Math.tan(THREE.MathUtils.degToRad(this.pose.fov / 2)) * 2) / this.host.clientHeight
    const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW))
    const fwd = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW))
    this.pan.addScaledVector(right, -dx * scale).addScaledVector(fwd, (dy * scale) / Math.sin(this.pose.elev))
    this.pan.clampLength(0, 10)
  }

  private tap(cx: number, cy: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    if (this.mode === 'home') {
      const hits = this.raycaster.intersectObjects(this.actors.map((a) => a.root), true)
      if (hits.length) {
        let o: THREE.Object3D | null = hits[0].object
        while (o && !o.userData.actor) o = o.parent
        if (o) {
          this.selected = o.userData.actor as Actor
          this.setHud({ selected: this.selected.name })
          return
        }
      }
      if (this.viewFloor === 1) return
    }
    const p = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return
    const who = this.mode === 'home' ? this.selected : this.heroine
    const path = this.nav.findPath(who.pos, { x: p.x, z: p.z })
    if (!path) return
    who.path = path
    const end = path[path.length - 1] ?? who.pos
    this.marker.position.set(end.x, 0.04, end.z)
    this.marker.scale.setScalar(1)
    ;(this.marker.material as THREE.MeshBasicMaterial).opacity = 1
    this.marker.visible = true
  }

  // --- 杂项 -------------------------------------------------------------------

  private fit(): void {
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private setHud(patch: Partial<Hud>): void {
    this.hud = { ...this.hud, ...patch }
    this.onHud(this.hud)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resize.disconnect()
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.geometry.dispose()
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
