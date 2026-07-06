/**
 * 정체 공개 드라마 순서 (design-spec §4.2).
 * 1~4 평이한 픽 → 5~8 반전 픽(점증) → 9~10 준-스타 → 11 최고 스타.
 * 반전 강도(§4.3)는 |achievement - fameProxy| 근사로 약/중/강 3단계.
 */
import type { FinalXIEntry } from '../../types';

export type Intensity = 'weak' | 'mid' | 'strong';

export interface DramaEntry {
  entry: FinalXIEntry;
  intensity: Intensity;
  upsetGap: number;
}

function upsetGap(e: FinalXIEntry): number {
  return e.player.scoring.achievement - e.player.scoring.fameProxy;
}

function intensityOf(gap: number, isStar: boolean): Intensity {
  if (isStar) return 'strong';
  const abs = Math.abs(gap);
  if (abs > 30) return 'strong';
  if (abs > 15) return 'mid';
  return 'weak';
}

export function buildRevealOrder(finalXI: FinalXIEntry[]): DramaEntry[] {
  if (finalXI.length === 0) return [];
  const pool = [...finalXI];

  // 11번(마지막): fameProxy 최대 = 최고 스타
  let starIdx = 0;
  pool.forEach((e, i) => {
    if (e.player.scoring.fameProxy > pool[starIdx].player.scoring.fameProxy) starIdx = i;
  });
  const star = pool[starIdx];
  const rest = pool.filter((_, i) => i !== starIdx);

  // 9~10: 스타 다음으로 fameProxy 높은 2인 (준-스타)
  const byFameDesc = [...rest].sort((a, b) => b.player.scoring.fameProxy - a.player.scoring.fameProxy);
  const subStars = byFameDesc.slice(0, 2).sort((a, b) => a.player.scoring.fameProxy - b.player.scoring.fameProxy);
  const subStarIds = new Set(subStars.map((e) => e.player.id));

  const remaining = rest.filter((e) => !subStarIds.has(e.player.id));

  // 5~8: 반전 갭(achievement-fameProxy) 상위 4인, 점증 순(작은 갭 -> 큰 갭)
  const byUpsetDesc = [...remaining].sort((a, b) => upsetGap(b) - upsetGap(a));
  const upsetPicks = byUpsetDesc.slice(0, 4).sort((a, b) => upsetGap(a) - upsetGap(b));
  const upsetIds = new Set(upsetPicks.map((e) => e.player.id));

  // 1~4: 나머지(평이한 픽), fameProxy 오름차순으로 워밍업 리듬
  const plain = remaining
    .filter((e) => !upsetIds.has(e.player.id))
    .sort((a, b) => a.player.scoring.fameProxy - b.player.scoring.fameProxy);

  const orderedEntries = [...plain, ...upsetPicks, ...subStars, star];

  return orderedEntries.map((e, i) => {
    const gap = upsetGap(e);
    const isStar = i === orderedEntries.length - 1;
    return { entry: e, intensity: intensityOf(gap, isStar), upsetGap: gap };
  });
}
