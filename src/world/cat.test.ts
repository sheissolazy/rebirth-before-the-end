import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { navFloors } from './nav'
import { Actor } from './residents'
import { Cat, type CatCtx } from './cat'

/** 一只不渲染的猫：节点名字和 Blender 导出的一样 */
function dummyCat() {
  const m = new THREE.Group()
  const body = new THREE.Group()
  body.name = 'body'
  body.position.y = 0.2
  m.add(body)
  for (const n of ['head', 'legFL', 'legFR', 'legBL', 'legBR', 'tail1']) {
    const o = new THREE.Group()
    o.name = n
    body.add(o)
  }
  return new Cat(m, { x: 1.3, z: 4.45, floor: 0 })
}

function ctx(hour: number, siege = false): CatCtx {
  const hero = new Actor('林知夏', '#d9534f', '#2b1d16', 1, { x: 3.2, z: 4.4 }, { hunger: 80, thirst: 80, energy: 80, mood: 60 })
  const mom = new Actor('妈妈', '#5aa469', '#3a2a20', 0.97, { x: 1.8, z: 4.2 }, { hunger: 80, thirst: 80, energy: 80, mood: 60 })
  return { navs: navFloors('paradise'), hero, family: [hero, mom], hour, siege }
}

describe('大橘', () => {
  it('白天到处走走、打盹、跟着人；夜里上二楼床边睡；打丧尸时躲到二楼', () => {
    const cat = dummyCat()
    const day = ctx(10)
    const plans = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      cat.update(0.1, day)
      plans.add(cat.plan)
    }
    expect(plans.size).toBeGreaterThanOrEqual(2)
    const night = ctx(23)
    for (let i = 0; i < 1500; i++) cat.update(0.1, night)
    expect(cat.plan).toBe('bed')
    expect(cat.floor).toBe(1)
    expect(cat.pose).toBe('loaf')
    const siege = ctx(21.5, true)
    for (let i = 0; i < 1500; i++) cat.update(0.1, siege)
    expect(cat.plan).toBe('hide')
    expect(cat.floor).toBe(1)
  })

  it('点一下：停下来坐着，冒心形泡泡', () => {
    const cat = dummyCat()
    cat.poke()
    cat.update(0.1, ctx(10))
    expect(cat.pose).toBe('sit')
    expect(cat.hearts).toBeGreaterThan(1)
  })
})
