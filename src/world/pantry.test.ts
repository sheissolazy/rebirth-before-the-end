import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PantryView, PER } from './pantry'
import { inRect } from './layout'

/** 储藏室墙里面那一块（隔墙 x=8、东墙 x=12，墙厚 0.3） */
const ROOM = { x0: 8.15, z0: -2.85, x1: 11.85, z1: 5.85 }
import type { ParadiseKit } from './paradise'

/** 假的模型包：每样东西一个小方块（只看摆放，不看长相） */
function fakeKit(): ParadiseKit {
  const models = new Map<string, THREE.Object3D>()
  for (const slug of ['long_life_food', 'russian_food_cans_01', 'cardboard_box_01', 'plastic_bottle_gallon', 'medical_box', 'ammo_box', 'metal_jerrycan']) {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial()))
    models.set(slug, g)
  }
  return { models, maps: new Map(), env: new THREE.Texture() }
}

function counts(root: THREE.Object3D): number[] {
  const out: number[] = []
  root.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) out.push((o as THREE.InstancedMesh).count) })
  return out
}

describe('储藏室的分类架子', () => {
  it('每个位置都在储藏室里面', () => {
    const v = new PantryView(new THREE.Group(), fakeKit())
    for (const s of [...v.foodSlots, ...v.floorBoxes, ...v.waterSlots, ...v.medSlots, ...v.ammoSlots, ...v.fuelSlots]) {
      expect(inRect(ROOM, s.x, s.z, 0.05), `${s.x},${s.z}`).toBe(true)
    }
  })

  it('摆几件跟着存货走：没有就空着，多了先放满架子再在地上码纸箱，再多也不越界', () => {
    const root = new THREE.Group()
    const v = new PantryView(root, fakeKit())
    v.sync({ food: 0, water: 0, medkits: 0, ammo: 0, fuel: 0 })
    expect(counts(root).every((n) => n === 0)).toBe(true)
    // 12 份吃的 = 4 件；6 份水 = 3 桶；2 个急救包；24 发子弹 = 2 箱；3 桶油
    v.sync({ food: 12, water: 6, medkits: 2, ammo: 24, fuel: 3 })
    const [sets, cans, boxes, jugs, med, ammo, fuel] = counts(root)
    expect(sets + cans / 2 + boxes).toBe(12 / PER.food)
    expect(jugs).toBe(3)
    expect(med).toBe(2)
    expect(ammo).toBe(2)
    expect(fuel).toBe(3)
    // 吃的多到架子放不下：多出来的变成地上的纸箱
    const shelf = v.foodSlots.length
    v.sync({ food: (shelf + 4) * PER.food, water: 0, medkits: 0, ammo: 0, fuel: 0 })
    const after = counts(root)
    expect(after[0] + after[1] / 2 + after[2]).toBe(shelf + 4)
    for (const huge of [500, 99999]) expect(() => v.sync({ food: huge, water: huge, medkits: huge, ammo: huge, fuel: huge })).not.toThrow()
  })
})
