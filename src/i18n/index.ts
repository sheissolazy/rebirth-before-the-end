/**
 * i18n：UI 字符串走这里；游戏内容文案走 LocalizedText。
 * 现在只有 zh，之后加 en 只需要加一个字典文件并在 setLocale 切换。
 */
import type { LocalizedText } from '../engine/types'
import { zh } from './zh'

export type Locale = 'zh' | 'en'
export type UiKey = keyof typeof zh

let current: Locale = 'zh'
const dicts: Record<Locale, Partial<Record<UiKey, string>>> = { zh, en: {} }

export function setLocale(l: Locale) { current = l }
export function getLocale(): Locale { return current }

/** UI 字符串 */
export function t(key: UiKey, vars?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? zh[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/** 内容文案 */
export function lt(text: LocalizedText): string {
  return (current === 'en' && text.en) || text.zh
}
