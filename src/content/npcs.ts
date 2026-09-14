import type { NpcDef } from '../engine/types'

/** 男主 5 位（先做顾沉 / 沈砚 / 谢临）+ 反派 + 固定 NPC。 */
export const npcs: NpcDef[] = [
  {
    id: 'guchen', name: { zh: '顾沉' }, title: { zh: '军区基地长' }, icon: '⚡', rarity: 'legendary',
    bio: { zh: '前世第 2 年为护送平民战死。序章去军区门口示警，他不会信你。' },
    romanceable: true, attrs: { strength: 5, mind: 3, charm: 2 }, needs: 'medicine',
    powerId: 'power_lightning', skillCardIds: ['skill_guchen_thunder'], initialAffection: 0, factionId: 'army',
    care: [
      { text: { zh: '一个兵送来一箱压缩饼干，纸条上只有两个字："吃饭。"' }, cardId: 'supply_compressed_biscuit' },
      { text: { zh: '对讲机里他的声音很短："东门今晚有尸群，别出门。"' }, cardId: 'intel_army_radio' },
      { text: { zh: '他路过时把自己的头盔留在了你门口。' }, cardId: 'equip_helmet' },
    ],
  },
  {
    id: 'shenyan', name: { zh: '沈砚' }, title: { zh: '天才医生' }, icon: '🩺', rarity: 'legendary',
    bio: { zh: '前世研究疫苗到一半病死。他需要 5 种材料，其中一种是丧尸王的血。' },
    romanceable: true, attrs: { strength: 1, mind: 5, charm: 3 }, needs: 'energy',
    powerId: 'power_heal', skillCardIds: ['skill_shenyan_heal'], initialAffection: 0,
    care: [
      { text: { zh: '他留下一个急救箱，里面每样东西都贴了用法。' }, cardId: 'supply_medkit' },
      { text: { zh: '"你上次咳嗽了。"他把一板药塞给你就走了。' }, cardId: 'supply_antibiotics' },
      { text: { zh: '他熬了一夜，把净水片分了你一半。' }, cardId: 'supply_water_tablets' },
    ],
  },
  {
    id: 'xielin', name: { zh: '谢临' }, title: { zh: '同为重生者' }, icon: '⏳', rarity: 'legendary',
    bio: { zh: '前世的"末世之主"，活到第 8 年。他知道的比你多，你的死和他有关。' },
    romanceable: true, attrs: { strength: 3, mind: 5, charm: 4 }, needs: 'material',
    powerId: 'power_time', skillCardIds: ['skill_xielin_slow'], initialAffection: 0,
    care: [
      { text: { zh: '门缝里塞进来一张便条："下个月比你记得的更糟。"' }, cardId: 'intel_xielin_note' },
      { text: { zh: '"上一世你这个月缺这个。"他放下一桶汽油。' }, cardId: 'supply_gasoline' },
      { text: { zh: '他把两世攒的晶核分了你一颗。' }, cardId: 'core_fine' },
    ],
  },
  {
    id: 'jiangye', name: { zh: '江野' }, title: { zh: '青梅竹马 / 佣兵团长' }, icon: '🔥', rarity: 'rare',
    bio: { zh: '前世替你挡了致命一击。序章第 1 周就能找到他，他无条件信你。第 2 年觉醒火系。' },
    romanceable: true, attrs: { strength: 5, mind: 2, charm: 3 }, needs: 'weapon',
    skillCardIds: ['skill_jiangye_guard'], initialAffection: 40,
    care: [
      { text: { zh: '他修好了你的弩，顺手多做了一捆箭。' }, cardId: 'supply_bolts' },
      { text: { zh: '"给你的。"一把新磨的斧子，木柄上刻了你名字的首字母。' }, cardId: 'equip_axe' },
      { text: { zh: '他带队回来，把最好的那箱罐头留给了你。' }, cardId: 'supply_canned' },
    ],
  },
  {
    id: 'aji', name: { zh: '阿寂' }, title: { zh: '丧尸王' }, icon: '🧟', rarity: 'legendary',
    bio: { zh: '不会腐烂的男人。前世杀死你的尸潮由他驱动，他不记得。第 1 年末出场。' },
    romanceable: true, attrs: { strength: 6, mind: 2, charm: 2 }, needs: 'daily',
    powerId: 'power_mind', skillCardIds: ['skill_aji_command'], initialAffection: 0,
    care: [
      { text: { zh: '门口放着一颗晶核。周围的丧尸一夜没靠近。' }, cardId: 'core_rare' },
    ],
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
    bio: { zh: '话不多，手很稳。一开始就住在你家。你没法告诉他真相，但他会信你。' },
    romanceable: false, attrs: { strength: 3, mind: 2, charm: 2 }, needs: 'medicine',
    skillCardIds: [], initialAffection: 60,
  },
  {
    id: 'mom', name: { zh: '妈妈' }, title: { zh: '退休会计' }, icon: '👩', rarity: 'fine',
    bio: { zh: '精打细算，一开始就住在你家。末日后她管仓库比你管得好。' },
    romanceable: false, attrs: { strength: 1, mind: 3, charm: 3 }, needs: 'daily',
    skillCardIds: [], initialAffection: 60,
  },
  {
    id: 'xiaoyu', name: { zh: '小鱼' }, title: { zh: '加油站便利店店长' }, icon: '🏪', rarity: 'fine',
    bio: { zh: '嘴甜，掌握全城货源八卦，什么都能换。' },
    romanceable: false, attrs: { strength: 1, mind: 2, charm: 4 }, needs: 'weapon',
    skillCardIds: [], initialAffection: 10,
  },
  {
    id: 'auntwang', name: { zh: '王阿姨' }, title: { zh: '楼长' }, icon: '👵', rarity: 'common',
    bio: { zh: '小区里什么都管，也什么都知道。' },
    romanceable: false, attrs: { strength: 1, mind: 2, charm: 3 }, needs: 'daily',
    skillCardIds: [], initialAffection: 20,
  },
]
