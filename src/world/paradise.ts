// "世外桃源"画风：全部用 Poly Haven（CC0）的贴图、天空光照和 3D 模型。
// 模型先用 tools/blender/slim_polyhaven.py 减面、压缩成 public/models/ph/*.glb。
// 和卡通画风共用同一套场景，加载后把材质换掉、把家具和景物换成真模型。
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { HOUSE, STREET, WORLD, YARD, GATE, PROPS, COURT, PORCH } from './layout'
import { PLOT_SLOTS } from './garden'

export type ArtStyle = 'toon' | 'paradise'

const STYLE_KEY = 'rbte-proto-style'

export function loadStyle(): ArtStyle {
  const q = new URLSearchParams(location.search).get('style')
  if (q === 'toon' || q === 'paradise') return q
  try {
    const v = localStorage.getItem(STYLE_KEY)
    if (v === 'toon' || v === 'paradise') return v
  } catch { /* 隐私模式下读不了，就用默认 */ }
  // 默认世外桃源：真人模型、换装、大块头这些都只在这个画风里有（2026-10-09 起；右上角可以切回卡通）
  return 'paradise'
}

export function saveStyle(s: ArtStyle): void {
  try { localStorage.setItem(STYLE_KEY, s) } catch { /* 存不了也不影响玩 */ }
}

/** 材质角色 → Poly Haven 贴图。tile = 一张贴图铺多少米 */
const SURFACES: Record<string, { slug: string; tile: number; rough: number; tint?: string; normal?: number; plain?: boolean }> = {
  // 墙：奶油色（原来的白灰泥在镜头下发灰、显冷）
  wall: { slug: 'white_plaster_02', tile: 2.5, rough: 0.95, tint: '#efe0c8', normal: 0.45, plain: true },
  trim: { slug: 'weathered_brown_planks', tile: 1, rough: 0.85, tint: '#6b4d38' },
  floor: { slug: 'wood_floor', tile: 2, rough: 0.6 },
  wood: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85 },
  wood_dark: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85, tint: '#8a6a52' },
  woodDark: { slug: 'weathered_brown_planks', tile: 1.2, rough: 0.85, tint: '#8a6a52' },
  roof: { slug: 'grey_roof_tiles_02', tile: 2, rough: 0.8, normal: 1.4 },
  // 院子草地：铺得更大、法线更浅，从高处看不再一片斑斑点点
  grass: { slug: 'leafy_grass', tile: 5, rough: 0.95, tint: '#cbe9a2', normal: 0.5 },
  grassDark: { slug: 'aerial_grass_rock', tile: 9, rough: 0.95, tint: '#b9d98f' },
  wallTinted: { slug: 'white_plaster_02', tile: 2.5, rough: 0.95 },
  road: { slug: 'asphalt_02', tile: 4, rough: 0.9 },
  // 院坝：浅色的水泥地（用沥青贴图提亮）
  concrete: { slug: 'asphalt_02', tile: 3, rough: 0.95, tint: '#e2dccf', normal: 0.35 },
  sidewalk: { slug: 'stone_tiles_02', tile: 2, rough: 0.9 },
  stone: { slug: 'cobblestone_floor_04', tile: 1, rough: 0.9 },
  bark: { slug: 'bark_brown_02', tile: 1, rough: 0.95 },
  sakuraBark: { slug: 'sakura_bark', tile: 1, rough: 0.95 },
  riverbed: { slug: 'ganges_river_pebbles', tile: 2.2, rough: 0.75, normal: 1.3 },
}

