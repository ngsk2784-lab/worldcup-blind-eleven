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
  /** 클릭-배치 모드에서 이 카드가 현재 선택됨. */
  selected?: boolean
  /** 카드 클릭 — 선택/선택교체/선택해제. 유일한 배치 시작 경로. */
  onTap?: () => void
}

/** 후보 트레이 카드. 클릭 → 선택 → 가능 슬롯 클릭으로 배치(유일한 인터랙션 경로). */
export function CandidateCard({ player, selected = false, onTap }: CandidateCardProps) {
  const color = POS_COLOR[player.positionGroup]

  return (
    <div
      onClick={onTap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTap?.()
        }
      }}
      data-player-id={player.id}
      data-position-group={player.positionGroup}
      data-selected={selected}
      aria-pressed={selected}
      aria-label={`${anonCode(player)} 클릭하여 슬롯에 배치`}
      className="flex cursor-pointer items-center gap-3 rounded-md border-l-4 bg-surface-2 p-2.5 shadow-1 transition-all hover:bg-surface-3"
      style={{
        borderLeftColor: color,
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
