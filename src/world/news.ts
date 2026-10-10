// 电视：末日前是新闻频道（每天一条头条、物价、天气），末日后停了电，有发电机才收得到应急广播——
// 广播里说下一个大夜是什么、新出现了哪种丧尸、天气（暴雨、高温、寒潮）。女主是重生的，新闻里"专家辟谣"的事她心里有数。
import type { CrisisKind } from '../engine/types'
import { DAYS_PER_MONTH, PROLOGUE_DAYS } from './life'
import { rainOf } from './weather'

export type NewsTone = 'bad' | 'warn' | 'ok'
export interface NewsLine { icon: string; text: string; tone?: NewsTone }
export interface NewsView {
  /** tv = 新闻频道；radio = 应急广播；off = 停电了 */
  mode: 'tv' | 'radio' | 'off'
  channel: string
  date: string
  headline: string
  /** 女主心里想的（重生的人知道后面会怎样） */
  thought?: string
  lines: NewsLine[]
}

export interface NewsCtx {
  day: number
  hour: number
  /** 有没有电（末日前有；末日后要发电机、还得有油） */
  powered: boolean
  /** 下一个月底大夜是第几天、是哪一种 */
  crisisDay: number
  crisisKind: CrisisKind | null
  /** 今晚会来几只（末日后） */
  tonight: number
  /** 家里有没有空调、发电机（预报高温、寒潮时提一句） */
  aircon: boolean
  generator: boolean
}

/** 末日前四天的头条（第 0 天到第 3 天），越来越不对劲 */
const PROLOGUE_NEWS: { headline: string; thought: string }[] = [
  { headline: '海外多地出现"狂躁症"病例，患者攻击性强。卫生组织：传染性低，民众不必恐慌。', thought: '前世我也是这么以为的。还有四天。' },
  { headline: '本市第一人民医院收治多名咬人患者，警方已介入。商务部门：米面油货源充足，请勿囤积。', thought: '"货源充足"——三天后超市就空了。' },
  { headline: '多国宣布进入紧急状态。本市暂停大型活动，部分航班取消。米面价格一天涨了两成。', thought: '能买的今天一定要买完，明天快递就停了。' },
  { headline: '市政府通告：明日起全市停工停课，市民非必要不外出，等待进一步通知。', thought: '明天就是末日了。' },
]

/** 末日后应急广播：按这个月月底是哪种大夜说 */
const BROADCAST: Record<CrisisKind, string> = {
  horde: '尸群正在向城区移动，月底前后可能出现大规模尸潮。请加固门窗，夜间不要开灯。',
  scarcity: '物资配给中断。请节约饮水、看好自家物资，警惕成群结队上门抢粮的人。',
  human: '有武装团伙冒充救援人员入户抢劫。没有确认身份，不要开门。',
  climate: '气象部门预警：月底有特大暴雨，低洼房屋注意防水，一楼的物资尽量往高处搬。',
  plague: '持续高温，尸体腐烂加快，传染病开始流行。注意饮水卫生，出现发热及时隔离。',
}
/** 第几个月第一次出现的丧尸（跟 Siege.pickKind 一致） */
const NEW_KINDS: Record<number, string> = {
  1: '有幸存者报告：出现会快速奔跑的感染者，铁门要加固，别在院子里逗留。',
  2: '注意：一种会喷吐腐蚀液体的感染者，隔着门也能伤人，请远离门缝。',
  3: '警告：一种体型肿胀的感染者被击毙后会爆炸，请远距离射击，别让它贴到门上。',
}

const KIND_NAME: Record<CrisisKind, string> = { horde: '尸潮', scarcity: '抢粮的人', human: '黑鸦扫荡', climate: '暴雨', plague: '疫病' }

function rainLine(day: number, label: string): NewsLine {
  const r = rainOf(day)
  if (!r) return { icon: '☀️', text: `${label}：晴。` }
  const when = r.start < 11 ? '上午' : r.start < 14 ? '中午' : r.start < 18 ? '下午' : '傍晚'
  return { icon: r.heavy ? '⛈️' : '🌧️', text: `${label}${when}有${r.heavy ? '大' : '小'}雨（院子里的木桶能接雨水）。`, tone: 'ok' }
}

