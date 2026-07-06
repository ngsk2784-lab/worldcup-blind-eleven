import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { FinalXIEntry } from '../../types';
import { Attribution } from '../../components/Attribution';
import { buildRevealOrder } from './revealOrder';
import { RevealCard, type CardStage } from './RevealCard';
import './reveal.css';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// 프레임 스펙(§4.3): enter 300 / hold 500 / flip 600 / impact 300 / narrative 1200 / exit 300 = 3200ms
const T_ENTER = 300;
const T_HOLD = 500;
const T_FLIP = 600;
const T_IMPACT = 300;
const T_NARRATIVE = 1200;
const T_EXIT = 300;
const T_STAR_SILENCE = 500;

export function Reveal({ finalXI, onFinish }: { finalXI: FinalXIEntry[]; onFinish: () => void }) {
  const order = useMemo(() => buildRevealOrder(finalXI), [finalXI]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<CardStage>('enter');
  const [showCta, setShowCta] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  const runCycle = useCallback(
    (i: number) => {
      clearTimers();
      setIndex(i);
      setStage('enter');
      setShowCta(false);
      const isLast = i === order.length - 1;

      schedule(() => setStage('hold'), T_ENTER);
      schedule(() => setStage('flip'), T_ENTER + T_HOLD);
      schedule(() => setStage('impact'), T_ENTER + T_HOLD + T_FLIP);
      schedule(() => setStage('narrative'), T_ENTER + T_HOLD + T_FLIP + T_IMPACT);

      if (!isLast) {
        schedule(() => setStage('exit'), T_ENTER + T_HOLD + T_FLIP + T_IMPACT + T_NARRATIVE);
        schedule(() => runCycle(i + 1), T_ENTER + T_HOLD + T_FLIP + T_IMPACT + T_NARRATIVE + T_EXIT);
      } else {
        // 스타: 최장 홀드 유지 후 침묵의 홀드 0.5s → CTA
        schedule(() => setStage('silence'), T_ENTER + T_HOLD + T_FLIP + T_IMPACT + T_NARRATIVE);
        schedule(() => setShowCta(true), T_ENTER + T_HOLD + T_FLIP + T_IMPACT + T_NARRATIVE + T_STAR_SILENCE);
      }
    },
    [order.length, clearTimers, schedule],
  );

  useEffect(() => {
    if (order.length === 0) return;
    runCycle(0);
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length]);

  const handleNext = () => {
    if (index >= order.length - 1) {
      setShowCta(true);
      return;
    }
    runCycle(index + 1);
  };

  const handleSkip = () => {
    clearTimers();
    onFinish();
  };

  if (order.length === 0) {
    return (
      <div className="reveal-screen">
        <p>공개할 라인업이 없습니다.</p>
      </div>
    );
  }

  const current = order[index];

  return (
    <div className="reveal-screen">
      <div className="reveal-header">
        <span className="overline">정체 공개</span>
        <span className="reveal-progress-n">
          <b>{index + 1}</b>
          <i>/ {order.length}</i>
        </span>
      </div>

      <div className="reveal-stage">
        <div className="reveal-glow-aura" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.div
            key={current.entry.player.id}
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } }}
            exit={{ x: -60, opacity: 0, transition: { duration: 0.3, ease: EASE_OUT } }}
          >
            <RevealCard entry={current.entry} stage={stage} intensity={current.intensity} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="reveal-progress-strip">
        {order.map((d, i) => (
          <span key={d.entry.slot.id} className={`reveal-chip${i <= index ? ' on' : ''}`} title={d.entry.slot.id} />
        ))}
      </div>

      {!showCta && (
        <div className="reveal-controls">
          <button className="reveal-btn" onClick={handleSkip}>
            건너뛰기
          </button>
          <button className="reveal-btn" onClick={handleNext}>
            다음 ▶
          </button>
        </div>
      )}

      {showCta && (
        <motion.button
          className="reveal-cta"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          onClick={onFinish}
        >
          결과 보기 ▶
        </motion.button>
      )}

      <Attribution className="reveal-attribution" />
    </div>
  );
}
