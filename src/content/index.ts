import type { ContentPack } from '../engine/types'
import { locations } from './locations'
import { npcs } from './npcs'
import { memoriesYear1 } from './memories'
import { cards } from './cards'
import { events } from './events'
import { bases, modules } from './bases'
import { factions } from './factions'
import { pets } from './pets'
import { powers } from './powers'
import { endings } from './endings'
import { survivorTraits, survivorNames } from './survivors'
import { lootTables, affixes } from './loot'

/** 当前内容包。空数组的部分按 docs/tasks 逐步填。 */
export const content: ContentPack = {
  locations,
  events,
  cards,
  affixes,
  lootTables,
  npcs,
  survivorTraits,
  survivorNames,
  powers,
  pets,
  bases,
  modules,
  factions,
  memories: memoriesYear1,
  endings,
  rebirthShop: [
    { id: 'shop_weeks', name: { zh: '更早醒来' }, desc: { zh: '序章 +4 周，最多到 48 周。' }, cost: [10, 20, 40, 80, 120, 160, 200, 250, 300, 350, 400], effect: { type: 'prologueWeeks', delta: 4 } },
    { id: 'shop_money', name: { zh: '一笔意外之财' }, desc: { zh: '开局 +5 万。' }, cost: [10, 20, 40, 80], effect: { type: 'money', delta: 50000 } },
    { id: 'shop_space', name: { zh: '更大的空间' }, desc: { zh: '空间起始档 +1。' }, cost: [60, 200], effect: { type: 'spaceRarity', rarity: 'fine' } },
    { id: 'shop_attr', name: { zh: '前世的本事' }, desc: { zh: '+1 属性点。' }, cost: [15, 30, 60, 120], effect: { type: 'attrPoint', count: 1 } },
    { id: 'shop_affection', name: { zh: '他好像记得你' }, desc: { zh: '选一位男主，初始好感 +20。' }, cost: [30, 60, 120], effect: { type: 'affection', delta: 20 } },
    { id: 'shop_dog', name: { zh: '它先找到了你' }, desc: { zh: '开局带一条狗。' }, cost: [20], effect: { type: 'pet', species: 'dog' } },
    { id: 'shop_keep', name: { zh: '带过去' }, desc: { zh: '一件装备跟你重生。' }, cost: [300], effect: { type: 'keepEquipment' } },
  ],
}
