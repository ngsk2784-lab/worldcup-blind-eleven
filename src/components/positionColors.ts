import type { PositionGroup } from '../types'

/** 포지션군 4색 raw hex(캔버스/문자열 배경 등 CSS 변수 미지원 컨텍스트용). index.css의 --pos-* 와 동일 값을 유지한다. */
const RAW_COLOR: Record<PositionGroup, string> = {
  GK: '#E8B04B',
  DEF: '#5B8DEF',
  MID: '#3FB98C',
  FWD: '#E5533C',
}

export function positionColorVar(group: PositionGroup): string {
  switch (group) {
    case 'GK':
      return 'var(--pos-gk)'
    case 'DEF':
      return 'var(--pos-def)'
    case 'MID':
      return 'var(--pos-mid)'
    case 'FWD':
      return 'var(--pos-fwd)'
  }
}

export function positionColorHex(group: PositionGroup): string {
  return RAW_COLOR[group]
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function positionOverlay(group: PositionGroup, alpha = 0.12): string {
  return hexToRgba(RAW_COLOR[group], alpha)
}
