import { AnimatePresence, motion } from 'framer-motion'
import { useDroppable } from '@dnd-kit/core'
import type { FormationSlot, PlayerCard, PositionGroup } from '../../types'
import { MiniCard } from './MiniCard'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface SlotProps {
  slot: FormationSlot
  player: PlayerCard | null
  activeDragGroup: PositionGroup | null
  shaking: boolean
  /** 탭-배치 모드: 트레이에서 후보가 선택된 상태에서 이 슬롯의 포지션군이 일치 + 비어있음 → 펄스 하이라이트. */
  tapSelectable: boolean
  onRemove: () => void
  /** 비어있는 슬롯 탭. 선택된 후보가 없으면 상위에서 no-op 처리. */
  onTapEmpty?: () => void
}

export function Slot({ slot, player, activeDragGroup, shaking, tapSelectable, onRemove, onTapEmpty }: SlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id, data: { group: slot.group } })
  const color = POS_COLOR[slot.group]
  const isValidTarget = activeDragGroup !== null && activeDragGroup === slot.group
  const isInvalidTarget = activeDragGroup !== null && activeDragGroup !== slot.group

  return (
    // 위치 고정용 래퍼(-translate-x/y-1/2로 슬롯 중심을 좌표에 맞춤)와 애니메이션용
    // motion.div를 분리한다: framer-motion의 `animate`(scale/shake)는 최적화를 위해
    // 미사용 트랜스폼 축을 `transform: none`으로 인라인 렌더링하는데, 같은 엘리먼트에
    // Tailwind의 -translate-x-1/2 -translate-y-1/2 클래스가 함께 있으면 인라인 style이
    // 항상 이겨서 중심 정렬이 깨진다(모바일 390에서 우측 슬롯이 뷰포트 밖으로 밀려나는
    // 버그로 발견됨). 래퍼가 위치를, 내부 motion.div가 스케일/셰이크만 담당하도록 분리.
    <div
      data-slot-id={slot.id}
      data-slot-group={slot.group}
      data-slot-filled={!!player}
      className="absolute h-18 w-18 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
    >
      <motion.div
        ref={setNodeRef}
        onClick={player ? undefined : onTapEmpty}
        role={player ? undefined : 'button'}
        tabIndex={player ? undefined : 0}
        aria-label={player ? undefined : `${slot.group} 슬롯${tapSelectable ? ' — 탭하여 배치' : ''}`}
        onKeyDown={
          player
            ? undefined
            : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onTapEmpty?.()
                }
              }
        }
        className={`flex h-18 w-18 items-center justify-center rounded-full ${!player ? 'cursor-pointer' : ''}`}
        style={{
          border: player ? 'none' : `2px dashed ${isInvalidTarget && isOver ? 'var(--error)' : color}`,
          backgroundColor: player ? 'transparent' : `${color}1f`,
          boxShadow: isValidTarget && isOver ? `0 0 0 2px ${color}` : undefined,
          filter: isInvalidTarget && isOver ? 'brightness(0.75)' : undefined,
        }}
        animate={
          shaking
            ? { x: [0, -6, 6, -6, 6, 0] }
            : tapSelectable
              ? { scale: [1, 1.08, 1], boxShadow: [`0 0 0 2px ${color}`, `0 0 0 7px ${color}66`, `0 0 0 2px ${color}`] }
              : { scale: isValidTarget && isOver ? 1.05 : 1 }
        }
        transition={shaking ? { duration: 0.3 } : tapSelectable ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18 }}
      >
        <AnimatePresence mode="wait">
          {player ? (
            <MiniCard key={player.id} player={player} onRemove={onRemove} />
          ) : (
            <span key="label" className="overline pointer-events-none" style={{ color }}>
              {slot.group}
            </span>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