/** 用到的 Poly Haven 模型（public/models/ph/<slug>.glb） */
export const PH_MODELS = [
  'Sofa_01', 'Rockingchair_01', 'wooden_table_02', 'painted_wooden_chair_01', 'chinese_cabinet', 'chinese_chandelier',
  'potted_plant_01', 'wooden_crate_01', 'wooden_crate_02', 'electric_stove', 'vintage_electric_kettle', 'painted_wooden_cabinet',
  'vintage_day_bed', 'ClassicNightstand_01', 'wooden_lantern_01', 'WoodenTable_01', 'wooden_bookshelf_worn',
  'island_tree_02', 'grass_bermuda_01', 'shrub_sorrel_01', 'periwinkle_plant', 'dandelion_01', 'flower_empodium', 'fern_02',
  'rock_moss_set_02', 'boulder_01', 'covered_car', 'wine_barrel_01', 'wooden_bucket_01', 'large_iron_gate',
  'painted_wooden_bench', 'street_lamp_01',
  // 野外能采的：荠菜（野草）、荨麻、野菊（gazania）、野果丛
  'weed_plant_02', 'nettle_plant', 'flower_gazania', 'shrub_04',
  // 卧室：爸妈的雕花双人床、客房的铁架床、五斗柜、钟、相框、台灯、靠垫、小黄鸭、旧皮箱、书
  'GothicBed_01', 'old_bed_frame', 'vintage_wooden_drawer_01', 'mantel_clock_01', 'wall_clock', 'alarm_clock_01',
  'standing_picture_frame_01', 'desk_lamp_arm_01', 'throw_pillows_01', 'rubber_duck_toy', 'vintage_suitcase', 'book_encyclopedia_set_01',
  // 储藏室：铁架子和上面放的吃的、水、药箱、弹药箱、油桶
  'steel_frame_shelves_01', 'long_life_food', 'russian_food_cans_01', 'cardboard_box_01', 'plastic_bottle_gallon',
  'medical_box', 'ammo_box', 'metal_jerrycan',
  // 堂屋的电视、火炉、小板凳；买回来的发电机、空调外机
  'television_02', 'scandinavian_masonry_heater', 'wooden_stool_02', 'portable_generator', 'exterior_aircon_unit',
] as const

export interface ParadiseKit {
  maps: Map<string, { diff: THREE.Texture; nor: THREE.Texture }>
  env: THREE.Texture
  models: Map<string, THREE.Object3D>
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
  const models = new Map<string, THREE.Object3D>()
  const gltf = new GLTFLoader()
  await Promise.all(PH_MODELS.map(async (slug) => {
    const g = await gltf.loadAsync(`${import.meta.env.BASE_URL}models/ph/${slug}.glb`)
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      // 叶子和草用镂空而不是半透明混合，避免前后排序出错
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        // 玻璃（钟面、相框）：不用透射材质——它每帧要把场景多画一遍，和江面倒影一起用还会把画面弄黑
        const phys = mat as THREE.MeshPhysicalMaterial
        if (phys.transmission > 0) {
          phys.transmission = 0
          phys.transparent = true
          phys.opacity = 0.3
          phys.depthWrite = false
        }
        const std = mat as THREE.MeshStandardMaterial
        if (std.transparent && std.map) {
          // 远处的叶子贴图缩小以后边缘变透明，0.5 的阈值会把叶子整片裁掉（树看着像秃枝）：
          // 阈值放低一点，再用多重采样的 alpha-to-coverage 让边缘柔和
          std.alphaTest = 0.3
          std.alphaToCoverage = true
          std.transparent = false
          std.depthWrite = true
          std.side = THREE.DoubleSide
        }
      }
    })
    models.set(slug, g.scene)
  }))
  const hdr = await new HDRLoader().loadAsync(`${base}kloofendal_sky.hdr`)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromEquirectangular(hdr).texture
  hdr.dispose()
  pmrem.dispose()
  return { maps, env, models }
}

/** 放一个模型（共用几何和材质的浅拷贝） */
export function placeModel(kit: ParadiseKit, slug: string, x: number, y: number, z: number, rotDeg = 0, scale = 1): THREE.Object3D {
  const src = kit.models.get(slug)
  if (!src) throw new Error(`缺少模型 ${slug}`)
  const o = src.clone()
  o.position.set(x, y, z)
  o.rotation.y = THREE.MathUtils.degToRad(rotDeg)
  o.scale.setScalar(scale)
  o.userData.slug = slug
  return o
}

/** 按顶点法线把 UV 设成"米"为单位的盒式投影，贴图就不会被拉伸 */
const projected = new WeakSet<THREE.BufferGeometry>()
export function boxProjectUV(geo: THREE.BufferGeometry): void {
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
      // plain：不用颜色贴图，只留法线（干净的纯色墙面，从高处看不"麻"）
      map: s.plain ? null : diff, normalMap: nor, normalScale: new THREE.Vector2(s.normal ?? 1, s.normal ?? 1),
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

/** 把一个"一排好几种"的模型集拆成一个个品种，每个品种底面中心归零 */
export function variants(src: THREE.Object3D): { parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[] }[] {
  src.updateMatrixWorld(true)
  const out: { parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[] }[] }[] = []
  const nodes = src.children.length === 1 && !(src.children[0] as THREE.Mesh).isMesh ? src.children[0].children : src.children
  for (const node of nodes) {
    const meshes: THREE.Mesh[] = []
    node.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    if (!meshes.length) continue
    const box = new THREE.Box3().setFromObject(node)
    const offset = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2)
    out.push({
      parts: meshes.map((m) => {
        const geo = m.geometry.clone().applyMatrix4(m.matrixWorld)
        geo.translate(-offset.x, -offset.y, -offset.z)
        return { geo, mat: m.material }
      }),
    })
  }
  return out
}

