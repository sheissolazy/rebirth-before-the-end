import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { lt, t, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { EMPTY_HUD, World, type FurnitureMenu, type Hud, type PhoneView } from './World'
import { loadStyle, saveStyle, type ArtStyle } from './paradise'
import { DEPRESSED, calendarLabel } from './life'
import type { PersonHud } from './residents'
import { DiaryPanel } from './DiaryPanel'
import { MapPanel, type AwayTrip, type MapMember } from './MapPanel'
import { TradePanel, type ShopView } from './TradePanel'
import { PhonePanel } from './PhonePanel'
import { TRIPS } from './expedition'
import type { LogEntry } from './residents'
import { PERK_DEFS, boughtPerks, rebirthPoints, togglePerk } from './save'
import { peopleStyle } from './people'
import { BTN_GOLD, BTN_RED, CHIP, GRAIN, Grain, PANEL, SERIF, TONE, toneOf, type Tone } from './ui'

const WELCOME_KEY = 'rbte-proto-welcome-v9'
const WELCOME_ITEMS = ['life', 'night', 'map', 'feel'] as const
const WELCOME_KEYS = ['click', 'wasd', 'wheel', 'space', 'speed', 'map', 'diary', 'act'] as const
const SPEEDS = [0, 1, 2, 3] as const
const SPEED_ICON = ['⏸', '▶', '▶▶', '▶▶▶']
/** 左上角"建设"小按钮 */
const BUILD = 'w-full rounded-sm bg-white/5 px-2 py-1 text-left text-[11px] text-[#efe4d0] ring-1 ring-[#e8c98a]/30 transition hover:bg-white/15 disabled:opacity-40'
const DBG = `${CHIP} px-3 py-1.5 text-left`
/** 左上角工具条的按钮 */
const TOOL = 'whitespace-nowrap rounded-sm bg-[#1d1915]/90 px-2 py-1 text-xs font-medium text-[#efe4d0] ring-1 ring-[#e8c98a]/30 shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition hover:bg-[#2a241e] hover:ring-[#e8c98a]/60'
const TOOL_ON = 'bg-[#3a3024] ring-[#e8c98a]/80 text-[#f4ecdc]'
const BUILD_DONE = 'rounded-sm bg-white/5 px-2 py-0.5 text-[11px] text-[#c9dcb0] ring-1 ring-white/10'
const MENU_ROW = 'block w-full rounded-sm px-2.5 py-1.5 text-left text-xs text-[#cbbfa8] transition hover:bg-white/10'
const logKey = (l: LogEntry) => `${l.day}-${l.hour}-${l.key}`
const FACE_MASK = 'radial-gradient(ellipse 90% 80% at 75% 30%, black 35%, transparent 75%)'


/** 状态词（像《这是我的战争》卡片上的"很饿""累了""受伤"）：只列不好的；严重的红、轻的黄 */
function statusWords(p: PersonHud): [string, Tone][] {
  const out: [string, Tone][] = []
  const n = p.needs
  if (p.injured > 0) out.push([t('world.st.injured', { h: p.injured }), 'bad'])
  if (p.health < 30) out.push([t('world.st.badlyHurt'), 'bad'])
  else if (p.health < 70) out.push([t('world.st.hurt'), 'warn'])
  if (n.hunger < 20) out.push([t('world.st.starving'), 'bad'])
  else if (n.hunger < 40) out.push([t('world.st.hungry'), 'warn'])
  if (n.thirst < 20) out.push([t('world.st.parched'), 'bad'])
  else if (n.thirst < 40) out.push([t('world.st.thirsty'), 'warn'])
  if (n.energy < 15) out.push([t('world.st.exhausted'), 'bad'])
  else if (n.energy < 30) out.push([t('world.st.tired'), 'warn'])
  if (n.mood < DEPRESSED) out.push([t('world.st.depressed'), 'bad'])
  else if (n.mood < 40) out.push([t('world.st.sad'), 'warn'])
  return out
}

/** 存货够几天：不到 2 天红、不到 5 天黄 */
function daysTone(days: number): Tone {
  return days < 2 ? 'bad' : days < 5 ? 'warn' : 'good'
}

function PersonCard({ p, portrait, selected, onClick }: { p: PersonHud; portrait?: string; selected: boolean; onClick: () => void }) {
  const doing = p.gone ? t(`world.do.${p.gone}` as UiKey) : p.trip
    ? t('world.away', { where: lt(locations.find((l) => l.id === p.trip!.id)?.name ?? { zh: '' }), h: p.trip.left.toFixed(1) })
    : t(`${p.going ? 'world.go' : 'world.do'}.${p.doing}` as UiKey)
  const words = p.gone ? [] : statusWords(p)
  // 饱、水、精力、心情、健康：统一红黄绿（低于 30 红、低于 60 黄）
  const bars: [string, string, number][] = [
    ['🍚', t('world.bar.hunger'), p.needs.hunger], ['💧', t('world.bar.thirst'), p.needs.thirst],
    ['☾', t('world.bar.energy'), p.needs.energy], ['♥', t('world.bar.mood'), p.needs.mood], ['✚', t('world.bar.health'), p.health],
  ]
  return (
    <button onClick={onClick}
      className={`relative h-[14rem] w-[9.25rem] shrink-0 overflow-hidden rounded-md text-left shadow-[0_8px_22px_rgba(0,0,0,0.5)] transition duration-200
        ${selected ? '-translate-y-1.5 ring-2 ring-[#e8c98a]' : 'ring-1 ring-black/50 hover:-translate-y-0.5'} ${p.gone ? 'grayscale' : ''}`}>
      {/* 卡片图（public/portraits/<模型>.jpg），略微压一点饱和度，加颗粒和暗角 */}
      <div className="absolute inset-0 bg-[#2e2924]" />
      {portrait && <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-cover object-top"
        style={{ filter: `saturate(${p.gone ? 0 : 0.9}) sepia(0.12) contrast(1.05) brightness(${p.gone ? 0.6 : 1})` }} />}
      <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 0.3 }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(130% 95% at 50% 28%, transparent 38%, rgba(10,8,6,0.7))' }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[#0e0b09] via-[#0e0b09]/80 to-transparent" />
      {/* 左上：特质、楼上 */}
      <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
        {p.trait && <span className="rounded-sm bg-[#e8c98a]/90 px-1 text-[10px] font-medium text-[#2b2117]">{p.trait}</span>}
        {!p.gone && <span title={t('world.fitness', { n: p.fitness })} className="rounded-sm bg-black/45 px-1 text-[10px] tabular-nums text-[#efe4d0]">💪{p.fitness}</span>}
        {p.floor === 1 && !p.trip && !p.gone && <span className="rounded-sm bg-black/45 px-1 text-[10px] text-[#efe4d0]">{t('world.upstairs')}</span>}
      </div>
      {/* 底部：名字、在干什么、状态词、四条细条 */}
      <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5">
        <div className="text-[17px] font-bold leading-tight tracking-[0.06em] text-[#f4ecdc] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" style={{ fontFamily: SERIF }}>{p.name}</div>
        <div className="mt-0.5 truncate text-[11px] text-[#d9ccb4]" title={doing}>{doing}</div>
        {p.doing === 'down' && !p.gone && <div className="mt-0.5 text-[11px] font-semibold text-[#ff8f7a]">{t('world.rescueHint')}</div>}
        <div className="mt-0.5 min-h-[15px] truncate text-[11px] font-semibold tracking-wide" style={{ fontFamily: SERIF }}>
          {words.map(([w, tone], i) => <span key={w} style={{ color: TONE[tone] }}>{i ? ' · ' : ''}{w}</span>)}
        </div>
        {p.gone !== 'dead' && (
          <div className="mt-1 space-y-[3px]">
            {bars.map(([icon, label, v]) => (
              <div key={icon} className="group/bar relative flex items-center gap-1">
                <span className="w-3 text-center text-[10px] leading-none text-[#efe4d0]">{icon}</span>
                <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.round(v))}%`, background: TONE[toneOf(v)] }} />
                </div>
                {/* 鼠标放上去：马上显示"精力：50" */}
                <span className="pointer-events-none absolute -inset-y-[4px] left-4 right-0 z-10 hidden items-center justify-center rounded-sm bg-black/85 text-[10px] font-semibold tabular-nums text-[#f4ecdc] ring-1 ring-white/15 group-hover/bar:flex">
                  {label}：{Math.round(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

/** 点家具弹出的小菜单（同一套深色纸面风格） */
function FurnitureMenuView({ menu, onPick, onClose }: { menu: FurnitureMenu; onPick: (o: FurnitureMenu['options'][number]) => void; onClose: () => void }) {
  const left = Math.min(menu.x + 12, window.innerWidth - 236)
  const top = Math.max(8, Math.min(menu.y - 10, window.innerHeight - 70 - menu.options.length * (menu.options.some((o) => o.text) ? 46 : 34)))
  return (
    <div className="fixed inset-0 z-30" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}>
      <div className="absolute w-56 overflow-hidden rounded-md bg-[#1b1714]/95 shadow-[0_10px_30px_rgba(0,0,0,0.55)] ring-1 ring-[#e8c98a]/40"
        style={{ left, top }} onClick={(e) => e.stopPropagation()}>
        <div className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: GRAIN, opacity: 0.35 }} />
        <div className="relative border-b border-[#e8c98a]/20 px-3 pb-1.5 pt-2">
          <div className="text-[15px] font-bold tracking-[0.08em] text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{menu.title}</div>
          {menu.mood !== undefined && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#c9bba2]">
              <span>♥ {t('world.bar.mood')}</span>
              <div className="h-[6px] w-16 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.round(menu.mood))}%`, background: TONE[toneOf(menu.mood)] }} />
              </div>
              <span className="tabular-nums" style={{ color: TONE[toneOf(menu.mood)] }}>{Math.round(menu.mood)}</span>
            </div>
          )}
          <div className="text-[11px] text-[#c9bba2]">{t(menu.target ? 'world.act.who' : 'world.use.who', { name: menu.who })}</div>
        </div>
        <div className="relative py-1">
          {menu.options.map((o) => (
            <button key={o.dish ?? o.label} onClick={() => onPick(o)} disabled={o.disabled}
              className="block w-full whitespace-pre-line px-3 py-1.5 text-left text-[13px] leading-snug text-[#efe4d0] transition hover:bg-[#e8c98a]/15 disabled:opacity-40">
              {o.text ? <>
                <span>{o.text.split('\n')[0]}</span>
                <span className="block text-[11px] text-[#a99d88]">{o.text.split('\n')[1]}</span>
              </> : t(o.label)}
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
  /** 左上角哪一块展开着（存货 / 任务 / 建设 / 空间）；一次只开一块 */
  const [pop, setPop] = useState<null | 'stock' | 'tasks' | 'build' | 'space'>(null)
  const togglePop = (k: NonNullable<typeof pop>) => setPop((p) => (p === k ? null : k))
  /** 日记：上次翻开时最新那条；刚冒出来的一条（右上角小纸条，几秒后消失） */
  const [logSeen, setLogSeen] = useState('')
  const [fresh, setFresh] = useState<LogEntry | null>(null)
  /** 右上角菜单：打开 / 正在确认哪一项；dayStart = "重过今天"回到几点 */
  const [menu, setMenu] = useState<null | 'open' | 'rewind' | 'restart'>(null)
  const [dayStart, setDayStart] = useState<string | null>(null)
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
  const [mapData, setMapData] = useState<{ checks: Record<string, ReturnType<World['tripCheck']>>; vanChecks: Record<string, ReturnType<World['tripCheck']>>; members: MapMember[]; away: AwayTrip[]; van: { fuel: number; home: boolean; armored: boolean; parkedOut: boolean } }>({ checks: {}, vanChecks: {}, members: [], away: [], van: { fuel: 0, home: true, armored: false, parkedOut: false } })
  /** 有人到了店里：交易界面 */
  const [shop, setShop] = useState<ShopView | null>(null)
  // 手机开着时的画面数据（下单、打电话以后重新取一次）
  const [phone, setPhone] = useState<PhoneView | null>(null)
  // 打丧尸时点防线 / 丧尸弹出的面板（开枪、燃烧瓶、救人）
  const [linePanel, setLinePanel] = useState(false)
  const setDiary = (open: boolean) => {
    const w = world.current
    if (w && open) { setDiaryLog(w.diaryLog()); setDiaryPeople(w.diaryPeople()); setLogSeen(w.latestLogKey()) }
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
        away: w.awayTrips(),
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
      w.onLinePanel = (open) => setLinePanel(open)
      w.onShop = (v) => { setMap(false); setShop(v) }
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
  // 家里几张嘴（存货够几天按人头算，一人一天大约一份吃的、一份水）
  const mouths = Math.max(1, hud.people.filter((p) => !p.gone).length)
  const blocking = welcome || diary || map || !!visitId || !!shop || !!phone
  // 面板一出现就停（layout effect 跟渲染同步，中间不会漏掉一次按空格或调速）
  useLayoutEffect(() => {
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

  // 日记：红点是翻开以后又多了几条；新的一条在日记本下面冒 6 秒
  const newest = hud.log[0] ? logKey(hud.log[0]) : ''
  const seenIdx = hud.log.findIndex((l) => logKey(l) === logSeen)
  const unread = !newest || !logSeen ? 0 : seenIdx < 0 ? hud.log.length : seenIdx
  const firstLog = useRef(true)
  useEffect(() => {
    if (!newest) return
    // 刚读档进来的那些不算新的
    if (firstLog.current) { firstLog.current = false; setLogSeen(newest); return }
    setFresh(hud.log[0])
    const id = setTimeout(() => setFresh(null), 6000)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest])

  const home = hud.mode === 'home'
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#15110e] text-zinc-900">
      <div ref={host} className="absolute inset-0" />

      {/* 片头放的时候把界面藏起来 */}
      <div className={hud.intro ? 'pointer-events-none opacity-0' : 'transition-opacity duration-1000'}>
      <div className="absolute left-3 top-3 flex w-[276px] flex-col gap-1.5">
        <div className={`${PANEL} px-3 py-2`}>
          <Grain />
          <div className="relative flex items-center gap-2 text-[16px] font-bold tabular-nums tracking-wide" style={{ fontFamily: SERIF }}>
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
          {/* 钱和晶核一直看得见；存货只显示最要紧的四样（按够吃几天红黄绿），点一下展开全部 */}
          <div className="relative mt-1.5 flex items-center gap-3 text-[13px] font-semibold tabular-nums" style={{ fontFamily: SERIF }}>
            <span title={t('world.money', { n: hud.money.toLocaleString() })}>💰 {hud.money.toLocaleString()}</span>
            <span title={t('world.cores', { n: hud.cores })}>💎 {hud.cores}</span>
          </div>
          <button onClick={() => togglePop('stock')} title={t('world.stock.more')}
            className="relative mt-1 flex w-full items-center gap-x-3 rounded-sm text-left text-xs font-semibold tabular-nums hover:brightness-125">
            <span style={{ color: TONE[daysTone(hud.food / mouths)] }}>🍚 {hud.food.toFixed(1)}</span>
            <span style={{ color: TONE[daysTone(hud.water / mouths)] }}>💧 {hud.water.toFixed(1)}</span>
            <span style={{ color: TONE[hud.ammo < 6 ? 'bad' : hud.ammo < 20 ? 'warn' : 'good'] }}>🔫 {hud.ammo}</span>
            <span style={{ color: TONE[hud.medkits < 1 ? 'bad' : hud.medkits < 3 ? 'warn' : 'good'] }}>🩹 {hud.medkits}</span>
            <span className="ml-auto text-[10px] text-[#8a7f6d]">{pop === 'stock' ? '▲' : '▼'}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {hud.goals && (
            <button onClick={() => togglePop('tasks')} className={`${TOOL} ${pop === 'tasks' ? TOOL_ON : ''}`}>
              {t('world.tool.tasks', { n: hud.goals.filter((g) => g.done).length, all: hud.goals.length })}
            </button>
          )}
          <button onClick={() => { setPop(null); setMap(true) }} className={TOOL}>{t('world.tool.out')}</button>
          <button onClick={() => { setPop(null); setPhone(world.current?.phoneView() ?? null) }} className={TOOL}>{t('world.tool.phone')}</button>
          <button onClick={() => togglePop('build')} className={`${TOOL} ${pop === 'build' ? TOOL_ON : ''}`}>{t('world.tool.build')}</button>
          <button onClick={() => togglePop('space')} className={`${TOOL} ${pop === 'space' ? TOOL_ON : ''}`}>
            {t('world.tool.space', { n: Math.round(hud.space.food + hud.space.water), cap: hud.space.cap })}
          </button>
        </div>
        {pop && (
          <div className={`${PANEL} px-3 py-2 text-xs`}>
            <Grain />
            {pop === 'stock' && (
              <div className="relative space-y-0.5 text-[#e6dac4]">
                <div className="mb-1 text-[13px] font-bold tracking-wide text-[#e8c98a]" style={{ fontFamily: SERIF }}>{t('world.stock.title')}</div>
                <div>🍚💧 {t('world.stock', { food: hud.food.toFixed(1), water: hud.water.toFixed(1) })}</div>
                <div>🔫 {t('world.ammo', { n: hud.ammo })} · 💎 {t('world.cores', { n: hud.cores })} · ⛽ {t('world.fuel', { n: hud.fuel })}</div>
                <div>💰 {t('world.money', { n: hud.money.toLocaleString() })} · 🩹 {t('world.medkits', { n: hud.medkits })}</div>
                {(hud.herbs > 0 || hud.bamboo > 0) && <div>{t('world.herbs', { n: hud.herbs, max: 3 })} · 🎋 {t('world.bamboo', { n: hud.bamboo })}</div>}
                <div className="pt-1 text-[11px] text-[#a99d88]">{t('world.stock.hint', { days: hud.daysLeft })}</div>
              </div>
            )}
            {pop === 'tasks' && hud.goals && (
              <div className="relative">
                <div className="mb-1 text-[13px] font-bold tracking-wide text-[#e8c98a]" style={{ fontFamily: SERIF }}>{t('world.goal.title')}</div>
                {hud.goals.map((g) => (
                  <div key={g.key} className={`flex gap-1.5 leading-snug ${g.done ? 'text-[#8a7f6d] line-through' : 'text-[#e6dac4]'}`}>
                    <span className={g.done ? 'text-[#9cbf7a]' : 'text-[#e8c98a]/70'}>{g.done ? '✓' : '○'}</span><span>{t(g.key as UiKey)}</span>
                  </div>
                ))}
              </div>
            )}
            {pop === 'build' && (
              <div className="relative flex flex-col gap-1">
                <div className="mb-0.5 text-[13px] font-bold tracking-wide text-[#e8c98a]" style={{ fontFamily: SERIF }}>{t('world.build.title')}</div>
                {/* 正在干的工程（可以几项同时干）：进度条、谁在干；停工了可以让选中的人接着干 */}
                {hud.build.map((b) => (
                  <div key={b.id} className="rounded-sm bg-white/5 px-2 py-1.5 ring-1 ring-[#e8c98a]/30">
                    <div className="text-[11px] text-[#efe4d0]">
                      {t(b.working ? 'world.build.doing' : 'world.build.paused', { what: t(`world.build.name.${b.id}` as UiKey), who: b.worker, p: b.p })}
                    </div>
                    <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, b.p)}%`, background: TONE[toneOf(b.p, 34, 67)] }} />
                    </div>
                    {!b.working && (
                      <button onClick={() => world.current?.continueBuild(b.id as 'trap' | 'wall' | 'garden' | 'mg')} className="mt-1 w-full rounded-sm bg-[#e8c98a]/90 py-0.5 text-[11px] font-semibold text-[#1d1915] hover:bg-[#f1d8a3]">
                        {t('world.build.resume', { who: hud.selected })}
                      </button>
                    )}
                  </div>
                ))}
                {hud.trap > 0 ? (
                  <div className={BUILD_DONE}>{t('world.trap.left', { n: hud.trap })}</div>
                ) : (
                  <button onClick={() => world.current?.buildGateTrap()} disabled={hud.build.some((b) => b.id === 'trap') || (hud.prologue ? hud.money < 1500 : hud.cores < 2)} className={BUILD} title={t('world.build.hours', { h: 1.5 })}>
                    {t(hud.prologue ? 'world.trap.build' : 'world.trap.buildCores')}
                  </button>
                )}
                {!hud.wall && !hud.build.some((b) => b.id === 'wall') && (
                  <button onClick={() => world.current?.buildYardWall()} disabled={hud.prologue ? hud.money < 6000 : hud.cores < 6} className={BUILD} title={t('world.build.hours', { h: 9 })}>
                    {t(hud.prologue ? 'world.wall.build' : 'world.wall.buildCores')}
                  </button>
                )}
                {!hud.garden.built ? (
                  <button onClick={() => world.current?.buildGardenPlot()} disabled={hud.build.some((b) => b.id === 'garden') || (hud.prologue ? hud.money < 800 : hud.cores < 2)} className={BUILD} title={t('world.build.hours', { h: 2 })}>
                    {t(hud.prologue ? 'world.garden.build' : 'world.garden.buildCores')}
                  </button>
                ) : (
                  <div className={BUILD_DONE}>{t(hud.garden.growth >= 1 ? 'world.garden.ripe' : 'world.garden.growing', { p: Math.round(hud.garden.growth * 100) })}</div>
                )}
                {!hud.mg && !hud.build.some((b) => b.id === 'mg') && (
                  <button onClick={() => world.current?.buildMachineGun()} disabled={hud.prologue ? hud.money < 8000 : hud.cores < 8} className={BUILD} title={t('world.build.hours', { h: 3 })}>
                    {t(hud.prologue ? 'world.mg.build' : 'world.mg.buildCores')}
                  </button>
                )}
                {hud.mg && <div className={BUILD_DONE}>{t('world.mg.done')}</div>}
                {hud.spikeNext >= 0 ? (
                  <button onClick={() => world.current?.craftSpikes()} disabled={hud.bamboo < 3} className={BUILD} title={t('world.spikes.tip')}>
                    {t('world.spikes.build', { n: hud.spikeNext + 1, have: hud.bamboo })}
                  </button>
                ) : (
                  <div className={BUILD_DONE}>{t('world.spikes.left', { a: hud.spikes[0], b: hud.spikes[1] })}</div>
                )}
              </div>
            )}
            {pop === 'space' && (
              <div className="relative">
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
        )}
        {hud.crisis && (
          <div className="w-fit rounded-sm bg-[#7c2d24] px-2.5 py-0.5 text-xs font-bold tracking-wide text-[#f4ecdc] ring-1 ring-[#e2553f]/50" style={{ fontFamily: SERIF }}>
            ⚠ {t('world.crisis')}{hud.crisisKind ? ` · ${t(`crisisKind.${hud.crisisKind}` as UiKey)}` : ''}
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

      {/* 右上角：一本日记（有新的就冒个小红点，点开才是全部日记）+ 一个菜单（重开、存档、声音、画风……都收在里面） */}
      <div className="absolute right-3 top-3 flex items-start gap-2">
        <div className="relative flex flex-col items-end">
          <button onClick={() => { setDiary(true); setLogSeen(hud.log[0] ? logKey(hud.log[0]) : '') }} title={t('world.notebook.tip')}
            className="group relative h-[52px] w-[42px] rounded-[3px] bg-gradient-to-br from-[#8a3a2c] to-[#5a2219] shadow-[2px_4px_10px_rgba(0,0,0,0.5)] ring-1 ring-black/40 transition hover:-translate-y-0.5">
            <span className="absolute inset-y-0 left-0 w-[7px] rounded-l-[3px] bg-[#3e160f]" />
            <span className="absolute left-[11px] right-[5px] top-[9px] h-[22px] rounded-[2px] border border-[#e8c98a]/60 text-center text-[11px] font-bold leading-[20px] text-[#f1d8a3]" style={{ fontFamily: SERIF }}>{t('world.notebook')}</span>
            <span className="absolute -bottom-[7px] right-[9px] h-[12px] w-[5px] bg-[#e8c98a] [clip-path:polygon(0_0,100%_0,100%_100%,50%_75%,0_100%)]" />
            {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e2553f] px-1 text-[10px] font-bold text-white ring-2 ring-[#1d1915]">{unread > 9 ? '9+' : unread}</span>}
          </button>
          {fresh && (
            <div className="pointer-events-none absolute right-0 top-[60px] w-56 rounded-sm bg-[#ece2cb]/95 px-2.5 py-1.5 text-[11px] leading-snug text-[#2f2418] shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-1 ring-[#b9a77f]/70" style={{ fontFamily: SERIF }}>
              <span className="mr-1 text-[10px] text-[#8a5a2b]">{calendarLabel({ day: fresh.day, hour: fresh.hour })}</span>{t(fresh.key as UiKey, fresh.vars)}
            </div>
          )}
        </div>
        <button onClick={() => { setDayStart(world.current?.dayStartLabel() ?? null); setMenu((m) => (m ? null : 'open')) }}
          className={`${CHIP} px-3 py-1.5 text-xs font-semibold text-[#e8c98a] ring-[#e8c98a]/60 ${menu ? 'bg-[#3a3024]' : ''}`}>{t('world.menu')}</button>
      </div>

      {menu && (
        <div className="absolute right-3 top-12 z-30 w-64">
        <div className={`p-1.5 ${PANEL} bg-[#1d1915]/95`}>
          <Grain />
          {menu === 'open' ? (
            <div className="relative flex flex-col">
              <button disabled={!dayStart} onClick={() => setMenu('rewind')}
                className="rounded-sm px-2.5 py-2 text-left transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent">
                <div className="text-sm font-bold text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{t('world.menu.rewind')}</div>
                <div className="mt-0.5 text-[11px] text-[#a99d88]">{dayStart ? t('world.menu.rewindSub', { when: dayStart }) : t('world.menu.rewindNone')}</div>
              </button>
              <button onClick={() => setMenu('restart')} className="rounded-sm px-2.5 py-2 text-left transition hover:bg-white/10">
                <div className="text-sm font-bold text-[#f4ecdc]" style={{ fontFamily: SERIF }}>{t('world.menu.restart')}</div>
                <div className="mt-0.5 text-[11px] text-[#a99d88]">{t('world.menu.restartSub')}</div>
              </button>
              <div className="mx-2 my-1 h-px bg-[#e8c98a]/15" />
              <button onClick={() => { setMenu(null); setWelcome(true) }} className={MENU_ROW}>
                {t('world.menu.help')}
              </button>
              <div className="mx-2 my-1 h-px bg-[#e8c98a]/15" />
              <button onClick={() => world.current?.toggleMute()} className={MENU_ROW}>{t(hud.muted ? 'world.menu.soundOff' : 'world.menu.soundOn')}</button>
              <button onClick={() => world.current?.toggleMusic()} className={MENU_ROW}>{t(hud.music ? 'world.menu.musicOn' : 'world.menu.musicOff')}</button>
              <button onClick={() => { setMenu(null); world.current?.snapshot() }} className={MENU_ROW}>{t('world.menu.photo')}</button>
              <button onClick={() => { setMenu(null); toggleStyle() }} className={MENU_ROW}>
                {t('world.style', { name: t(style === 'toon' ? 'world.style.toon' : 'world.style.paradise') })}
              </button>
              {style === 'paradise' && (
                <button onClick={() => world.current?.togglePeople()} className={MENU_ROW}>
                  {t('world.people', { name: t(peopleStyle() === 'toon' ? 'world.people.toon' : 'world.people.real') })}
                </button>
              )}
              <a href="#text" className={MENU_ROW}>{t('world.textVersion')}</a>
            </div>
          ) : (
            <div className="relative p-2">
              <p className="text-[13px] leading-relaxed text-[#e6dac4]" style={{ fontFamily: SERIF }}>
                {menu === 'rewind' ? t('world.menu.rewindAsk', { when: dayStart ?? '' }) : t('world.menu.restartAsk')}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => (menu === 'rewind' ? world.current?.rewindDay() : world.current?.restart())}
                  className={`flex-1 py-1.5 text-sm ${BTN_RED}`}>{t('world.menu.sure')}</button>
                <button onClick={() => setMenu('open')} className={`flex-1 py-1.5 text-sm ${CHIP}`}>{t('world.menu.cancel')}</button>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex gap-2">
        {hud.people.map((p) => (
          <div key={p.name} className="relative">
            {/* 还没走出去的那一趟：卡片上方一个"叫回来" */}
            {p.trip?.leaving && (
              <button onClick={() => world.current?.cancelTrip(p.trip!.n)}
                className="absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#e8c98a] px-2.5 py-0.5 text-[11px] font-semibold text-[#1d1915] shadow-md hover:bg-[#f1d8a3]">
                {t('world.trip.recall')}
              </button>
            )}
            <PersonCard p={p} portrait={hud.portraits[p.name]} selected={p.name === hud.selected} onClick={() => world.current?.select(p.name)} />
          </div>
        ))}
      </div>


      {hud.sleepSkip && !hud.siege && (
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-[#1d1915]/85 px-4 py-1.5 text-[13px] text-[#cfd0f0] ring-1 ring-[#8a8fd6]/40" style={{ fontFamily: SERIF }}>
          {t('world.sleepSkip')}
        </div>
      )}
      {hud.siege && (
        <div className="absolute left-1/2 top-14 w-80 -translate-x-1/2 overflow-hidden rounded-md bg-[#2a0f0c]/90 px-4 py-2 text-[#f4ecdc] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-[#e2553f]/40">
          <Grain />
          <div className="relative text-[15px] font-bold tracking-wide" style={{ fontFamily: SERIF }}>🧟 {t(hud.siege.ambush ? 'world.ambush' : 'world.siege', { n: hud.siege.left })}</div>
          {hud.siege.layer && (
            <div className="relative mt-1 flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0">{t(`world.layer.${hud.siege.layer}` as UiKey)}</span>
              <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full" style={{ width: `${Math.round((hud.siege.hp / hud.siege.max) * 100)}%`, background: TONE[toneOf((hud.siege.hp / hud.siege.max) * 100)] }} />
              </div>
              <span className="tabular-nums">{Math.ceil(hud.siege.hp)}</span>
            </div>
          )}
          {!linePanel && <div className="relative mt-1 text-[11px] text-[#e9c9b9]">{t('world.line.hint')}</div>}
        </div>
      )}
      {/* 防线面板：点防线或者丧尸才弹出来；家里人平时只用手上的家伙，开枪、扔燃烧瓶、救人都在这里下令 */}
      {hud.siege && linePanel && (
        <div className="absolute left-1/2 top-[8.6rem] w-80 -translate-x-1/2 overflow-hidden rounded-md bg-[#1d1915]/95 px-3 py-2.5 text-[#f4ecdc] shadow-[0_10px_28px_rgba(0,0,0,0.55)] ring-1 ring-[#e8c98a]/40">
          <Grain />
          <div className="relative flex items-center justify-between">
            <div className="text-[14px] font-bold tracking-wide" style={{ fontFamily: SERIF }}>🛡 {hud.siege.layer ? t(`world.layer.${hud.siege.layer}` as UiKey) : t('world.line.inside')}</div>
            <button onClick={() => setLinePanel(false)} className="px-1 text-[13px] text-[#a99d88] hover:text-[#f4ecdc]">✕</button>
          </div>
          <div className="relative mt-1 text-[11px] leading-snug text-[#d9ccb4]">
            {(Object.entries(hud.siege.kinds) as [string, number][]).map(([k, n]) => `${t(`world.zkind.${k}` as UiKey)}×${n}`).join(' · ') || t('world.line.none')}
          </div>
          {hud.siege.target && <div className="relative mt-0.5 text-[11px] font-semibold text-[#ff8f7a]">🎯 {t('world.line.target', { what: t(`world.zkind.${hud.siege.target}` as UiKey) })}</div>}
          <div className="relative mt-2 flex flex-col gap-1.5">
            {hud.siege.shooter ? (
              <button onClick={() => world.current?.fire()}
                disabled={hud.siege.shooter.cool > 0 || (hud.siege.shooter.weapon === 'shotgun' && hud.ammo <= 0)}
                className="relative overflow-hidden rounded-sm bg-[#7c2d24] px-2 py-1.5 text-left text-[12px] font-semibold ring-1 ring-white/10 hover:bg-[#93372c] disabled:opacity-60">
                {hud.siege.shooter.cool > 0 && <span className="absolute inset-y-0 left-0 bg-white/10" style={{ width: `${Math.min(100, (hud.siege.shooter.cool / 2.4) * 100)}%` }} />}
                <span className="relative">{t(hud.siege.shooter.weapon === 'shotgun' ? 'world.line.shoot' : 'world.line.bolt', { who: hud.siege.shooter.name, n: hud.ammo })}</span>
              </button>
            ) : <div className="text-[11px] text-[#a99d88]">{t('world.line.noGun')}</div>}
            {hud.siege.mg !== null && (
              <button onClick={() => world.current?.machineGun()} disabled={hud.siege.mg > 0 || hud.ammo < 3}
                className="relative overflow-hidden rounded-sm bg-[#5a3a1c] px-2 py-1.5 text-left text-[12px] font-semibold ring-1 ring-white/10 hover:bg-[#6e4823] disabled:opacity-60">
                {hud.siege.mg > 0 && <span className="absolute inset-y-0 left-0 bg-white/10" style={{ width: `${Math.min(100, (hud.siege.mg / 6) * 100)}%` }} />}
                <span className="relative">{t('world.mg.fire', { n: hud.ammo })}</span>
              </button>
            )}
            <button disabled={hud.molotovs <= 0} onClick={() => world.current?.throwMolotov()}
              className="rounded-sm bg-[#c2551f] px-2 py-1.5 text-left text-[12px] font-semibold ring-1 ring-white/10 hover:bg-[#d8652b] disabled:opacity-40">
              {t('world.molotov', { n: hud.molotovs })}
            </button>
            {hud.siege.downed.map((name) => (
              <button key={name} disabled={hud.medkits <= 0} onClick={() => world.current?.rescueByName(name)}
                className="rounded-sm bg-[#2f5d3a] px-2 py-1.5 text-left text-[12px] font-semibold ring-1 ring-white/10 hover:bg-[#3a7048] disabled:opacity-40">
                {t('world.line.rescue', { who: name, n: hud.medkits })}
              </button>
            ))}
          </div>
          <div className="relative mt-1.5 text-[10px] text-[#a99d88]">{t('world.line.tip')}</div>
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
          <button onClick={() => world.current?.debugVisitor('scout')} className={DBG}>{t('world.debug.scout')}</button>
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
                  <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: `url(${hud.visit.face})`, filter: 'saturate(0.9) sepia(0.12) contrast(1.05)' }} />
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
                  style={{ backgroundImage: `url(${face})`, filter: 'saturate(0.75) sepia(0.2)',
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
          members={mapData.members} van={mapData.van} away={mapData.away}
          onGo={(id, names, van) => { if (world.current?.startTrip(id, names, van)) setMap(false) }}
          onClose={() => setMap(false)} />
      )}

      {shop && (
        <TradePanel key={shop.tripId} view={shop} onCheckout={(cart, sell) => {
          const r = world.current?.checkout(shop.tripId, cart, sell) ?? 'no'
          if (r === 'ok') setShop(null)
          return r
        }} />
      )}

      {phone && <PhonePanel view={phone} onClose={() => setPhone(null)}
        onOrder={(cart) => { const r = world.current?.placeOrder(cart) ?? 'nosignal'; setPhone(world.current?.phoneView() ?? null); return r }}
        onCall={(id) => { const r = world.current?.callContact(id) ?? { r: 'nosignal' }; setPhone(world.current?.phoneView() ?? null); return r }}
        onInvite={(id) => { const r = world.current?.inviteContact(id) ?? 'nosignal'; setPhone(world.current?.phoneView() ?? null); return r }} />}
      {furn && <FurnitureMenuView menu={furn} onClose={() => setFurn(null)}
        onPick={(o) => { if (o.act && furn.target) world.current?.interactWith(furn.target, o.act); else if (o.cmd) world.current?.menuCommand(o.cmd, furn.target); else if (o.spot) world.current?.useFurniture(o.spot, o.dish) }} />}

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
