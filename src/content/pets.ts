import type { PetDef } from '../engine/types'

export const pets: PetDef[] = [
  { id: 'pet_dog', species: 'dog', name: { zh: '狗' }, desc: { zh: '尸潮来之前会叫。守夜时 +1 骰。' }, icon: '🐕', rarity: 'fine', weeklyFood: 1,
    effects: [{ type: 'revealCrisis', monthsAhead: 0 }] },
  { id: 'pet_cat', species: 'cat', name: { zh: '猫' }, desc: { zh: '搜刮时更容易发现藏起来的东西，仓库不闹老鼠。' }, icon: '🐈', rarity: 'fine', weeklyFood: 1,
    effects: [] },
]
