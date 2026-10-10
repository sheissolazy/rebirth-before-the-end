// 临江市地图（客厅墙上那张）：选地方、选人、出发。
import { useState } from 'react'
import { t, lt, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { TRIPS, VAN, tripCost, tripHours, vanAllowed } from './expedition'
import { capacity, shopFor } from './shop'
import { Grain, SERIF } from './ui'

export interface MapMember { name: string; health: number }
/** 已经在外面的几拨人 */
export interface AwayTrip { who: string; where: string; left: number; van: boolean; shopping: boolean }
type Check = 'ok' | 'phase' | 'money' | 'late' | 'busy' | 'cores' | 'fuel'

export function MapPanel({ prologue, check, members, van, away, onGo, onClose }: {
  prologue: boolean
  away: AwayTrip[]
  check: (id: string, van: boolean) => Check
  members: MapMember[]
  van: { fuel: number; home: boolean; armored: boolean; parkedOut: boolean }
  onGo: (id: string, names: string[], van: boolean) => void
  onClose: () => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [who, setWho] = useState<string[]>(() => members.slice(0, 1).map((m) => m.name))
  // 有油、车在家就默认开车去
  const [drive, setDrive] = useState(van.fuel >= 0.2 && van.home)
  // 地点按文字版的阶段筛；加油站这种 3D 原型里两边都能去的，按出门规则来
  const places = locations.filter((l) => l.id !== 'home' && (l.phase === 'both' || l.phase === (prologue ? 'prologue' : 'apocalypse')
    || TRIPS.some((x) => x.id === l.id && x.phase === 'both')))
  const trip = TRIPS.find((x) => x.id === pick)
  const loc = locations.find((l) => l.id === pick)
  const canDrive = !!trip && vanAllowed(trip.id) && van.fuel >= 0.2 && van.home && check(trip.id, true) !== 'fuel'
  const byVan = canDrive && drive
  const shop = trip ? shopFor(trip.id, prologue) : null
  // 能开的车（现在只有一辆面包车）
  const cars = van.fuel >= 0.2 && van.home && !away.some((a) => a.van) ? 1 : 0
  const status: Check | null = trip ? check(trip.id, byVan) : null
  const toggle = (n: string) => setWho((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n]))
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative flex w-[min(980px,94vw)] gap-4 overflow-hidden rounded-md bg-[#ece2cb] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-[#b9a77f]/70" onClick={(e) => e.stopPropagation()}>
        <Grain opacity={0.45} />
        <div className="relative aspect-[4/3] flex-1 overflow-hidden rounded-xl border-2 border-[#b9a77f] bg-[#f4ecd6]">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 75" preserveAspectRatio="none">
            {/* 临江：从东北流到东南的一条江 */}
            <path d="M78 0 C 70 18, 92 30, 84 48 S 70 66, 100 75 L 100 0 Z" fill="#bcd6dc" />
            <path d="M0 40 L 100 38 M 50 0 L 52 75 M 10 70 L 90 8" stroke="#d8c9a6" strokeWidth="1.2" fill="none" />
            {places.map((p) => (
              <line key={p.id} x1={50} y1={55 * 0.75} x2={p.pos.x} y2={p.pos.y * 0.75} stroke="#a8946a" strokeWidth="0.35" strokeDasharray="1 1" />
            ))}
          </svg>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: '50%', top: '55%' }}>
            <div className="text-2xl">🏡</div>
            <div className="rounded bg-white/70 px-1 text-[11px] font-semibold">{t('world.map.home')}</div>
          </div>
          {places.map((p) => {
            const known = TRIPS.some((x) => x.id === p.id)
            const st = known ? check(p.id, false) : 'phase'
            return (
              <button key={p.id} onClick={() => known && setPick(p.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg px-1.5 py-0.5 text-center transition
                  ${pick === p.id ? 'bg-amber-300 shadow-md' : known ? 'hover:bg-white/70' : 'opacity-40'}`}
                style={{ left: `${p.pos.x}%`, top: `${p.pos.y}%` }}>
                <div className={`text-xl ${st !== 'ok' && known ? 'grayscale' : ''}`}>{p.icon}</div>
                <div className="whitespace-nowrap text-[11px] font-medium">{lt(p.name)}</div>
              </button>
            )
          })}
        </div>

        <div className="relative flex w-64 shrink-0 flex-col">
          <div className="flex items-start justify-between">
            <div className="text-xl font-bold tracking-wide text-[#3a2a1a]" style={{ fontFamily: SERIF }}>{t('world.map.title')}</div>
            <button onClick={onClose} className="rounded-full px-2 text-lg text-zinc-500 hover:bg-black/5">✕</button>
          </div>
          {away.length > 0 && (
            <div className="mt-2 rounded-sm bg-[#3a2a1a]/90 px-2 py-1.5 text-[11px] leading-snug text-[#f4ecdc]">
              <div className="mb-0.5 font-semibold text-[#e8c98a]">{t('world.map.away')}</div>
              {away.map((a, k) => (
                <div key={k}>{a.van ? '🚐' : '🚶'} {a.who} → {a.where} · {a.shopping ? t('world.map.inShop') : t('world.map.backIn', { h: a.left.toFixed(1) })}</div>
              ))}
            </div>
          )}
          {!trip || !loc ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">{t('world.map.pick')}</p>
          ) : (
            <div className="mt-2 flex flex-1 flex-col">
              <div className="text-base font-bold text-[#3a2a1a]" style={{ fontFamily: SERIF }}>{loc.icon} {lt(loc.name)}</div>
              <div className="mt-1 text-xs text-zinc-600">{lt(loc.desc)}</div>
              <div className="mt-2 rounded-lg bg-white/60 p-2 text-sm leading-relaxed">
                {shop ? t('world.map.shopInfo', { n: capacity(Math.max(1, who.length), byVan) }) : t(`world.tripInfo.${trip.id}` as UiKey)}
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-zinc-700">
                <li>⏱ {t('world.map.hours', { h: tripHours(trip, byVan) })}</li>
                <li>💰 {shop ? t(shop.currency === 'money' ? 'world.map.payInShop' : 'world.map.payCores') : tripCost(trip, prologue) ? t('world.map.cost', { n: tripCost(trip, prologue) }) : t('world.map.free')}</li>
                <li>🧟 {trip.danger && !prologue
                  ? t('world.map.danger', { n: Math.round(Math.min(0.9, trip.danger * (byVan ? (van.armored ? VAN.armorDanger : VAN.danger) : 1)) * 100) })
                  : t('world.map.safe')}</li>
              </ul>
              {/* 怎么去：走路，或者开车（看家里有几辆车能开） */}
              <div className="mt-3 text-xs font-semibold text-zinc-700">{t('world.map.how', { n: cars })}</div>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <button onClick={() => setDrive(false)}
                  className={`rounded-sm px-2 py-1.5 text-left text-xs ring-1 transition ${!byVan ? 'bg-[#3a2a1a] text-[#f4ecdc] ring-[#3a2a1a]' : 'bg-white/50 text-[#3a2a1a] ring-[#b9a77f] hover:bg-white/80'}`}>
                  <div className="font-semibold">🚶 {t('world.map.walk')}</div>
                  <div className="opacity-75">{t('world.map.hours', { h: tripHours(trip, false) })}</div>
                </button>
                <button onClick={() => canDrive && setDrive(true)} disabled={!canDrive}
                  className={`rounded-sm px-2 py-1.5 text-left text-xs ring-1 transition disabled:opacity-45 ${byVan ? 'bg-[#3a2a1a] text-[#f4ecdc] ring-[#3a2a1a]' : 'bg-white/50 text-[#3a2a1a] ring-[#b9a77f] hover:bg-white/80'}`}>
                  <div className="font-semibold">🚐 {t('world.map.drive')}</div>
                  <div className="opacity-75">{vanAllowed(trip.id) ? (canDrive ? t('world.map.hours', { h: tripHours(trip, true) }) : t(away.some((a) => a.van) ? 'world.map.vanAway' : van.parkedOut ? 'world.map.vanParked' : 'world.map.vanNoFuel')) : t('world.map.noDrive')}</div>
                </button>
              </div>
              {byVan && <div className="mt-1 text-[11px] text-zinc-600">{t('world.map.vanInfo', { n: van.fuel })}{!prologue ? ` ${t(van.armored ? 'world.map.vanArmored' : 'world.map.vanNoise')}` : ''}</div>}
              <div className="mt-3 text-xs font-semibold text-zinc-700">{t('world.map.who')}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button key={m.name} onClick={() => toggle(m.name)}
                    className={`rounded-sm px-2.5 py-1 text-xs ring-1 transition ${who.includes(m.name) ? 'bg-[#3a2a1a] font-semibold text-[#f4ecdc] ring-[#3a2a1a]' : 'bg-white/50 text-[#3a2a1a] ring-[#b9a77f] hover:bg-white/80'}`}>
                    {m.name}{m.health < 60 ? ' 🩹' : ''}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {status !== 'ok' && <div className="mt-2 text-xs text-red-700">{t(`world.map.why.${status}` as UiKey)}</div>}
              <button disabled={status !== 'ok' || who.length === 0}
                onClick={() => onGo(trip.id, who, byVan)}
                className="mt-2 rounded-sm bg-[#7c2d24] py-2 text-sm font-semibold tracking-widest text-[#f4ecdc] shadow transition hover:bg-[#93372c] disabled:opacity-40" style={{ fontFamily: SERIF }}>
                {t('world.map.go')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
