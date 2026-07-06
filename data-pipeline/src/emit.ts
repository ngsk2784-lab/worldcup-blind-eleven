/**
 * emit.ts — players.<year>.json, meta.json을 src/data/에 출력.
 * 스키마는 ./types.ts로 컴파일 검증(tsc --noEmit).
 *
 * 실행: `npm run build:data -- 2022` (인자 없으면 2022만; `2022 2018`로 둘 다).
 * 선행 조건: `npm run fetch -- 106 3`으로 cache/ 채워둘 것.
 *
 * 상세: docs/architecture.md §3-6
 */

import { writeFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  PlayerCard,
  Meta,
  KeyStat,
  PositionGroup,
  Formation,
} from "./types.js";
import { aggregateSeason, toHeatmapGrid, type RawPlayerAgg } from "./aggregate.js";
import { normalizePlayers } from "./normalize.js";
import { curatePool } from "./curate.js";
import { scorePlayers, type ScoredPlayer } from "./score.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "src", "data");

const MIN_MINUTES_THRESHOLD = 180;
const SEASON_BY_YEAR: Record<number, number> = { 2022: 106, 2018: 3 };
const YEAR_LABEL: Record<number, string> = { 2022: "2022 카타르 월드컵", 2018: "2018 러시아 월드컵" };

const ATTRIBUTION =
  "데이터 출처: StatsBomb Open Data (비상업적 사용, 출처표기 조건 준수 — StatsBomb Public Data User Agreement).";

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}
function per90(v: number, minutes: number): number {
  return minutes > 0 ? (v / minutes) * 90 : 0;
}

function buildKeyStats(p: ScoredPlayer): KeyStat[] {
  const passCompletionPct = pct(p.passCompleted, p.passAttempts);
  const aerialWinPct = pct(p.aerialWon, p.aerialWon + p.aerialLost);

  switch (p.positionGroup) {
    case "GK":
      return [
        { label: "선방", value: p.saves, unit: "회" },
        { label: "실점", value: p.concededGoals, unit: "회" },
        { label: "패스 성공률", value: Math.round(passCompletionPct), unit: "%" },
      ];
    case "DEF":
      return [
        { label: "태클 성공", value: p.tacklesWon, unit: "회" },
        { label: "인터셉트", value: p.interceptionsWon, unit: "회" },
        { label: "패스 성공률", value: Math.round(passCompletionPct), unit: "%" },
        { label: "공중볼 승률", value: Math.round(aerialWinPct), unit: "%" },
      ];
    case "MID":
      return [
        { label: "패스 성공률", value: Math.round(passCompletionPct), unit: "%" },
        { label: "키패스", value: p.keyPasses, unit: "회" },
        { label: "전진패스", value: p.forwardPasses, unit: "회" },
        { label: "인터셉트", value: p.interceptionsWon, unit: "회" },
      ];
    case "FWD":
    default:
      return [
        { label: "골", value: p.goals, unit: "골" },
        { label: "xG", value: Math.round(p.xg * 100) / 100 },
        { label: "슈팅", value: p.shots, unit: "회" },
        { label: "드리블 성공", value: p.dribbleSuccess, unit: "회" },
      ];
  }
}

function buildEpithet(p: ScoredPlayer): string | undefined {
  if (p.teamResult.furthestRound === "Winner") return "우승의 주역";
  if (p.teamResult.furthestRound === "Final") return "결승 무대의 주인공";
  if (p.scoring.statExcellence >= 85 && p.scoring.fameProxy <= 40) return "숨은 보석";
  return undefined;
}

function toPlayerCard(p: ScoredPlayer, id: string, year: 2018 | 2022): PlayerCard {
  return {
    id,
    tournament: year,
    positionGroup: p.positionGroup,
    positionLabel: p.positionLabel,
    sampleMinutes: Math.round(p.minutes),
    spider: p.spider,
    heatmap: toHeatmapGrid(p.heatmapRaw),
    keyStats: buildKeyStats(p),
    reveal: {
      realName: p.name,
      country: p.teamName,
      jerseyNumber: p.jerseyNumber,
      teamResult: p.teamResult,
      epithet: buildEpithet(p),
    },
    scoring: p.scoring,
  };
}

