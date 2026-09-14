import type { LocationDef } from '../engine/types'

export const locations: LocationDef[] = [
  { id: 'home', name: { zh: '家' }, desc: { zh: '两室一厅的出租屋。你的堡垒，也是你的仓库。' }, icon: '🏠', pos: { x: 50, y: 55 } },
  { id: 'office', name: { zh: '公司' }, desc: { zh: '还在正常上班的地方。每周去一次能领薪水。' }, icon: '🏢', pos: { x: 22, y: 25 } },
  { id: 'supermarket', name: { zh: '超市' }, desc: { zh: '大型连锁超市。前夜阶段最主要的补给来源。' }, icon: '🛒', pos: { x: 70, y: 30 } },
  { id: 'pharmacy', name: { zh: '药店' }, desc: { zh: '社区药店。药品有限购。' }, icon: '💊', pos: { x: 82, y: 50 } },
  { id: 'hardware', name: { zh: '五金/户外店' }, desc: { zh: '发电机、炉子、绳索、工具。' }, icon: '🔧', pos: { x: 35, y: 70 } },
  { id: 'fleamarket', name: { zh: '二手市场' }, desc: { zh: '什么都有，什么都要砍价。以物易物的雏形。' }, icon: '🧺', pos: { x: 15, y: 55 } },
  { id: 'groupchat', name: { zh: '小区群' }, desc: { zh: '线上。八卦、互助、抢团购。' }, icon: '📱', pos: { x: 55, y: 82 } },
  { id: 'courier', name: { zh: '快递站' }, desc: { zh: '网购的最后一公里。后期会先断。' }, icon: '📦', pos: { x: 75, y: 72 } },
  { id: 'hospital', name: { zh: '医院' }, desc: { zh: '林晚舟工作的地方。' }, icon: '🏥', pos: { x: 90, y: 20 } },
  { id: 'farm', name: { zh: '郊区农场' }, desc: { zh: '开车一小时。粮食、种子、可能的退路。' }, icon: '🌾', pos: { x: 10, y: 15 } },
]
