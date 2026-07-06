import { useMemo, useState } from 'react'
import type { PlayerCard, PositionGroup } from '../../types'
import { CandidateCard } from './CandidateCard'

const TABS: Array<PositionGroup | 'ALL'> = ['ALL', 'GK', 'DEF', 'MID', 'FWD']

export interface CandidateTrayProps {
  pool: PlayerCard[]
  placedIds: Set<string>
}

export function CandidateTray({ pool, placedIds }: CandidateTrayProps) {
  const [tab, setTab] = useState<PositionGroup | 'ALL'>('ALL')

  const candidates = useMemo(
    () => pool.filter((p) => !placedIds.has(p.id) && (tab === 'ALL' || p.positionGroup === tab)),
    [pool, placedIds, tab],
  )

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-3 font-display text-lg font-semibold text-text-hi">후보 트레이</h2>
      <div className="mb-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="포지션 필터 탭">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-sm px-2.5 py-1 text-[12px] font-medium transition-colors ${
              tab === t ? 'bg-surface-3 text-text-hi' : 'text-text-lo hover:text-text-mid'
            }`}
          >
            {t === 'ALL' ? '전체' : t}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {candidates.length === 0 ? (
          <p className="p-4 text-center text-[13px] text-text-lo">배치 가능한 후보가 없습니다.</p>
        ) : (
          candidates.map((p) => <CandidateCard key={p.id} player={p} dragId={`cand-${p.id}`} />)
        )}
      </div>
    </div>
  )
}
