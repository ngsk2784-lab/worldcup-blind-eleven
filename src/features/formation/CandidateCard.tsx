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
  /** 탭-배치 모드에서 이 카드가 현재 선택됨. */
  selected?: boolean
  /** 카드 탭(클릭) — 선택/선택교체/선택해제. 드래그와 별개로 동작(모바일 보조 배치 경로). */
  onTap?: () => void
}

/** 후보 트레이 드래그 소스 카드(간략형). 데스크탑은 드래그가 주력, 모바일은 탭-배치가 보조. */
export function CandidateCard({ player, dragId, selected = false, onTap }: CandidateCardProps) {
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
      onClick={onTap}
      role="button"
      tabIndex={0}
      data-player-id={player.id}
      data-position-group={player.positionGroup}
      data-selected={selected}
      aria-pressed={selected}
      aria-label={`${anonCode(player)} 드래그하거나 탭하여 슬롯에 배치`}
      className="flex cursor-grab touch-none items-center gap-3 rounded-md border-l-4 bg-surface-2 p-2.5 shadow-1 transition-all active:cursor-grabbing"
      style={{
        borderLeftColor: color,
        opacity: isDragging ? 0.35 : 1,
        boxShadow: selected ? '0 0 0 2px var(--accent)' : undefined,
        transform: selected ? 'scale(1.02)' : undefined,
      }}
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
