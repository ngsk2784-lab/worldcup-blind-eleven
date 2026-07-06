import { useDraggable } from '@dnd-kit/core'
import type { PlayerCard, PositionGroup } from '../../types'
import { Silhouette } from '../../components/Silhouette'
import { anonCode } from '../cards/PlayerCardTile'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface CandidateCardProps {
  player: PlayerCard
  dragId: string
}

/** 후보 트레이 드래그 소스 카드(간략형). */
export function CandidateCard({ player, dragId }: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { playerId: player.id, positionGroup: player.positionGroup },
  })
  const color = POS_COLOR[player.positionGroup]

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      data-player-id={player.id}
      data-position-group={player.positionGroup}
      aria-label={`${anonCode(player)} 드래그하여 슬롯에 배치`}
      className="flex cursor-grab touch-none items-center gap-3 rounded-md border-l-4 bg-surface-2 p-2.5 shadow-1 transition-opacity active:cursor-grabbing"
      style={{ borderLeftColor: color, opacity: isDragging ? 0.35 : 1 }}
    >
      <Silhouette position={player.positionGroup} size={36} />
      <div className="min-w-0">
        <div className="overline" style={{ color }}>
          {player.positionGroup} · {player.positionLabel}
        </div>
        <div className="font-mono text-[13px] text-text-hi">{anonCode(player)}</div>
      </div>
    </div>
  )
}
