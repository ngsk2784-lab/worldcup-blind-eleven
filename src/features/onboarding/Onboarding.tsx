import { useState } from 'react';
import { motion } from 'framer-motion';
import { Silhouette } from '../../components/Silhouette';
import { Attribution } from '../../components/Attribution';
import { useGameStore, gameMeta } from '../../store/gameStore';
import type { PositionGroup } from '../../types';
import './onboarding.css';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const FAN_CARDS: { rotate: number; group: PositionGroup }[] = [
  { rotate: -8, group: 'DEF' },
  { rotate: 0, group: 'MID' },
  { rotate: 8, group: 'FWD' },
];

export function Onboarding({ onStart }: { onStart: () => void }) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const tournament = useGameStore((s) => s.tournament);
  const setTournament = useGameStore((s) => s.setTournament);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: px * 12, y: py * 12 });
  };

  return (
    <div className="onboarding-screen" onMouseMove={handleMouseMove}>
      <div className="onboarding-logo overline">BLIND XI</div>

      <div className="onboarding-hero">
        <motion.h1
          className="onboarding-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}
        >
          이름을 지웠습니다.
        </motion.h1>
        <motion.h1
          className="onboarding-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: EASE_OUT }}
        >
          당신의 눈을 믿으세요.
        </motion.h1>
      </div>

      <div className="onboarding-fan">
        {FAN_CARDS.map((c, i) => (
          <motion.div
            key={i}
            className="onboarding-fan-card"
            style={{ rotate: c.rotate, zIndex: i === 1 ? 2 : 1 }}
            animate={{ x: parallax.x * (i - 1) * 0.4, y: parallax.y }}
            transition={{ type: 'spring', stiffness: 80, damping: 14 }}
          >
            <Silhouette position={c.group} size={64} />
          </motion.div>
        ))}
      </div>

      <p className="onboarding-desc">
        실명도, 국적도, 사진도 없습니다.
        <br />
        데이터만 보고 당신의 베스트11을.
      </p>

      <button className="onboarding-cta" onClick={onStart}>
        스카우팅 시작 ▶
      </button>

      <div className="onboarding-chips" role="group" aria-label="대회 선택">
        {gameMeta.tournaments.map((t) => (
          <button
            key={t.year}
            type="button"
            className={`onboarding-chip-btn${tournament === t.year ? ' active' : ''}`}
            aria-pressed={tournament === t.year}
            onClick={() => setTournament(t.year as 2018 | 2022)}
          >
            {t.label}
          </button>
        ))}
        <span className="onboarding-chip-formation">4-3-3 (기본)</span>
      </div>

      <Attribution className="onboarding-caption" />
    </div>
  );
}
