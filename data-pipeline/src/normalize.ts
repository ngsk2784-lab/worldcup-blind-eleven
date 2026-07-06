/**
 * normalize.ts — 포지션군(GK/DEF/MID/FWD) 내 백분위(0~100) 정규화 → 스파이더 6축 산출.
 * minMinutesThreshold 미만 제외.
 *
 * 상세: docs/architecture.md §3-3
 */

import type { PositionGroup, SpiderAxes } from "./types.js";
import { primaryPosition, toHeatmapGrid, type RawPlayerAgg } from "./aggregate.js";

export interface NormalizedPlayer extends RawPlayerAgg {
  positionGroup: PositionGroup;
  positionLabel: string;
  spider: SpiderAxes;
}

function per90(value: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (value / minutes) * 90;
}

/** 축별 raw 합성값(가중합, per-90 기반). architecture §3-3: "가중합 후 포지션군 백분위". */
function axisComposites(p: RawPlayerAgg): Record<keyof SpiderAxes, number> {
  const m = p.minutes;
  const nonZeroCells = p.heatmapRaw.filter((c) => c > 0).length;
  const heatmapCoverage = (nonZeroCells / p.heatmapRaw.length) * 100;

  const aerialTotal = p.aerialWon + p.aerialLost;
  const aerialWinPct = aerialTotal > 0 ? (p.aerialWon / aerialTotal) * 100 : 0;

  const passCompletionPct = p.passAttempts > 0 ? (p.passCompleted / p.passAttempts) * 100 : 0;
  const dribbleSuccessPct = p.dribbleAttempts > 0 ? (p.dribbleSuccess / p.dribbleAttempts) * 100 : 0;

  return {
    attack: 0.3 * per90(p.shots, m) * 10 + 0.4 * per90(p.xg, m) * 100 + 0.3 * per90(p.goals, m) * 100,
    passing:
      0.35 * passCompletionPct +
      0.25 * per90(p.keyPasses, m) * 10 +
      0.15 * per90(p.forwardPasses, m) * 5 +
      0.25 * per90(p.xa, m) * 100,
    defending:
      0.3 * per90(p.tacklesWon, m) * 10 +
      0.3 * per90(p.interceptionsWon, m) * 10 +
      0.25 * per90(p.recoveries, m) * 5 +
      0.15 * per90(p.pressures, m) * 2,
    dribbling: 0.5 * per90(p.dribbleSuccess, m) * 10 + 0.2 * dribbleSuccessPct + 0.3 * per90(p.carryDistance, m) * 0.3,
    aerial: 0.6 * aerialWinPct + 0.4 * per90(p.aerialWon, m) * 10,
    activity: 0.6 * per90(p.totalActions, m) + 0.4 * heatmapCoverage,
  };
}

/** 동순위 평균 순위 방식 백분위(0~100). 값이 낮을수록 낮은 백분위. */
function percentileRank(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 50);
  const sortedIdx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(n);

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sortedIdx[j + 1][0] === sortedIdx[i][0]) j++;
    const avgRank = (i + j) / 2; // 0-based average rank among ties
    for (let k = i; k <= j; k++) {
      ranks[sortedIdx[k][1]] = avgRank;
    }
    i = j + 1;
  }
  return ranks.map((r) => (r / (n - 1)) * 100);
}

export function normalizePlayers(players: RawPlayerAgg[], minMinutesThreshold: number): NormalizedPlayer[] {
  const eligible = players.filter((p) => p.minutes >= minMinutesThreshold);

  const byGroup = new Map<PositionGroup, RawPlayerAgg[]>();
  const groupOf = new Map<number, { group: PositionGroup; label: string }>();
  for (const p of eligible) {
    const pos = primaryPosition(p);
    groupOf.set(p.playerId, pos);
    const list = byGroup.get(pos.group) ?? [];
    list.push(p);
    byGroup.set(pos.group, list);
  }

  const spiderByPlayer = new Map<number, SpiderAxes>();
  for (const [, groupPlayers] of byGroup) {
    const composites = groupPlayers.map(axisComposites);
    const axisKeys: (keyof SpiderAxes)[] = ["attack", "passing", "defending", "dribbling", "aerial", "activity"];
    const percentilesByAxis: Record<string, number[]> = {};
    for (const axis of axisKeys) {
      percentilesByAxis[axis] = percentileRank(composites.map((c) => c[axis]));
    }
    groupPlayers.forEach((p, idx) => {
      spiderByPlayer.set(p.playerId, {
        attack: Math.round(percentilesByAxis.attack[idx]),
        passing: Math.round(percentilesByAxis.passing[idx]),
        defending: Math.round(percentilesByAxis.defending[idx]),
        dribbling: Math.round(percentilesByAxis.dribbling[idx]),
        aerial: Math.round(percentilesByAxis.aerial[idx]),
        activity: Math.round(percentilesByAxis.activity[idx]),
      });
    });
  }

  return eligible.map((p) => {
    const pos = groupOf.get(p.playerId)!;
    return {
      ...p,
      positionGroup: pos.group,
      positionLabel: pos.label,
      spider: spiderByPlayer.get(p.playerId)!,
    };
  });
}

export { toHeatmapGrid };
