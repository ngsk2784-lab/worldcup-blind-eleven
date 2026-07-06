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

/** 슬롯 안착 미니카드 72x96. */
export const MiniCard = memo(function MiniCard({ player, onRemove }: MiniCardProps) {
  const color = POS_COLOR[player.positionGroup]
  return (
    <motion.button
      type="button"
      onClick={onRemove}
      aria-label={`${anonCode(player)} 슬롯에서 제거`}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex h-24 w-18 flex-col items-center justify-center rounded-md border shadow-card"
      style={{ borderColor: color, backgroundColor: 'var(--surface-2)' }}
    >
      <Silhouette position={player.positionGroup} size={30} />
      <span className="mt-0.5 font-mono text-[11px] text-text-hi">{anonCode(player)}</span>
    </motion.button>
  )
})
