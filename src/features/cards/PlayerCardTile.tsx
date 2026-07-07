import { memo } from 'react'
import type { PlayerCard as PlayerCardType, PositionGroup } from '../../types'
import { SpiderChart } from '../../components/SpiderChart'
import { Heatmap } from '../../components/Heatmap'
import { Silhouette } from '../../components/Silhouette'
import { useAnonCode } from '../../store/gameStore'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface PlayerCardTileProps {
  player: PlayerCardType
  selected?: boolean
  onSelect?: () => void
}

/** S1 카드 그리드 앞면(익명). 220x300 비율. */
export const PlayerCardTile = memo(function PlayerCardTile({ player, selected, onSelect }: PlayerCardTileProps) {
  const anonCode = useAnonCode()
  const color = POS_COLOR[player.positionGroup]
  const confDots = Math.min(4, Math.max(1, Math.round(player.sampleMinutes / 200)))

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={!!selected}
      aria-label={`익명 카드 ${anonCode(player)}, ${player.positionLabel}, 상세 보기`}
      className="group relative flex w-full flex-col rounded-lg border-l-4 bg-surface-2 p-3.5 text-left shadow-card transition-all duration-[180ms] ease-out hover:-translate-y-1 hover:bg-surface-3 hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{
        aspectRatio: '220 / 300',
        borderLeftColor: color,
        boxShadow: selected ? `0 0 0 2px ${color}, var(--sh-2)` : undefined,
      }}
    >
      <div className="mb-0.5 flex items-start justify-between gap-2">
        <span className="overline truncate" style={{ color }}>
          {player.positionGroup} · {player.positionLabel}
        </span>
        <span className="flex shrink-0 items-center gap-[3px]" aria-label={`출전 신뢰도 ${confDots}/4`}>
          {Array.from({ length: 4 }, (_, i) => (
            <i key={i} className={`h-1.5 w-1.5 rounded-full ${i < confDots ? 'bg-data' : 'bg-surface-line'}`} />
          ))}
        </span>
      </div>
      <div className="my-0.5 mb-1.5 flex flex-col items-center">
        <Silhouette position={player.positionGroup} size={50} />
        <span className="mt-0.5 font-mono text-[13px] tracking-wide text-text-mid">{anonCode(player)}</span>
      </div>
      <div className="mb-1.5 flex justify-center">
        <SpiderChart axes={player.spider} size={96} />
      </div>
      <div className="mb-1.5 flex justify-center">
        <Heatmap grid={player.heatmap} />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-surface-line pt-2">
        {player.keyStats.slice(0, 4).map((ks) => (
          <div key={ks.label} className="min-w-0">
            <div className="truncate text-[10px] uppercase tracking-wide text-text-lo">{ks.label}</div>
            <div className="font-mono text-[15px] font-semibold leading-none text-text-hi">
              {ks.value}
              {ks.unit ? <span className="text-[10px] font-medium text-text-mid"> {ks.unit}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
})
