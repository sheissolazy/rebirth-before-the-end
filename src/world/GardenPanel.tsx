// 点一块菜地：上面是这块地现在的样子（种的什么、长到哪了、今天浇没浇水），能收就收、能浇就浇；
// 下面是家里的种子（一包种一块地），点"种这个"选中的人就去种（原来种的拔掉）。
import type { CropId } from './garden'
import type { PlotView } from './World'
import { TONE } from './ui'

export function GardenPanel({ view, onAct, onClose }: {
  view: PlotView
  onAct: (act: 'plant' | 'water' | 'harvest' | 'clear', crop?: CropId) => void
  onClose: () => void
}) {
  const c = view.crop
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45" onClick={onClose}>
      <div className="flex max-h-[90vh] w-[min(460px,94vw)] flex-col gap-3 rounded-2xl bg-[#1d1915]/97 p-4 text-[#efe4d0] shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-[#e8c98a]/30"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <div className="text-[17px] font-bold">🌱 第 {view.i + 1} 块菜地</div>
          <div className="text-[11px] text-[#bfb29a]">让 {view.who} 去干</div>
        </div>
        <div className="rounded-xl bg-gradient-to-b from-[#4a3424] to-[#2f2116] px-4 py-3 ring-1 ring-[#e8a33a]/25">
          {c ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-[40px] leading-none">{c.icon}</div>
                <div className="flex-1">
                  <div className="text-[15px] font-bold">{c.name}</div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${c.p}%`, background: c.ripe ? TONE.good : TONE.warn }} /></div>
                  <div className="mt-1 text-[12px] text-[#d9ccb4]">{c.ripe ? '熟了，可以收了' : `长到 ${c.p}% · ${c.watered ? '今天浇过水了' : '今天还没浇水（不浇长得慢三倍多）'}`}</div>
                </div>
              </div>
              <div className="mt-2.5 flex gap-2">
                {c.ripe && <button onClick={() => onAct('harvest')} className="flex-1 rounded-lg py-1.5 text-[13px] font-bold text-[#1d1915]" style={{ background: TONE.good }}>🧺 去收菜</button>}
                {!c.ripe && !c.watered && <button disabled={view.water < 0.3} onClick={() => onAct('water')} className="flex-1 rounded-lg bg-[#5aa0d8] py-1.5 text-[13px] font-bold text-white disabled:opacity-35">💧 去浇水</button>}
                <button onClick={() => onAct('clear')} className="rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-semibold hover:bg-white/20">拔掉</button>
              </div>
            </>
          ) : (
            <div className="text-[13px] text-[#d9ccb4]">空地。从下面挑一样种上（不选的话，家里人会拿现有的种子种上）。</div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mb-1.5 text-[12px] font-semibold text-[#d9ccb4]">家里的种子（一包种一块地；收菜时一半机会留一包种）</div>
          <div className="space-y-1.5">
            {view.seeds.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/5">
                <div className="text-[26px] leading-none">{s.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{s.name} <span className="text-[11px] font-normal text-[#bfb29a]">· {s.days} 天 · 收 {s.gives}</span></div>
                  <div className="truncate text-[11px] text-[#a99d8a]">{s.desc}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] font-bold tabular-nums" style={{ color: s.have > 0 ? TONE.good : TONE.bad }}>{s.have} 包</div>
                  <button disabled={s.have <= 0} onClick={() => onAct('plant', s.id)} className="mt-0.5 rounded-full bg-[#e8a33a] px-2.5 py-0.5 text-[11px] font-bold text-[#1d1915] disabled:opacity-30">{c ? '改种这个' : '种这个'}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-[#a99d8a]">种子在五金店、手机网购里买得到（末日前）。</div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-semibold hover:bg-white/20">关上</button>
        </div>
      </div>
    </div>
  )
}
