/**
 * score.ts — statExcellence / achievement(roundScore) / fameProxy 사전 산출.
 *
 * 상세: docs/architecture.md §3-5, §4(안목 점수 알고리즘)
 */

import type { Round, ScoringFacets, TeamResult } from "./types.js";
import type { MatchInfo } from "./aggregate.js";
import type { NormalizedPlayer } from "./normalize.js";

export const ROUND_ORDER: Round[] = ["Group", "R16", "QF", "SF", "Final", "Winner"];
export const ROUND_SCORE: Record<Round, number> = {
  Group: 20,
  R16: 40,
  QF: 60,
  SF: 75,
  Final: 90,
  Winner: 100,
};

const STAGE_TO_ROUND: Record<string, Round> = {
  "Group Stage": "Group",
  "Round of 16": "R16",
  "Quarter-finals": "QF",
  "Semi-finals": "SF",
  "3rd Place Final": "SF", // 4강 진출 성취를 그대로 인정(3/4위전 결과는 별도 등급 없음)
  Final: "Final",
};

/**
 * StatsBomb match 데이터는 승부차기 승자를 인코딩하지 않는다(정규시간 스코어만 제공).
 * 결승 우승팀은 역사적 사실로 하드코딩 — 2022 아르헨티나(승부차기), 2018 프랑스.
 * ASSUMPTION: 이 표는 season(연도) 확장 시 수동 갱신 필요.
 */
const CHAMPIONS: Record<number, string> = {
  2022: "Argentina",
  2018: "France",
};

export function computeTeamResults(matches: MatchInfo[], year: 2018 | 2022): Map<string, TeamResult> {
  const best = new Map<string, Round>();
  const consider = (team: string, stageName: string) => {
    const round = STAGE_TO_ROUND[stageName];
    if (!round) return;
    const cur = best.get(team);
    if (!cur || ROUND_ORDER.indexOf(round) > ROUND_ORDER.indexOf(cur)) {
      best.set(team, round);
    }
  };
  for (const m of matches) {
    consider(m.homeTeamName, m.stageName);
    consider(m.awayTeamName, m.stageName);
  }

  const champion = CHAMPIONS[year];
  const results = new Map<string, TeamResult>();
  for (const [team, round] of best) {
    const furthestRound: Round = team === champion && round === "Final" ? "Winner" : round;
    results.set(team, { team, furthestRound, roundScore: ROUND_SCORE[furthestRound] });
  }
  return results;
}

export interface ScoredPlayer extends NormalizedPlayer {
  scoring: ScoringFacets;
  teamResult: TeamResult;
}

const SPIDER_AXES = ["attack", "passing", "defending", "dribbling", "aerial", "activity"] as const;

export function scorePlayers(players: NormalizedPlayer[], matches: MatchInfo[], year: 2018 | 2022): ScoredPlayer[] {
  const teamResults = computeTeamResults(matches, year);
  const maxMinutes = Math.max(1, ...players.map((p) => p.minutes));

  return players.map((p) => {
    const statExcellence = Math.round(
      SPIDER_AXES.reduce((sum, axis) => sum + p.spider[axis], 0) / SPIDER_AXES.length,
    );
    const teamResult = teamResults.get(p.teamName) ?? { team: p.teamName, furthestRound: "Group", roundScore: ROUND_SCORE.Group };
    const achievement = teamResult.roundScore;

    const goalsScaled = Math.min(100, p.goals * 20);
    const minutesScaled = (p.minutes / maxMinutes) * 100;
    const fameProxy = Math.round(0.4 * achievement + 0.3 * minutesScaled + 0.3 * goalsScaled);

    const scoring: ScoringFacets = { statExcellence, achievement, fameProxy: Math.min(100, fameProxy) };

    return { ...p, scoring, teamResult };
  });
}
