import { useMemo, useState } from 'react'
import type { PositionGroup } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { Attribution } from '../../components/Attribution'
import { PlayerCardTile } from './PlayerCardTile'
import { FilterChips } from './FilterChips'
import { DetailPanel } from './DetailPanel'

export interface ExploreScreenProps {
  onGoToFormation: () => void
}

export function ExploreScreen({ onGoToFormation }: ExploreScreenProps) {
  const pool = useGameStore((s) => s.pool)
  const slots = useGameStore((s) => s.slots)
  const placedCount = Object.values(slots).filter(Boolean).length

  const [activeFilters, setActiveFilters] = useState<Set<PositionGroup>>(new Set(['GK', 'DEF', 'MID', 'FWD']))
  const [selectedId, setSelectedId] = useState<string | null>(pool[0]?.id ?? null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [detailOpenMobile, setDetailOpenMobile] = useState(false)

  const filtered = useMemo(() => pool.filter((p) => activeFilters.has(p.positionGroup)), [pool, activeFilters])

  const selected = useMemo(() => pool.find((p) => p.id === selectedId) ?? null, [pool, selectedId])
  const compareA = useMemo(() => pool.find((p) => p.id === compareIds[0]) ?? null, [pool, compareIds])
  const compareB = useMemo(() => pool.find((p) => p.id === compareIds[1]) ?? null, [pool, compareIds])

  function toggleFilter(pos: PositionGroup) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(pos)) next.delete(pos)
      else next.add(pos)
      return next
    })
  }

  function handleSelect(id: string) {
    setSelectedId(id)
    setDetailOpenMobile(true)
  }

  function handleAddCompare() {
    if (!selected) return
    setCompareIds((prev) => {
      if (prev.includes(selected.id)) return prev
      const next = [...prev, selected.id]
      return next.slice(-2)
    })
  }

  function handleRemoveCompare(id: string) {
    setCompareIds((prev) => prev.filter((c) => c !== id))
  }

  const dotsFilled = Array.from({ length: 11 }, (_, i) => i < placedCount)

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-6 border-b border-surface-line bg-surface-1/90 px-4 backdrop-blur-md md:px-8">
        <div className="font-display text-xl font-bold tracking-wide text-text-hi">
          BLIND <b className="text-accent">XI</b>
        </div>
        <span className="hidden text-[14px] text-text-lo sm:inline">스카우팅 · 카드 탐색</span>
        <FilterChips active={activeFilters} onToggle={toggleFilter} />
        <span className="ml-auto shrink-0 font-mono text-[14px] text-text-mid">
          배치 <b className="text-accent">{placedCount}</b>/11
        </span>
      </header>

      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-6 px-4 pt-7 md:flex-row md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold text-text-hi">후보 선수 풀</h1>
          <p className="mb-5 text-[14px] text-text-lo">이름도, 국적도 없습니다. 데이터만 보고 판단하세요.</p>

          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-surface-line p-8 text-center text-text-lo">
              이 포지션 카드가 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => (
                <PlayerCardTile key={p.id} player={p} selected={p.id === selectedId} onSelect={() => handleSelect(p.id)} />
              ))}
            </div>
          )}
        </div>

        {/* 데스크탑/태블릿: 고정 우측 패널 */}
        <div className="hidden md:block">
          <DetailPanel
            player={selected}
            compareIds={compareIds}
            compareA={compareA}
            compareB={compareB}
            onAddCompare={handleAddCompare}
            onRemoveCompare={handleRemoveCompare}
          />
        </div>
      </div>

      {/* 모바일: 바텀시트 오버레이 */}
      {detailOpenMobile && selected && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 max-h-[70vh] overflow-y-auto border-t border-surface-line bg-bg-base/95 p-4 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setDetailOpenMobile(false)}
            className="mb-2 ml-auto block text-[13px] text-text-lo"
            aria-label="상세 패널 닫기"
          >
            닫기 ✕
          </button>
          <DetailPanel
            player={selected}
            compareIds={compareIds}
            compareA={compareA}
            compareB={compareB}
            onAddCompare={handleAddCompare}
            onRemoveCompare={handleRemoveCompare}
          />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex h-18 items-center gap-4 border-t border-surface-line bg-surface-1/95 px-4 backdrop-blur-md md:px-8">
        <div className="flex gap-[5px]" aria-hidden="true">
          {dotsFilled.map((filled, i) => (
            <i key={i} className={`h-2.5 w-2.5 rounded-full ${filled ? 'bg-accent' : 'bg-surface-line'}`} />
          ))}
        </div>
        <span className="hidden text-[13px] text-text-mid sm:inline">라인업 {placedCount} / 11</span>
        <Attribution className="explore-footer-attribution" />
        <button
          type="button"
          onClick={onGoToFormation}
          className="ml-auto flex h-11 shrink-0 items-center gap-2 rounded-md bg-accent px-6 font-semibold text-text-onaccent shadow-glow-soft transition-colors hover:bg-accent-hi"
        >
          배치하러 가기 ▶
        </button>
      </div>
    </div>
  )
}
