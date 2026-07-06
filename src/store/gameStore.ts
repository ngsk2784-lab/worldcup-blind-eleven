import { create } from 'zustand'
import type { FinalXIEntry, GamePhase, GameStore, Meta, PlayerCard, XIScore } from '../types'
import players2022Raw from '../data/players.2022.json'
import metaRaw from '../data/meta.json'

const players = players2022Raw as unknown as PlayerCard[]
const meta = metaRaw as unknown as Meta

function getFormation(formationKey: string) {
  return meta.formations.find((f) => f.key === formationKey) ?? meta.formations[0]
}

function emptySlots(formationKey: string): Record<string, string | null> {
  const formation = getFormation(formationKey)
  const slots: Record<string, string | null> = {}
  formation.slots.forEach((s) => {
    slots[s.id] = null
  })
  return slots
}

const DEFAULT_FORMATION = meta.formations[0]?.key ?? '4-3-3'

/** 안목 점수 등급 매핑 (architecture.md §4) */
function gradeFor(total: number): XIScore['grade'] {
  if (total >= 85) return 'S'
  if (total >= 70) return 'A'
  if (total >= 55) return 'B'
  if (total >= 40) return 'C'
  return 'D'
}

/**
 * 내부 전용 확장(WT-C 계약 밖). App 내 S1<->S2 화면 전환에만 쓰인다.
 * 계약 필수 필드(GameStore)는 전부 아래에 구현됨.
 */
export interface InternalGameStore extends GameStore {
  setPhase(phase: GamePhase): void
}

export const useGameStore = create<InternalGameStore>((set, get) => ({
  phase: 'onboarding',
  tournament: 2022,
  pool: players,
  formationKey: DEFAULT_FORMATION,
  slots: emptySlots(DEFAULT_FORMATION),

  setTournament(year) {
    set({ tournament: year })
  },

  setPhase(phase) {
    set({ phase })
  },

  /** 규칙 검증 포함: 슬롯의 positionGroup과 카드가 불일치하면 조용히 no-op(UI가 셰이크/토스트로 안내). */
  place(slotId, playerId) {
    const state = get()
    const formation = getFormation(state.formationKey)
    const slot = formation.slots.find((s) => s.id === slotId)
    const player = state.pool.find((p) => p.id === playerId)
    if (!slot || !player) return
    if (slot.group !== player.positionGroup) return

    set((s) => {
      const nextSlots = { ...s.slots }
      // 같은 선수가 이미 다른 슬롯에 있으면 제거(중복 배치 방지)
      for (const key of Object.keys(nextSlots)) {
        if (nextSlots[key] === playerId) nextSlots[key] = null
      }
      nextSlots[slotId] = playerId
      return { slots: nextSlots }
    })
  },

  remove(slotId) {
    set((s) => ({ slots: { ...s.slots, [slotId]: null } }))
  },

  confirmXI() {
    if (get().isComplete()) {
      set({ phase: 'reveal' })
    }
  },

  reset() {
    set((s) => ({ phase: 'onboarding', slots: emptySlots(s.formationKey) }))
  },

  finalXI(): FinalXIEntry[] {
    const state = get()
    const formation = getFormation(state.formationKey)
    const entries: FinalXIEntry[] = []
    formation.slots.forEach((slot) => {
      const playerId = state.slots[slot.id]
      if (!playerId) return
      const player = state.pool.find((p) => p.id === playerId)
      if (player) entries.push({ slot, player })
    })
    return entries
  },

  isComplete() {
    const state = get()
    const formation = getFormation(state.formationKey)
    return formation.slots.every((s) => !!state.slots[s.id])
  },

  score(): XIScore {
    const xi = get().finalXI()
    if (xi.length === 0) {
      return {
        total: 0,
        grade: 'D',
        statAvg: 0,
        achievementAvg: 0,
        bestPick: { playerId: '', reason: '' },
        biggestUpset: { playerId: '', reason: '' },
      }
    }
    const statAvg = xi.reduce((sum, e) => sum + e.player.scoring.statExcellence, 0) / xi.length
    const achievementAvg = xi.reduce((sum, e) => sum + e.player.scoring.achievement, 0) / xi.length
    const total = 0.6 * statAvg + 0.4 * achievementAvg

    const contrib = (e: FinalXIEntry) => 0.6 * e.player.scoring.statExcellence + 0.4 * e.player.scoring.achievement
    const bestPick = xi.reduce<FinalXIEntry | null>(
      (best, e) => (best === null || contrib(e) > contrib(best) ? e : best),
      null,
    )
    const upsetGap = (e: FinalXIEntry) => e.player.scoring.achievement - e.player.scoring.fameProxy
    const biggestUpset = xi.reduce<FinalXIEntry | null>(
      (worst, e) => (worst === null || upsetGap(e) > upsetGap(worst) ? e : worst),
      null,
    )

    return {
      total: Math.round(total),
      grade: gradeFor(total),
      statAvg: Math.round(statAvg),
      achievementAvg: Math.round(achievementAvg),
      bestPick: bestPick ? { playerId: bestPick.player.id, reason: '안목 점수 기여도 최고' } : { playerId: '', reason: '' },
      biggestUpset: biggestUpset
        ? { playerId: biggestUpset.player.id, reason: biggestUpset.player.reveal.epithet ?? '의외의 반전 픽' }
        : { playerId: '', reason: '' },
    }
  },
}))

/** WT-C 등 소비자가 포메이션 슬롯 정의를 읽을 때 사용(스토어 자체는 formationKey만 보유). */
export function getFormationDef(formationKey: string) {
  return getFormation(formationKey)
}

export { meta as gameMeta }
