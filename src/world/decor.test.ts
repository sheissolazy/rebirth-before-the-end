import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { StockView } from './decor'
import { STORE_ROOM } from './layout'

describe('储藏室堆货', () => {
  it('存货很多时也不会越界（以前吃的超过 87 份会报错、整帧跳过）', () => {
    const v = new StockView(new THREE.Group(), STORE_ROOM)
    for (const food of [0, 12, 60, 87, 90, 200, 999]) expect(() => v.sync(food, food)).not.toThrow()
  })
})
