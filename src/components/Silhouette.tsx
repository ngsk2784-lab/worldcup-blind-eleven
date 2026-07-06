import { memo } from 'react'
import type { PositionGroup } from '../types'

const RIM: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

export interface SilhouetteProps {
  position: PositionGroup
  size?: number
}

/** 포지션군별 4종 상반신 실루엣(자세 미세 차등). 사진 절대 미사용. */
export const Silhouette = memo(function Silhouette({ position, size = 54 }: SilhouetteProps) {
  const rim = RIM[position]
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" role="img" aria-label={`${position} 실루엣 아바타`}>
      <circle cx={27} cy={17} r={9.5} fill="#2a3641" stroke={rim} strokeWidth={1} opacity={0.95} />
      <path d="M9 50c0-11 8-18 18-18s18 7 18 18z" fill="#2a3641" stroke={rim} strokeWidth={1} />
      {position === 'GK' && (
        <path
          d="M6 44c2-9 8-15 15-16M48 44c-2-9-8-15-15-16"
          fill="none"
          stroke={rim}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
      {position === 'FWD' && (
        <path d="M17 30l-6 8M37 30l6 8" fill="none" stroke={rim} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      )}
      {position === 'DEF' && <path d="M14 40h26" stroke={rim} strokeWidth={1} opacity={0.4} />}
    </svg>
  )
})
