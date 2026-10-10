// 点储藏室的铁架子：家里都有什么。一组一组的格子（吃的、喝的、药、防身、车和家电、钱、空间里），数字按红黄绿。
import type { Holdings } from './World'
import { TONE } from './ui'

export function HoldingsPanel({ view, onClose }: { view: Holdings; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="flex max-h-[90vh] w-[min(760px,95vw)] flex-col gap-3 rounded-2xl bg-[#1d1915]/97 p-4 text-[#efe4d0] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[#e8c98a]/30"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between px-1">
          <div className="text-[18px] font-bold">📦 家里有什么</div>
          <div className="text-[12px] text-[#bfb29a]">家里 {view.mouths} 口人 · 一人一天大约吃一份、喝一份</div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {view.groups.filter((g) => g.items.length).map((g) => (
            <div key={g.title} className="rounded-xl bg-[#2a2420]/95 p-3 ring-1 ring-[#e8c98a]/20">
              <div className="mb-2 border-l-4 border-[#e8a33a] pl-2 text-[13px] font-bold">{g.title}</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.items.map((it) => (
                  <div key={it.name} className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/5" title={it.note}>
                    <div className="text-[24px] leading-none">{it.icon}</div>
                    <div className="min-w-0">
                      <div className="truncate text-[12px] text-[#d9ccb4]">{it.name}</div>
                      <div className="text-[14px] font-bold tabular-nums" style={{ color: it.tone ? TONE[it.tone] : undefined }}>{it.n}</div>
                      {it.note && <div className="truncate text-[10px] text-[#a99d8a]">{it.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-semibold hover:bg-white/20">关上</button>
        </div>
      </div>
    </div>
  )
}
