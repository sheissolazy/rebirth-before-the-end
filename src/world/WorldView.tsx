import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { World, type Hud } from './World'

export default function WorldView() {
  const host = useRef<HTMLDivElement>(null)
  const world = useRef<World | null>(null)
  const [hud, setHud] = useState<Hud>({ loading: true, mode: 'home', floor: 0, selected: '林知夏' })

  useEffect(() => {
    let w: World | null = null
    try {
      w = new World(host.current!, setHud)
      world.current = w
    } catch (e) {
      // 手机不支持 WebGL 等情况：下一拍再显示错误
      queueMicrotask(() => setHud((h) => ({ ...h, loading: false, error: String(e) })))
    }
    return () => {
      w?.dispose()
      world.current = null
    }
  }, [])

  const home = hud.mode === 'home'
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-sky-200 text-zinc-900">
      <div ref={host} className="absolute inset-0" />

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        <div className="rounded-full bg-white/85 px-3 py-1 text-sm font-medium shadow">
          {t(home ? 'world.mode.home' : 'world.mode.outside')}
        </div>
        {home && (
          <div className="rounded-full bg-white/70 px-3 py-1 text-xs shadow">
            {t('world.selected', { name: hud.selected })}
          </div>
        )}
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

      <a href="#text" className="absolute right-3 top-3 rounded-full bg-zinc-900/70 px-3 py-1 text-xs text-white shadow">
        {t('world.textVersion')}
      </a>

      <div className="pointer-events-none absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-xl bg-zinc-900/65 px-4 py-2 text-center text-xs text-white">
        {home && hud.floor === 1 ? t('world.floor2Hint') : t(home ? 'world.help.home' : 'world.help.outside')}
      </div>

      {hud.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-sky-200/80 text-sm">{t('world.loading')}</div>
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
