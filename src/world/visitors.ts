// 来敲院门的人（设计文档：突发事件尽量在世界里真实发生——邻居真的来敲院门）。
// 有人从街上走到铁门外，敲三下，游戏暂停弹出对话，选完 TA 再走掉。
import * as THREE from 'three'
import { PoseDriver } from './people'
import { person } from './meshes'
import { Walker } from './walker'
import type { Pt } from './nav'

export type VisitorId = 'relative_loan' | 'neighbor_rice' | 'neighbor_thanks' | 'beggar' | 'scout' | 'crow_tax' | 'jiangye_meet' | 'jiangye_care' | 'shenyan_meet' | 'guchen_visit' | 'xielin_meet'
  | 'invite_jiangye' | 'invite_shenyan' | 'invite_guchen' | 'invite_xielin' | 'invite_neighbor'
export type VisitorModel = 'neighbor' | 'stranger' | 'jiangye' | 'shenyan' | 'guchen' | 'xielin'

export interface VisitorCtx {
  day: number
  hour: number
  prologue: boolean
  /** 末日后第几个月（从 1 开始），末日前是 0 */
  month: number
  food: number
  water: number
  /** 子弹 */
  ammo: number
  /** 已经来过的（id → 哪天来的） */
  seen: Record<string, number>
  /** 帮过王阿姨 */
  helpedNeighbor: boolean
  /** 家里现在住几个人（最多 5） */
  residents: number
  /** 男主好感（id → 0~100） */
  affection: Record<string, number>
  /** 跟江野说过末日的事 */
  warnedJiangye: boolean
  /** 家里最重的伤（最低的健康） */
  worstHealth: number
  medkits: number
  /** 去过军区、认识顾沉 */
  guchenMet: boolean
  /** 能借出去的家人（不算女主、客人、出门的） */
  lendable: number
  /** 谢临塞过几张纸条 */
  xielinNotes: number
  /** 江野已经住进来了 */
  jiangyeHome: boolean
  /** 沈砚已经住进来了 */
  shenyanHome: boolean
  money: number
  /** 中了彩票、兑了奖（消息传开了） */
  rich: boolean
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

/** 手机上请来家里做客的人（一天请一个）：来了有一件小事可以一起做、有收获；或者就坐坐聊聊天（感情涨得多一点）。不会自己随机来 */
export const INVITES: VisitorDef[] = (['jiangye', 'shenyan', 'guchen', 'xielin', 'neighbor'] as const).map((m) => ({
  id: `invite_${m}` as VisitorId, model: m as VisitorModel, icon: { jiangye: '🔥', shenyan: '🩺', guchen: '⚡', xielin: '⏳', neighbor: '👵' }[m],
  chance: 0, when: () => false, choices: [{ id: 'task' }, { id: 'chat' }],
}))

export const VISITORS: VisitorDef[] = [
  // 中了彩票的消息传开了：二姑上门借钱
  {
    id: 'relative_loan', model: 'neighbor', icon: '👩‍🦳', chance: 0.5,
    when: (c) => c.prologue && c.rich && daytime(c) && c.seen.relative_loan === undefined,
    choices: [{ id: 'lend', need: (c) => c.money >= 5000 }, { id: 'refuse' }],
  },
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
    choices: [{ id: 'give', need: (c) => c.food >= 1 }, { id: 'invite', need: (c) => c.residents < 5 }, { id: 'refuse' }],
  },
  // 来踩点的人：说是讨碗水喝，眼睛却一直在数院子里有几个人、窗户在哪（陌生人敲门，有一定概率打起来）
  {
    id: 'scout', model: 'stranger', icon: '🧢', chance: 0.1,
    when: (c) => !c.prologue && c.day >= 5 && c.hour >= 10 && c.hour < 16.5 && (c.seen.scout === undefined || c.day - c.seen.scout >= 3),
    choices: [{ id: 'water', need: (c) => c.water >= 1 }, { id: 'gun', need: (c) => c.ammo >= 2 }, { id: 'shut' }],
  },
  // 男主：江野（青梅竹马、佣兵团长）。序章就能遇到，他无条件信你
  {
    id: 'jiangye_meet', model: 'jiangye', icon: '🔥', chance: 0.3,
    when: (c) => c.prologue && daytime(c) && c.seen.jiangye_meet === undefined,
    choices: [{ id: 'warn' }, { id: 'weld' }, { id: 'tea' }],
  },
  {
    id: 'jiangye_care', model: 'jiangye', icon: '🔥', chance: 0.25,
    when: (c) => !c.prologue && daytime(c) && !c.jiangyeHome && (c.warnedJiangye || (c.affection.jiangye ?? 0) >= 55)
      && (c.seen.jiangye_care === undefined || c.day - c.seen.jiangye_care >= 3),
    // 好感到"暧昧"以上、家里还有位置：可以请他住下来（设计文档：暧昧 = 可入住基地）
    choices: [{ id: 'thanks' }, { id: 'stay', need: (c) => (c.affection.jiangye ?? 0) >= 70 && c.residents < 5 }],
  },
  // 男主：沈砚（天才医生）。末日后家里有人伤得重，他会闻着血腥味找上门
  {
    id: 'shenyan_meet', model: 'shenyan', icon: '🩺', chance: 0.4,
    when: (c) => !c.prologue && daytime(c) && c.worstHealth < 55 && !c.shenyanHome
      && (c.seen.shenyan_meet === undefined || c.day - c.seen.shenyan_meet >= 4),
    // 好感够高、家里有位置：请他留下来当家里的医生
    choices: [{ id: 'treat' }, { id: 'medkit', need: (c) => c.medkits >= 1 }, { id: 'stay', need: (c) => (c.affection.shenyan ?? 0) >= 70 && c.residents < 5 }, { id: 'refuse' }],
  },
  // 男主：顾沉（军区基地长）。末日前去军区门口见过他，末日后他会亲自上门借人守防线
  {
    id: 'guchen_visit', model: 'guchen', icon: '⚡', chance: 0.3,
    when: (c) => !c.prologue && c.guchenMet && daytime(c) && c.day >= 6
      && (c.seen.guchen_visit === undefined || c.day - c.seen.guchen_visit >= 5),
    choices: [{ id: 'lend', need: (c) => c.lendable >= 1 }, { id: 'ammo', need: (c) => c.food >= 4 }, { id: 'refuse' }],
  },
  // 男主：谢临（同为重生者）。塞过两张纸条以后，某个傍晚他会亲自站到铁门外（只来这一次）
  {
    id: 'xielin_meet', model: 'xielin', icon: '⏳', chance: 0.35,
    when: (c) => !c.prologue && c.xielinNotes >= 2 && c.hour >= 17 && c.hour < 18.5 && c.seen.xielin_meet === undefined,
    choices: [{ id: 'ask' }, { id: 'dinner', need: (c) => c.food >= 1 }, { id: 'shut' }],
  },
  {
    id: 'crow_tax', model: 'stranger', icon: '🐦‍⬛', chance: 0.25,
    when: (c) => !c.prologue && c.month >= 1 && c.hour >= 10 && c.hour < 16
      && (c.seen.crow_tax === undefined || Math.floor(c.seen.crow_tax / 4) !== Math.floor(c.day / 4)) && c.day >= 5,
    choices: [{ id: 'pay', need: (c) => c.food >= 3 }, { id: 'refuse' }],
  },
]

