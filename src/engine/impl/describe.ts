import type { Effect } from '../types'
import type { ContentIndex } from './content'

const STAT: Record<string, string> = { health: '健康', exposure: '暴露', butterfly: '蝴蝶效应' }
const ATTR: Record<string, string> = { strength: '体力', mind: '头脑', charm: '魅力' }
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** 引擎侧的效果描述（中文），用于日记和周报，保证"写的就是发生的" */
export function describeEffectsZh(ci: ContentIndex, effects: Effect[], actorName?: string): string {
  const parts: string[] = []
  const npc = (id: string) => ci.npcs.get(id)?.name.zh ?? id
  const card = (id: string) => ci.cards.get(id)?.name.zh ?? id
  for (const e of effects) {
    switch (e.type) {
      case 'money': parts.push(`钱 ${sign(e.delta)}`); break
      case 'stat': parts.push(`${STAT[e.stat] ?? e.stat} ${sign(e.delta)}`); break
      case 'attr': parts.push(`${e.target === 'hero' ? '你的' : e.target === 'self' ? `${actorName ?? '带队者'}的` : npc(e.target) + '的'}${ATTR[e.attr]} ${sign(e.delta)}（有几率）`); break
      case 'gainCard': parts.push(`获得 ${card(e.cardId)}${(e.count ?? 1) > 1 ? `×${e.count}` : ''}`); break
      case 'gainRandom': parts.push(`随机物资×${e.count ?? 1}`); break
      case 'loseCard': parts.push(`失去 ${card(e.cardId)}${(e.count ?? 1) > 1 ? `×${e.count}` : ''}`); break
      case 'affection': parts.push(`${npc(e.npcId)} 好感 ${sign(e.delta)}`); break
      case 'loyalty': parts.push(`${e.target === 'all' ? '所有伙伴' : npc(e.target)}忠诚 ${sign(e.delta)}`); break
      case 'npcJoin': parts.push(`${npc(e.npcId)} 搬进基地`); break
      case 'npcLeave': parts.push(`${npc(e.npcId)} 离开`); break
      case 'recruitRandom': parts.push('有人想加入（去人物页决定）'); break
      case 'injure': parts.push(`${e.target === 'hero' ? '你' : e.target === 'self' ? (actorName ?? '带队者') : npc(e.target)}受伤`); break
      case 'kill': parts.push(`${e.target === 'hero' ? '你' : npc(e.target)}死亡`); break
      case 'employment': parts.push(e.value ? '恢复工作' : '失业'); break
      case 'resolveCrisis': parts.push('本月危机已解决'); break
      case 'revealCrisis': parts.push('看穿危机档位'); break
      case 'unlockEvent': parts.push('解锁后续剧情'); break
      case 'relation': parts.push(`${ci.factions.get(e.factionId)?.name.zh ?? e.factionId} 关系 ${sign(e.delta)}`); break
      case 'moveBase': parts.push(`搬到${ci.bases.get(e.baseType)?.name.zh ?? e.baseType}`); break
      case 'buildModule': parts.push(`建成 ${ci.modules.get(e.moduleId)?.name.zh ?? e.moduleId}`); break
      case 'damageModule': parts.push('模块损毁'); break
      case 'powerUp': parts.push('异能提升'); break
      case 'adoptPet': parts.push(`收养 ${ci.pets.get(e.petId)?.name.zh ?? e.petId}`); break
      case 'losePet': parts.push('失去宠物'); break
      case 'rebirthPoints': parts.push(`重生点 +${e.delta}`); break
      case 'energy': parts.push(e.permanent ? `精力上限 ${sign(e.delta)}` : `精力 ${sign(e.delta)}`); break
      case 'status': { const d = ci.statuses.get(e.id); parts.push(`状态「${d?.name.zh ?? e.id}」${e.weeks ?? d?.defaultWeeks ?? ''} 周`); break }
      case 'killRandomCompanion': parts.push('一名伙伴死亡'); break
      case 'ending': parts.push('触发结局'); break
      default: break
    }
  }
  return parts.join('、')
}
