import { useState } from 'react'
import type { GameState } from '../engine/types'
import type { Store } from './store'
import { t } from '../i18n'
import { TopBar } from './TopBar'
import { MapPage } from './MapPage'
import { BasePage } from './BasePage'
import { WarehousePage } from './WarehousePage'
import { PeoplePage } from './PeoplePage'
import { DiaryPage } from './DiaryPage'
import { WeekReportModal } from './WeekReportModal'
import { ChoiceModal } from './ChoiceModal'

type Tab = 'map' | 'base' | 'warehouse' | 'people' | 'diary'
const TABS: Tab[] = ['map', 'base', 'warehouse', 'people', 'diary']

export function Game({ state, store }: { state: GameState; store: Store }) {
  const [tab, setTab] = useState<Tab>('map')
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-20">
      <TopBar state={state} />
      <div className="flex-1">
        {tab === 'map' && <MapPage state={state} store={store} />}
        {tab === 'base' && <BasePage state={state} store={store} />}
        {tab === 'warehouse' && <WarehousePage state={state} store={store} />}
        {tab === 'people' && <PeoplePage state={state} store={store} />}
        {tab === 'diary' && <DiaryPage state={state} />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className={`flex-1 py-3 text-sm ${tab === tb ? 'text-amber-400' : 'text-zinc-400'}`}>{t(`nav.${tb}`)}</button>
          ))}
          <button onClick={store.endWeek} className="m-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold">{t('action.endWeek')}</button>
        </div>
      </nav>
      {store.report && <WeekReportModal report={store.report} state={state} onClose={store.dismissReport} />}
      {!store.report && (state.pendingChoice || store.choiceResult) && <ChoiceModal state={state} store={store} />}
      {store.error && (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded bg-red-800 px-4 py-2 text-sm" onClick={store.clearError}>{store.error}</div>
      )}
    </div>
  )
}
