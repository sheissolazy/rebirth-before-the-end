// 头顶的想法泡泡（像模拟人生）：在干什么、或者最缺什么，用一个表情表示。
import * as THREE from 'three'
import type { Actor } from './residents'
import { t, type UiKey } from '../i18n'

const cache = new Map<string, THREE.SpriteMaterial>()

export function bubbleMaterial(emoji: string): THREE.SpriteMaterial {
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
  if (k === 'garden' && using) return '🌱'
  if (k === 'tidy' && using) return '🧹'
  if (k === 'wash' && using) return '🧽'
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

/** 一句话的气泡（canvas 画的圆角框） */
const lineCache = new Map<string, { mat: THREE.SpriteMaterial; aspect: number }>()
function lineMaterial(text: string): { mat: THREE.SpriteMaterial; aspect: number } {
  // 先查缓存：每帧都会调用，别每次都新建画布
  const hit = lineCache.get(text)
  if (hit) return hit
  const font = '28px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const w = Math.min(560, Math.ceil(probe.measureText(text).width) + 36)
  const c = document.createElement('canvas')
  c.width = w
  c.height = 60
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(255,255,255,0.94)'
  g.beginPath()
  // 老 Safari 没有 roundRect
  if (typeof g.roundRect === 'function') g.roundRect(2, 2, w - 4, 46, 18)
  else g.rect(2, 2, w - 4, 46)
  g.fill()
  g.beginPath()
  g.moveTo(w / 2 - 8, 46)
  g.lineTo(w / 2, 58)
  g.lineTo(w / 2 + 8, 46)
  g.fill()
  g.font = font
  g.fillStyle = '#333'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, 25)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  const out = { mat, aspect: w / 60 }
  lineCache.set(text, out)
  return out
}

const tr = t
const CHAT_PROLOGUE = 6
const CHAT_DOOM = 7

export class Bubbles {
  private readonly sprites = new Map<Actor, THREE.Sprite>()
  /** 正在说的话：说到什么时候 */
  private readonly saying = new Map<Actor, { text: string; until: number }>()
  private nextLine = 4

  update(actors: Actor[], fighting: boolean, show: boolean, t: number, doom = false, paused = false): void {
    // 聊天的人隔一会儿说一句（末日前后说的不一样）；暂停时不说新的
    if (t > this.nextLine && !paused) {
      this.nextLine = t + 5 + Math.random() * 6
      const talkers = actors.filter((a) => a.chatting && a.root.visible)
      const who = talkers[Math.floor(Math.random() * talkers.length)]
      if (who) {
        const n = Math.floor(Math.random() * (doom ? CHAT_DOOM : CHAT_PROLOGUE))
        this.saying.set(who, { text: tr(`world.chat.${doom ? 'doom' : 'calm'}${n}` as UiKey), until: t + 3.2 })
      }
    }
    for (const a of actors) {
      let s = this.sprites.get(a)
      if (!s) {
        s = new THREE.Sprite(bubbleMaterial('💤'))
        s.scale.set(0.5, 0.5, 1)
        s.renderOrder = 11
        a.root.add(s)
        this.sprites.set(a, s)
      }
      const say = this.saying.get(a)
      if (say && (say.until < t || !a.chatting)) this.saying.delete(a)
      const line = show && a.root.visible && say && say.until >= t ? say.text : null
      const emoji = line ? null : show && a.root.visible ? thoughtOf(a, fighting) : null
      s.visible = !!(emoji || line)
      if (!emoji && !line) continue
      const lm = line ? lineMaterial(line) : null
      const m = lm ? lm.mat : bubbleMaterial(emoji!)
      if (s.material !== m) s.material = m
      // 躺着时泡泡挪到身子上方，站着在头顶；轻轻上下飘
      const lying = a.pose === 'sleep' || a.pose === 'down'
      s.position.set(0, (lying ? 1.0 : 2.15) + Math.sin(t * 2 + a.name.length) * 0.04, lying ? -0.6 : 0)
      // 抵消人物整体缩放；一句话的气泡是长条
      const k = 1 / (a.root.scale.x || 1)
      if (lm) s.scale.set(0.42 * lm.aspect * k, 0.42 * k, 1)
      else s.scale.setScalar(0.62 * k)
    }
  }
}
