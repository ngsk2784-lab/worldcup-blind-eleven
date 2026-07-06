/**
 * WT-C 개발용 임시 로컬 스토어.
 *
 * 실제 GameStore는 WT-B가 `src/store/`에 구현한다. 이 파일은 그 타입 계약
 * (`src/types/index.ts`의 GameStore)에 맞춰 reveal/result 화면을 개발·검증하기
 * 위한 스텁이다. 컴포넌트는 이 파일을 직접 import하지 않고, 아래 `useDevStore`
 * 훅과 동일한 셀렉터 시그니처(finalXI/isComplete/score 등)만 사용한다.
 * 통합 시 이 파일을 지우고 WT-B의 실제 스토어로 교체하면 된다.
 */
import { create } from 'zustand';
import type {
  Formation,
  FormationSlot,
  GamePhase,
  GameStore,
  Meta,
  PlayerCard,
  XIScore,
} from '../types';
import playersMockRaw from '../data/players.mock.json';
import metaRaw from '../data/meta.json';

const players = playersMockRaw as unknown as PlayerCard[];
const meta = metaRaw as unknown as Meta;
const formation: Formation = meta.formations[0];

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function gradeOf(total: number): XIScore['grade'] {
  if (total >= 85) return 'S';
  if (total >= 70) return 'A';
  if (total >= 55) return 'B';
  if (total >= 40) return 'C';
  return 'D';
}

/** 대회 11자리를 포지션군 순서대로 그리디하게 채운다(개발용 픽스처). */
function buildInitialSlots(): Record<string, string | null> {
  const used = new Set<string>();
  const slots: Record<string, string | null> = {};
  for (const slot of formation.slots) {
    const candidate = players.find((p) => p.positionGroup === slot.group && !used.has(p.id));
    if (candidate) {
      used.add(candidate.id);
      slots[slot.id] = candidate.id;
    } else {
      slots[slot.id] = null;
    }
  }
  return slots;
}

function combined(p: PlayerCard): number {
  return 0.6 * p.scoring.statExcellence + 0.4 * p.scoring.achievement;
}

function upsetGap(p: PlayerCard): number {
  return p.scoring.achievement - p.scoring.fameProxy;
}

function computeScore(finalXI: { slot: FormationSlot; player: PlayerCard }[]): XIScore {
  const statAvg = mean(finalXI.map((e) => e.player.scoring.statExcellence));
  const achievementAvg = mean(finalXI.map((e) => e.player.scoring.achievement));
  const total = 0.6 * statAvg + 0.4 * achievementAvg;

  let best = finalXI[0];
  let upset = finalXI[0];
  for (const e of finalXI) {
    if (combined(e.player) > combined(best.player)) best = e;
    if (upsetGap(e.player) > upsetGap(upset.player)) upset = e;
  }

  return {
    total: Math.round(total * 10) / 10,
    grade: gradeOf(total),
    statAvg: Math.round(statAvg),
    achievementAvg: Math.round(achievementAvg),
    bestPick: {
      playerId: best.player.id,
      reason: best.player.reveal.epithet ?? '팀 기여도 최고',
    },
    biggestUpset: {
      playerId: upset.player.id,
      reason: upset.player.reveal.epithet ?? '예상 밖의 활약',
    },
  };
}

export const useDevStore = create<GameStore>((set, get) => ({
  phase: 'formation' as GamePhase,
  tournament: 2022,
  pool: players,
  formationKey: formation.key,
  slots: buildInitialSlots(),

  setTournament: (year) => set({ tournament: year }),
  place: (slotId, playerId) => set((s) => ({ slots: { ...s.slots, [slotId]: playerId } })),
  remove: (slotId) => set((s) => ({ slots: { ...s.slots, [slotId]: null } })),
  confirmXI: () => set({ phase: 'reveal' }),
  reset: () => set({ phase: 'onboarding', slots: buildInitialSlots() }),

  finalXI: () =>
    formation.slots
      .map((slot) => ({ slot, player: players.find((p) => p.id === get().slots[slot.id]) }))
      .filter((e): e is { slot: FormationSlot; player: PlayerCard } => Boolean(e.player)),
  isComplete: () => formation.slots.every((slot) => Boolean(get().slots[slot.id])),
  score: () => computeScore(get().finalXI()),
}));

export const devFormation = formation;
export const devMeta = meta;
