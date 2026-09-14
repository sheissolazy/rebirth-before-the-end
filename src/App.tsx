import { useEffect, useState } from 'react'
import { useStore } from './ui/store'
import { StartScreen } from './ui/StartScreen'
import { Game } from './ui/Game'
import { EndingScreen } from './ui/EndingScreen'

export default function App() {
  const store = useStore()
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { if (store.error) { const id = setTimeout(store.clearError, 2500); return () => clearTimeout(id) } }, [store.error, store.clearError])

  if (store.state?.ending && !store.report) return <EndingScreen state={store.state} store={store} />
  if (store.state && hash === '#game') return <Game state={store.state} store={store} />
  return <StartScreen store={store} />
}
