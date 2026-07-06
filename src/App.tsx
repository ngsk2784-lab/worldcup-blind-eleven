import { useState } from 'react'
import { ExploreScreen } from './features/cards/ExploreScreen'
import { FormationScreen } from './features/formation/FormationScreen'

type View = 'explore' | 'formation'

function App() {
  const [view, setView] = useState<View>('explore')

  if (view === 'formation') {
    return <FormationScreen onGoToExplore={() => setView('explore')} />
  }
  return <ExploreScreen onGoToFormation={() => setView('formation')} />
}

export default App
