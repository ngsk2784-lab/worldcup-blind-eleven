import { memo } from 'react'
import type { SpiderAxes } from '../types'

const AXES: Array<{ key: keyof SpiderAxes; label: string }> = [
  { key: 'attack', label: '공격' },
  { key: 'passing', label: '패스' },
  { key: 'defending', label: '수비' },
  { key: 'dribbling', label: '드리블' },
  { key: 'aerial', label: '공중' },
  { key: 'activity', label: '활동량' },
]

function point(i: number, r: number, cx: number, cy: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
}

function polygonPath(values: number[], R: number, cx: number, cy: number) {
  return (
    values
      .map((v, i) => {
        const [x, y] = point(i, (R * Math.max(0, Math.min(100, v))) / 100, cx, cy)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ') + 'Z'
  )
}

export interface SpiderChartProps {
  axes: SpiderAxes
  size?: number
  color?: string
  /** 비교용 두 번째 폴리곤(비교 트레이 diff 오버레이) */
  compareAxes?: SpiderAxes
  compareColor?: string
  showLabels?: boolean
  /** 정체공개 뒷면 "고스트" 미니차트처럼 옅게 표시(포인트 도트 생략) */
  faded?: boolean
}

export const SpiderChart = memo(function SpiderChart({
  axes,
  size = 120,
  color = 'var(--data)',
  compareAxes,
  compareColor = 'var(--accent)',
  showLabels = false,
  faded = false,
}: SpiderChartProps) {
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - (showLabels ? 26 : 14)
  const values = AXES.map((a) => axes[a.key])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      opacity={faded ? 0.35 : 1}
      role="img"
      aria-label="스탯 스파이더 차트"
    >
      {[0.4, 0.7, 1].map((f, idx) => {
        const d =
          AXES.map((_, i) => {
            const [x, y] = point(i, R * f, cx, cy)
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
          }).join(' ') + 'Z'
        return <path key={idx} d={d} fill="none" stroke="var(--surface-line)" strokeWidth={1} opacity={0.5} />
      })}
      {AXES.map((_, i) => {
        const [x, y] = point(i, R, cx, cy)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--surface-line)" strokeWidth={1} opacity={0.4} />
      })}
      {compareAxes && (
        <path
          d={polygonPath(
            AXES.map((a) => compareAxes[a.key]),
            R,
            cx,
            cy,
          )}
          fill={compareColor}
          fillOpacity={0.16}
          stroke={compareColor}
          strokeWidth={1.6}
        />
      )}
      <path d={polygonPath(values, R, cx, cy)} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.6} />
      {!faded &&
        values.map((v, i) => {
          const [x, y] = point(i, (R * Math.max(0, Math.min(100, v))) / 100, cx, cy)
          return <circle key={i} cx={x} cy={y} r={2.4} fill={color} />
        })}
      {showLabels &&
        AXES.map((a, i) => {
          const [x, y] = point(i, R + 16, cx, cy)
          return (
            <text key={a.key} x={x} y={y} fill="var(--text-lo)" fontSize={10} textAnchor="middle" dominantBaseline="middle">
              {a.label}
            </text>
          )
        })}
    </svg>
  )
})
