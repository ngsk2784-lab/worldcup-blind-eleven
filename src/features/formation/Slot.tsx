import { AnimatePresence, motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import type { FormationSlot, PlayerCard, PositionGroup } from '../../types'
import { MiniCard } from './MiniCard'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface SlotProps {
  slot: FormationSlot
  player: PlayerCard | null
  activeDragGroup: PositionGroup | null
  shaking: boolean
  onRemove: () => void
}

export function Slot({ slot, player, activeDragGroup, shaking, onRemove }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, data: { group: slot.group } })
  const color = POS_COLOR[slot.group]
  const isValidTarget = activeDragGroup !== null && activeDragGroup === slot.group
  const isInvalidTarget = activeDragGroup !== null && activeDragGroup !== slot.group

  return (
    <motion.div
      ref={setNodeRef}
      className="absolute flex h-18 w-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
      style={{
        left: `${slot.x * 100}%`,
        top: `${slot.y * 100}%`,
        border: player ? 'none' : `2px dashed ${isInvalidTarget && isOver ? 'var(--error)' : color}`,
        backgroundColor: player ? 'transparent' : `${color}1f`,
        boxShadow: isValidTarget && isOver ? `0 0 0 2px ${color}` : undefined,
        filter: isInvalidTarget && isOver ? 'brightness(0.75)' : undefined,
      }}
      animate={shaking ? { x: [0, -6, 6, -6, 6, 0] } : { scale: isValidTarget && isOver ? 1.05 : 1 }}
      transition={shaking ? { duration: 0.3 } : { duration: 0.18 }}
    >
      <AnimatePresence mode="wait">
        {player ? (
          <MiniCard key={player.id} player={player} onRemove={onRemove} />
        ) : (
          <span key="label" className="overline pointer-events-none" style={{ color }}>
            {slot.group}
          </span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
