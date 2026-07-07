import { useMemo, useState } from 'react'
import { Onboarding } from './features/onboarding/Onboarding'
import { ExploreScreen } from './features/cards/ExploreScreen'
import { FormationScreen } from './features/formation/FormationScreen'
import { ConfirmBreak } from './features/reveal/ConfirmBreak'
import { Reveal } from './features/reveal/Reveal'
import { Result } from './features/result/Result'
import { useGameStore, getFormationDef, gameMeta } from './store/gameStore'

function App() {
  const phase = useGameStore((s) => s.phase)
  const setPhase = useGameStore((s) => s.setPhase)
  const startSession = useGameStore((s) => s.startSession)
  const confirmXI = useGameStore((s) => s.confirmXI)
  const reset = useGameStore((s) => s.reset)
  const finalXI = useGameStore((s) => s.finalXI)
  const score = useGameStore((s) => s.score)
  const formationKey = useGameStore((s) => s.formationKey)
  const tournament = useGameStore((s) => s.tournament)

  const [showConfirm, setShowConfirm] = useState(false)

  const formation = useMemo(() => getFormationDef(formationKey), [formationKey])
  const tournamentLabel = useMemo(
    () => gameMeta.tournaments.find((t) => t.year === tournament)?.label ?? '',
    [tournament],
  )

  if (phase === 'onboarding') {
    return (
      <Onboarding
        onStart={() => {
          // 매 판(세션) 시작 시 익명 코드/카드 순서를 재셔플(반복 플레이 암기 공략 방지).
          startSession()
          setPhase('explore')
        }}
      />
    )
  }

  if (phase === 'explore') {
    return (
      <ExploreScreen onGoToFormation={() => setPhase('formation')} />
    )
  }

  if (phase === 'formation') {
    return (
      <>
        <FormationScreen onGoToExplore={() => setPhase('explore')} onConfirmRequest={() => setShowConfirm(true)} />
        {showConfirm && (
          <ConfirmBreak
            finalXI={finalXI()}
            onCancel={() => setShowConfirm(false)}
            onConfirm={() => {
              setShowConfirm(false)
              confirmXI()
            }}
          />
        )}
      </>
    )
  }

  if (phase === 'reveal') {
    return <Reveal finalXI={finalXI()} onFinish={() => setPhase('result')} />
  }

  return (
    <Result
      finalXI={finalXI()}
      score={score()}
      formation={formation}
      tournamentLabel={tournamentLabel}
      onRestart={() => reset()}
    />
  )
}

export default App
