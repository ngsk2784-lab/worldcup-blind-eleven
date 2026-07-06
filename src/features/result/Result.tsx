import { useEffect, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import type { FinalXIEntry, Formation, XIScore } from '../../types';
import { positionColorHex } from '../reveal/cardVisuals';
import { downloadCanvas, drawShareCard } from './shareCard';
import './result.css';

const EASE_SNAP: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

const GRADE_COMMENT: Record<XIScore['grade'], string> = {
  S: '전설을 알아보는 눈',
  A: '예리한 스카우트',
  B: '균형 잡힌 안목',
  C: '가능성을 본 선구자',
  D: '과감한 도전자',
};

function useCountUp(target: number, durationSec = 1.1) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(0, target, {
      duration: durationSec,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [target, durationSec]);
  return value;
}

export function Result({
  finalXI,
  score,
  formation,
  tournamentLabel,
  onRestart,
}: {
  finalXI: FinalXIEntry[];
  score: XIScore;
  formation: Formation;
  tournamentLabel: string;
  onRestart: () => void;
}) {
  const displayScore = useCountUp(score.total);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const bestPick = finalXI.find((e) => e.player.id === score.bestPick.playerId);
  const upsetPick = finalXI.find((e) => e.player.id === score.biggestUpset.playerId);

  const roundCounts = finalXI.reduce<Record<string, number>>((acc, e) => {
    const r = e.player.reveal.teamResult.furthestRound;
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  const ROUND_LABEL: Record<string, string> = {
    Group: '조별리그',
    R16: '16강',
    QF: '8강',
    SF: '4강',
    Final: '결승',
    Winner: '우승',
  };

  const handleSave = async () => {
    setSaving(true);
    const canvas = canvasRef.current;
    if (canvas) {
      drawShareCard(canvas, { score, finalXI, formation, tournamentLabel });
      downloadCanvas(canvas);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="result-screen">
      <h1 className="result-title">당신의 안목</h1>

      <div className="result-score-row">
        <div className="result-score-num">{Math.round(displayScore)}</div>
        <motion.div
          className="result-grade"
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.0, ease: EASE_SNAP }}
        >
          등급 {score.grade}
        </motion.div>
      </div>
      <p className="result-comment">{GRADE_COMMENT[score.grade]}</p>

      <div className="result-picks">
        {bestPick && (
          <div className="result-pick-card">
            <span className="overline">최고의 픽</span>
            <div className="result-pick-name">{bestPick.player.reveal.realName}</div>
            <div className="result-pick-sub">
              {bestPick.player.reveal.country} · {bestPick.player.positionGroup}
            </div>
            <p className="result-pick-reason">{score.bestPick.reason}</p>
          </div>
        )}
        {upsetPick && (
          <div className="result-pick-card result-pick-upset">
            <span className="overline">가장 의외의 픽</span>
            <div className="result-pick-name">{upsetPick.player.reveal.realName}</div>
            <div className="result-pick-sub">
              {upsetPick.player.reveal.country} · {upsetPick.player.positionGroup}
            </div>
            <p className="result-pick-reason">"{score.biggestUpset.reason}"</p>
          </div>
        )}
      </div>

      <div className="result-xi-board">
        <span className="overline">나의 XI</span>
        <div className="result-pitch">
          {formation.slots.map((slot) => {
            const entry = finalXI.find((e) => e.slot.id === slot.id);
            const color = entry ? positionColorHex(entry.player.positionGroup) : '#33424F';
            return (
              <div
                key={slot.id}
                className="result-pitch-dot"
                style={{ left: `${slot.x * 100}%`, top: `${(1 - slot.y) * 100}%`, background: color }}
                title={entry?.player.reveal.realName}
              >
                <span className="result-pitch-label">
                  {entry ? entry.player.reveal.realName.split(' ').pop() : slot.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="result-contrast">
        <span className="overline">실제 성적 대조</span>
        <div className="result-contrast-chips">
          {Object.entries(roundCounts).map(([round, count]) => (
            <span key={round} className="result-chip">
              {ROUND_LABEL[round] ?? round} {count}
            </span>
          ))}
        </div>
      </div>

      <div className="result-actions">
        <button className="result-btn-cta" onClick={handleSave} disabled={saving}>
          {saved ? '저장됨 ✓' : saving ? '저장 중…' : '결과 카드 저장'}
        </button>
        <button className="result-btn-ghost" onClick={onRestart}>
          다시 하기
        </button>
      </div>

      <div className="result-caption">StatsBomb Open Data</div>

      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden />
    </div>
  );
}
