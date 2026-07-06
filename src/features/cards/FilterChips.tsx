import type { PositionGroup } from '../../types'

const POS_STYLE: Record<PositionGroup, { border: string; bg: string; text: string }> = {
  GK: { border: 'var(--pos-gk)', bg: 'rgba(232,176,75,.14)', text: '#ffe6b3' },
  DEF: { border: 'var(--pos-def)', bg: 'rgba(91,141,239,.14)', text: '#c9dcff' },
  MID: { border: 'var(--pos-mid)', bg: 'rgba(63,185,140,.14)', text: '#bff0dd' },
  FWD: { border: 'var(--pos-fwd)', bg: 'rgba(229,83,60,.14)', text: '#ffd0c7' },
}

const ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD']

export interface FilterChipsProps {
  active: Set<PositionGroup>
  onToggle: (pos: PositionGroup) => void
}

export function FilterChips({ active, onToggle }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="포지션 필터">
      {ORDER.map((pos) => {
        const on = active.has(pos)
        const s = POS_STYLE[pos]
        return (
          <button
            key={pos}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(pos)}
            className="shrink-0 rounded-pill border px-3.5 py-1.5 font-body text-[13px] font-medium transition-[background-color,border-color,color] duration-[180ms]"
            style={{
              borderColor: on ? s.border : 'var(--surface-line)',
              backgroundColor: on ? s.bg : 'transparent',
              color: on ? s.text : 'var(--text-mid)',
            }}
          >
            {pos}
          </button>
        )
      })}
    </div>
  )
}
