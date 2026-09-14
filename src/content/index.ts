import type { ContentPack } from '../engine/types'
import { locations } from './locations'
import { npcs } from './npcs'
import { memoriesYear1 } from './memories'
import { sampleCards } from './cards.sample'
import { sampleEvents } from './events.sample'

/** 当前内容包。正式内容填好后把 sample 换成正式文件。 */
export const content: ContentPack = {
  locations,
  npcs,
  memories: memoriesYear1,
  cards: sampleCards,
  events: sampleEvents,
  endings: [],
}
