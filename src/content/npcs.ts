import type { NpcDef } from '../engine/types'

/** 男主 5 位（先做顾沉 / 沈砚 / 谢临）+ 反派 + 固定 NPC。 */
export const npcs: NpcDef[] = [
  {
    id: 'guchen', name: { zh: '顾沉' }, title: { zh: '军区基地长' }, icon: '⚡', rarity: 'legendary',
    bio: { zh: '前世第 2 年为护送平民战死。序章去军区门口示警，他不会信你。' },
    romanceable: true, attrs: { strength: 5, mind: 3, charm: 2 }, needs: 'medicine',
    powerId: 'power_lightning', skillCardIds: ['skill_guchen_thunder'], initialAffection: 0, factionId: 'army',
  },
  {
    id: 'shenyan', name: { zh: '沈砚' }, title: { zh: '天才医生' }, icon: '🩺', rarity: 'legendary',
    bio: { zh: '前世研究疫苗到一半病死。他需要 5 种材料，其中一种是丧尸王的血。' },
    romanceable: true, attrs: { strength: 1, mind: 5, charm: 3 }, needs: 'energy',
    powerId: 'power_heal', skillCardIds: ['skill_shenyan_heal'], initialAffection: 0,
  },
  {
    id: 'xielin', name: { zh: '谢临' }, title: { zh: '同为重生者' }, icon: '⏳', rarity: 'legendary',
    bio: { zh: '前世的"末世之主"，活到第 8 年。他知道的比你多，你的死和他有关。' },
    romanceable: true, attrs: { strength: 3, mind: 5, charm: 4 }, needs: 'material',
    powerId: 'power_time', skillCardIds: ['skill_xielin_slow'], initialAffection: 0,
  },
  {
    id: 'jiangye', name: { zh: '江野' }, title: { zh: '青梅竹马 / 佣兵团长' }, icon: '🔥', rarity: 'rare',
    bio: { zh: '前世替你挡了致命一击。序章第 1 周就能找到他，他无条件信你。第 2 年觉醒火系。' },
    romanceable: true, attrs: { strength: 5, mind: 2, charm: 3 }, needs: 'weapon',
    skillCardIds: ['skill_jiangye_guard'], initialAffection: 40,
  },
  {
    id: 'aji', name: { zh: '阿寂' }, title: { zh: '丧尸王' }, icon: '🧟', rarity: 'legendary',
    bio: { zh: '不会腐烂的男人。前世杀死你的尸潮由他驱动，他不记得。第 1 年末出场。' },
    romanceable: true, attrs: { strength: 6, mind: 2, charm: 2 }, needs: 'daily',
    powerId: 'power_mind', skillCardIds: ['skill_aji_command'], initialAffection: 0,
  },
  {
    id: 'zhoumingyu', name: { zh: '周明宇' }, title: { zh: '前世渣男 / 黑鸦头目' }, icon: '🐦‍⬛', rarity: 'rare',
    bio: { zh: '前世把你的物资骗光。这一世带着匪帮回来了。' },
    romanceable: false, attrs: { strength: 3, mind: 3, charm: 4 }, needs: 'weapon',
    skillCardIds: [], initialAffection: 0, factionId: 'crow',
  },
  {
    id: 'suyuan', name: { zh: '苏媛' }, title: { zh: '前世闺蜜' }, icon: '🌸', rarity: 'fine',
    bio: { zh: '白莲花。混进了军区。' },
    romanceable: false, attrs: { strength: 1, mind: 3, charm: 5 }, needs: 'daily',
    skillCardIds: [], initialAffection: 30, factionId: 'army',
  },
  {
    id: 'dad', name: { zh: '爸爸' }, title: { zh: '退休工人' }, icon: '👨', rarity: 'fine',
    bio: { zh: '话不多，手很稳。你没法告诉他真相，但他会信你。' },
    romanceable: false, attrs: { strength: 3, mind: 2, charm: 2 }, needs: 'medicine',
    skillCardIds: [], initialAffection: 60,
  },
  {
    id: 'mom', name: { zh: '妈妈' }, title: { zh: '退休会计' }, icon: '👩', rarity: 'fine',
    bio: { zh: '精打细算。末日后她管仓库比你管得好。' },
    romanceable: false, attrs: { strength: 1, mind: 3, charm: 3 }, needs: 'daily',
    skillCardIds: [], initialAffection: 60,
  },
  {
    id: 'auntwang', name: { zh: '王阿姨' }, title: { zh: '楼长' }, icon: '👵', rarity: 'common',
    bio: { zh: '小区里什么都管，也什么都知道。' },
    romanceable: false, attrs: { strength: 1, mind: 2, charm: 3 }, needs: 'daily',
    skillCardIds: [], initialAffection: 20,
  },
]
