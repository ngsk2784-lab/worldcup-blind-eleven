import { useState } from 'react';
import { Onboarding } from './features/onboarding/Onboarding';
import { ConfirmBreak } from './features/reveal/ConfirmBreak';
import { Reveal } from './features/reveal/Reveal';
import { Result } from './features/result/Result';
import { useDevStore, devFormation, devMeta } from './store/devStore';

// 개발용 하네스: WT-C 담당 화면(S0/S3/S4/S5)만 연결한다.
// S1(카드 탐색)/S2(포메이션 보드)는 WT-B 담당이라 생략하고
// 온보딩 CTA에서 바로 확정 브레이크(S3)로 진입시킨다.
type LocalPhase = 'onboarding' | 'confirm' | 'reveal' | 'result';

function App() {
  const [localPhase, setLocalPhase] = useState<LocalPhase>('onboarding');
  const finalXI = useDevStore((s) => s.finalXI);
  const scoreFn = useDevStore((s) => s.score);
  const confirmXI = useDevStore((s) => s.confirmXI);
  const reset = useDevStore((s) => s.reset);

  const xi = finalXI();

  if (localPhase === 'onboarding') {
    return <Onboarding onStart={() => setLocalPhase('confirm')} />;
  }

  if (localPhase === 'confirm') {
    return (
      <ConfirmBreak
        finalXI={xi}
        onCancel={() => setLocalPhase('onboarding')}
        onConfirm={() => {
          confirmXI();
          setLocalPhase('reveal');
        }}
      />
    );
  }

  if (localPhase === 'reveal') {
    return <Reveal finalXI={xi} onFinish={() => setLocalPhase('result')} />;
  }

  return (
    <Result
      finalXI={xi}
      score={scoreFn()}
      formation={devFormation}
      tournamentLabel={devMeta.tournaments[0]?.label ?? ''}
      onRestart={() => {
        reset();
        setLocalPhase('onboarding');
      }}
    />
  );
}

export default App;
