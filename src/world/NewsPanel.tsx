// 点电视选"听听新闻"：一台老电视的样子——木头外壳、圆角屏幕、扫描线。
// 末日前是新闻频道（头条、物价、快递、天气）；末日后是应急广播（下一个大夜、新出现的丧尸、天气）；停电了屏幕是黑的。
import { t } from '../i18n'
import type { NewsView } from './news'
import { TONE } from './ui'

export function NewsPanel({ view, onClose }: { view: NewsView; onClose: () => void }) {
  const off = view.mode === 'off'
  const radio = view.mode === 'radio'
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[min(560px,94vw)] rounded-[22px] bg-gradient-to-b from-[#6b4a30] to-[#4a321f] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-black/40"
        onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden rounded-[18px] bg-[#0d0f10] p-1.5 ring-4 ring-[#2a2b2c]">
          <div className={`relative min-h-[240px] rounded-[14px] px-5 py-4 ${off ? 'bg-[#121416]' : radio ? 'bg-[#e8b923] text-[#1a1a1a]' : 'bg-gradient-to-b from-[#2b5c9e] to-[#173762] text-white'}`}>
            {!off && (
              <div className="mb-2 flex items-center justify-between text-[12px] font-semibold opacity-85">
                <span>{radio ? '📢' : '📺'} {view.channel}</span>
                <span className="tabular-nums">{view.date}</span>
              </div>
            )}
            <div className={`text-[16px] font-bold leading-relaxed ${off ? 'pt-14 text-center text-[#8b8f93]' : ''}`}>{view.headline}</div>
            {view.thought && (
              <div className={`mt-2 text-[13px] italic ${off ? 'text-center text-[#6c7075]' : radio ? 'text-[#4a3a00]' : 'text-[#cfe0ff]'}`}>（{view.thought}）</div>
            )}
            {view.lines.length > 0 && (
              <div className={`mt-3 space-y-1.5 rounded-xl px-3 py-2.5 text-[13px] leading-snug ${radio ? 'bg-black/10' : 'bg-black/25'}`}>
                {view.lines.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0">{l.icon}</span>
                    <span style={{ color: l.tone === 'bad' ? (radio ? '#8c1c13' : '#ffb3a6') : l.tone === 'warn' ? (radio ? '#5a3c00' : '#ffe08a') : undefined }}
                      className={l.tone ? 'font-semibold' : ''}>{l.text}</span>
                  </div>
                ))}
              </div>
            )}
            {/* 扫描线 */}
            {!off && <div className="pointer-events-none absolute inset-0 rounded-[14px] bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.12)_0px,rgba(0,0,0,0.12)_1px,transparent_1px,transparent_3px)]" />}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex gap-2">
            {[0, 1].map((k) => <span key={k} className="h-6 w-6 rounded-full bg-gradient-to-b from-[#d8d2c4] to-[#8f887a] shadow-inner ring-1 ring-black/30" />)}
          </div>
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-white" style={{ background: TONE.bad }}>⏻ {t('world.news.close')}</button>
        </div>
      </div>
    </div>
  )
}
