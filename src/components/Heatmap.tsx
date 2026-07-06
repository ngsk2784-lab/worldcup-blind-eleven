import { memo, useId } from 'react'
import type { HeatmapGrid } from '../types'

export interface HeatmapProps {
  grid: HeatmapGrid
  color?: string
  cellSize?: number
  /** 미니 히트맵의 픽셀 뭉개짐 방지: 하드 엣지를 blur로 부드러운 존(zone) 형태로 뭉개기.
   * 기본 on(§ 재작업 라운드1 #4). 큰 상세 히트맵 등에서 정밀도가 필요하면 false로 끈다. */
  blur?: boolean
}

export const Heatmap = memo(function Heatmap({ grid, color = 'var(--data)', cellSize = 4, blur = true }: HeatmapProps) {
  const { cols, rows, cells } = grid
  const w = cols * cellSize
  const h = rows * cellSize
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const filterId = `hm-blur-${rawId}`
  const rects: React.ReactNode[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = cells[y * cols + x] || 0
      if (v < 6) continue
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * cellSize}
          y={y * cellSize}
          width={cellSize}
          height={cellSize}
          rx={1}
          fill={color}
          opacity={(v / 100) * 0.9 + 0.1}
        />,
      )
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="활동 히트맵">
      <rect width={w} height={h} rx={3} fill="var(--bg-pitch)" />
      {blur && (
        <defs>
          <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={cellSize * 0.45} />
          </filter>
        </defs>
      )}
      <g filter={blur ? `url(#${filterId})` : undefined}>{rects}</g>
    </svg>
  )
})
