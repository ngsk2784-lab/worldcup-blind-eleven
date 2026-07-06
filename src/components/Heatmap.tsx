import { memo } from 'react'
import type { HeatmapGrid } from '../types'

export interface HeatmapProps {
  grid: HeatmapGrid
  color?: string
  cellSize?: number
}

export const Heatmap = memo(function Heatmap({ grid, color = 'var(--data)', cellSize = 4 }: HeatmapProps) {
  const { cols, rows, cells } = grid
  const w = cols * cellSize
  const h = rows * cellSize
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
      {rects}
    </svg>
  )
})
