import { AnimatePresence, motion } from 'framer-motion'
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
  shaking: boolean
  /** 클릭-배치 모드: 트레이에서 후보가 선택된 상태에서 이 슬롯의 포지션군이 일치 + 비어있음 → 펄스 하이라이트. */
  tapSelectable: boolean
  onRemove: () => void
  /** 비어있는 슬롯 클릭. 선택된 후보가 없으면 상위에서 no-op 처리. */
  onTapEmpty?: () => void
}

export function Slot({ slot, player, shaking, tapSelectable, onRemove, onTapEmpty }: SlotProps) {
  const color = POS_COLOR[slot.group]

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
        onClick={player ? undefined : onTapEmpty}
        role={player ? undefined : 'button'}
        tabIndex={player ? undefined : 0}
        aria-label={player ? undefined : `${slot.group} 슬롯${tapSelectable ? ' — 클릭하여 배치' : ''}`}
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
          border: player ? 'none' : `2px dashed ${color}`,
          backgroundColor: player ? 'transparent' : `${color}1f`,
        }}
        // 클릭 배치 모드에서만 어포던스가 필요하다: 선택된 후보가 있고 이 슬롯이 대상일 때
        // 펄스 하이라이트(tapSelectable), 거부 시 셰이크. 데스크탑 마우스 호버는 빈 슬롯에
        // 살짝 확대로 클릭 가능함을 알린다.
        whileHover={!player ? { scale: 1.06 } : undefined}
        whileTap={!player ? { scale: 0.96 } : undefined}
        animate={
          shaking
            ? { x: [0, -6, 6, -6, 6, 0], boxShadow: 'none' }
            : tapSelectable
              ? { scale: [1, 1.08, 1], boxShadow: [`0 0 0 2px ${color}`, `0 0 0 7px ${color}66`, `0 0 0 2px ${color}`] }
              // framer-motion은 animate 타깃에서 빠진 키를 이전 애니메이션의 마지막 값으로 그대로
              // 남겨둔다(리셋 안 함). tapSelectable이 true→false로 바뀌는 순간(=배치 직후)
              // boxShadow 키가 사라지면 펄스 링의 마지막 프레임 색이 미니카드 뒤에 잔존하는
              // 버그가 생긴다. player 유무와 무관하게 항상 boxShadow: 'none'을 명시해 리셋한다.
              : { scale: 1, boxShadow: 'none' }
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
