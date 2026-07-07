import { create } from 'zustand'
import type { FinalXIEntry, GamePhase, GameStore, Meta, PlayerCard, XIScore } from '../types'
import players2022Raw from '../data/players.2022.json'
import players2018Raw from '../data/players.2018.json'
import metaRaw from '../data/meta.json'
import { buildSessionPool, randomSeed } from '../lib/sessionShuffle'

const meta = metaRaw as unknown as Meta

/** 대회연도 -> 선수 풀(원본, 불변). 실데이터/능력치는 절대 셔플하지 않는다 — 셔플은
 * buildSessionPool()이 만드는 표시용 레이어(카드 순서 + 익명 코드)에만 적용된다. */
const BASE_POOLS: Record<2018 | 2022, PlayerCard[]> = {
  2022: players2022Raw as unknown as PlayerCard[],
  2018: players2018Raw as unknown as PlayerCard[],
}

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
 * 내부 전용 확장(WT-C 계약 밖). App 내 S1<->S2 화면 전환 + 세션 셔플에만 쓰인다.
 * 계약 필수 필드(GameStore)는 전부 아래에 구현됨.
 */
export interface InternalGameStore extends GameStore {
  setPhase(phase: GamePhase): void
  /** 세션 시드 — qa/e2e가 "세션 내 일관 / 세션 간 상이"를 검증할 때 읽는다(개발 전용 훅과 별개로 항상 노출). */
  sessionSeed: number
  /** playerId -> 익명 코드("#G01" 등). anonCode 표시는 전부 이 맵을 거친다(useAnonCode 훅 참조). */
  codeMap: Record<string, string>
  /** 새 세션 시작(스카우팅 시작 클릭) — 시드 재생성 + 카드 순서/코드 재배정. */
  startSession(): void
}

const initialSeed = randomSeed()
const initialSession = buildSessionPool(BASE_POOLS[2022], initialSeed)

export const useGameStore = create<InternalGameStore>((set, get) => ({
  phase: 'onboarding',
  tournament: 2022,
  pool: initialSession.pool,
  sessionSeed: initialSeed,
  codeMap: initialSession.codeMap,
  formationKey: DEFAULT_FORMATION,
  slots: emptySlots(DEFAULT_FORMATION),

  /** 대회 전환: 새 시드로 pool 재셔플 + 코드 재배정, 슬롯 리셋(이전 대회 선수 id는 새 pool에 존재하지 않음). */
  setTournament(year) {
    const seed = randomSeed()
    const session = buildSessionPool(BASE_POOLS[year], seed)
    set((s) => ({
      tournament: year,
      sessionSeed: seed,
      pool: session.pool,
      codeMap: session.codeMap,
      slots: emptySlots(s.formationKey),
    }))
  },

  /** "스카우팅 시작" 클릭 시 호출 — 매 판(세션)마다 코드/카드 순서를 새로 섞는다(반복 플레이 암기 공략 방지).
   * 선수 데이터/능력치(BASE_POOLS)는 절대 변경하지 않고 표시 레이어만 재생성한다. */
  startSession() {
    const seed = randomSeed()
    const session = buildSessionPool(BASE_POOLS[get().tournament], seed)
    set({ sessionSeed: seed, pool: session.pool, codeMap: session.codeMap })
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

  /** 재도전: 온보딩으로 복귀 + 슬롯 리셋 + 세션 재셔플(다음 판은 코드/카드 순서가 달라짐). */
  reset() {
    const seed = randomSeed()
    const session = buildSessionPool(BASE_POOLS[get().tournament], seed)
    set((s) => ({
      phase: 'onboarding',
      slots: emptySlots(s.formationKey),
      sessionSeed: seed,
      pool: session.pool,
      codeMap: session.codeMap,
    }))
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

/** 익명 코드 표시 훅. 세션의 codeMap을 구독 — 세션 재셔플(startSession/setTournament/reset) 시
 * 자동으로 새 코드로 리렌더된다. 이 훅을 거치지 않고 player.id에서 직접 코드를 파생하지 말 것
 * (그러면 세션 무관 고정 코드가 되어 암기 공략 방지 목적이 깨진다). */
export function useAnonCode() {
  const codeMap = useGameStore((s) => s.codeMap)
  return (player: PlayerCard) => codeMap[player.id] ?? '#???'
}

// 개발/e2e 테스트 전용 훅: 프로덕션 빌드에서는 import.meta.env.DEV가 false로 상수 폴딩되어
// 데드코드 제거(tree-shaking)된다. 드래그로는 재현 불가능한 스토어 방어로직(예: 같은 선수
// 중복 슬롯 배치 가드)을 e2e에서 직접 검증하기 위함.
if (import.meta.env.DEV) {
  ;(window as unknown as { __gameStore?: typeof useGameStore }).__gameStore = useGameStore
}
