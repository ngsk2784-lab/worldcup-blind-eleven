import { motion } from 'framer-motion';
import type { FinalXIEntry } from '../../types';
import { Silhouette } from '../../components/Silhouette';
import { Attribution } from '../../components/Attribution';
import { positionColorVar } from '../../components/positionColors';
import './confirmBreak.css';

const EASE_SNAP: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

export function ConfirmBreak({
  finalXI,
  onCancel,
  onConfirm,
}: {
  finalXI: FinalXIEntry[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-overlay">
      <motion.div
        className="confirm-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.32, ease: EASE_SNAP }}
      >
        <h1 className="confirm-title">되돌릴 수 없습니다.</h1>
        <p className="confirm-sub">당신의 눈을 믿습니까?</p>

        <div className="confirm-lineup" role="list" aria-label="익명 라인업 미리보기">
          {finalXI.map((e) => (
            <div key={e.slot.id} className="confirm-avatar" role="listitem" title={e.slot.id}>
              <Silhouette position={e.player.positionGroup} size={36} />
              <span className="confirm-avatar-label" style={{ color: positionColorVar(e.player.positionGroup) }}>
                {e.slot.id}
              </span>
            </div>
          ))}
        </div>

        <div className="confirm-actions">
          <button className="confirm-btn-ghost" onClick={onCancel}>
            다시 보기
          </button>
          <button className="confirm-btn-cta" onClick={onConfirm}>
            공개한다 ▶
          </button>
        </div>

        <Attribution className="confirm-attribution" />
      </motion.div>
    </div>
  );
}
