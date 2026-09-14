import type { NpcDef } from '../engine/types'

/** 第 1 年先做前三位（阿哲 / 林晚舟 / 老K），后两位定义好但事件暂缺。 */
export const npcs: NpcDef[] = [
  {
    id: 'azhe', name: { zh: '阿哲' }, title: { zh: '隔壁程序员' }, icon: '👨‍💻',
    bio: { zh: '社恐，末日了还在远程上班。其实什么都看在眼里。' },
    romanceable: true, attrs: { strength: 1, craft: 2, mind: 4, charm: 1 },
    needs: 'food', skillCardId: 'skill_azhe_intel', initialAffection: 10,
  },
  {
    id: 'lin', name: { zh: '林晚舟' }, title: { zh: '社区医生' }, icon: '🩺',
    bio: { zh: '温和克制，超负荷工作。不信你的"预言"，直到 8 月。' },
    romanceable: true, attrs: { strength: 2, craft: 3, mind: 3, charm: 2 },
    needs: 'energy', skillCardId: 'skill_lin_medic', initialAffection: 0,
  },
  {
    id: 'laok', name: { zh: '老K' }, title: { zh: '退伍军人 / 小区保安' }, icon: '🪖',
    bio: { zh: '话少，靠谱，有不能说的过去。' },
    romanceable: true, attrs: { strength: 4, craft: 2, mind: 2, charm: 1 },
    needs: 'medicine', skillCardId: 'skill_laok_guard', initialAffection: 5,
  },
  {
    id: 'xiaoyu', name: { zh: '小鱼' }, title: { zh: '便利店店长' }, icon: '🏪',
    bio: { zh: '嘴甜，掌握全城货源八卦，机会主义者。' },
    romanceable: true, attrs: { strength: 1, craft: 1, mind: 2, charm: 4 },
    needs: 'security', skillCardId: 'skill_xiaoyu_restock', initialAffection: 15,
  },
  {
    id: 'chenxu', name: { zh: '陈序' }, title: { zh: '网红主播' }, icon: '🎥',
    bio: { zh: '表面浮夸，实际最会组织人。' },
    romanceable: true, attrs: { strength: 2, craft: 1, mind: 3, charm: 4 },
    needs: 'water', skillCardId: 'skill_chenxu_rally', initialAffection: 0,
  },
  {
    id: 'auntwang', name: { zh: '王阿姨' }, title: { zh: '楼长' }, icon: '👵',
    bio: { zh: '小区里什么都管，也什么都知道。' },
    romanceable: false, attrs: { strength: 1, craft: 2, mind: 2, charm: 3 },
    needs: 'daily', initialAffection: 20,
  },
]