export function buildNews(c: NewsCtx): NewsView {
  const prologue = c.day < PROLOGUE_DAYS
  if (prologue) {
    const n = PROLOGUE_NEWS[Math.max(0, Math.min(PROLOGUE_NEWS.length - 1, c.day))]
    const left = PROLOGUE_DAYS - c.day
    const lines: NewsLine[] = []
    // 物价：明天还要涨多少（跟商店的涨价一致：1 → 1.1 → 1.3 → 1.6）
    const k = [1, 1.1, 1.3, 1.6]
    if (c.day < 3) lines.push({ icon: '📈', text: `物价：明天米面、饮用水还要再涨 ${Math.round((k[c.day + 1] / k[c.day] - 1) * 100)}%。`, tone: 'warn' })
    else lines.push({ icon: '🛒', text: '超市、药店今天是最后一天开门。', tone: 'bad' })
    if (c.day <= PROLOGUE_DAYS - 2) lines.push({ icon: '📦', text: c.day === PROLOGUE_DAYS - 2 ? '快递：今天是最后一天能下单，明天全面停运。' : '快递：网购照常，第二天上午送到。', tone: c.day === PROLOGUE_DAYS - 2 ? 'warn' : undefined })
    lines.push(rainLine(c.day + 1, '明天'))
    return { mode: 'tv', channel: '本市新闻频道', date: `末日前 ${left} 天`, headline: n.headline, thought: n.thought, lines }
  }
  const d = c.day - PROLOGUE_DAYS
  const month = Math.floor(d / DAYS_PER_MONTH)
  const date = `末日第 ${month + 1} 月 · 第 ${(d % DAYS_PER_MONTH) + 1} 天`
  if (!c.powered) {
    return {
      mode: 'off', channel: '', date,
      headline: c.generator ? '发电机没油了，电视黑着。' : '停电了，电视黑着。',
      thought: c.generator ? '灌点汽油进去，就能接着听应急广播。' : '家里要有一台发电机，才收得到应急广播。',
      lines: [],
    }
  }
  const lines: NewsLine[] = []
  const inDays = c.crisisDay - c.day
  if (c.crisisKind) {
    lines.push({ icon: '📅', text: inDays <= 0 ? `今晚就是月底大夜：${KIND_NAME[c.crisisKind]}。` : `下一个大夜在 ${inDays} 天后：${KIND_NAME[c.crisisKind]}。`, tone: inDays <= 1 ? 'bad' : 'warn' })
  }
  if (c.tonight > 0 && inDays > 0) {
    const size = c.tonight <= 3 ? '零星几只' : c.tonight <= 6 ? '一小群' : '一大群'
    lines.push({ icon: '🧟', text: `今晚附近街区：${size}感染者游荡。`, tone: c.tonight <= 3 ? 'ok' : 'warn' })
  }
  // 极端天气：第 7 个月高温、第 11～12 个月寒潮（跟前世记忆一致）
  const m = month % 12
  if (m === 6) lines.push({ icon: '🌡️', text: `高温预警：白天超过 40 度。${c.aircon ? '家里有空调，记得开发电机。' : '没有空调的话，中午别干重活。'}`, tone: 'bad' })
  if (m === 10 || m === 11) lines.push({ icon: '❄️', text: `寒潮预警：夜里零下二十度。${c.generator ? '火炉烧旺，发电机加满油。' : '多囤燃料和棉被，火炉不能断。'}`, tone: 'bad' })
  // 提前一个月：气象台的长期预报
  if (m === 5) lines.push({ icon: '🌡️', text: '长期预报：下个月起持续高温，最高四十度以上。', tone: 'warn' })
  if (m === 9) lines.push({ icon: '❄️', text: '长期预报：下个月起强冷空气南下，随后是罕见的极寒。', tone: 'warn' })
  lines.push(rainLine(c.day + 1, '明天'))
  // 这个月新出现了哪种丧尸就先说这个；大夜前一天起改说大夜
  const headline = c.crisisKind && inDays <= 1 ? BROADCAST[c.crisisKind] : (NEW_KINDS[month] ?? BROADCAST[c.crisisKind ?? 'horde'])
  return { mode: 'radio', channel: '市应急广播', date, headline, lines }
}
