import { useEffect, useRef, useState } from 'react'
import { lt, t, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { EMPTY_HUD, World, type FurnitureMenu, type Hud } from './World'
import { loadStyle, saveStyle, type ArtStyle } from './paradise'
import { DEPRESSED, calendarLabel } from './life'
import type { PersonHud } from './residents'
import { DiaryPanel } from './DiaryPanel'
import { MapPanel, type MapMember } from './MapPanel'
import { TRIPS } from './expedition'
import type { LogEntry } from './residents'
import { PERK_DEFS, boughtPerks, rebirthPoints, togglePerk } from './save'
import { peopleStyle } from './people'
import { BTN_GOLD, BTN_RED, CHIP, GRAIN, Grain, PANEL, SERIF } from './ui'

const WELCOME_KEY = 'rbte-proto-welcome-v8'
const WELCOME_ITEMS = ['life', 'night', 'map', 'feel'] as const
const WELCOME_KEYS = ['click', 'wasd', 'wheel', 'space', 'speed', 'map', 'diary', 'act'] as const
const SPEEDS = [0, 1, 2, 3] as const
const SPEED_ICON = ['⏸', '▶', '▶▶', '▶▶▶']
/** 左上角"建设"小按钮 */
const BUILD = 'rounded-sm bg-white/5 px-2 py-0.5 text-left text-[11px] text-[#efe4d0] ring-1 ring-[#e8c98a]/30 transition hover:bg-white/15 disabled:opacity-40'
const DBG = `${CHIP} px-3 py-1.5 text-left`
const FACE_MASK = 'radial-gradient(ellipse 90% 80% at 75% 30%, black 35%, transparent 75%)'


/** 状态词（像《这是我的战争》卡片上的"很饿""累了""受伤"）：只列不好的 */
function statusWords(p: PersonHud): string[] {
  const out: string[] = []
  const n = p.needs
  if (p.health < 30) out.push(t('world.st.badlyHurt'))
  else if (p.health < 70) out.push(t('world.st.hurt'))
  if (n.hunger < 20) out.push(t('world.st.starving'))
  else if (n.hunger < 40) out.push(t('world.st.hungry'))
  if (n.thirst < 20) out.push(t('world.st.parched'))
  else if (n.thirst < 40) out.push(t('world.st.thirsty'))
  if (n.energy < 15) out.push(t('world.st.exhausted'))
  else if (n.energy < 30) out.push(t('world.st.tired'))
  if (n.mood < DEPRESSED) out.push(t('world.st.depressed'))
  else if (n.mood < 40) out.push(t('world.st.sad'))
  return out
}

function PersonCard({ p, portrait, selected, onClick }: { p: PersonHud; portrait?: string; selected: boolean; onClick: () => void }) {
  const doing = p.gone ? t(`world.do.${p.gone}` as UiKey) : p.trip
    ? t('world.away', { where: lt(locations.find((l) => l.id === p.trip!.id)?.name ?? { zh: '' }), h: p.trip.left.toFixed(1) })
    : t(`${p.going ? 'world.go' : 'world.do'}.${p.doing}` as UiKey)
  const words = p.gone ? [] : statusWords(p)
  const bars: [string, number, string][] = [
    ['🍚', p.needs.hunger, '#d9a441'], ['💧', p.needs.thirst, '#6fa8c8'], ['☾', p.needs.energy, '#a99ad6'], ['♥', p.needs.mood, '#d4787a'],
  ]
  return (
    <button onClick={onClick}
      className={`relative h-[12.5rem] w-[9.25rem] shrink-0 overflow-hidden rounded-md text-left shadow-[0_8px_22px_rgba(0,0,0,0.5)] transition duration-200
        ${selected ? '-translate-y-1.5 ring-2 ring-[#e8c98a]' : 'ring-1 ring-black/50 hover:-translate-y-0.5'} ${p.gone ? 'grayscale' : ''}`}>
      {/* 头像：去色、偏旧照片的暖灰，加颗粒和暗角 */}
      <div className="absolute inset-0 bg-[#2e2924]" />
      {portrait && <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: `grayscale(${p.gone ? 1 : 0.72}) sepia(0.28) contrast(1.18) brightness(${p.gone ? 0.6 : 0.95})` }} />}
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 0.5 }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(130% 95% at 50% 28%, transparent 38%, rgba(10,8,6,0.7))' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[#0e0b09] via-[#0e0b09]/80 to-transparent" />
      {/* 左上：特质、楼上 */}
      <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
        {p.trait && <span className="rounded-sm bg-[#e8c98a]/90 px-1 text-[10px] font-medium text-[#2b2117]">{p.trait}</span>}
        {p.floor === 1 && !p.trip && !p.gone && <span className="rounded-sm bg-black/45 px-1 text-[10px] text-[#efe4d0]">{t('world.upstairs')}</span>}
      </div>
      {/* 底部：名字、在干什么、状态词、四条细条 */}
      <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5">
        <div className="text-[17px] font-bold leading-tight tracking-[0.06em] text-[#f4ecdc] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={{ fontFamily: SERIF }}>{p.name}</div>
        <div className="mt-0.5 truncate text-[11px] text-[#d9ccb4]" title={doing}>{doing}</div>
        {p.doing === 'down' && !p.gone && <div className="mt-0.5 text-[11px] font-semibold text-[#ff8f7a]">{t('world.rescueHint')}</div>}
        <div className="mt-0.5 min-h-[15px] truncate text-[11px] font-semibold tracking-wide text-[#ec8a72]" style={{ fontFamily: SERIF }}>
          {words.join(' · ')}
        </div>
        {p.gone !== 'dead' && (
          <div className="mt-1 grid grid-cols-4 gap-1">
            {bars.map(([icon, v, color]) => (
              <div key={icon} className="flex items-center gap-0.5" title={String(Math.round(v))}>
                <span className="w-2.5 text-center text-[9px] leading-none text-[#e9dfcc]/80">{icon}</span>
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(v)}%`, background: v < 25 ? '#e2553f' : color }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {p.health < 100 && p.gone !== 'dead' && (
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#c9473a]" style={{ width: `${Math.round(p.health)}%` }} />
          </div>
        )}
      </div>
    </button>
  )
}

/** 点家具弹出的小菜单（同一套深色纸面风格） */
function FurnitureMenuView({ menu, onPick, onClose }: { menu: FurnitureMenu; onPick: (s: FurnitureMenu['options'][number]['spot']) => void; onClose: () => void }) {
  const left = Math.min(menu.x + 12, window.innerWidth - 200)
  const top = Math.min(menu.y - 10, window.innerHeight - 60 - menu.options.length * 34)
  return (
    <div className="fixed inset-0 z-30" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div className="absolute w-44 overflow-hidden rounded-md bg-[#1b1714]/95 shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-[#e8c98a]/40"
        style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 0.35 }} />
        <div className="relative border-b border-[#e8c98a]/20 px-3 pb-1.5 pt-2">
          <div className="text-[15px] font-bold tracking-[0.08em] text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{menu.title}</div>
          <div className="text-[11px] text-[#c9bba2]">{t('world.use.who', { name: menu.who })}</div>
        </div>
        <div className="relative py-1">
          {menu.options.map((o) => (
            <button key={o.label} onClick={() => onPick(o.spot)}
              className="block w-full px-3 py-1.5 text-left text-[13px] text-[#efe4d0] transition hover:bg-[#e8c98a]/15">
              {t(o.label)}
            </button>
          ))}
          <button onClick={onClose} className="block w-full px-3 py-1 text-left text-[12px] text-[#a99d88] hover:bg-white/5">{t('world.use.cancel')}</button>
        </div>
      </div>
    </div>
  )
}

export default function WorldView() {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const [hud, setHud] = useState<Hud>(EMPTY_HUD)
  const [style, setStyle] = useState<ArtStyle>(loadStyle)
  const [diary, setDiaryState] = useState(false)
  const [map, setMapState] = useState(false)
  const [spaceOpen, setSpaceOpen] = useState(false)
  const [furn, setFurn] = useState<FurnitureMenu | null>(null)
  const [welcome, setWelcome] = useState(() => {
    try { return localStorage.getItem(WELCOME_KEY) !== '1' } catch { return true }
  })
  const closeWelcome = (night: boolean) => {
    try { localStorage.setItem(WELCOME_KEY, '1') } catch { /* 隐私模式 */ }
    setWelcome(false)
    if (night) world.current?.debugNight(true)
  }
  // 欢迎卡、日记、地图、门口的对话框：任何一个开着游戏就暂停，全关了再回到原来的速度
  // （原来就是手动暂停的，关掉以后还是暂停）
  const resume = useRef(1)
  const uiPaused = useRef(false)
  /** 重生点商店点了一下：重新画一遍（数据在 localStorage 里） */
  const [, setShopTick] = useState(0)
  /** 换画风前的速度，新世界接着用 */
  const keptSpeed = useRef<number | null>(null)
  // 打开面板时从游戏里抄一份数据（游戏这时是暂停的）
  const [diaryLog, setDiaryLog] = useState<LogEntry[]>([])
  const [diaryPeople, setDiaryPeople] = useState<ReturnType<World['diaryPeople']>>([])
  const [mapData, setMapData] = useState<{ checks: Record<string, ReturnType<World['tripCheck']>>; vanChecks: Record<string, ReturnType<World['tripCheck']>>; members: MapMember[]; van: { fuel: number; home: boolean; armored: boolean; parkedOut: boolean } }>({ checks: {}, vanChecks: {}, members: [], van: { fuel: 0, home: true, armored: false, parkedOut: false } })
  const setDiary = (open: boolean) => {
    const w = world.current
    if (w && open) { setDiaryLog(w.diaryLog()); setDiaryPeople(w.diaryPeople()) }
    setDiaryState(open)
  }
  // 键盘快捷键（M 地图）用：effect 里拿到的总是最新的 setMap
  const setMapRef = useRef<(open: boolean) => void>(() => {})
  const setMap = (open: boolean) => {
    const w = world.current
    if (w && open) {
      setMapData({
        checks: Object.fromEntries(TRIPS.map((x) => [x.id, w.tripCheck(x.id)])),
        vanChecks: Object.fromEntries(TRIPS.map((x) => [x.id, w.tripCheck(x.id, true)])),
        members: w.homeMembers(),
        van: w.vanInfo(),
      })
    }
    setMapState(open)
  }
  useEffect(() => { setMapRef.current = setMap })
  const blockedRef = useRef(false)
  useEffect(() => { blockedRef.current = !!hud.over || hud.intro })

  useEffect(() => {
    let w: World | null = null
    try {
      w = new World(host.current!, setHud, style)
      // 换画风重建世界时，如果有面板开着，接着暂停；否则沿用之前的速度（包括手动暂停）
      if (uiPaused.current) w.setSpeed(0)
      else if (keptSpeed.current !== null) w.setSpeed(keptSpeed.current)
      w.onDiary = () => setDiary(true)
      w.onMap = () => setMap(true)
      w.onFurnitureMenu = (m) => setFurn(m)
      world.current = w
    } catch (e) {
      // 不支持 WebGL 等情况：下一拍再显示错误
      queueMicrotask(() => setHud((h) => ({ ...h, loading: false, error: String(e) })))
    }
    return () => {
      if (w) keptSpeed.current = w.speed
      w?.dispose()
      world.current = null
    }
  }, [style])

  const visitId = hud.visit?.id ?? null
  const blocking = welcome || diary || map || !!visitId
  useEffect(() => {
    const w = world.current
    if (!w) return
    if (blocking && !uiPaused.current) {
      uiPaused.current = true
      resume.current = w.speed
      w.setSpeed(0)
    } else if (!blocking && uiPaused.current) {
      uiPaused.current = false
      w.setSpeed(resume.current)
    }
  }, [blocking])

  // 调速：有面板挡着时只记下来，等面板关了再生效（不然对话框开着游戏就偷偷跑起来了）
  const changeSpeed = (n: number) => {
    const w = world.current
    if (!w) return
    if (uiPaused.current) resume.current = n
    else w.setSpeed(n)
  }

  // 空格暂停，1/2/3 调速
  useEffect(() => {
    let last = 1
    const onKey = (e: KeyboardEvent) => {
      const w = world.current
      if (!w || e.target instanceof HTMLInputElement) return
      if (e.key === ' ') {
        e.preventDefault()
        if (uiPaused.current) return
        if (w.speed > 0) { last = w.speed; w.setSpeed(0) } else w.setSpeed(last)
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        if (uiPaused.current) resume.current = Number(e.key)
        else w.setSpeed(Number(e.key))
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && !blockedRef.current) {
        // M 地图、J 日记（片头、结束画面时不响应；Cmd+M 之类留给系统）
        if (e.key === 'm' || e.key === 'M') setMapRef.current(true)
        else if (e.key === 'j' || e.key === 'J') setDiary(true)
      }
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
    <div className="fixed inset-0 select-none overflow-hidden bg-[#15110e] text-zinc-900">
      <div ref={host} className="absolute inset-0" />

      {/* 片头放的时候把界面藏起来 */}
      <div className={hud.intro ? 'pointer-events-none opacity-0' : 'transition-opacity duration-1000'}>
      <div className="absolute left-3 top-3 flex flex-col gap-1.5">
        <div className={`${PANEL} px-4 py-2.5`}>
          <Grain />
          <div className="relative flex items-center gap-2 text-[17px] font-bold tabular-nums tracking-wide" style={{ fontFamily: SERIF }}>
            <span>{hud.rain > 0.05 ? '🌧️' : hud.night ? '🌙' : '☀️'}</span>
            <span>{hud.time}</span>
            {hud.hard && <span className="rounded bg-red-700 px-1 text-[10px] font-bold text-white">{t('world.hardTag')}</span>}
          </div>
          <div className="relative mt-1.5 flex items-center gap-1">
            {SPEEDS.map((n) => (
              <button key={n} title={t(`world.speed.${n}` as UiKey)} onClick={() => changeSpeed(n)}
                className={`rounded-sm px-2 py-0.5 text-xs font-medium transition ${hud.speed === n ? 'bg-[#e8c98a] text-[#1d1915]' : 'bg-white/10 text-[#efe4d0] hover:bg-white/20'}`}>
                {SPEED_ICON[n]}
              </button>
            ))}
          </div>
          <div className="relative mt-2 text-xs text-[#d9ccb4]">
            🍚💧 {t('world.stock', { food: hud.food.toFixed(1), water: hud.water.toFixed(1) })}
          </div>
          <div className="relative mt-0.5 text-xs text-[#d9ccb4]">
            🔫 {t('world.ammo', { n: hud.ammo })} · 💎 {t('world.cores', { n: hud.cores })} · ⛽ {t('world.fuel', { n: hud.fuel })}
          </div>
          <div className="relative mt-0.5 text-xs text-[#d9ccb4]">
            💰 {t('world.money', { n: hud.money.toLocaleString() })} · 🩹 {t('world.medkits', { n: hud.medkits })}
          </div>
          <div className="relative mt-2 flex gap-1.5">
            <button onClick={() => setDiary(true)}
              className="rounded-sm bg-[#7c2d24] px-2 py-0.5 text-xs font-medium text-[#f4ecdc] ring-1 ring-white/10 hover:bg-[#93372c]">
              {t('world.diary.open')}
            </button>
            <button onClick={() => setMap(true)}
              className="rounded-sm bg-[#2f5a3e] px-2 py-0.5 text-xs font-medium text-[#f4ecdc] ring-1 ring-white/10 hover:bg-[#386b4a]">
              {t('world.map.open')}
            </button>
            <button onClick={() => setSpaceOpen((o) => !o)}
              className="rounded-sm bg-[#3b3f73] px-2 py-0.5 text-xs font-medium text-[#f4ecdc] ring-1 ring-white/10 hover:bg-[#474c88]">
              {t('world.space.open', { n: Math.round(hud.space.food + hud.space.water), cap: hud.space.cap })}
            </button>
          </div>
          <div className="relative mt-2 flex max-w-[260px] flex-wrap gap-1">
            {hud.trap > 0 ? (
              <div className="rounded-sm bg-white/5 px-2 py-0.5 text-[11px] text-[#d9ccb4] ring-1 ring-white/10">{t('world.trap.left', { n: hud.trap })}</div>
            ) : (
              <button onClick={() => world.current?.buildGateTrap()}
                disabled={hud.prologue ? hud.money < 1500 : hud.cores < 2}
                className={BUILD}>
                {t(hud.prologue ? 'world.trap.build' : 'world.trap.buildCores')}
              </button>
            )}
            {!hud.wall && (
              <button onClick={() => world.current?.buildYardWall()}
                disabled={hud.prologue ? hud.money < 6000 : hud.cores < 6}
                className={BUILD}>
                {t(hud.prologue ? 'world.wall.build' : 'world.wall.buildCores')}
              </button>
            )}
            {!hud.garden.built ? (
              <button onClick={() => world.current?.buildGardenPlot()}
                disabled={hud.prologue ? hud.money < 800 : hud.cores < 2}
                className={BUILD}>
                {t(hud.prologue ? 'world.garden.build' : 'world.garden.buildCores')}
              </button>
            ) : (
              <div className="rounded-sm bg-white/5 px-2 py-0.5 text-[11px] text-[#c9dcb0] ring-1 ring-white/10">
                {t(hud.garden.growth >= 1 ? 'world.garden.ripe' : 'world.garden.growing', { p: Math.round(hud.garden.growth * 100) })}
              </div>
            )}
          </div>
          {spaceOpen && (
            <div className="relative mt-2 w-64 rounded-md bg-[#2a2747]/70 p-2 text-xs ring-1 ring-[#9aa0ff]/25">
              <div className="mb-1 leading-snug text-[#cfd0f0]">{t('world.space.hint')}</div>
              {(['food', 'water'] as const).map((k) => (
                <div key={k} className="mt-1 flex items-center gap-1.5">
                  <span className="w-20">{t(`world.space.${k}` as UiKey, { n: hud.space[k].toFixed(1) })}</span>
                  <button onClick={() => world.current?.moveToSpace(k, -1)} className="rounded-sm bg-white/10 px-1.5 text-[#efe4d0] hover:bg-white/20">{t('world.space.out')}</button>
                  <button onClick={() => world.current?.moveToSpace(k, 1)} className="rounded-sm bg-[#4b4f96] px-1.5 text-white hover:bg-[#5a5fb0]">{t('world.space.in')}</button>
                </div>
              ))}
              <button disabled={hud.cores < 3} onClick={() => world.current?.upgradeSpace()}
                className="mt-2 w-full rounded-sm bg-[#3b3f73] py-1 text-white ring-1 ring-white/10 hover:bg-[#474c88] disabled:opacity-40">{t('world.space.up')}</button>
            </div>
          )}
        </div>
        {hud.crisis && (
          <div className="w-fit rounded-sm bg-[#7c2d24] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#f4ecdc] ring-1 ring-[#e2553f]/50" style={{ fontFamily: SERIF }}>
            ⚠ {t('world.crisis')}{hud.crisisKind ? ` · ${t(`crisisKind.${hud.crisisKind}` as UiKey)}` : ''}
          </div>
        )}
        <div className="pointer-events-none w-fit rounded-sm bg-[#1d1915]/80 px-2.5 py-0.5 text-[11px] tracking-wide text-[#d9ccb4] ring-1 ring-[#e8c98a]/20">
          {t(home ? 'world.mode.home' : 'world.mode.outside')}
        </div>
        {hud.goals && !hud.siege && (
          <div className={`pointer-events-none w-60 px-3 py-2 text-xs ${PANEL}`}>
            <Grain />
            <div className="relative mb-1 text-[13px] font-bold tracking-wide text-[#e8c98a]" style={{ fontFamily: SERIF }}>{t('world.goal.title')}</div>
            {hud.goals.map((g) => (
              <div key={g.key} className={`relative flex gap-1.5 leading-snug ${g.done ? 'text-[#8a7f6d] line-through' : 'text-[#e6dac4]'}`}>
                <span className={g.done ? 'text-[#9cbf7a]' : 'text-[#e8c98a]/70'}>{g.done ? '✓' : '○'}</span><span>{t(g.key as UiKey)}</span>
              </div>
            ))}
          </div>
        )}

      </div>

      {home && (
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          {([1, 0] as const).map((f) => (
            <button key={f} onClick={() => world.current?.setViewFloor(f)}
              className={`px-3 py-2 text-sm font-bold tracking-widest ${hud.floor === f ? BTN_GOLD : CHIP}`} style={{ fontFamily: SERIF }}>
              {t(f === 1 ? 'world.floor2' : 'world.floor1')}
            </button>
          ))}
        </div>
      )}

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button onClick={() => world.current?.toggleMute()} title={t('world.sound')}
          className={`${CHIP} px-2 py-1 text-xs`}>
          {hud.muted ? '🔇' : '🔊'}
        </button>
        <button onClick={() => world.current?.snapshot()} title={t('world.photo')}
          className={`${CHIP} px-2 py-1 text-xs`}>📷</button>
        <button onClick={() => setWelcome(true)} title={t('world.helpAgain')}
          className={`${CHIP} px-2 py-1 text-xs`}>❓</button>
        <button onClick={() => world.current?.toggleMusic()} title={t('world.music')}
          className={`${CHIP} px-2 py-1 text-xs ${hud.music ? '' : 'opacity-40'}`}>
          🎵
        </button>
        <button onClick={toggleStyle} className={`${CHIP} px-2.5 py-1 text-xs`}>
          {t('world.style', { name: t(style === 'toon' ? 'world.style.toon' : 'world.style.paradise') })}
        </button>
        {style === 'paradise' && (
          <button onClick={() => world.current?.togglePeople()} title={t('world.people.tip')}
            className={`${CHIP} px-2.5 py-1 text-xs`}>
            {t('world.people', { name: t(peopleStyle() === 'toon' ? 'world.people.toon' : 'world.people.real') })}
          </button>
        )}
        <a href="#text" className={`${CHIP} px-2.5 py-1 text-xs text-[#a99d88]`}>
          {t('world.textVersion')}
        </a>
      </div>

      <div className="absolute bottom-3 left-3 flex gap-2">
        {hud.people.map((p) => (
          <PersonCard key={p.name} p={p} portrait={hud.portraits[p.name]} selected={p.name === hud.selected} onClick={() => world.current?.select(p.name)} />
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 max-w-xs rounded-md bg-[#1d1915]/80 px-3 py-2 text-[11px] leading-relaxed text-[#e6dac4] ring-1 ring-[#e8c98a]/20">
        {home && hud.floor === 1 ? t('world.floor2Hint') : t(home ? 'world.help.home' : 'world.help.outside')}
      </div>

      {hud.siege && (
        <div className="absolute left-1/2 top-14 w-80 -translate-x-1/2 overflow-hidden rounded-md bg-[#2a0f0c]/90 px-4 py-2 text-[#f4ecdc] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-[#e2553f]/40">
          <Grain />
          <div className="relative flex items-center justify-between gap-2">
            <div className="text-[15px] font-bold tracking-wide" style={{ fontFamily: SERIF }}>🧟 {t(hud.siege.ambush ? 'world.ambush' : 'world.siege', { n: hud.siege.left })}</div>
            <button disabled={hud.molotovs <= 0} onClick={() => world.current?.throwMolotov()}
              className="rounded-sm bg-[#c2551f] px-2 py-0.5 text-xs font-semibold ring-1 ring-white/15 hover:bg-[#d8652b] disabled:opacity-40">
              {t('world.molotov', { n: hud.molotovs })}
            </button>
          </div>
          {hud.siege.layer && (
            <div className="relative mt-1 flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0">{t(`world.layer.${hud.siege.layer}` as UiKey)}</span>
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[#e8c98a]" style={{ width: `${Math.round((hud.siege.hp / hud.siege.max) * 100)}%` }} />
              </div>
              <span className="tabular-nums">{Math.ceil(hud.siege.hp)}</span>
            </div>
          )}
        </div>
      )}

      {hud.log.length > 0 && (
        <div className="pointer-events-none absolute right-3 top-14 w-64 overflow-hidden rounded-sm bg-[#ece2cb]/95 px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-[#b9a77f]/70">
          <Grain opacity={0.45} />
          <div className="relative mb-1 border-b border-[#8a6a48]/30 pb-0.5 text-[13px] font-bold tracking-wide text-[#5a3b22]" style={{ fontFamily: SERIF }}>📔 {t('world.diary')}</div>
          {hud.log.slice(0, 4).map((l, k) => (
            <div key={`${l.day}-${l.hour}-${k}`} className={`relative mb-1 line-clamp-3 leading-snug ${k ? 'text-[#6b5a45]' : 'text-[#2f2418]'}`} style={{ fontFamily: SERIF }}>
              <span className="mr-1 text-[10px] text-[#8a5a2b]">{calendarLabel({ day: l.day, hour: l.hour })}</span>
              {t(l.key as UiKey, l.vars)}
            </div>
          ))}
        </div>
      )}

      <details className="absolute bottom-3 right-3 mb-24 text-xs">
        <summary className={`cursor-pointer list-none px-2.5 py-1 text-[#a99d88] ${CHIP}`}>{t('world.debug')}</summary>
        <div className="mt-1 flex flex-col gap-1">
          <button onClick={() => world.current?.debugNight(false)} className={DBG}>{t('world.debug.night')}</button>
          <button onClick={() => world.current?.debugNight(true)} className={DBG}>{t('world.debug.crisis')}</button>
          <button onClick={() => world.current?.debugVisitor('jiangye_meet')} className={DBG}>{t('world.debug.jiangye')}</button>
          <button onClick={() => world.current?.debugVisitor('shenyan_meet')} className={DBG}>{t('world.debug.shenyan')}</button>
          <button onClick={() => world.current?.debugVisitor('guchen_visit')} className={DBG}>{t('world.debug.guchenVisit')}</button>
          <button onClick={() => world.current?.debugVisitor('xielin_meet')} className={DBG}>{t('world.debug.xielinMeet')}</button>
          <button onClick={() => world.current?.debugCourier('guchen')} className={DBG}>{t('world.debug.guchen')}</button>
          <button onClick={() => world.current?.debugCourier('xielin')} className={DBG}>{t('world.debug.xielin')}</button>
          <button onClick={() => world.current?.debugVisitor('neighbor_rice')} className={DBG}>{t('world.debug.visitor')}</button>
          <button onClick={() => world.current?.debugVisitor('beggar')} className={DBG}>{t('world.debug.beggar')}</button>
          <button onClick={() => world.current?.debugVisitor('crow_tax')} className={DBG}>{t('world.debug.crow')}</button>
          <button onClick={() => world.current?.togglePeople()} className={DBG}>{t('world.debug.people')}</button>
          <button onClick={() => world.current?.toggleHard()} className={DBG}>{t(hud.hard ? 'world.debug.hardOn' : 'world.debug.hardOff')}</button>
          <button onClick={() => world.current?.debugDie()} className={DBG}>{t('world.debug.die')}</button>
          <button onClick={() => { if (confirm(t('world.debug.restartAsk'))) world.current?.restart() }} className={`${DBG} text-[#ff8f7a]`}>{t('world.debug.restart')}</button>
        </div>
      </details>

      {(hud.fishing.near || hud.fishing.active) && !hud.siege && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2">
          <button onClick={() => world.current?.searchHere()}
            className={`px-4 py-2 text-sm ${hud.fishing.active ? `${CHIP} text-[#bfe3f2]` : BTN_GOLD}`}>
            {t(hud.fishing.active ? 'world.fish.doing' : 'world.fish.go', { n: hud.fishing.caught })}
          </button>
        </div>
      )}

      {hud.search && !hud.siege && !hud.fishing.near && (
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2">
          {hud.search.state === 'doing' ? (
            <div className={`w-56 px-4 py-2 text-center text-sm ${PANEL}`}>
              {t('world.search.doing', { p: hud.search.progress ?? 0 })}
              <div className="mt-1 h-[4px] overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-[#e8c98a]" style={{ width: `${hud.search.progress ?? 0}%` }} />
              </div>
            </div>
          ) : hud.search.state === 'ok' ? (
            <button onClick={() => world.current?.searchHere()} className={`px-4 py-2 text-sm ${BTN_GOLD}`}>
              {t('world.search.go', { where: t(`world.spot.${hud.search.kind}` as UiKey) })}
            </button>
          ) : (
            <div className={`px-4 py-2 text-sm ${PANEL}`}>{t(`world.search.${hud.search.state}` as UiKey)}</div>
          )}
        </div>
      )}

      {hud.toast && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-[#1d1915]/90 px-4 py-1.5 text-sm text-[#efe4d0] shadow-[0_6px_18px_rgba(0,0,0,0.45)] ring-1 ring-[#e8c98a]/35" style={{ fontFamily: SERIF }}>
          {t(hud.toast as UiKey, hud.toastVars ?? undefined)}
        </div>
      )}

      </div>

      {hud.visit && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/50 to-transparent pb-6 pt-24">
          <div className={`flex w-[min(660px,92vw)] gap-4 p-4 ${PANEL} bg-[#1d1915]/95`}>
            <Grain opacity={0.4} />
            <div className="relative flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-gradient-to-b from-[#3a3128] to-[#15110e] text-5xl ring-1 ring-[#e8c98a]/30">
              {hud.visit.face ? (
                <>
                  <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${hud.visit.face})`, filter: 'grayscale(0.55) sepia(0.3) contrast(1.12) brightness(0.95)' }} />
                  <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 0.5 }} />
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18px_rgba(0,0,0,0.7)]" />
                  <span className="absolute bottom-0.5 right-1 text-base drop-shadow">{hud.visit.icon}</span>
                </>
              ) : <span className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">{hud.visit.icon}</span>}
            </div>
            <div className="relative flex-1">
              <div className="text-[10px] tracking-[0.3em] text-[#e8c98a]/70">{t('world.visit.knock')}</div>
              <div className="text-lg font-bold tracking-wide text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{hud.visit.name}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-[#ddd1ba]" style={{ fontFamily: SERIF }}>{t(hud.visit.textKey as UiKey, hud.visit.vars)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {hud.visit.choices.map((c) => (
                  <button key={c.id} disabled={!c.ok} onClick={() => world.current?.answerVisitor(c.id)}
                    className="rounded-sm bg-white/5 px-3 py-1.5 text-[13px] text-[#f4ecdc] ring-1 ring-[#e8c98a]/40 transition hover:bg-[#e8c98a] hover:text-[#1d1915] disabled:opacity-35 disabled:hover:bg-white/5 disabled:hover:text-[#f4ecdc]">
                    {t(`world.visit.${hud.visit!.id}.choice.${c.id}` as UiKey, hud.visit!.vars)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {hud.report && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35">
          <div className={`w-[min(420px,90vw)] p-5 ${PANEL} bg-[#1d1915]/95 ${hud.report.won ? '' : 'ring-[#e2553f]/50'}`}>
            <Grain opacity={0.4} />
            <div className="relative text-[10px] tracking-[0.3em] text-[#a99d88]">{t(hud.report.crisis ? 'world.report.crisis' : 'world.report.normal')}</div>
            <div className={`relative mt-0.5 text-2xl font-bold tracking-wide ${hud.report.won ? 'text-[#e8c98a]' : 'text-[#ff8f7a]'}`} style={{ fontFamily: SERIF }}>{t(hud.report.won ? 'world.report.won' : 'world.report.lost')}</div>
            <ul className="relative mt-3 space-y-1 border-t border-[#e8c98a]/15 pt-3 text-sm text-[#e6dac4]">
              <li>🧟 {t('world.report.kills', { n: hud.report.kills })}</li>
              {(hud.report.trapKills > 0 || hud.report.fireKills > 0 || hud.report.bruteKills > 0) && (
                <li className="pl-5 text-xs text-[#a99d88]">{[
                  hud.report.bruteKills > 0 ? t('world.report.bruteKills', { n: hud.report.bruteKills }) : '',
                  hud.report.trapKills > 0 ? t('world.report.trapKills', { n: hud.report.trapKills }) : '',
                  hud.report.fireKills > 0 ? t('world.report.fireKills', { n: hud.report.fireKills }) : '',
                ].filter(Boolean).join(' · ')}</li>
              )}
              <li>🔫 {t('world.report.ammo', { n: hud.report.ammo })}</li>
              {hud.report.cores > 0 && <li>💎 {t('world.report.cores', { n: hud.report.cores })}</li>}
              {hud.report.layers.map((l) => (
                <li key={l.id}>🚪 {t(l.broken ? 'world.report.broken' : 'world.report.damaged', { what: t(`world.layer.${l.id}` as UiKey), n: Math.round(l.lost) })}</li>
              ))}
              {hud.report.hurt.map((h) => <li key={h.name}>🩹 {t('world.report.hurt', { who: h.name, n: h.lost })}</li>)}
              {hud.report.died.map((n) => <li key={n} className="font-bold text-[#ff8f7a]">🕯 {t('world.report.died', { who: n })}</li>)}
              {(hud.report.food > 0.05 || hud.report.water > 0.05) && (
                <li>📦 {t('world.report.loss', { food: hud.report.food.toFixed(1), water: hud.report.water.toFixed(1) })}</li>
              )}
            </ul>
            {hud.report.layers.some((l) => l.id === 'gate') && <div className="relative mt-3 text-xs text-[#a99d88]">{t('world.report.repairHint')}</div>}
            <button onClick={() => world.current?.clearReport()}
              className={`relative mt-4 w-full py-2 text-sm tracking-widest ${hud.report.won ? BTN_GOLD : BTN_RED}`} style={{ fontFamily: SERIF }}>{t('world.report.ok')}</button>
          </div>
        </div>
      )}

      {hud.doom && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-black/40 via-transparent to-black/40">
          <div className="intro-title text-center font-serif text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            <div className="text-4xl font-bold tracking-[0.4em]">{t('world.doom.title')}</div>
            <div className="mt-3 text-base tracking-widest opacity-90">{t('world.doom.sub')}</div>
          </div>
        </div>
      )}
      {hud.over && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="over-card max-w-md text-center font-serif text-white">
            <div className="text-sm tracking-[0.4em] text-white/60">{t('world.over.life', { n: hud.life })}</div>
            <div className="mt-3 text-4xl font-bold tracking-[0.2em]">{t('world.over.title')}</div>
            <p className="mt-5 text-base leading-relaxed text-white/85">{t(`world.over.cause.${hud.over.cause}` as UiKey)}</p>
            <p className="mt-2 text-sm text-white/60">{t('world.over.when', { when: hud.over.when, days: hud.over.days })}</p>
            {hud.over.mourned.length > 0 && <p className="mt-2 text-sm text-white/60">🕯 {t('world.over.mourned', { names: hud.over.mourned.join('、') })}</p>}
            <p className="mt-4 text-sm text-amber-200">{t('world.over.points', { days: hud.over.days, kills: hud.over.kills, points: hud.over.points })}</p>
            <div className="mt-3 rounded-md bg-white/5 p-3 text-left font-sans ring-1 ring-[#e8c98a]/20">
              <div className="mb-2 text-xs text-white/70">{t('world.over.shop', { n: rebirthPoints() })}</div>
              <div className="flex flex-wrap gap-1.5">
                {PERK_DEFS.map((p) => {
                  const have = boughtPerks().includes(p.id)
                  return (
                    <button key={p.id} onClick={() => { togglePerk(p.id); setShopTick((n) => n + 1) }}
                      disabled={!have && rebirthPoints() < p.cost}
                      className={`rounded-sm px-2 py-1 text-xs ${have ? 'bg-[#e8c98a] text-[#1d1915]' : 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20'} disabled:opacity-35`}>
                      {have ? '✓ ' : ''}{t(`world.perk.${p.id}` as UiKey)} · {p.cost}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/70">{t('world.over.again')}</p>
            <button onClick={() => world.current?.rebirth()}
              className={`mt-6 px-6 py-2.5 text-base tracking-widest ${BTN_GOLD}`}>
              {t('world.over.button', { n: hud.life + 1 })}
            </button>
          </div>
        </div>
      )}
      {hud.intro && (
        <div className="absolute inset-0 z-30 flex cursor-pointer flex-col justify-between" onClick={() => world.current?.endIntro()}>
          <div className="h-[9vh] bg-black" />
          <div className="intro-title text-center font-serif text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
            <div className="text-4xl font-bold tracking-[0.3em]">{t('app.title')}</div>
            <div className="mt-3 text-base tracking-widest opacity-90">{hud.life > 1 ? t('world.intro.subLife', { n: hud.life }) : t('world.intro.sub')}</div>
          </div>
          <div className="flex h-[9vh] items-center justify-end bg-black px-6 text-xs text-white/60">{t('world.intro.skip')}</div>
        </div>
      )}

      {welcome && !hud.loading && !hud.intro && (() => {
        const face = hud.people[0] ? hud.portraits[hud.people[0].name] : undefined
        return (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3">
            <div className={`w-[min(640px,94vw)] max-h-[92vh] overflow-y-auto ${PANEL} bg-[#1d1915]/95`}>
              {face && (
                <div className="pointer-events-none absolute right-0 top-0 h-56 w-48 bg-cover bg-top opacity-55"
                  style={{ backgroundImage: `url(${face})`, filter: 'grayscale(0.85) sepia(0.35) contrast(1.15)',
                    maskImage: FACE_MASK, WebkitMaskImage: FACE_MASK }} />
              )}
              <Grain opacity={0.4} />
              <div className="relative px-6 pb-5 pt-6">
                <div className="text-[11px] tracking-[0.35em] text-[#e8c98a]/80">{t('app.title')}</div>
                <div className="mt-1 text-2xl font-bold tracking-wide text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{t('world.welcome.title')}</div>
                <div className="mt-1 text-xs text-[#a99d88]">{t('world.welcome.sub')}</div>

                <div className="mt-4 border-l-2 border-[#e8c98a] bg-[#e8c98a]/10 py-2 pl-3 pr-3">
                  <div className="text-[13px] font-bold text-[#e8c98a]" style={{ fontFamily: SERIF }}>✦ {t('world.welcome.todayH')}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#e6dac4]">{t('world.welcome.today')}</p>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                  {WELCOME_ITEMS.map((k) => (
                    <div key={k}>
                      <div className="flex items-center gap-2 text-[13px] font-bold text-[#f4ecdc]" style={{ fontFamily: SERIF }}>
                        <span className="h-px w-3 bg-[#e8c98a]/70" />{t(`world.welcome.${k}H` as UiKey)}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#cbbfa8]">{t(`world.welcome.${k}` as UiKey)}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-[#e8c98a]/15 pt-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[#cbbfa8]">
                    {WELCOME_KEYS.map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <kbd className="rounded-sm bg-white/10 px-1.5 py-px font-sans text-[10px] font-semibold text-[#f4ecdc] ring-1 ring-white/15">{t(`world.welcome.key.${k}` as UiKey)}</kbd>
                        {t(`world.welcome.keyd.${k}` as UiKey)}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#8a7f6d]">{t('world.welcome.debug')}</div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button onClick={() => closeWelcome(false)} className={`flex-1 py-2.5 text-sm tracking-widest ${BTN_GOLD}`} style={{ fontFamily: SERIF }}>{t('world.welcome.start')}</button>
                  {hud.prologue && (
                    <button onClick={() => closeWelcome(true)} className={`flex-1 py-2.5 text-sm ${BTN_RED}`} style={{ fontFamily: SERIF }}>{t('world.welcome.zombies')}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {map && (
        <MapPanel prologue={hud.prologue} check={(id, van) => (van ? mapData.vanChecks : mapData.checks)[id] ?? 'busy'}
          members={mapData.members} van={mapData.van}
          onGo={(id, names, van) => { if (world.current?.startTrip(id, names, van)) setMap(false) }}
          onClose={() => setMap(false)} />
      )}

      {furn && <FurnitureMenuView menu={furn} onPick={(spot) => world.current?.useFurniture(spot)} onClose={() => setFurn(null)} />}

      {diary && (
        <DiaryPanel day={hud.day} hour={hud.hour} log={diaryLog} people={diaryPeople} onClose={() => setDiary(false)} />
      )}

      {hud.loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#15110e] text-[#cbbfa8]">
          <Grain opacity={0.5} />
          <div className="relative text-3xl font-bold tracking-[0.3em] text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{t('app.title')}</div>
          <div className="relative mt-3 animate-pulse text-sm tracking-widest">{t(style === 'paradise' ? 'world.loadingParadise' : 'world.loading')}</div>
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