const FORMATIONS: Formation[] = [
  {
    key: "4-3-3",
    label: "4-3-3",
    slots: [
      { id: "GK", group: "GK", x: 0.5, y: 0.94 },
      { id: "LB", group: "DEF", x: 0.12, y: 0.74 },
      { id: "CB1", group: "DEF", x: 0.36, y: 0.8 },
      { id: "CB2", group: "DEF", x: 0.64, y: 0.8 },
      { id: "RB", group: "DEF", x: 0.88, y: 0.74 },
      { id: "CM1", group: "MID", x: 0.28, y: 0.52 },
      { id: "CM2", group: "MID", x: 0.5, y: 0.58 },
      { id: "CM3", group: "MID", x: 0.72, y: 0.52 },
      { id: "LW", group: "FWD", x: 0.15, y: 0.22 },
      { id: "ST", group: "FWD", x: 0.5, y: 0.14 },
      { id: "RW", group: "FWD", x: 0.85, y: 0.22 },
    ],
  },
  {
    key: "4-4-2",
    label: "4-4-2",
    slots: [
      { id: "GK", group: "GK", x: 0.5, y: 0.94 },
      { id: "LB", group: "DEF", x: 0.12, y: 0.74 },
      { id: "CB1", group: "DEF", x: 0.36, y: 0.8 },
      { id: "CB2", group: "DEF", x: 0.64, y: 0.8 },
      { id: "RB", group: "DEF", x: 0.88, y: 0.74 },
      { id: "LM", group: "MID", x: 0.12, y: 0.5 },
      { id: "CM1", group: "MID", x: 0.38, y: 0.54 },
      { id: "CM2", group: "MID", x: 0.62, y: 0.54 },
      { id: "RM", group: "MID", x: 0.88, y: 0.5 },
      { id: "ST1", group: "FWD", x: 0.38, y: 0.16 },
      { id: "ST2", group: "FWD", x: 0.62, y: 0.16 },
    ],
  },
  {
    key: "3-4-3",
    label: "3-4-3",
    slots: [
      { id: "GK", group: "GK", x: 0.5, y: 0.94 },
      { id: "CB1", group: "DEF", x: 0.28, y: 0.78 },
      { id: "CB2", group: "DEF", x: 0.5, y: 0.82 },
      { id: "CB3", group: "DEF", x: 0.72, y: 0.78 },
      { id: "LM", group: "MID", x: 0.1, y: 0.52 },
      { id: "CM1", group: "MID", x: 0.38, y: 0.56 },
      { id: "CM2", group: "MID", x: 0.62, y: 0.56 },
      { id: "RM", group: "MID", x: 0.9, y: 0.52 },
      { id: "LW", group: "FWD", x: 0.18, y: 0.2 },
      { id: "ST", group: "FWD", x: 0.5, y: 0.14 },
      { id: "RW", group: "FWD", x: 0.82, y: 0.2 },
    ],
  },
];

async function buildTournament(year: 2018 | 2022): Promise<number> {
  const season = SEASON_BY_YEAR[year];
  console.log(`[emit] ${year} (season ${season}) aggregate 시작...`);
  const { players, matches } = await aggregateSeason(season);
  console.log(`[emit] ${year}: raw 선수 ${players.length}명, 경기 ${matches.length}개`);

  const normalized = normalizePlayers(players, MIN_MINUTES_THRESHOLD);
  console.log(`[emit] ${year}: minMinutes(${MIN_MINUTES_THRESHOLD}) 통과 ${normalized.length}명`);

  const curated = curatePool(normalized, matches, year);
  console.log(`[emit] ${year}: 큐레이션 ${curated.length}명`);

  const scored = scorePlayers(curated, matches, year);

  // 포지션군 → 품질 내림차순 정렬 후 안정적 id 부여
  const groupOrder: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];
  scored.sort((a, b) => {
    const ga = groupOrder.indexOf(a.positionGroup);
    const gb = groupOrder.indexOf(b.positionGroup);
    if (ga !== gb) return ga - gb;
    return b.scoring.statExcellence - a.scoring.statExcellence;
  });

  const cards: PlayerCard[] = scored.map((p, i) => toPlayerCard(p, `p${year}_${String(i + 1).padStart(3, "0")}`, year));

  await writeFile(path.join(DATA_DIR, `players.${year}.json`), JSON.stringify(cards, null, 0), "utf-8");
  console.log(`[emit] ${year}: players.${year}.json 저장 (${cards.length}명)`);
  return cards.length;
}

async function buildMeta(): Promise<void> {
  const files = await readdir(DATA_DIR);
  const tournamentFiles = files.filter((f) => /^players\.(2018|2022)\.json$/.test(f));

  const tournaments: Meta["tournaments"] = [];
  for (const f of tournamentFiles) {
    const year = Number(f.match(/players\.(\d{4})\.json/)![1]) as 2018 | 2022;
    const text = await readFile(path.join(DATA_DIR, f), "utf-8");
    const cards = JSON.parse(text) as PlayerCard[];
    tournaments.push({ year, playerCount: cards.length, label: YEAR_LABEL[year] });
  }
  tournaments.sort((a, b) => b.year - a.year);

  const meta: Meta = {
    tournaments,
    positionGroups: [
      { key: "GK", label: "골키퍼" },
      { key: "DEF", label: "수비수" },
      { key: "MID", label: "미드필더" },
      { key: "FWD", label: "공격수" },
    ],
    formations: FORMATIONS,
    attribution: ATTRIBUTION,
    minMinutesThreshold: MIN_MINUTES_THRESHOLD,
    generatedAt: new Date().toISOString(),
  };

  await writeFile(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
  console.log(`[emit] meta.json 저장 (${tournaments.map((t) => t.year).join(", ")})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).map(Number).filter((n) => n === 2022 || n === 2018) as (2018 | 2022)[];
  const years: (2018 | 2022)[] = args.length ? args : [2022];
  for (const year of years) {
    await buildTournament(year);
  }
  await buildMeta();
}

await main();
