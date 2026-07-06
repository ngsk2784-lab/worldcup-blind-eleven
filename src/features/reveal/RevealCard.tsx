import { motion } from 'framer-motion';
import type { FinalXIEntry } from '../../types';
import { ConfidenceDots, Flag, MiniHeatmap, Silhouette, SpiderChart, positionColorVar, positionOverlay } from './cardVisuals';
import type { Intensity } from './revealOrder';
import './reveal.css';

export type CardStage = 'enter' | 'hold' | 'flip' | 'impact' | 'narrative' | 'exit' | 'silence';

const EASE_INOUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

// 주의: `filter`는 `transform-style: preserve-3d`를 쓰는 바로 그 요소에 걸면
// 크롬 계열 브라우저가 3D 합성을 깨뜨려(자식이 평면화) 플립이 거울상으로 보이는
// 버그가 있다(실측 확인). 그래서 rotateY(3D 대상)와 filter(밝기)를 별도 래퍼로 분리한다.
const rotateVariants = {
  anon: { rotateY: 0 },
  flipping: { rotateY: 180, transition: { duration: 0.6, ease: EASE_INOUT } },
  revealed: { rotateY: 180 },
};

const brightnessVariants = {
  anon: { filter: 'brightness(1)' },
  flipping: {
    filter: ['brightness(1)', 'brightness(0.4)', 'brightness(1)'],
    transition: { duration: 0.6, times: [0, 0.5, 1] },
  },
  revealed: { filter: 'brightness(1)' },
};

const holdFloat = {
  idle: { y: 0 },
  floating: { y: [0, -2, 0, 2, 0], transition: { duration: 0.5, ease: 'easeInOut' as const } },
};

function flipTargetFor(stage: CardStage): keyof typeof rotateVariants {
  if (stage === 'flip') return 'flipping';
  if (stage === 'enter' || stage === 'hold') return 'anon';
  return 'revealed';
}

export function RevealCard({
  entry,
  stage,
  intensity,
}: {
  entry: FinalXIEntry;
  stage: CardStage;
  intensity: Intensity;
}) {
  const { slot, player } = entry;
  const color = positionColorVar(player.positionGroup);
  const showBack = stage === 'flip' || stage === 'impact' || stage === 'narrative' || stage === 'exit' || stage === 'silence';
  const impactPunch = stage === 'impact' && intensity === 'strong';
  const shortName = player.reveal.realName;

  return (
    <div className="reveal-stage-inner">
      <motion.div
        className="reveal-card-punch"
        animate={impactPunch ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={impactPunch ? { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } : undefined}
      >
        <motion.div
          className="reveal-card-glow"
          animate={
            stage === 'impact' || stage === 'narrative'
              ? { boxShadow: ['0 0 0 rgba(232,176,75,0)', 'var(--glow-accent)', 'var(--glow-soft)'] }
              : { boxShadow: 'none' }
          }
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="reveal-card-flip"
            animate={{
              ...holdFloat[stage === 'hold' ? 'floating' : 'idle'],
              ...brightnessVariants[flipTargetFor(stage)],
            }}
          >
            <motion.div
              className="reveal-card-3d"
              style={{ transformStyle: 'preserve-3d' }}
              animate={rotateVariants[flipTargetFor(stage)]}
            >
              {/* --- 익명 앞면 --- */}
              <div className="reveal-face reveal-face-front" style={{ borderLeftColor: color }}>
                <div className="rf-top">
                  <span className="rf-ribbon" style={{ color }}>
                    {player.positionGroup} · {player.positionLabel}
                  </span>
                  <ConfidenceDots minutes={player.sampleMinutes} />
                </div>
                <div className="rf-avatar">
                  <Silhouette group={player.positionGroup} />
                  <span className="rf-code">#{player.id.slice(-3).toUpperCase()}</span>
                </div>
                <div className="rf-mid">
                  <SpiderChart values={player.spider} size={96} />
                </div>
                <div className="rf-mid">
                  <MiniHeatmap grid={player.heatmap} />
                </div>
                <div className="rf-keystats">
                  {player.keyStats.slice(0, 3).map((ks) => (
                    <div key={ks.label}>
                      <div className="ks-l">{ks.label}</div>
                      <div className="ks-v">
                        {ks.value}
                        {ks.unit && <span> {ks.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* --- 공개 뒷면 --- */}
              <div
                className="reveal-face reveal-face-back"
                style={{
                  background: `linear-gradient(${positionOverlay(player.positionGroup)}, ${positionOverlay(player.positionGroup)}), var(--surface-2)`,
                }}
              >
                <div className="rb-top">
                  <Flag country={player.reveal.country} />
                  {player.reveal.jerseyNumber != null && <span className="rb-jersey">#{player.reveal.jerseyNumber}</span>}
                </div>
                <div className="rb-name">{shortName}</div>
                <div className="rb-sub">
                  {player.reveal.country} · {player.positionGroup}
                </div>
                <div className="rb-result" style={{ borderColor: color }}>
                  🏆 {slot.id} · {player.reveal.teamResult.furthestRound}
                </div>
                {player.reveal.epithet && <div className="rb-epithet">"{player.reveal.epithet}"</div>}
                <div className="rb-ghost">
                  <SpiderChart values={player.spider} size={72} faded />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {showBack && player.reveal.epithet && (
        <motion.div
          className="reveal-caption"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <span className="overline">엘리트 에피셋</span>
          <div className="reveal-caption-text">{player.reveal.epithet}</div>
        </motion.div>
      )}
    </div>
  );
}
