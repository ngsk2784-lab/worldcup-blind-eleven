import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { PositionGroup } from '../../types'
import { useGameStore } from '../../store/gameStore'
import { getFormationDef } from '../../store/gameStore'
import { FormationBoard } from './FormationBoard'
import { CandidateTray } from './CandidateTray'
import { Silhouette } from '../../components/Silhouette'
import { anonCode } from '../cards/PlayerCardTile'

export interface FormationScreenProps {
  onGoToExplore: () => void
}

export function FormationScreen({ onGoToExplore }: FormationScreenProps) {
  const pool = useGameStore((s) => s.pool)
  const slots = useGameStore((s) => s.slots)
  const formationKey = useGameStore((s) => s.formationKey)
  const place = useGameStore((s) => s.place)
  const remove = useGameStore((s) => s.remove)
  const isComplete = useGameStore((s) => s.isComplete)
  const confirmXI = useGameStore((s) => s.confirmXI)

  const formation = useMemo(() => getFormationDef(formationKey), [formationKey])
  const placedCount = Object.values(slots).filter(Boolean).length
  const complete = isComplete()

  const [activeDragGroup, setActiveDragGroup] = useState<PositionGroup | null>(null)
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(null)
  const [shakingSlotId, setShakingSlotId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 5 } }),
  )

  const placedIds = useMemo(() => new Set(Object.values(slots).filter((v): v is string => !!v)), [slots])
  const draggedPlayer = pool.find((p) => p.id === activeDragPlayerId) ?? null

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 1600)
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { playerId: string; positionGroup: PositionGroup } | undefined
    if (!data) return
    setActiveDragGroup(data.positionGroup)
    setActiveDragPlayerId(data.playerId)
  }

  function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as { playerId: string; positionGroup: PositionGroup } | undefined
    setActiveDragGroup(null)
    setActiveDragPlayerId(null)
    if (!data || !event.over) return

    const slotId = String(event.over.id)
    const slotDef = formation.slots.find((s) => s.id === slotId)
    if (!slotDef) return

    if (slotDef.group !== data.positionGroup) {
      setShakingSlotId(slotId)
      window.setTimeout(() => setShakingSlotId((cur) => (cur === slotId ? null : cur)), 320)
      showToast(`${slotDef.group} 슬롯엔 ${slotDef.group}만 배치할 수 있어요`)
      return
    }
    place(slotId, data.playerId)
  }

  const dotsFilled = Array.from({ length: 11 }, (_, i) => i < placedCount)

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen pb-8">
        <header className="sticky top-0 z-10 flex h-16 flex-wrap items-center gap-4 border-b border-surface-line bg-surface-1/90 px-4 backdrop-blur-md md:px-8">
          <div className="font-display text-xl font-bold tracking-wide text-text-hi">
            BLIND <b className="text-accent">XI</b>
          </div>
          <button type="button" onClick={onGoToExplore} className="text-[14px] text-text-lo underline decoration-dotted hover:text-text-mid">
            ◀ 탐색으로
          </button>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {dotsFilled.map((filled, i) => (
              <i key={i} className={`h-2 w-2 rounded-full ${filled ? 'bg-ok' : 'bg-surface-line'}`} />
            ))}
          </div>
          <span className="font-mono text-[13px] text-text-mid">{placedCount}/11</span>
          <motion.button
            key={String(complete)}
            type="button"
            disabled={!complete}
            onClick={() => confirmXI()}
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

        <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-6 px-4 py-7 md:flex-row md:px-6">
          <div className="min-w-0 flex-1">
            <FormationBoard
              formation={formation}
              slots={slots}
              pool={pool}
              activeDragGroup={activeDragGroup}
              shakingSlotId={shakingSlotId}
              onRemove={remove}
            />
          </div>
          <div className="w-full shrink-0 rounded-xl border border-surface-line bg-surface-1 p-4 md:w-[340px]">
            <CandidateTray pool={pool} placedIds={placedIds} />
          </div>
        </div>
      </div>

      <DragOverlay>
        {draggedPlayer ? (
          <div
            className="flex items-center gap-2 rounded-md border-l-4 bg-surface-3 p-2.5 shadow-card-hover"
            style={{ borderLeftColor: 'var(--data)', transform: 'rotate(-2deg) scale(1.06)' }}
          >
            <Silhouette position={draggedPlayer.positionGroup} size={32} />
            <span className="font-mono text-[13px] text-text-hi">{anonCode(draggedPlayer)}</span>
          </div>
        ) : null}
      </DragOverlay>

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
    </DndContext>
  )
}
