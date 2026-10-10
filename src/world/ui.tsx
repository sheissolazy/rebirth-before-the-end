/** 全套界面共用的"深色纸面"风格（参考《这是我的战争》）：颗粒、宋体标题、暖色字 */

/** 纸面颗粒感：一张很小的 SVG 噪点图 */
export const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>")`
export const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", serif'
/** 深色纸面面板 */
export const PANEL = 'relative overflow-hidden rounded-lg bg-[#1d1915]/90 text-[#efe4d0] shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-[#e8c98a]/25'
/** 深色小按钮（右上角、楼层、调试） */
export const CHIP = 'rounded-md bg-[#1d1915]/85 text-[#efe4d0] ring-1 ring-[#e8c98a]/25 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition hover:bg-[#2a241e]/90 hover:ring-[#e8c98a]/50'
/** 金色主按钮 / 暗红按钮 */
export const BTN_GOLD = 'rounded-md bg-[#e8c98a] font-semibold text-[#1d1915] shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition hover:bg-[#f1d8a3] disabled:opacity-40'
export const BTN_RED = 'rounded-md bg-[#7c2d24] font-semibold text-[#f4ecdc] ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition hover:bg-[#93372c] disabled:opacity-40'

export function Grain({ opacity = 0.35 }: { opacity?: number }) {
  return <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity }} />
}

/** 全游戏统一的状态颜色：红 = 不好、黄 = 一般、绿 = 好（人物的需求、存货够几天、防线、菜地……都用这一套） */
export const TONE = { bad: '#e2553f', warn: '#e3b341', good: '#7cc35f' } as const
export type Tone = keyof typeof TONE
/** 0–100 的数值：低于 bad 是红、低于 warn 是黄、其余绿 */
export function toneOf(v: number, bad = 30, warn = 60): Tone {
  return v < bad ? 'bad' : v < warn ? 'warn' : 'good'
}
