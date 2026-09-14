import type { Effect } from '../engine/types'
import { t, lt } from '../i18n'
import { cardDefs, npcDefs, moduleDefs, petDefs } from './lookup'
import { content } from '../content'

const STAT: Record<string, string> = { health: '健康', exposure: '暴露', butterfly: '蝴蝶效应' }

/** 把效果列表翻译成玩家能读的一句话 */
export function describeEffects(effects: Effect[]): string {
  const parts: string[] = []
  const npc = (id: string) => lt(npcDefs.get(id)?.name ?? { zh: id })
  for (const e of effects) {
    switch (e.type) {
      case 'money': parts.push(`钱 ${e.delta > 0 ? '+' : ''}${e.delta.toLocaleString()}`); break
      case 'stat': parts.push(`${STAT[e.stat] ?? e.stat} ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'attr': parts.push(`${e.target === 'hero' ? '你的' : e.target === 'self' ? '带队者的' : npc(e.target) + '的'}${t(`attr.${e.attr}`)} ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'gainCard': parts.push(`获得 ${lt(cardDefs.get(e.cardId)?.name ?? { zh: e.cardId })}${(e.count ?? 1) > 1 ? `×${e.count}` : ''}`); break
      case 'gainRandom': parts.push(`随机物资 ×${e.count ?? 1}`); break
      case 'loseCard': parts.push(`失去 ${lt(cardDefs.get(e.cardId)?.name ?? { zh: e.cardId })}${(e.count ?? 1) > 1 ? `×${e.count}` : ''}`); break
      case 'affection': parts.push(`${npc(e.npcId)} 好感 ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'loyalty': parts.push(`${e.target === 'all' ? '所有伙伴' : '伙伴'}忠诚 ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'npcJoin': parts.push(`${npc(e.npcId)} 搬进基地`); break
      case 'npcLeave': parts.push(`${npc(e.npcId)} 离开`); break
      case 'recruitRandom': parts.push('一名幸存者加入'); break
      case 'injure': parts.push(`${e.target === 'hero' ? '你' : e.target === 'self' ? '带队者' : npc(e.target)}受伤（${['', '轻', '中', '重'][e.severity]}）`); break
      case 'kill': parts.push(`${e.target === 'hero' ? '你' : npc(e.target)}死亡`); break
      case 'setFlag': break
      case 'employment': parts.push(e.value ? '恢复工作' : '失业'); break
      case 'resolveCrisis': parts.push('本月危机已解决'); break
      case 'revealCrisis': parts.push(e.monthsAhead === 0 ? '看穿本月危机档位' : `看穿 ${e.monthsAhead} 个月后的危机档位`); break
      case 'unlockEvent': parts.push('解锁后续剧情'); break
      case 'relation': parts.push(`${lt(content.factions.find((f) => f.id === e.factionId)?.name ?? { zh: e.factionId })} 关系 ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'moveBase': parts.push(`搬到${lt(content.bases.find((b) => b.type === e.baseType)?.name ?? { zh: e.baseType })}`); break
      case 'buildModule': parts.push(`建成 ${lt(moduleDefs.get(e.moduleId)?.name ?? { zh: e.moduleId })}`); break
      case 'damageModule': parts.push(e.moduleId ? `${lt(moduleDefs.get(e.moduleId)?.name ?? { zh: e.moduleId })} 损毁` : '一个模块损毁'); break
      case 'powerUp': parts.push('异能提升'); break
      case 'adoptPet': parts.push(`收养 ${lt(petDefs.get(e.petId)?.name ?? { zh: e.petId })}`); break
      case 'losePet': parts.push('失去宠物'); break
      case 'rebirthPoints': parts.push(`重生点 +${e.delta}`); break
      case 'energy': parts.push(e.permanent ? `精力上限 ${e.delta > 0 ? '+' : ''}${e.delta}` : `精力 ${e.delta > 0 ? '+' : ''}${e.delta}`); break
      case 'status': { const d = content.statuses.find((x) => x.id === e.id); parts.push(`状态「${d ? lt(d.name) : e.id}」${e.weeks ?? d?.defaultWeeks ?? ''} 周`); break }
      case 'killRandomCompanion': parts.push('一名伙伴死亡'); break
      case 'ending': parts.push('触发结局'); break
    }
  }
  return parts.join('、')
}
