import { motion, AnimatePresence } from 'framer-motion'
import type { PlayerCard, PositionGroup } from '../../types'
import { SpiderChart } from '../../components/SpiderChart'
import { anonCode } from './PlayerCardTile'
import { CompareOverlay } from './CompareOverlay'

const POS_COLOR: Record<PositionGroup, string> = {
  GK: 'var(--pos-gk)',
  DEF: 'var(--pos-def)',
  MID: 'var(--pos-mid)',
  FWD: 'var(--pos-fwd)',
}

const AXIS_LABELS: Array<{ key: keyof PlayerCard['spider']; label: string }> = [
  { key: 'attack', label: '공격' },
  { key: 'passing', label: '패스' },
  { key: 'defending', label: '수비' },
  { key: 'dribbling', label: '드리블' },
  { key: 'aerial', label: '공중' },
  { key: 'activity', label: '활동량' },
]

export interface DetailPanelProps {
  player: PlayerCard | null
  compareIds: string[]
  compareA: PlayerCard | null
  compareB: PlayerCard | null
  onAddCompare: () => void
  onRemoveCompare: (playerId: string) => void
  /** § 오너 실기기 피드백 A4: 이 버튼이 모바일 탭-배치 모드의 진입점 — S2로 이동 + 이 선수를
   * 자동으로 "선택됨" 상태로 시작해 가능한 슬롯이 곧바로 하이라이트되게 한다. */
  onGoToFormation: (playerId: string) => void
}

export function DetailPanel({ player, compareIds, compareA, compareB, onAddCompare, onRemoveCompare, onGoToFormation }: DetailPanelProps) {
  return (
    <div className="w-full shrink-0 md:w-[360px]">
      <div className="rounded-xl border border-surface-line bg-surface-2 p-5 shadow-card">
        <AnimatePresence mode="wait">
          {player ? (
            <motion.div
              key={player.id}
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -12, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <span
                className="mb-2.5 inline-block rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: POS_COLOR[player.positionGroup], backgroundColor: `${POS_COLOR[player.positionGroup]}1f` }}
              >
                {player.positionGroup} · {player.positionLabel}
              </span>
              <h2 className="font-mono text-[26px] font-bold tracking-wide text-text-hi">{anonCode(player)}</h2>
              <p className="mb-4 text-[13px] text-text-lo">
                출전 신뢰도 {'●'.repeat(Math.min(4, Math.max(1, Math.round(player.sampleMinutes / 200))))}
                {'○'.repeat(4 - Math.min(4, Math.max(1, Math.round(player.sampleMinutes / 200))))} · 표본{' '}
                {player.sampleMinutes}분
              </p>
              <div className="my-1.5 mb-3.5 flex justify-center">
                <SpiderChart axes={player.spider} size={200} showLabels />
              </div>
              <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2">
                {AXIS_LABELS.map(({ key, label }) => (
                  <div key={key} className="flex justify-between border-b border-surface-line pb-1 text-[12px]">
                    <span className="text-text-mid">{label}</span>
                    <span className="font-mono font-semibold text-data">{player.spider[key]}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onGoToFormation(player.id)}
                className="mb-2.5 h-12 w-full rounded-md bg-accent font-body text-[15px] font-semibold text-text-onaccent shadow-glow-soft transition-colors hover:bg-accent-hi"
              >
                이 선수 배치하기
              </button>
              <button
                type="button"
                onClick={onAddCompare}
                disabled={compareIds.includes(player.id) || compareIds.length >= 2}
                className="h-12 w-full rounded-md border border-surface-line font-body text-[15px] font-semibold text-text-mid transition-colors hover:border-data disabled:cursor-not-allowed disabled:opacity-40"
              >
                {compareIds.includes(player.id) ? '비교 트레이에 있음' : '비교에 추가'}
              </button>
            </motion.div>
          ) : (
            <motion.p key="empty" className="py-10 text-center text-[14px] text-text-lo">
              카드를 선택하면 상세 스탯을 확인할 수 있습니다.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-4 rounded-md border border-dashed border-surface-line bg-surface-1 p-3.5">
          <span className="overline mb-2 block">비교 트레이 (최대 2)</span>
          <div className="flex gap-2">
            {[0, 1].map((i) => {
              const id = compareIds[i]
              const p = i === 0 ? compareA : compareB
              return (
                <div
                  key={i}
                  className="flex h-[52px] flex-1 items-center justify-center rounded-md border border-dashed border-surface-line text-[12px] text-text-lo"
                >
                  {p ? (
                    <button
                      type="button"
                      onClick={() => onRemoveCompare(id)}
                      className="font-mono text-[13px] text-text-hi underline decoration-dotted"
                      aria-label={`비교에서 ${anonCode(p)} 제거`}
                    >
                      {anonCode(p)} ✕
                    </button>
                  ) : (
                    '비어 있음'
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {compareA && compareB && (
          <div className="mt-3.5">
            <CompareOverlay a={compareA} b={compareB} />
          </div>
        )}
      </div>
    </div>
  )
}
