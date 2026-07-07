import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { PositionGroup } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { getFormationDef } from '../../store/gameStore'
import { FormationBoard } from './FormationBoard'
import { CandidateTray } from './CandidateTray'
import { Attribution } from '../../components/Attribution'
import { useAnonCode } from '../../store/gameStore'

export interface FormationScreenProps {
  onGoToExplore: () => void
  /** 11/11 완료 후 "정체 공개" CTA 클릭 시 호출 — 상위(App)가 확정 브레이크(S3) 모달을 띄운다. */
  onConfirmRequest: () => void
}

export function FormationScreen({ onGoToExplore, onConfirmRequest }: FormationScreenProps) {
  const anonCode = useAnonCode()
  const pool = useGameStore((s) => s.pool)
  const slots = useGameStore((s) => s.slots)
  const formationKey = useGameStore((s) => s.formationKey)
  const place = useGameStore((s) => s.place)
  const remove = useGameStore((s) => s.remove)
  const isComplete = useGameStore((s) => s.isComplete)

  const formation = useMemo(() => getFormationDef(formationKey), [formationKey])
  const placedCount = Object.values(slots).filter(Boolean).length
  const complete = isComplete()

  const [shakingSlotId, setShakingSlotId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // § 탭/클릭 배치 모드(유일한 배치 경로). 트레이 카드 클릭 → 이 선수가 "선택됨" 상태가 되고,
  // 피치의 포지션군 일치 빈 슬롯이 펄스 하이라이트된다. 슬롯 클릭 → 배치.
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const placedIds = useMemo(() => new Set(Object.values(slots).filter((v): v is string => !!v)), [slots])
  const selectedCandidate = pool.find((p) => p.id === selectedCandidateId) ?? null

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 1600)
  }

  function rejectSlot(slotId: string, group: PositionGroup) {
    setShakingSlotId(slotId)
    window.setTimeout(() => setShakingSlotId((cur) => (cur === slotId ? null : cur)), 320)
    showToast(`${group} 슬롯엔 ${group}만 배치할 수 있어요`)
  }

  function handleSelectCandidate(playerId: string) {
    setSelectedCandidateId((cur) => (cur === playerId ? null : playerId))
  }

  function handleSlotTap(slotId: string) {
    if (!selectedCandidate) return
    const slotDef = formation.slots.find((s) => s.id === slotId)
    if (!slotDef) return
    if (slotDef.group !== selectedCandidate.positionGroup) {
      rejectSlot(slotId, slotDef.group)
      return
    }
    place(slotId, selectedCandidate.id)
    setSelectedCandidateId(null)
  }

  /** 배경(빈 영역) 클릭 → 선택 취소. 클릭 타깃이 컨테이너 자기 자신일 때만(자식 카드/슬롯 클릭은 버블링돼도 타깃이 자식이라 무시). */
  function handleBackgroundClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) setSelectedCandidateId(null)
  }

  const dotsFilled = Array.from({ length: 11 }, (_, i) => i < placedCount)

  return (
    <>
      <div className="min-h-screen pb-8">
        {/* § 오너 실기기 피드백 B1: 기존엔 h-16 고정 높이라 모바일에서 콘텐츠가 flex-wrap으로
            2줄이 되면 두번째 줄(카운터+CTA)이 헤더 배경 박스 밖으로 흘러나와 피치 상단 선과
            겹쳐 보였다. 고정 높이를 없애 헤더가 실제 콘텐츠 줄 수만큼 자연스럽게 늘어나게 하고
            (sticky는 문서 흐름을 밀어내므로 겹침이 원천적으로 발생하지 않는다), 데스크탑은
            기존 한 줄(md:h-16) 레이아웃을 그대로 유지한다. */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-surface-line bg-surface-1/95 px-4 py-3 backdrop-blur-md md:h-16 md:flex-nowrap md:gap-4 md:px-8 md:py-0">
          <div className="font-display text-xl font-bold tracking-wide text-text-hi">
            BLIND <b className="text-accent">XI</b>
          </div>
          <button type="button" onClick={onGoToExplore} className="text-[14px] text-text-lo underline decoration-dotted hover:text-text-mid">
            ◀ 탐색으로
          </button>
          <div className="hidden items-center gap-1.5 md:flex" aria-hidden="true">
            {dotsFilled.map((filled, i) => (
              <i key={i} className={`h-2 w-2 rounded-full ${filled ? 'bg-ok' : 'bg-surface-line'}`} />
            ))}
          </div>
          <span className="font-mono text-[13px] text-text-mid">{placedCount}/11</span>
          <motion.button
            key={String(complete)}
            type="button"
            disabled={!complete}
            onClick={onConfirmRequest}
            animate={complete ? { boxShadow: ['0 0 0 rgba(0,0,0,0)', 'var(--glow-accent)', 'var(--glow-soft)'] } : {}}
            transition={{ duration: 0.3 }}
            className="ml-auto rounded-md px-5 py-2 text-[14px] font-semibold transition-colors"
            style={{
              backgroundColor: complete ? 'var(--accent)' : 'var(--accent-dim)',
              color: complete ? 'var(--text-onAccent)' : 'var(--text-lo)',
              cursor: complete ? 'pointer' : 'not-allowed',
            }}
          >
            정체 공개 ▶
          </motion.button>
        </header>

        <div
          data-testid="formation-canvas"
          className="mx-auto flex max-w-[var(--content-max)] flex-col gap-6 px-4 py-7 md:flex-row md:items-start md:px-6"
          onClick={handleBackgroundClick}
        >
          <div className="min-w-0 flex-1 md:sticky md:top-[60px]">
            <AnimatePresence>
              {selectedCandidate && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  data-testid="tap-select-banner"
                  className="mb-3 flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 text-[13px] font-medium"
                  style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}
                >
                  <span>
                    <span className="font-mono">{anonCode(selectedCandidate)}</span> 선택됨 · 배치할{' '}
                    {selectedCandidate.positionGroup} 슬롯을 탭하세요
                  </span>
                  <button
                    type="button"
                    data-testid="tap-select-cancel"
                    onClick={() => setSelectedCandidateId(null)}
                    className="shrink-0 text-text-lo underline decoration-dotted hover:text-text-mid"
                  >
                    취소
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <FormationBoard
              formation={formation}
              slots={slots}
              pool={pool}
              shakingSlotId={shakingSlotId}
              onRemove={remove}
              tapSelectGroup={selectedCandidate?.positionGroup ?? null}
              onSlotTap={handleSlotTap}
            />
          </div>
          <div
            data-testid="candidate-tray-panel"
            className="w-full shrink-0 rounded-xl border border-surface-line bg-surface-1 p-4 pb-14 md:w-[340px] md:sticky md:top-[60px] md:h-[calc(100vh-80px)] md:overflow-hidden md:pb-4"
            onClick={handleBackgroundClick}
          >
            <CandidateTray
              pool={pool}
              placedIds={placedIds}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={handleSelectCandidate}
            />
          </div>
        </div>

        {/* § 재작업 라운드3 #1: 모바일은 fixed 푸터가 트레이 카드 텍스트와 겹치는 문제가 있어,
            정상 문서 흐름 맨 아래로 분리(겹침 원천 차단). 데스크탑은 아래 fixed 버전을 씀. */}
        <div className="flex justify-center px-4 pb-4 md:hidden">
          <Attribution />
        </div>
      </div>

      {/* § 재작업 라운드3 #2: 데스크탑은 트레이 패널(우측) 모서리와 겹치지 않도록 좌하단으로 이동 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-10 hidden md:flex md:justify-start md:pl-8">
        <Attribution />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.24 }}
            role="status"
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-md border px-4 py-2.5 text-[13px] font-medium shadow-card"
            style={{ borderColor: 'var(--warn)', backgroundColor: 'var(--surface-2)', color: 'var(--warn)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
