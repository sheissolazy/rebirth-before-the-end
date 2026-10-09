import { describe, expect, it } from 'vitest'
import { zh } from '../i18n/zh'
import src from './residents.ts?raw'

describe('人物卡上的"在干什么"', () => {
  it('每一种事都有"去做"和"在做"两句话（不会露出 world.go.xxx 这种字）', () => {
    const m = src.match(/export type TaskKind =([^\n]*\n[^\n]*)/)
    expect(m).not.toBeNull()
    const kinds = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1])
    expect(kinds.length).toBeGreaterThan(20)
    const keys = zh as Record<string, string>
    const missing = kinds.filter((k) => !keys[`world.go.${k}`] || !keys[`world.do.${k}`]).filter((k) => k !== 'walk' && k !== 'idle')
    expect(missing).toEqual([])
  })
})
