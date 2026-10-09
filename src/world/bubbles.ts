// 头顶的想法泡泡（像模拟人生）：在干什么、或者最缺什么，用一个表情表示。
import * as THREE from 'three'
import type { Actor } from './residents'

const cache = new Map<string, THREE.SpriteMaterial>()

function bubbleMaterial(emoji: string): THREE.SpriteMaterial {
  const hit = cache.get(emoji)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.strokeStyle = 'rgba(60,60,60,0.35)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(64, 56, 44, 0, Math.PI * 2)
  g.fill()
  g.stroke()
  // 小尾巴：两个小圆点
  g.beginPath()
  g.arc(52, 108, 8, 0, Math.PI * 2)
  g.arc(44, 122, 5, 0, Math.PI * 2)
  g.fill()
  g.font = '52px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(emoji, 64, 60)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  cache.set(emoji, m)
  return m
}

/** 这个人现在头上该冒什么 */
export function thoughtOf(a: Actor, fighting: boolean): string | null {
  if (a.pose === 'down') return '🤕'
  if (fighting) return null
  const k = a.task?.kind
  const using = a.task?.phase === 'use'
  if (k === 'sleep' && using) return '💤'
  if (a.chatting) return '💬'
  if (k === 'cook' && using) return '🍳'
  if (k === 'eat' && using) return '🍚'
  if (k === 'drink' && using) return '💧'
  if (k === 'repair' && using) return '🔨'
  const n = a.needs
  if (n.mood < 18) return '🌧️'
  if (n.thirst < 25) return '🥤'
  if (n.hunger < 25) return '🍗'
  if (n.energy < 20) return '🥱'
  if (n.mood < 30) return '😞'
  if (a.carrying) return '📦'
  if (k === 'relax' && using) return '☕'
  return null
}

export class Bubbles {
  private readonly sprites = new Map<Actor, THREE.Sprite>()

  update(actors: Actor[], fighting: boolean, show: boolean, t: number): void {
    for (const a of actors) {
      let s = this.sprites.get(a)
      if (!s) {
        s = new THREE.Sprite(bubbleMaterial('💤'))
        s.scale.set(0.5, 0.5, 1)
        s.renderOrder = 11
        a.root.add(s)
        this.sprites.set(a, s)
      }
      const emoji = show && a.root.visible ? thoughtOf(a, fighting) : null
      s.visible = !!emoji
      if (!emoji) continue
      const m = bubbleMaterial(emoji)
      if (s.material !== m) s.material = m
      // 躺着时泡泡挪到身子上方，站着在头顶；轻轻上下飘
      const lying = a.pose === 'sleep' || a.pose === 'down'
      s.position.set(0, (lying ? 1.0 : 2.15) + Math.sin(t * 2 + a.name.length) * 0.04, lying ? -0.6 : 0)
      // 抵消人物整体缩放
      s.scale.setScalar(0.62 / (a.root.scale.x || 1))
    }
  }
}
