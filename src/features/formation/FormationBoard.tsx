import type { Formation, PlayerCard, PositionGroup } from '../../types'
import { Slot } from './Slot'

function PitchLines() {
  return (
    <svg viewBox="0 0 300 460" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <rect x={4} y={4} width={292} height={452} rx={8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <line x1={4} y1={230} x2={296} y2={230} stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <circle cx={150} cy={230} r={46} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <circle cx={150} cy={230} r={2.5} fill="rgba(255,255,255,0.12)" />
      <rect x={70} y={356} width={160} height={100} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <rect x={110} y={416} width={80} height={40} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
      <rect x={70} y={4} width={160} height={70} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
    </svg>
  )
}

export interface FormationBoardProps {
  formation: Formation
  slots: Record<string, string | null>
  pool: PlayerCard[]
  shakingSlotId: string | null
  onRemove: (slotId: string) => void
  /** 클릭-배치 모드: 트레이에서 선택된 후보의 포지션군(없으면 null). */
  tapSelectGroup: PositionGroup | null
  onSlotTap: (slotId: string) => void
}

export function FormationBoard({ formation, slots, pool, shakingSlotId, onRemove, tapSelectGroup, onSlotTap }: FormationBoardProps) {
  return (
    <div className="relative mx-auto aspect-[300/460] w-full max-w-[420px] rounded-xl bg-bg-pitch shadow-card">
      <PitchLines />
      {formation.slots.map((slot) => (
        <Slot
          key={slot.id}
          slot={slot}
          player={pool.find((p) => p.id === slots[slot.id]) ?? null}
          shaking={shakingSlotId === slot.id}
          tapSelectable={tapSelectGroup !== null && tapSelectGroup === slot.group && !slots[slot.id]}
          onRemove={() => onRemove(slot.id)}
          onTapEmpty={() => onSlotTap(slot.id)}
        />
      ))}
    </div>
  )
}
