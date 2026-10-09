// 临江市地图（客厅墙上那张）：选地方、选人、出发。
import { useState } from 'react'
import { t, lt, type UiKey } from '../i18n'
import { locations } from '../content/locations'
import { TRIPS, VAN, tripCost, tripHours, vanAllowed } from './expedition'

export interface MapMember { name: string; health: number }
type Check = 'ok' | 'phase' | 'money' | 'late' | 'busy' | 'cores' | 'fuel'

export function MapPanel({ prologue, check, members, van, onGo, onClose }: {
  prologue: boolean
  check: (id: string, van: boolean) => Check
  members: MapMember[]
  van: { fuel: number; home: boolean }
  onGo: (id: string, names: string[], van: boolean) => void
  onClose: () => void
}) {
  const [pick, setPick] = useState<string | null>(null)
  const [who, setWho] = useState<string[]>(() => members.slice(0, 1).map((m) => m.name))
  // 有油、车在家就默认开车去
  const [drive, setDrive] = useState(van.fuel > 0 && van.home)
  // 地点按文字版的阶段筛；加油站这种 3D 原型里两边都能去的，按出门规则来
  const places = locations.filter((l) => l.id !== 'home' && (l.phase === 'both' || l.phase === (prologue ? 'prologue' : 'apocalypse')
    || TRIPS.some((x) => x.id === l.id && x.phase === 'both')))
  const trip = TRIPS.find((x) => x.id === pick)
  const loc = locations.find((l) => l.id === pick)
  const canDrive = !!trip && vanAllowed(trip.id) && van.fuel > 0 && van.home
  const byVan = canDrive && drive
  const status: Check | null = trip ? check(trip.id, byVan) : null
  const toggle = (n: string) => setWho((w) => (w.includes(n) ? w.filter((x) => x !== n) : [...w, n]))
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="flex w-[min(980px,94vw)] gap-4 rounded-2xl bg-[#efe6cf] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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

        <div className="flex w-64 shrink-0 flex-col">
          <div className="flex items-start justify-between">
            <div className="text-lg font-bold">{t('world.map.title')}</div>
            <button onClick={onClose} className="rounded-full px-2 text-lg text-zinc-500 hover:bg-black/5">✕</button>
          </div>
          {!trip || !loc ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">{t('world.map.pick')}</p>
          ) : (
            <div className="mt-2 flex flex-1 flex-col">
              <div className="text-base font-semibold">{loc.icon} {lt(loc.name)}</div>
              <div className="mt-1 text-xs text-zinc-600">{lt(loc.desc)}</div>
              <div className="mt-2 rounded-lg bg-white/60 p-2 text-sm leading-relaxed">{t(`world.tripInfo.${trip.id}` as UiKey)}</div>
              <ul className="mt-2 space-y-0.5 text-xs text-zinc-700">
                <li>⏱ {t('world.map.hours', { h: tripHours(trip, byVan) })}</li>
                <li>💰 {tripCost(trip, prologue) ? t('world.map.cost', { n: tripCost(trip, prologue) }) : t('world.map.free')}</li>
                <li>🧟 {trip.danger && !prologue
                  ? t('world.map.danger', { n: Math.round(Math.min(0.9, trip.danger * (byVan ? VAN.danger : 1)) * 100) })
                  : t('world.map.safe')}</li>
              </ul>
              {vanAllowed(trip.id) && (
                canDrive ? (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg bg-white/60 p-2 text-xs leading-snug">
                    <input type="checkbox" className="mt-0.5" checked={drive} onChange={(e) => setDrive(e.target.checked)} />
                    <span>
                      <span className="font-semibold">{t('world.map.van')}</span>
                      <span className="block text-zinc-600">{t('world.map.vanInfo', { n: van.fuel })}</span>
                      {!prologue && <span className="block text-zinc-500">{t('world.map.vanNoise')}</span>}
                    </span>
                  </label>
                ) : (
                  <div className="mt-2 rounded-lg bg-white/40 p-2 text-xs text-zinc-500">{t(van.home ? 'world.map.vanNoFuel' : 'world.map.vanAway')}</div>
                )
              )}
              <div className="mt-3 text-xs font-semibold text-zinc-700">{t('world.map.who')}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button key={m.name} onClick={() => toggle(m.name)}
                    className={`rounded-full px-2.5 py-1 text-xs shadow-sm ${who.includes(m.name) ? 'bg-amber-400 font-semibold' : 'bg-white/80'}`}>
                    {m.name}{m.health < 60 ? ' 🩹' : ''}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {status !== 'ok' && <div className="mt-2 text-xs text-red-700">{t(`world.map.why.${status}` as UiKey)}</div>}
              <button disabled={status !== 'ok' || who.length === 0}
                onClick={() => onGo(trip.id, who, byVan)}
                className="mt-2 rounded-lg bg-red-800 py-2 text-sm font-semibold text-amber-50 shadow disabled:opacity-40">
                {t('world.map.go')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
