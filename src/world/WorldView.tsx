import { useEffect, useRef, useState } from 'react'
import { lt, t, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { EMPTY_HUD, World, type Hud } from './World'
import { loadStyle, saveStyle, type ArtStyle } from './paradise'
import { DEPRESSED, calendarLabel, type NeedKey } from './life'
import type { PersonHud } from './residents'
import { DiaryPanel } from './DiaryPanel'
import { MapPanel } from './MapPanel'

const NEEDS: NeedKey[] = ['hunger', 'thirst', 'energy', 'mood']
const SPEEDS = [0, 1, 2, 3] as const
const SPEED_ICON = ['⏸', '▶', '▶▶', '▶▶▶']

function barColor(v: number): string {
  if (v < 25) return 'bg-red-500'
  if (v < 50) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function PersonCard({ p, selected, onClick }: { p: PersonHud; selected: boolean; onClick: () => void }) {
  const doing = p.gone ? t(`world.do.${p.gone}` as UiKey) : p.trip
    ? t('world.away', { where: lt(locations.find((l) => l.id === p.trip!.id)?.name ?? { zh: '' }), h: p.trip.left.toFixed(1) })
    : t(`${p.going ? 'world.go' : 'world.do'}.${p.doing}` as UiKey)
  return (
    <button onClick={onClick}
      className={`w-44 rounded-xl bg-white/90 p-2 text-left shadow transition ${selected ? 'ring-2 ring-amber-400' : 'opacity-90 hover:opacity-100'} ${p.gone ? 'grayscale opacity-60' : ''}`}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="whitespace-nowrap text-sm font-semibold">{p.name}</span>
        {p.floor === 1 && !p.trip && <span className="text-[10px] text-zinc-400">{t('world.upstairs')}</span>}
      </div>
      <div className="truncate text-[11px] text-zinc-500" title={doing}>{doing}</div>
      <div className="mt-1.5 grid grid-cols-[2.2rem_1fr] items-center gap-x-1.5 gap-y-1">
        {p.health < 100 && (
          <div className="contents">
            <span className="text-[11px] font-medium text-red-700">{t('world.need.health')}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.round(p.health)}%` }} />
            </div>
          </div>
        )}
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
  const [diary, setDiaryState] = useState(false)
  const [map, setMapState] = useState(false)
  // 翻日记时游戏暂停，合上再接着走
  const resume = useRef(1)
  const setDiary = (open: boolean) => {
    const w = world.current
    if (w && open && w.speed > 0) { resume.current = w.speed; w.setSpeed(0) }
    if (w && !open && w.speed === 0) w.setSpeed(resume.current)
    setDiaryState(open)
  }
  const setMap = (open: boolean) => {
    const w = world.current
    if (w && open && w.speed > 0) { resume.current = w.speed; w.setSpeed(0) }
    if (w && !open && w.speed === 0) w.setSpeed(resume.current)
    setMapState(open)
  }

  useEffect(() => {
    let w: World | null = null
    try {
      w = new World(host.current!, setHud, style)
      w.onDiary = () => setDiary(true)
      w.onMap = () => setMap(true)
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
          <div className={`mt-0.5 text-xs ${hud.night ? 'text-zinc-300' : 'text-zinc-600'}`}>
            🔫 {t('world.ammo', { n: hud.ammo })} · 💎 {t('world.cores', { n: hud.cores })}
          </div>
          <div className={`mt-0.5 text-xs ${hud.night ? 'text-zinc-300' : 'text-zinc-600'}`}>
            💰 {t('world.money', { n: hud.money.toLocaleString() })} · 🩹 {t('world.medkits', { n: hud.medkits })}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <button onClick={() => setDiary(true)}
              className="rounded-md bg-red-800 px-2 py-0.5 text-xs font-medium text-amber-50 shadow-sm hover:bg-red-700">
              {t('world.diary.open')}
            </button>
            <button onClick={() => setMap(true)}
              className="rounded-md bg-emerald-800 px-2 py-0.5 text-xs font-medium text-amber-50 shadow-sm hover:bg-emerald-700">
              {t('world.map.open')}
            </button>
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
        <button onClick={() => world.current?.toggleMute()} title={t('world.sound')}
          className="rounded-full bg-white/90 px-2.5 py-1 text-xs shadow">
          {hud.muted ? '🔇' : '🔊'}
        </button>
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

      {hud.siege && (
        <div className="pointer-events-none absolute left-1/2 top-14 w-72 -translate-x-1/2 rounded-xl bg-red-950/85 px-4 py-2 text-white shadow-lg">
          <div className="text-sm font-semibold">🧟 {t('world.siege', { n: hud.siege.left })}</div>
          {hud.siege.layer && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0">{t(`world.layer.${hud.siege.layer}` as UiKey)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((hud.siege.hp / hud.siege.max) * 100)}%` }} />
              </div>
              <span className="tabular-nums">{Math.ceil(hud.siege.hp)}</span>
            </div>
          )}
        </div>
      )}

      {hud.log.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-14 w-64 rounded-xl bg-amber-50/90 px-3 py-2 text-xs shadow">
          <div className="mb-1 font-semibold text-amber-900">📔 {t('world.diary')}</div>
          {hud.log.slice(0, 4).map((l, k) => (
            <div key={`${l.day}-${l.hour}-${k}`} className={`mb-1 leading-snug ${k ? 'text-zinc-500' : 'text-zinc-800'}`}>
              <span className="mr-1 text-[10px] text-amber-800">{calendarLabel({ day: l.day, hour: l.hour })}</span>
              {t(l.key as UiKey, l.vars)}
            </div>
          ))}
        </div>
      )}

      <details className="absolute bottom-3 right-3 mb-24 text-xs">
        <summary className="cursor-pointer list-none rounded-full bg-white/70 px-3 py-1 text-zinc-600 shadow">{t('world.debug')}</summary>
        <div className="mt-1 flex flex-col gap-1">
          <button onClick={() => world.current?.debugNight(false)} className="rounded-lg bg-white/90 px-3 py-1.5 text-left shadow">{t('world.debug.night')}</button>
          <button onClick={() => world.current?.debugNight(true)} className="rounded-lg bg-white/90 px-3 py-1.5 text-left shadow">{t('world.debug.crisis')}</button>
        </div>
      </details>

      {hud.toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-zinc-900/80 px-4 py-1.5 text-sm text-white shadow">
          {t(hud.toast as UiKey)}
        </div>
      )}

      {map && (
        <MapPanel prologue={hud.prologue} check={(id) => world.current?.tripCheck(id) ?? 'busy'}
          members={world.current?.homeMembers() ?? []}
          onGo={(id, names) => { if (world.current?.startTrip(id, names)) setMap(false) }}
          onClose={() => setMap(false)} />
      )}

      {diary && (
        <DiaryPanel day={hud.day} hour={hud.hour} log={world.current?.diaryLog() ?? []} onClose={() => setDiary(false)} />
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
