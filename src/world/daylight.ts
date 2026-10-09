// 一天里的光：太阳从东边升起、中午偏南、傍晚从西边落下；晚上换成冷色的月光，屋里和路灯亮起来。
// 纯数据 + 插值，World 每帧调用 skyAt(hour) 再套到灯光上。
import * as THREE from 'three'
import { SUNRISE, SUNSET } from './life'

export interface StyleDay {
  sky: THREE.ColorRepresentation
  fog: THREE.ColorRepresentation
  sun: THREE.ColorRepresentation
}

export interface Sky {
  /** 主光的方向（从目标点指向光源，单位向量） */
  dir: THREE.Vector3
  color: THREE.Color
  /** 主光强度系数（乘画风的白天强度） */
  light: number
  /** 天光、环境光系数 */
  ambient: number
  sky: THREE.Color
  fog: THREE.Color
  /** 屋里灯、路灯亮度 0~1 */
  lamps: number
  /** 0 = 白天，1 = 深夜 */
  night: number
}

const MOON = { color: new THREE.Color('#8ea6dc'), light: 0.22, az: 35, elev: 55 }

type Stop = [hour: number, sky: string | null, fog: string | null]
// null = 用画风自己的白天颜色
const STOPS: Stop[] = [
  [0, '#0b1424', '#152033'],
  [4.8, '#101a2c', '#18233a'],
  [6, '#f0b48e', '#e9c2a4'],
  [7.5, '#dbe5e4', '#e4e7dc'],
  [12, null, null],
  [16.5, null, null],
  [18.2, '#f1c08f', '#ecd0ae'],
  [19.2, '#c97f73', '#b98b84'],
  [20.2, '#16203a', '#1b2438'],
  [24, '#0b1424', '#152033'],
]

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function dirFrom(azDeg: number, elevDeg: number): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azDeg)
  const el = THREE.MathUtils.degToRad(elevDeg)
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
}

export function skyAt(hour: number, day: StyleDay): Sky {
  const h = ((hour % 24) + 24) % 24
  const pick = (k: 1 | 2, s: Stop) => new THREE.Color(s[k] ?? (k === 1 ? day.sky : day.fog))
  let i = 0
  while (i < STOPS.length - 2 && STOPS[i + 1][0] <= h) i++
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const t = (h - a[0]) / (b[0] - a[0])
  const sky = pick(1, a).lerp(pick(1, b), t)
  const fog = pick(2, a).lerp(pick(2, b), t)

  const span = SUNSET - SUNRISE
  const up = h > SUNRISE && h < SUNSET
  let dir: THREE.Vector3
  let color: THREE.Color
  let light: number
  if (up) {
    const p = (h - SUNRISE) / span
    const elev = Math.sin(Math.PI * p) * 62
    // 方位角从 +z（南）量起，往 +x（东）为正：早上在东，中午在南，傍晚在西
    const az = 95 - p * 190
    dir = dirFrom(az, Math.max(elev, 9))
    light = smooth(0, 14, elev)
    const warm = 1 - smooth(6, 30, elev)
    color = new THREE.Color(day.sun).lerp(new THREE.Color('#ff9a5c'), warm * 0.85)
  } else {
    dir = dirFrom(MOON.az, MOON.elev)
    color = MOON.color.clone()
    const fadeIn = smooth(SUNSET, SUNSET + 1, h < SUNRISE ? h + 24 : h)
    const fadeOut = 1 - smooth(SUNRISE - 1, SUNRISE, h < SUNRISE ? h : -1)
    light = MOON.light * (h < SUNRISE ? fadeOut : fadeIn)
  }
  const dark = h >= 12 ? smooth(SUNSET - 0.6, SUNSET + 1.2, h) : 1 - smooth(SUNRISE - 1, SUNRISE + 0.8, h)
  return {
    dir,
    color,
    light,
    ambient: THREE.MathUtils.lerp(1, 0.22, dark),
    sky,
    fog,
    lamps: h >= 12 ? smooth(SUNSET - 1, SUNSET, h) : 1 - smooth(SUNRISE, SUNRISE + 0.8, h),
    night: dark,
  }
}
