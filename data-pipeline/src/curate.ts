/**
 * curate.ts — 포지션군별 상위 N 선발로 풀 규모 관리(대회당 ~50~60명).
 * "스타 + 숨은보석" 믹스: 품질 상위 정렬 + 팀당 상한으로 특정 강팀 편중 방지.
 *
 * 상세: docs/architecture.md §3-4
 */

import type { PositionGroup } from "./types.js";
import type { MatchInfo } from "./aggregate.js";
import type { NormalizedPlayer } from "./normalize.js";
import { computeTeamResults } from "./score.js";

/** 포지션군별 목표 인원. 총 ~56명(대회당 gzip 500KB 예산, 4-3-3/4-4-2/3-4-3 포메이션 채우기 가능). */
export const DEFAULT_TARGETS: Record<PositionGroup, number> = {
  GK: 6,
  DEF: 18,
  MID: 18,
  FWD: 14,
};

/** 포지션군 내 품질 = 스파이더 6축 평균. */
function quality(p: NormalizedPlayer): number {
  const axes = p.spider;
  return (axes.attack + axes.passing + axes.defending + axes.dribbling + axes.aerial + axes.activity) / 6;
}

const MAX_PER_TEAM_PER_GROUP = 3;

export function curatePool(
  players: NormalizedPlayer[],
  matches: MatchInfo[],
  year: 2018 | 2022,
  targets: Record<PositionGroup, number> = DEFAULT_TARGETS,
): NormalizedPlayer[] {
  const teamResults = computeTeamResults(matches, year);

  const byGroup = new Map<PositionGroup, NormalizedPlayer[]>();
  for (const p of players) {
    const list = byGroup.get(p.positionGroup) ?? [];
    list.push(p);
    byGroup.set(p.positionGroup, list);
  }

  const curated: NormalizedPlayer[] = [];

  for (const [group, target] of Object.entries(targets) as [PositionGroup, number][]) {
    const pool = (byGroup.get(group) ?? []).slice();
    // 품질 내림차순, 동률이면 팀 성적(선수풀 다양성에 큰 영향 없는 타이브레이커)으로 보조 정렬
    pool.sort((a, b) => {
      const q = quality(b) - quality(a);
      if (q !== 0) return q;
      const ra = teamResults.get(a.teamName)?.roundScore ?? 0;
      const rb = teamResults.get(b.teamName)?.roundScore ?? 0;
      return rb - ra;
    });

    const perTeamCount = new Map<string, number>();
    const picked: NormalizedPlayer[] = [];
    const overflow: NormalizedPlayer[] = [];

    for (const p of pool) {
      const cnt = perTeamCount.get(p.teamName) ?? 0;
      if (cnt < MAX_PER_TEAM_PER_GROUP) {
        picked.push(p);
        perTeamCount.set(p.teamName, cnt + 1);
      } else {
        overflow.push(p);
      }
      if (picked.length >= target) break;
    }
    // 팀당 상한 때문에 목표를 못 채웠으면 overflow(품질순)로 채움
    for (const p of overflow) {
      if (picked.length >= target) break;
      picked.push(p);
    }

    curated.push(...picked);
  }

  return curated;
}
