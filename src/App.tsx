import { t } from './i18n'
import { content } from './content'

/** 占位首页。UI 由 Codex 按 docs/tasks/T-002 重做。 */
export default function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-2xl font-bold">{t('app.title')}</h1>
      <p className="mt-2 text-zinc-400">{t('time.format', { year: 1, month: 1, week: 1 })}</p>
      <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {content.locations.map((l) => (
          <li key={l.id} className="rounded-lg border border-zinc-800 p-3">
            <span className="mr-2">{l.icon}</span>{l.name.zh}
          </li>
        ))}
      </ul>
    </main>
  )
}
