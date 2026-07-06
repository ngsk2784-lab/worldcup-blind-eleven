import type { PlayerCard } from '../../types'
import { SpiderChart } from '../../components/SpiderChart'
import { anonCode } from './PlayerCardTile'

const AXIS_LABELS: Array<{ key: keyof PlayerCard['spider']; label: string }> = [
  { key: 'attack', label: '공격' },
  { key: 'passing', label: '패스' },
  { key: 'defending', label: '수비' },
  { key: 'dribbling', label: '드리블' },
  { key: 'aerial', label: '공중' },
  { key: 'activity', label: '활동량' },
]

export interface CompareOverlayProps {
  a: PlayerCard
  b: PlayerCard
}

/** 비교 트레이 2장 스파이더 오버레이(두 폴리곤 겹쳐 diff). */
export function CompareOverlay({ a, b }: CompareOverlayProps) {
  return (
    <div className="rounded-md border border-surface-line bg-surface-1 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[13px] text-data">
          <i className="inline-block h-2 w-2 rounded-full bg-data" /> {anonCode(a)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[13px] text-accent">
          <i className="inline-block h-2 w-2 rounded-full bg-accent" /> {anonCode(b)}
        </span>
      </div>
      <div className="flex justify-center">
        <SpiderChart axes={a.spider} compareAxes={b.spider} color="var(--data)" compareColor="var(--accent)" size={200} showLabels />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1.5">
        {AXIS_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between border-b border-surface-line pb-1 text-[12px]">
            <span className="text-text-mid">{label}</span>
            <span className="font-mono">
              <span className="text-data">{a.spider[key]}</span>
              <span className="mx-1 text-text-lo">/</span>
              <span className="text-accent">{b.spider[key]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
