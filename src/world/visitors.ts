// 来敲院门的人（设计文档：突发事件尽量在世界里真实发生——邻居真的来敲院门）。
// 有人从街上走到铁门外，敲三下，游戏暂停弹出对话，选完 TA 再走掉。
import * as THREE from 'three'
import { PoseDriver } from './people'
import { person } from './meshes'
import { Walker } from './walker'
import type { Pt } from './nav'

export type VisitorId = 'neighbor_rice' | 'neighbor_thanks' | 'beggar' | 'crow_tax'
export type VisitorModel = 'neighbor' | 'stranger'

export interface VisitorCtx {
  day: number
  hour: number
  prologue: boolean
  /** 末日后第几个月（从 1 开始），末日前是 0 */
  month: number
  food: number
  /** 已经来过的（id → 哪天来的） */
  seen: Record<string, number>
  /** 帮过王阿姨 */
  helpedNeighbor: boolean
}

export interface VisitorDef {
  id: VisitorId
  model: VisitorModel
  icon: string
  /** 这一个小时里有多大概率来 */
  chance: number
  when: (c: VisitorCtx) => boolean
  choices: { id: string; need?: (c: VisitorCtx) => boolean }[]
}

const daytime = (c: VisitorCtx) => c.hour >= 9 && c.hour < 16.5

export const VISITORS: VisitorDef[] = [
  {
    id: 'neighbor_rice', model: 'neighbor', icon: '👵', chance: 0.35,
    when: (c) => c.prologue && c.day >= 1 && daytime(c) && c.seen.neighbor_rice === undefined,
    choices: [{ id: 'give', need: (c) => c.food >= 1 }, { id: 'refuse' }],
  },
  {
    id: 'neighbor_thanks', model: 'neighbor', icon: '👵', chance: 0.3,
    when: (c) => !c.prologue && c.helpedNeighbor && daytime(c) && c.seen.neighbor_thanks === undefined,
    choices: [{ id: 'ok' }],
  },
  {
    id: 'beggar', model: 'stranger', icon: '🧔', chance: 0.12,
    when: (c) => !c.prologue && daytime(c) && (c.seen.beggar === undefined || c.day - c.seen.beggar >= 3),
    choices: [{ id: 'give', need: (c) => c.food >= 1 }, { id: 'refuse' }],
  },
  {
    id: 'crow_tax', model: 'stranger', icon: '🐦‍⬛', chance: 0.25,
    when: (c) => !c.prologue && c.month >= 1 && c.hour >= 10 && c.hour < 16
      && (c.seen.crow_tax === undefined || Math.floor(c.seen.crow_tax / 4) !== Math.floor(c.day / 4)) && c.day >= 5,
    choices: [{ id: 'pay', need: (c) => c.food >= 3 }, { id: 'refuse' }],
  },
]

/** 来敲门的人：一个会走路的 NPC */
export class Visitor extends Walker {
  readonly def: VisitorDef
  phase: 'walk' | 'knock' | 'talk' | 'leave' = 'walk'
  knockT = 0
  readonly home: Pt
  private readonly driver: PoseDriver | null
  private readonly inner: THREE.Object3D

  constructor(def: VisitorDef, at: Pt, model?: THREE.Object3D) {
    super()
    this.def = def
    this.home = { ...at }
    this.inner = model ?? person(def.model === 'neighbor' ? '#b07a9a' : '#3c3c44', '#2a2a2a', def.model === 'neighbor' ? 0.92 : 1.02)
    this.driver = model ? new PoseDriver(model) : null
    this.root.add(this.inner)
    this.root.position.set(at.x, 0, at.z)
  }

  animate(dt: number, walking: boolean): void {
    if (this.driver) this.driver.update(dt, walking ? 'walk' : 'idle')
    else {
      const body = this.inner.userData.body as THREE.Object3D | undefined
      if (body) body.position.y = 0.55 + (walking ? Math.abs(Math.sin(performance.now() / 90)) * 0.05 : 0)
    }
  }
}