/** 门外陌生人可能长的样子（住进来以后也是这个模型）；survivor_f 是女的 */
export const STRANGER_MODELS = ['stranger', 'survivor_f', 'survivor_m'] as const
export const isFemaleModel = (m: string) => m === 'survivor_f' || m === 'neighbor'

/** 街上走来走去的 NPC：有 MakeHuman 模型就用骨骼摆姿势，没有就用代码画的小人 */
class StreetWalker extends Walker {
  readonly home: Pt
  private driver: PoseDriver | null
  private inner: THREE.Object3D

  constructor(at: Pt, model: THREE.Object3D | undefined, female: boolean) {
    super()
    this.home = { ...at }
    this.inner = model ?? person(female ? '#b07a9a' : '#3c3c44', '#2a2a2a', female ? 0.92 : 1.02)
    this.driver = model ? new PoseDriver(model) : null
    this.root.add(this.inner)
    this.root.position.set(at.x, 0, at.z)
  }

  /** 真人模型（拍头像用）；还是代码画的小人时为 null */
  get model3d(): THREE.Object3D | null {
    return this.driver ? this.inner : null
  }

  /** 还是代码画的小人吗（来的时候真人模型还没加载好） */
  get placeholder(): boolean {
    return !this.driver
  }

  /** 真人模型加载好了：把代码画的小人换掉 */
  setModel(model: THREE.Object3D): void {
    this.inner.removeFromParent()
    this.inner = model
    this.driver = new PoseDriver(model)
    this.root.add(model)
  }

  animate(dt: number, walking: boolean): void {
    if (this.driver) this.driver.update(dt, walking ? 'walk' : 'idle')
    else {
      const body = this.inner.userData.body as THREE.Object3D | undefined
      if (body) body.position.y = 0.55 + (walking ? Math.abs(Math.sin(performance.now() / 90)) * 0.05 : 0)
    }
  }
}

/** 来敲门的人 */
export class Visitor extends StreetWalker {
  readonly def: VisitorDef
  phase: 'walk' | 'knock' | 'talk' | 'leave' = 'walk'
  knockT = 0
  /** 用的哪个人物模型（卡片图按它找） */
  modelId = ''

  constructor(def: VisitorDef, at: Pt, model?: THREE.Object3D, female = def.model === 'neighbor') {
    super(at, model, female)
    this.def = def
  }
}

/** 男主送东西：走到铁门外放下就走，不敲门、不打扰（顾沉放一箱物资，沈砚放药，谢临塞纸条） */
/** 送东西上门的人：三位男主，或者网购的快递小哥 */
export type CourierId = 'guchen' | 'shenyan' | 'xielin' | 'express'
export class Courier extends StreetWalker {
  readonly who: CourierId
  phase: 'walk' | 'drop' | 'leave' = 'walk'
  /** 放东西停留的游戏小时 */
  wait = 0
  /** 放下东西时才记进日志（路上就记的话，人还没到字先出来了） */
  pending: { key: string; vars: Record<string, string | number> } | null = null
  /** 快递：放下时把这一单的东西加进家里 */
  order: { cart: Record<string, number> } | null = null

  constructor(who: CourierId, at: Pt, model?: THREE.Object3D) {
    super(at, model, false)
    this.who = who
  }
}
