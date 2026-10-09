// 重生日记（二楼书桌上那本红本子）：前世记忆 + 倒计时 + 今生发生的事。
import { t, lt, type UiKey } from '../i18n'
import { memoriesYear1 } from '../content/memories'
import { DAYS_PER_MONTH, PROLOGUE_DAYS, SUNSET, calendarLabel } from './life'
import type { LogEntry } from './residents'
import { currentLife, lastDeath, rebirthPoints } from './save'
import { Grain } from './ui'

export interface DiaryPerson { icon: string; name: string; title: string; affection: number; met: boolean; home?: boolean; canStay?: boolean }

export function DiaryPanel({ day, hour, log, people, onClose }: {
  day: number; hour: number; log: LogEntry[]; people: DiaryPerson[]; onClose: () => void
}) {
  const after = day - PROLOGUE_DAYS
  const month = after >= 0 ? Math.floor(after / DAYS_PER_MONTH) + 1 : 0
  // 离"末日"或者"本月危机夜"还有多久（按游戏小时算）
  const hoursTo = (d: number, h: number) => (d - day) * 24 + (h - hour)
  const countdown = after < 0
    ? t('world.diary.toDoom', { n: Math.max(0, Math.ceil(hoursTo(PROLOGUE_DAYS, 0) / 24 * 10) / 10) })
    : t('world.diary.toCrisis', {
      m: month,
      kind: t(`crisisKind.${memoriesYear1[(month - 1) % 12].crisisKind}` as UiKey),
      n: Math.max(0, Math.round(hoursTo(PROLOGUE_DAYS + month * DAYS_PER_MONTH - 1, SUNSET + 2))),
    })
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="flex max-h-[86vh] w-[min(760px,92vw)] overflow-hidden rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 shrink-0 bg-gradient-to-b from-red-800 to-red-950" />
        <div className="relative flex-1 overflow-y-auto bg-[#f1e8d2] px-6 py-5 font-serif text-zinc-800">
          <Grain opacity={0.4} />
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-bold tracking-wide">{t('world.diary.title')}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {calendarLabel({ day, hour })}
                {currentLife() > 1 && <span className="ml-2 text-red-800">{t('world.diary.life', { n: currentLife(), p: rebirthPoints() })}</span>}
              </div>
            </div>
            <button onClick={onClose} className="rounded-full px-2 text-lg text-zinc-500 hover:bg-black/5">✕</button>
          </div>
          <div className="mt-3 rounded-lg bg-red-900/90 px-3 py-2 text-sm text-amber-50">⏳ {countdown}</div>
          {currentLife() > 1 && lastDeath() && (
            <div className="mt-2 rounded-lg bg-zinc-800/85 px-3 py-1.5 text-xs text-zinc-100">
              {t('world.diary.lastLife', { days: lastDeath()!.days, cause: t(`world.diary.cause.${lastDeath()!.cause}` as UiKey) })}
            </div>
          )}

          <div className="mt-4 text-sm font-semibold text-red-900">{t('world.diary.past')}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{t('world.diary.blurHint')}</div>
          <ol className="mt-2 space-y-1.5">
            {memoriesYear1.map((m) => {
              const ahead = m.month - Math.max(1, month)
              const blur = ahead <= 1 ? '' : ahead <= 3 ? 'blur-[0.6px]' : ahead <= 6 ? 'blur-[1.2px] opacity-80' : 'blur-[2px] opacity-60'
              const now = m.month === month
              const done = month > 0 && m.month < month
              return (
                <li key={m.month} className={`flex gap-2 rounded px-2 py-1 text-sm ${now ? 'bg-amber-200/70' : ''}`}>
                  <span className={`w-12 shrink-0 text-xs leading-5 ${now ? 'font-bold text-red-800' : 'text-zinc-500'}`}>
                    {t('world.diary.month', { m: m.month })}
                  </span>
                  <span className="w-10 shrink-0 text-xs leading-5 text-red-900/80">{t(`crisisKind.${m.crisisKind}` as UiKey)}</span>
                  <span className={`leading-5 ${blur} ${done ? 'text-zinc-400 line-through decoration-zinc-400/60' : ''}`}>{lt(m.memory)}</span>
                </li>
              )
            })}
          </ol>

          {people.some((p) => p.met) && (
            <>
              <div className="mt-5 text-sm font-semibold text-red-900">{t('world.diary.people')}</div>
              <ul className="mt-1 space-y-1">
                {people.filter((p) => p.met).map((p) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{p.icon}</span>
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs text-zinc-500">{p.title}</span>
                    {p.home && <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800">{t('world.diary.home')}</span>}
                    {p.canStay && <span className="rounded bg-rose-100 px-1 text-[10px] text-rose-800">{t('world.diary.canStay')}</span>}
                    <span className="ml-auto text-xs text-red-700">{'❤'.repeat(Math.max(1, Math.round(p.affection / 20)))} {Math.round(p.affection)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 text-sm font-semibold text-red-900">{t('world.diary.now')}</div>
          {log.length === 0 && <div className="mt-1 text-sm text-zinc-500">{t('world.diary.empty')}</div>}
          <ul className="mt-1 space-y-1">
            {[...log].reverse().map((l, k) => (
              <li key={k} className="text-sm leading-snug">
                <span className="mr-2 text-[11px] text-zinc-500">{calendarLabel({ day: l.day, hour: l.hour })}</span>
                {t(l.key as UiKey, l.vars)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
