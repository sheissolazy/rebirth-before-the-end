import type { SlotDef, SupplyKind } from '../../engine/types'

/** 常用槽位 */
export const HERO: SlotDef = { id: 'hero', label: { zh: '你' }, required: true, accepts: { kind: 'hero' } }
export const HELPER: SlotDef = { id: 'helper', label: { zh: '带个人' }, required: false, accepts: { kind: 'companion' } }
export const LEAD = (npcId: string, label = '他'): SlotDef => ({ id: 'lead', label: { zh: label }, required: false, accepts: { kind: 'npc', npcId } })
export const WEAPON: SlotDef = { id: 'weapon', label: { zh: '带件武器' }, required: false, accepts: { kind: 'equipment', slot: 'weapon' }, bonusDice: 1 }
export const GIFT = (supplyKind: SupplyKind, label = '带点东西'): SlotDef =>
  ({ id: 'gift', label: { zh: label }, required: false, accepts: { kind: 'supply', supplyKind }, consumes: true, bonusDice: 2 })
export const DOG: SlotDef = { id: 'dog', label: { zh: '带狗' }, required: false, accepts: { kind: 'pet', species: 'dog' }, bonusDice: 1 }
export const CAT: SlotDef = { id: 'cat', label: { zh: '带猫' }, required: false, accepts: { kind: 'pet', species: 'cat' }, bonusDice: 1 }
