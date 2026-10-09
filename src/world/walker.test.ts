import { describe, expect, it } from 'vitest'
import { Walker } from './walker'

describe('转身', () => {
  it('两个人叠在一起（方向是噪声）时不转身，不会原地打转', () => {
    const w = new Walker()
    w.root.rotation.y = 0.5
    let total = 0
    let prev = w.root.rotation.y
    for (let i = 0; i < 120; i++) {
      // 对方就在脚下，每帧的方向都是乱的
      w.face(Math.sin(i * 7.3) * 0.05, Math.cos(i * 3.1) * 0.05, 1 / 60)
      total += Math.abs(w.root.rotation.y - prev)
      prev = w.root.rotation.y
    }
    expect(total).toBe(0)
  })

  it('转身有最快速度，掉头也要一会儿；角度不会越转越大', () => {
    const w = new Walker()
    w.face(0, -1, 1 / 60)
    expect(Math.abs(w.root.rotation.y)).toBeLessThanOrEqual(9 / 60 + 1e-9)
    for (let i = 0; i < 600; i++) w.face(Math.sin(i * 0.05), Math.cos(i * 0.05), 1 / 60)
    expect(Math.abs(w.root.rotation.y)).toBeLessThanOrEqual(Math.PI)
  })
})
