// 乡下的野外采集：院子外面、江边、田埂上长着野菜、野花、草药、蘑菇、竹笋、野果，还有一窝野蜂。
// 点一下，女主走过去蹲下采；采过的地方过几天会重新长出来。末日后在外面采东西可能引来丧尸。
import type { Pt } from './nav'

export type ForageKind = 'greens' | 'flowers' | 'herb' | 'mushroom' | 'toadstool' | 'shoots' | 'bamboo' | 'berries' | 'honey'

export interface ForageSpot {
  id: string
  kind: ForageKind
  /** 叫什么（显示在提示和日记里） */
  name: string
  /** 植物长在这里；女主站在它旁边 */
  at: Pt
}

export const FORAGE: ForageSpot[] = [
  { id: 'greens_w', kind: 'greens', name: '荠菜', at: { x: -8, z: -5.5 } },
  { id: 'greens_e', kind: 'greens', name: '蕨菜', at: { x: 15, z: 11 } },
  { id: 'flowers_w', kind: 'flowers', name: '野菊花', at: { x: -11, z: 6 } },
  { id: 'flowers_e', kind: 'flowers', name: '紫云英', at: { x: 17, z: -5.5 } },
  { id: 'herb_river', kind: 'herb', name: '蒲公英', at: { x: 8.5, z: -6.2 } },
  { id: 'herb_w', kind: 'herb', name: '荨麻', at: { x: -16, z: -6 } },
  { id: 'herb_e', kind: 'herb', name: '酢浆草', at: { x: 29, z: 11 } },
  { id: 'mushroom', kind: 'mushroom', name: '平菇', at: { x: -19, z: 2 } },
  { id: 'toadstool', kind: 'toadstool', name: '红伞伞', at: { x: -21, z: 4.5 } },
  { id: 'shoots', kind: 'shoots', name: '竹笋', at: { x: -21, z: 10 } },
  { id: 'bamboo', kind: 'bamboo', name: '竹林', at: { x: 30, z: 1.5 } },
  { id: 'berries_e', kind: 'berries', name: '覆盆子', at: { x: 28, z: -5 } },
  { id: 'berries_w', kind: 'berries', name: '野桑葚', at: { x: -14, z: 11.5 } },
  { id: 'honey', kind: 'honey', name: '野蜂窝', at: { x: 14.5, z: -6.6 } },
]

/** 采完以后过几天重新长出来 */
export const REGROW: Record<ForageKind, number> = {
  greens: 2, flowers: 2, herb: 2, mushroom: 3, toadstool: 2, shoots: 3, bamboo: 2, berries: 2, honey: 4,
}

/** 蹲下采要多久（游戏小时） */
export const FORAGE_HOURS: Record<ForageKind, number> = {
  greens: 0.3, flowers: 0.2, herb: 0.25, mushroom: 0.25, toadstool: 0.15, shoots: 0.4, bamboo: 0.5, berries: 0.3, honey: 0.45,
}

/** 几份草药，妈妈就能捣成一个急救包 */
export const HERBS_PER_MEDKIT = 3

/** 女主站在哪儿采：植物南边一点（离江、离树干远一点），面朝植物 */
export function standAt(s: ForageSpot): Pt & { face: number } {
  const off = s.kind === 'honey' ? 1.0 : s.kind === 'bamboo' ? 0.9 : 0.55
  return { x: s.at.x, z: s.at.z + off, face: 180 }
}

export function ripe(s: ForageSpot, picked: Record<string, number>, day: number): boolean {
  const d = picked[s.id]
  return d === undefined || day - d >= REGROW[s.kind]
}

export interface ForageYield {
  /** 家里多了几份吃的 */
  food: number
  /** 女主自己的心情 */
  mood: number
  /** 家里每个人的心情（野花插瓶、蜂蜜甜） */
  family: number
  herbs: number
  /** 砍回来几根竹子（削竹尖刺用） */
  bamboo: number
  /** 被蜂蛰了：掉多少健康 */
  sting: number
  /** 这次说哪句话（world.forage.<key>） */
  key: string
}

export function harvest(kind: ForageKind, r: () => number): ForageYield {
  const y: ForageYield = { food: 0, mood: 2, family: 0, herbs: 0, bamboo: 0, sting: 0, key: kind }
  if (kind === 'greens') y.food = 0.4
  if (kind === 'flowers') { y.mood = 6; y.family = 5 }
  if (kind === 'herb') y.herbs = 1
  if (kind === 'shoots') { y.food = 0.6; y.bamboo = 1 }
  if (kind === 'bamboo') { y.bamboo = 3; y.mood = 0 }
  if (kind === 'berries') { y.food = 0.3; y.mood = 6 }
  if (kind === 'toadstool') y.mood = 0
  if (kind === 'mushroom') {
    // 一窝里偶尔混着一朵毒的：认出来扔掉，少采一点
    const bad = r() < 0.2
    y.food = bad ? 0.25 : 0.5
    if (bad) y.key = 'mushroomBad'
  }
  if (kind === 'honey') {
    y.food = 0.8
    y.family = 8
    if (r() < 0.5) { y.sting = 6; y.mood = -3; y.key = 'honeySting' }
  }
  return y
}
