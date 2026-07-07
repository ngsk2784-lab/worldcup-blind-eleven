import { memo } from 'react'
import { motion } from 'framer-motion'
import type { PlayerCard, PositionGroup } from '../../types'
import { Silhouette } from '../../components/Silhouette'
import { anonCode } from '../cards/PlayerCardTile'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface MiniCardProps {
  player: PlayerCard
  onRemove?: () => void
}

/** 슬롯 안착 미니카드. 슬롯 원(h-18 w-18 = 72x72) 안에 들어차도록 66x66 정사각형으로 맞춘다
 * (§ 오너 실기기 피드백 B2: 기존 72x96 카드가 슬롯 원 대비 과대해 세로로 넘쳐 이웃 슬롯을
 * 침범 렌더하는 문제 — 특히 GK↔센터백처럼 대각선으로 가까운 슬롯 쌍에서 재현됨). */
export const MiniCard = memo(function MiniCard({ player, onRemove }: MiniCardProps) {
  const color = POS_COLOR[player.positionGroup]
  return (
    <motion.button
      type="button"
      onClick={onRemove}
      data-player-id={player.id}
      aria-label={`${anonCode(player)} 슬롯에서 제거`}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex h-[66px] w-[66px] flex-col items-center justify-center rounded-md border shadow-card"
      style={{ borderColor: color, backgroundColor: 'var(--surface-2)' }}
    >
      <Silhouette position={player.positionGroup} size={26} />
      <span className="mt-0.5 font-mono text-[10px] leading-tight text-text-hi">{anonCode(player)}</span>
    </motion.button>
  )
})