/** 在一片区域里撒某个模型集的各个品种（实例化，便宜） */
export function scatter(kit: ParadiseKit, slug: string, total: number, sample: (r: () => number) => [number, number] | null,
  scale: [number, number], seed: number): THREE.Group {
  const r = rng(seed)
  const g = new THREE.Group()
  const vs = variants(kit.models.get(slug)!)
  const per = Math.ceil(total / vs.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  for (const v of vs) {
    const mats: THREE.Matrix4[] = []
    for (let tries = 0; mats.length < per && tries < per * 6; tries++) {
      const p = sample(r)
      if (!p) continue
      const s = scale[0] + r() * (scale[1] - scale[0])
      q.setFromAxisAngle(up, r() * Math.PI * 2)
      mats.push(m.clone().compose(new THREE.Vector3(p[0], 0, p[1]), q, new THREE.Vector3(s, s, s)))
    }
    for (const part of v.parts) {
      // 植物贴图的透明部分要镂空（Blender 导出时会丢掉这个设置），否则会显示成黑块
      for (const mat of Array.isArray(part.mat) ? part.mat : [part.mat]) {
        const std = mat as THREE.MeshStandardMaterial
        if (std.map && slug !== 'rock_moss_set_02') {
          std.alphaTest = 0.5
          std.transparent = false
          std.depthWrite = true
          std.side = THREE.DoubleSide
          std.needsUpdate = true
        }
      }
      const im = new THREE.InstancedMesh(part.geo, part.mat, mats.length)
      mats.forEach((mm, k) => im.setMatrixAt(k, mm))
      im.castShadow = true
      im.receiveShadow = true
      g.add(im)
    }
  }
  return g
}

/** 不长草的地方：房子、石板路、街道、邻居家、围栏线 */
function blocked(x: number, z: number): boolean {
  if (x > HOUSE.x0 - 0.3 && x < HOUSE.x1 + 0.3 && z > HOUSE.z0 - 0.3 && z < HOUSE.z1 + 0.3) return true
  if (x > COURT.x0 - 0.2 && x < COURT.x1 + 0.2 && z > HOUSE.z1 - 0.3 && z < COURT.z1 + 0.6) return true
  // 檐廊（地砖上不长草）
  if (x > PORCH.x0 - 0.3 && x < PORCH.x1 + 0.3 && z > PORCH.z0 - 0.3 && z < PORCH.z1 + 0.3) return true
  if (z > STREET.z0 - 1.4 && z < STREET.z1 + 1.4) return true
  for (const p of PROPS) if (p.kind !== 'tree' && Math.abs(x - p.x) < p.w / 2 + 0.6 && Math.abs(z - p.z) < p.d / 2 + 0.6) return true
  if (Math.abs(z - YARD.z0) < 0.25 || Math.abs(z - YARD.z1) < 0.25 || Math.abs(x - YARD.x0) < 0.25 || Math.abs(x - YARD.x1) < 0.25) return true
  // 四块菜地的地方不长草（开不开地都留着，不然开了地草会从土里冒出来）
  for (const g of PLOT_SLOTS) if (x > g.x0 - 0.15 && x < g.x1 + 0.15 && z > g.z0 - 0.15 && z < g.z1 + 0.15) return true
  return false
}

/** 地面采样器：院子草坪的边上、院子里、外面野地 */
export const samplers = {
  lawnEdge: (r: () => number): [number, number] | null => {
    const x = YARD.x0 + r() * (YARD.x1 - YARD.x0)
    const z = YARD.z0 + r() * (YARD.z1 - YARD.z0)
    const edge = Math.min(x - YARD.x0, YARD.x1 - x, z - YARD.z0, YARD.z1 - z)
    const nearHouse = x > HOUSE.x0 - 1.2 && x < HOUSE.x1 + 1.2 && z > HOUSE.z0 - 1.2 && z < HOUSE.z1 + 1.2
    if (blocked(x, z) || (edge > 1.4 && !nearHouse)) return null
    return [x, z]
  },
  lawn: (r: () => number): [number, number] | null => {
    const x = YARD.x0 + r() * (YARD.x1 - YARD.x0)
    const z = YARD.z0 + r() * (YARD.z1 - YARD.z0)
    return blocked(x, z) ? null : [x, z]
  },
  houseFront: (r: () => number): [number, number] | null => {
    const side = r()
    const [x, z] = side < 0.6 ? [HOUSE.x0 + r() * (HOUSE.x1 - HOUSE.x0), HOUSE.z1 + 0.35 + r() * 0.5] : [HOUSE.x1 + 0.35 + r() * 0.5, HOUSE.z0 + r() * (HOUSE.z1 - HOUSE.z0)]
    return blocked(x, z) || Math.abs(x - GATE.x) < 1 ? null : [x, z]
  },
  wild: (r: () => number): [number, number] | null => {
    const x = WORLD.x0 - 8 + r() * (WORLD.x1 - WORLD.x0 + 16)
    const z = WORLD.z0 - 2 + r() * (WORLD.z1 - WORLD.z0 + 10)
    if (x > YARD.x0 - 0.4 && x < YARD.x1 + 0.4 && z > YARD.z0 - 0.4 && z < YARD.z1 + 0.4) return null
    if (z < RIVER.south + 1.2 && z > RIVER.north - 1.2) return null
    return blocked(x, z) ? null : [x, z]
  },
  riverBank: (r: () => number): [number, number] | null => {
    const x = WORLD.x0 - 10 + r() * (WORLD.x1 - WORLD.x0 + 20)
    const z = RIVER.south + 0.2 + r() * 1.4
    return [x, z]
  },
}

/** 樱花树：Poly Haven 的老树，叶子在着色器里换成樱花粉 */
const sakuraLeavesByKit = new WeakMap<ParadiseKit, THREE.Material>()
export function sakuraTree(kit: ParadiseKit, scale: number): THREE.Object3D {
  let sakuraLeaves = sakuraLeavesByKit.get(kit) ?? null
  const t = kit.models.get('island_tree_02')!.clone()
  t.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    const swapped = mats.map((mat) => {
      if (!/leaves/i.test(mat.name)) return mat
      if (!sakuraLeaves) {
        const pink = (mat as THREE.MeshStandardMaterial).clone()
        pink.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb = mix(vec3(0.86, 0.45, 0.62), vec3(1.0, 0.84, 0.9), clamp(lum * 2.4, 0.0, 1.0));`)
        }
        pink.customProgramCacheKey = () => 'sakura-leaves'
        sakuraLeaves = pink
        sakuraLeavesByKit.set(kit, pink)
      }
      return sakuraLeaves
    })
    m.material = Array.isArray(m.material) ? swapped : swapped[0]
  })
  t.scale.setScalar(scale)
  return t
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
    // 球的贴图坐标是 0~1，草地材质却是按"米"铺的：换算成米，不然整座山只铺了一小块图，糊成一片
    const uv = geo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * (Math.PI / 2) * h)
    uv.needsUpdate = true
    const m = new THREE.Mesh(geo, mat)
    m.scale.set(1, h / r, 1)
    m.position.set(x, -0.5, z)
    m.receiveShadow = true
    g.add(m)
  }
  return g
}

/** 屋后那条江的位置（南岸、北岸的地面边缘，单位米） */
export const RIVER = { south: WORLD.z0 - 1.3, north: WORLD.z0 - 9.7, bed: -0.55, water: -0.14, bank: 1.3 }

/** 屋后的江：草坡岸 + Poly Haven 卵石河床 + 透亮的水面（水面效果是代码做的，Poly Haven 没有水） */
export class River {
  readonly group = new THREE.Group()
  private readonly normal: THREE.CanvasTexture

  constructor(mats: ParadiseMaterials) {
    const len = 300
    const bed = mats.textured('riverbed') ?? new THREE.MeshStandardMaterial({ color: '#7d7466' })
    const grass = mats.textured('grassDark') ?? new THREE.MeshStandardMaterial({ color: '#6f9a55' })
    const width = RIVER.south - RIVER.north - RIVER.bank * 2
    const mid = (RIVER.south + RIVER.north) / 2
    const plane = (w: number, d: number, mat: THREE.Material, y: number, z: number, tilt = 0) => {
      const geo = new THREE.PlaneGeometry(w, d)
      boxProjectUV(geo)
      const m = new THREE.Mesh(geo, mat)
      m.rotation.x = -Math.PI / 2 + tilt
      m.position.set(5, y, z)
      m.receiveShadow = true
      this.group.add(m)
      return m
    }
    // 北岸的地
    plane(len, 80, grass, -0.02, RIVER.north - 40)
    // 河床和两边的斜岸
    plane(len, width, bed, RIVER.bed, mid)
    const slope = Math.atan2(-RIVER.bed, RIVER.bank)
    const bankLen = Math.hypot(RIVER.bank, -RIVER.bed)
    plane(len, bankLen, bed, RIVER.bed / 2, RIVER.south - RIVER.bank / 2, -slope)
    plane(len, bankLen, bed, RIVER.bed / 2, RIVER.north + RIVER.bank / 2, slope)
    // 水面：半透明的青绿色，能看到下面的卵石；法线贴图慢慢流动。
    // 以前用透射材质（?water=glass 还能切回去），但它每帧要把整个场景多画一遍，一帧慢 5 倍左右，看起来也差不多
    this.normal = rippleTexture()
    this.normal.repeat.set(len / 9, (RIVER.south - RIVER.north) / 9)
    const mode = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('water') : null
    // 默认：镜面倒影的水（参考小红书"Harbour Town"：倒影 + 涟漪扭曲 + 青绿底色 + 雾）。?water=simple 回到半透明的旧水面
    if (mode !== 'simple' && mode !== 'glass') {
      const mirror = mirrorWater(len, RIVER.south - RIVER.north - 0.4, this.normal)
      mirror.position.set(5, RIVER.water, mid)
      this.mirror = mirror
      this.group.add(mirror)
      return
    }
    const glass = mode === 'glass'
    const water = glass
      ? new THREE.MeshPhysicalMaterial({
        color: '#f2fbfa', roughness: 0.02, metalness: 0, transmission: 1, ior: 1.33, thickness: 0.5,
        attenuationColor: '#6fb7ae', attenuationDistance: 4, normalMap: this.normal, normalScale: new THREE.Vector2(0.1, 0.1),
        specularIntensity: 0.6,
      })
      : new THREE.MeshPhysicalMaterial({
        color: '#57a196', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false,
        normalMap: this.normal, normalScale: new THREE.Vector2(0.1, 0.1), specularIntensity: 0.7,
      })
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(len, RIVER.south - RIVER.north - 0.4), water)
    surface.rotation.x = -Math.PI / 2
    surface.position.set(5, RIVER.water, mid)
    this.group.add(surface)
  }

  /** 镜面水（默认）；旧的半透明水面时为 null */
  private mirror: Reflector | null = null

  /** 倒影那一遍只画这一层 */
  static readonly LAYER = 3

  /** 倒影只画江边和江北的东西（山、岸、石头、树、地面、天空）：房子、人、院子里的东西都看不见，不用画——倒影那一遍省一大半 */
  limitReflection(scene: THREE.Object3D): void {
    if (!this.mirror) return
    const box = new THREE.Box3()
    scene.traverse((o) => {
      if ((o as THREE.Light).isLight) { o.layers.enable(River.LAYER); return }
      const m = o as THREE.Mesh
      if (!m.isMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return
      box.setFromObject(m)
      if (box.min.z < RIVER.south + 3) m.layers.enable(River.LAYER)
    })
    const get = this.mirror.getReflectionCamera.bind(this.mirror)
    this.mirror.getReflectionCamera = (cam: THREE.Camera) => {
      const rc = get(cam)
      rc.layers.set(River.LAYER)
      return rc
    }
  }

  update(t: number): void {
    this.normal.offset.set(t * 0.025, t * 0.006)
    if (this.mirror) (this.mirror.material as THREE.ShaderMaterial).uniforms.time.value = t
  }
}

/**
 * 镜面水：把场景按水面翻过来再画一遍（Reflector，半分辨率），水面上读这张倒影图。
 * - 两层流动的涟漪法线把倒影扭一扭：竖着扭得多、横着扭得少，远处的灯、树、山的倒影就拉成一条条竖的光带
 * - 底色是青绿的；看得越斜（远处）倒影越多（菲涅尔）
 * - 接场景的雾：远处的水和天空、远山融在一起，看不出水平线
 */
function mirrorWater(w: number, d: number, normal: THREE.Texture): Reflector {
  const px = typeof window !== 'undefined' ? Math.min(1024, Math.max(256, Math.round(window.innerWidth * window.devicePixelRatio * 0.5))) : 512
  const shader = {
    name: 'MirrorWater',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      color: { value: null },
      tDiffuse: { value: null },
      textureMatrix: { value: null },
      tNormal: { value: null },
      time: { value: 0 },
      deep: { value: new THREE.Color('#2f7a74') },
      shallow: { value: new THREE.Color('#8fd0c2') },
      north: { value: 0 },
      south: { value: 0 },
    }]),
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform vec3 deep;
      uniform vec3 shallow;
      uniform float north;
      uniform float south;
      uniform sampler2D tDiffuse;
      uniform sampler2D tNormal;
      uniform float time;
      varying vec4 vUv;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        vec2 p = vWorld.xz;
        // 两层不同方向、不同速度的涟漪（沿水流方向拉长）
        vec2 n1 = texture2D(tNormal, p * vec2(0.06, 0.2) + vec2(time * 0.02, time * 0.005)).xy * 2.0 - 1.0;
        vec2 n2 = texture2D(tNormal, p * vec2(0.14, 0.42) + vec2(-time * 0.012, time * 0.015)).xy * 2.0 - 1.0;
        vec2 n = n1 + n2 * 0.55;
        vec4 uv = vUv;
        // 竖着扭得多：倒影里的灯和树拉成竖的光带
        uv.xy += n * vec2(0.018, 0.055) * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.3 + 0.32 * pow(1.0 - clamp(V.y, 0.0, 1.0), 2.0);
        // 离岸边近的地方浅一点、亮一点（看得出水是浅的），还能隐约看见河底的卵石
        float edge = min(vWorld.z - north, south - vWorld.z);
        float shallowK = 1.0 - smoothstep(0.0, 1.8, edge);
        vec3 base = mix(deep, shallow, shallowK * 0.7);
        // 倒影染成青绿、压暗一点（天空的倒影不是一片白），涟漪亮面暗面交错
        vec3 col = mix(base, refl * vec3(0.62, 0.86, 0.84), fres);
        col *= 0.8 + 0.4 * (n.y * 0.3 + 0.5);
        // 靠岸一圈细细的白沫
        col = mix(col, vec3(0.92, 0.97, 0.95), (1.0 - smoothstep(0.0, 0.2, edge)) * 0.5);
        col += vec3(0.95, 1.0, 1.0) * pow(max(0.0, n.x * 0.6 + n.y * 0.4), 5.0) * 0.16;
        gl_FragColor = vec4(col, mix(0.62, 1.0, smoothstep(0.1, 1.4, edge)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // 雾只上一半：远处的水还是青绿的，不会被雾刷成沙子的颜色
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
          #else
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
          #endif
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor * 0.45 );
        #endif
      }`,
  }
  const mirror = new Reflector(new THREE.PlaneGeometry(w, d), {
    color: '#6fb8ae', textureWidth: px, textureHeight: Math.round(px * 0.6), clipBias: 0.003, multisample: 0, shader,
  })
  mirror.rotation.x = -Math.PI / 2
  const mat = mirror.material as THREE.ShaderMaterial
  mat.uniforms.tNormal.value = normal
  mat.uniforms.north.value = RIVER.north + 0.2
  mat.uniforms.south.value = RIVER.south - 0.2
  mat.fog = true
  mat.transparent = true
  return mirror
}

/** 可平铺的水波法线贴图：几组不同方向、频率的波叠在一起 */
function rippleTexture(): THREE.CanvasTexture {
  const n = 256
  const c = document.createElement('canvas')
  c.width = c.height = n
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(n, n)
  const waves = [[1, 2, 0.9, 0.3], [3, -1, 0.6, 1.7], [-2, 5, 0.35, 2.4], [6, 3, 0.22, 0.8], [-7, -4, 0.15, 4.1], [9, -8, 0.1, 5.3]]
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let dx = 0
      let dy = 0
      for (const [kx, ky, a, ph] of waves) {
        const arg = ((kx * x + ky * y) / n) * Math.PI * 2 + ph
        dx += a * kx * Math.cos(arg)
        dy += a * ky * Math.cos(arg)
      }
      const i = (y * n + x) * 4
      img.data[i] = 128 + Math.max(-127, Math.min(127, dx * 9))
      img.data[i + 1] = 128 + Math.max(-127, Math.min(127, dy * 9))
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
