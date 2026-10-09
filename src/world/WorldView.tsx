import { useEffect, useRef, useState } from 'react'
import { t, type UiKey } from '../i18n'
import { EMPTY_HUD, World, type Hud } from './World'
import { loadStyle, saveStyle, type ArtStyle } from './paradise'
import { DEPRESSED, type NeedKey } from './life'
import type { PersonHud } from './residents'

const NEEDS: NeedKey[] = ['hunger', 'thirst', 'energy', 'mood']
const SPEEDS = [0, 1, 2, 3] as const
const SPEED_ICON = ['⏸', '▶', '▶▶', '▶▶▶']

function barColor(v: number): string {
  if (v < 25) return 'bg-red-500'
  if (v < 50) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function PersonCard({ p, selected, onClick }: { p: PersonHud; selected: boolean; onClick: () => void }) {
  const doing = t(`${p.going ? 'world.go' : 'world.do'}.${p.doing}` as UiKey)
  return (
    <button onClick={onClick}
      className={`w-44 rounded-xl bg-white/90 p-2 text-left shadow transition ${selected ? 'ring-2 ring-amber-400' : 'opacity-90 hover:opacity-100'}`}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-semibold">{p.name}</span>
        <span className="truncate text-[11px] text-zinc-500">
          {p.floor === 1 && `${t('world.upstairs')} · `}{doing}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-[2.2rem_1fr] items-center gap-x-1.5 gap-y-1">
        {NEEDS.map((k) => (
          <div key={k} className="contents">
            <span className="text-[11px] text-zinc-600">{t(`world.need.${k}` as UiKey)}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div className={`h-full rounded-full ${barColor(p.needs[k])}`} style={{ width: `${Math.round(p.needs[k])}%` }} />
            </div>
          </div>
        ))}
      </div>
      {p.needs.mood < DEPRESSED && (
        <div className="mt-1 text-[11px] font-medium text-red-600">{t('world.depressed')}</div>
      )}
    </button>
  )
}

export default function WorldView() {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const [hud, setHud] = useState<Hud>(EMPTY_HUD)
  const [style, setStyle] = useState<ArtStyle>(loadStyle)

  useEffect(() => {
    let w: World | null = null
    try {
      w = new World(host.current!, setHud, style)
      world.current = w
    } catch (e) {
      // 不支持 WebGL 等情况：下一拍再显示错误
      queueMicrotask(() => setHud((h) => ({ ...h, loading: false, error: String(e) })))
    }
    return () => {
      w?.dispose()
      world.current = null
    }
  }, [style])

  // 空格暂停，1/2/3 调速
  useEffect(() => {
    let last = 1
    const onKey = (e: KeyboardEvent) => {
      const w = world.current
      if (!w || e.target instanceof HTMLInputElement) return
      if (e.key === ' ') {
        e.preventDefault()
        if (w.speed > 0) { last = w.speed; w.setSpeed(0) } else w.setSpeed(last)
      } else if (e.key === '1' || e.key === '2' || e.key === '3') w.setSpeed(Number(e.key))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggleStyle = () => {
    const next: ArtStyle = style === 'toon' ? 'paradise' : 'toon'
    saveStyle(next)
    setHud((h) => ({ ...h, loading: true }))
    setStyle(next)
  }

  const home = hud.mode === 'home'
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-sky-200 text-zinc-900">
      <div ref={host} className="absolute inset-0" />

      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        <div className={`rounded-2xl px-4 py-2 shadow ${hud.night ? 'bg-zinc-900/80 text-white' : 'bg-white/90'}`}>
          <div className="flex items-center gap-2 text-base font-semibold tabular-nums">
            <span>{hud.night ? '🌙' : '☀️'}</span>
            <span>{hud.time}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {SPEEDS.map((n) => (
              <button key={n} title={t(`world.speed.${n}` as UiKey)} onClick={() => world.current?.setSpeed(n)}
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${hud.speed === n ? 'bg-amber-400 text-zinc-900' : hud.night ? 'bg-white/15' : 'bg-zinc-100'}`}>
                {SPEED_ICON[n]}
              </button>
            ))}
          </div>
          <div className={`mt-1.5 text-xs ${hud.night ? 'text-zinc-300' : 'text-zinc-600'}`}>
            🍚💧 {t('world.stock', { food: hud.food.toFixed(1), water: hud.water.toFixed(1) })}
          </div>
        </div>
        {hud.crisis && (
          <div className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow">{t('world.crisis')}</div>
        )}
        <div className="pointer-events-none w-fit rounded-full bg-white/70 px-3 py-1 text-xs shadow">
          {t(home ? 'world.mode.home' : 'world.mode.outside')}
        </div>
      </div>

      {home && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          {([1, 0] as const).map((f) => (
            <button key={f} onClick={() => world.current?.setViewFloor(f)}
              className={`rounded-lg px-3 py-2 text-sm font-medium shadow ${hud.floor === f ? 'bg-amber-400 text-zinc-900' : 'bg-white/85'}`}>
              {t(f === 1 ? 'world.floor2' : 'world.floor1')}
            </button>
          ))}
        </div>
      )}

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button onClick={toggleStyle} className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium shadow">
          {t('world.style', { name: t(style === 'toon' ? 'world.style.toon' : 'world.style.paradise') })}
        </button>
        <a href="#text" className="rounded-full bg-zinc-900/70 px-3 py-1 text-xs text-white shadow">
          {t('world.textVersion')}
        </a>
      </div>

      <div className="absolute bottom-3 left-3 flex gap-2">
        {hud.people.map((p) => (
          <PersonCard key={p.name} p={p} selected={p.name === hud.selected} onClick={() => world.current?.select(p.name)} />
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 max-w-sm rounded-xl bg-zinc-900/65 px-4 py-2 text-xs leading-relaxed text-white">
        {home && hud.floor === 1 ? t('world.floor2Hint') : t(home ? 'world.help.home' : 'world.help.outside')}
      </div>

      {hud.toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-zinc-900/80 px-4 py-1.5 text-sm text-white shadow">
          {t(hud.toast as UiKey)}
        </div>
      )}

      {hud.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-sky-200/80 text-sm">
          {t(style === 'paradise' ? 'world.loadingParadise' : 'world.loading')}
        </div>
      )}
      {hud.error && (
        <div className="absolute inset-x-6 top-16 rounded-lg bg-red-600 p-3 text-sm text-white">{hud.error}</div>
      )}

      <div className="rotate-hint absolute inset-0 hidden items-center justify-center bg-zinc-950 p-8 text-center text-lg text-white">
        {t('world.rotate')}
      </div>
    </div>
  )
}
