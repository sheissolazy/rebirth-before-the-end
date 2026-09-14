import type { LocationDef } from '../engine/types'

export const locations: LocationDef[] = [
  // 序章
  { id: 'home', phase: 'both', inBase: true, name: { zh: '家 / 基地' }, desc: { zh: '你的堡垒。序章是出租屋，之后看你买什么。' }, icon: '🏠', pos: { x: 50, y: 55 } },
  { id: 'office', phase: 'prologue', name: { zh: '公司' }, desc: { zh: '还在正常上班。去一次领一周薪水。' }, icon: '🏢', pos: { x: 22, y: 25 } },
  { id: 'supermarket', phase: 'prologue', name: { zh: '超市' }, desc: { zh: '囤货主战场。' }, icon: '🛒', pos: { x: 70, y: 30 } },
  { id: 'pharmacy', phase: 'prologue', name: { zh: '药店' }, desc: { zh: '药品限购，得想办法。' }, icon: '💊', pos: { x: 82, y: 50 } },
  { id: 'hardware', phase: 'prologue', name: { zh: '五金 / 户外店' }, desc: { zh: '刀、弩、发电机、材料。' }, icon: '🔧', pos: { x: 35, y: 72 } },
  { id: 'blackmarket', phase: 'prologue', name: { zh: '黑市' }, desc: { zh: '有钱能买到枪。前提是你找得到门。' }, icon: '🕶️', pos: { x: 12, y: 60 } },
  { id: 'bank', phase: 'prologue', name: { zh: '银行 / 券商' }, desc: { zh: '贷款、炒股、卖房。' }, icon: '🏦', pos: { x: 60, y: 12 } },
  { id: 'armygate', phase: 'both', name: { zh: '军区门口' }, desc: { zh: '序章可以来示警。末日后是军区基地。' }, icon: '🪖', pos: { x: 90, y: 18 } },
  // 末日后
  { id: 'ruin_market', phase: 'apocalypse', name: { zh: '超市废墟' }, desc: { zh: '被抢过，但没抢干净。' }, icon: '🏚️', pos: { x: 70, y: 30 }, encounter: { zombie: 40, survivor: 20, faction: 10 } },
  { id: 'hospital', phase: 'apocalypse', name: { zh: '医院' }, desc: { zh: '药，和很多不再动的人。' }, icon: '🏥', pos: { x: 82, y: 50 }, encounter: { zombie: 60, survivor: 10, faction: 5 } },
  { id: 'armory', phase: 'apocalypse', name: { zh: '军械库' }, desc: { zh: '军区撤走时没搬完。' }, icon: '🔫', pos: { x: 25, y: 20 }, encounter: { zombie: 50, survivor: 10, faction: 30 } },
  { id: 'apartments', phase: 'apocalypse', name: { zh: '居民楼' }, desc: { zh: '一户一户翻。' }, icon: '🏘️', pos: { x: 35, y: 72 }, encounter: { zombie: 45, survivor: 35, faction: 5 } },
  { id: 'factory', phase: 'apocalypse', name: { zh: '工厂' }, desc: { zh: '钢材、零件、柴油。' }, icon: '🏭', pos: { x: 15, y: 45 }, encounter: { zombie: 35, survivor: 15, faction: 20 } },
  { id: 'gasstation', phase: 'apocalypse', name: { zh: '加油站' }, desc: { zh: '油。谁都想要。' }, icon: '⛽', pos: { x: 60, y: 82 }, encounter: { zombie: 30, survivor: 20, faction: 40 } },
  { id: 'farm', phase: 'apocalypse', name: { zh: '郊区农场' }, desc: { zh: '种子、牲畜、可能的退路。' }, icon: '🌾', pos: { x: 10, y: 15 }, encounter: { zombie: 20, survivor: 30, faction: 15 } },
  { id: 'crow_turf', phase: 'apocalypse', name: { zh: '黑鸦地盘' }, desc: { zh: '周明宇的匪帮。别一个人来。' }, icon: '🐦‍⬛', pos: { x: 45, y: 90 }, encounter: { zombie: 10, survivor: 10, faction: 80 } },
]
