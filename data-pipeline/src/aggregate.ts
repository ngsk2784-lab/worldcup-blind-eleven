/**
 * aggregate.ts — 경기별 events를 player.id로 그룹, raw 지표 산출
 * (출전분, 슛/xG, 드리블, 패스류, 수비류, 공중경합, 히트맵 카운트)
 *
 * 네트워크 호출 없음 — fetch.ts가 받아둔 cache/만 읽는다 (`npm run fetch` 선행 필요).
 *
 * 상세: docs/architecture.md §3-2
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PositionGroup, HeatmapGrid } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", "cache");

async function readCached<T>(relPath: string): Promise<T> {
  const p = path.join(CACHE_DIR, relPath);
  const text = await readFile(p, "utf-8");
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// StatsBomb raw 타입 (필요한 필드만 명시, 나머지는 unknown 인덱스로 허용)
// ---------------------------------------------------------------------------

interface SBRef {
  id: number;
  name: string;
}

interface SBEvent {
  id: string;
  index: number;
  period: number;
  minute: number;
  second: number;
  type: SBRef;
  team?: SBRef;
  player?: SBRef;
  position?: SBRef;
  location?: [number, number];
  related_events?: string[];
  [key: string]: unknown;
}

interface SBMatch {
  match_id: number;
  match_date: string;
  home_team: { home_team_id: number; home_team_name: string };
  away_team: { away_team_id: number; away_team_name: string };
  home_score: number;
  away_score: number;
  competition_stage: SBRef;
}

interface SBLineupPosition {
  position_id: number;
  position: string;
  from: string; // "MM:SS"
  to: string | null;
  from_period: number;
  to_period: number | null;
}

interface SBLineupPlayer {
  player_id: number;
  player_name: string;
  player_nickname: string | null;
  jersey_number: number;
  country: { id: number; name: string };
  positions: SBLineupPosition[];
}

interface SBTeamLineup {
  team_id: number;
  team_name: string;
  lineup: SBLineupPlayer[];
}

// ---------------------------------------------------------------------------
// 포지션 매핑 (StatsBomb 25개 세부 포지션 → 4개 포지션군 + 한글 라벨)
// ---------------------------------------------------------------------------

const POSITION_MAP: Record<string, { group: PositionGroup; label: string }> = {
  Goalkeeper: { group: "GK", label: "골키퍼" },
  "Right Back": { group: "DEF", label: "라이트백" },
  "Right Center Back": { group: "DEF", label: "오른쪽 센터백" },
  "Center Back": { group: "DEF", label: "센터백" },
  "Left Center Back": { group: "DEF", label: "왼쪽 센터백" },
  "Left Back": { group: "DEF", label: "레프트백" },
  "Right Wing Back": { group: "DEF", label: "라이트 윙백" },
  "Left Wing Back": { group: "DEF", label: "레프트 윙백" },
  "Right Defensive Midfield": { group: "MID", label: "오른쪽 수비형 미드필더" },
  "Center Defensive Midfield": { group: "MID", label: "수비형 미드필더" },
  "Left Defensive Midfield": { group: "MID", label: "왼쪽 수비형 미드필더" },
  "Right Midfield": { group: "MID", label: "라이트 미드필더" },
  "Right Center Midfield": { group: "MID", label: "오른쪽 중앙 미드필더" },
  "Center Midfield": { group: "MID", label: "중앙 미드필더" },
  "Left Center Midfield": { group: "MID", label: "왼쪽 중앙 미드필더" },
  "Left Midfield": { group: "MID", label: "레프트 미드필더" },
  "Right Wing": { group: "FWD", label: "라이트 윙어" },
  "Right Attacking Midfield": { group: "MID", label: "오른쪽 공격형 미드필더" },
  "Center Attacking Midfield": { group: "MID", label: "공격형 미드필더" },
  "Left Attacking Midfield": { group: "MID", label: "왼쪽 공격형 미드필더" },
  "Left Wing": { group: "FWD", label: "레프트 윙어" },
  "Right Center Forward": { group: "FWD", label: "오른쪽 스트라이커" },
  "Center Forward": { group: "FWD", label: "스트라이커" },
  "Left Center Forward": { group: "FWD", label: "왼쪽 스트라이커" },
  "Secondary Striker": { group: "FWD", label: "세컨드 스트라이커" },
};

function mapPosition(name: string): { group: PositionGroup; label: string } {
  return POSITION_MAP[name] ?? { group: "MID", label: name };
}

// ---------------------------------------------------------------------------
// 결과 타입
// ---------------------------------------------------------------------------

export interface RawPlayerAgg {
  playerId: number;
  name: string;
  teamId: number;
  teamName: string;
  jerseyNumber?: number;
  minutes: number;
  matchesPlayed: number;
  positionMinutes: Record<string, number>; // 세부 포지션명 -> 누적 분 (주포지션 결정용)

  // 슈팅
  shots: number;
  goals: number;
  xg: number;

  // 패싱
  passAttempts: number;
  passCompleted: number;
  keyPasses: number;
  assists: number;
  forwardPasses: number;
  xa: number;

  // 드리블/볼운반
  dribbleAttempts: number;
  dribbleSuccess: number;
  carryDistance: number;

  // 수비
  tacklesAttempted: number;
  tacklesWon: number;
  interceptions: number;
  interceptionsWon: number;
  recoveries: number;
  pressures: number;
  clearances: number;

  // 공중볼
  aerialWon: number;
  aerialLost: number;

  // GK 전용 (Shot의 related Goal Keeper 이벤트로 귀속)
  saves: number;
  concededGoals: number;

  // 활동량
  totalActions: number;
  heatmapRaw: number[]; // 160칸 raw count (미정규화)
}

export interface MatchInfo {
  matchId: number;
  date: string;
  stageName: string;
  homeTeamId: number;
  homeTeamName: string;
  homeScore: number;
  awayTeamId: number;
  awayTeamName: string;
  awayScore: number;
}

export interface AggregateResult {
  players: RawPlayerAgg[];
  matches: MatchInfo[];
}

const GRID_COLS = 16;
const GRID_ROWS = 10;
const PITCH_X = 120;
const PITCH_Y = 80;
const FORWARD_THRESHOLD = 5; // 좌표 단위(피치 120 기준), 미세한 횡패스 잡음 배제

function toSeconds(t: string): number {
  const [m, s] = t.split(":").map(Number);
  return m * 60 + s;
}

function binCell(loc: [number, number]): number {
  const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((loc[0] / PITCH_X) * GRID_COLS)));
  const cy = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((loc[1] / PITCH_Y) * GRID_ROWS)));
  return cy * GRID_COLS + cx;
}

function newPlayerAgg(playerId: number, name: string, teamId: number, teamName: string): RawPlayerAgg {
  return {
    playerId,
    name,
    teamId,
    teamName,
    minutes: 0,
    matchesPlayed: 0,
    positionMinutes: {},
    shots: 0,
    goals: 0,
    xg: 0,
    passAttempts: 0,
    passCompleted: 0,
    keyPasses: 0,
    assists: 0,
    forwardPasses: 0,
    xa: 0,
    dribbleAttempts: 0,
    dribbleSuccess: 0,
    carryDistance: 0,
    tacklesAttempted: 0,
    tacklesWon: 0,
    interceptions: 0,
    interceptionsWon: 0,
    recoveries: 0,
    pressures: 0,
    clearances: 0,
    aerialWon: 0,
    aerialLost: 0,
    saves: 0,
    concededGoals: 0,
    totalActions: 0,
    heatmapRaw: new Array(GRID_COLS * GRID_ROWS).fill(0),
  };
}

/** 팀별/피리어드별 공격 방향(+1: x증가가 전진, -1: x감소가 전진). 자기 팀 패스 평균 x 기준. */
function computeTeamDirections(events: SBEvent[]): Map<string, 1 | -1> {
  const sums = new Map<string, { sum: number; n: number }>();
  for (const e of events) {
    if (e.type.name !== "Pass" || !e.location || !e.team) continue;
    const key = `${e.team.id}_${e.period}`;
    const cur = sums.get(key) ?? { sum: 0, n: 0 };
    cur.sum += e.location[0];
    cur.n += 1;
    sums.set(key, cur);
  }
  const dirs = new Map<string, 1 | -1>();
  for (const [key, { sum, n }] of sums) {
    dirs.set(key, sum / n >= PITCH_X / 2 ? 1 : -1);
  }
  return dirs;
}

async function aggregateMatch(matchId: number, players: Map<number, RawPlayerAgg>): Promise<void> {
  const [events, lineups] = await Promise.all([
    readCached<SBEvent[]>(`events/${matchId}.json`),
    readCached<SBTeamLineup[]>(`lineups/${matchId}.json`),
  ]);

  // 경기 종료 시각(초) — 마지막 이벤트 시각 + 여유
  let matchEndSeconds = 0;
  for (const e of events) {
    matchEndSeconds = Math.max(matchEndSeconds, e.minute * 60 + e.second);
  }
  matchEndSeconds += 3;

  // 1) lineups로 출전분 + 주포지션 누적 + 선수 엔트리 생성
  const matchPlayerIds = new Set<number>();
  for (const team of lineups) {
    for (const lp of team.lineup) {
      if (lp.positions.length === 0) continue; // 미출전 교체선수
      let agg = players.get(lp.player_id);
      if (!agg) {
        agg = newPlayerAgg(lp.player_id, lp.player_name, team.team_id, team.team_name);
        players.set(lp.player_id, agg);
      }
      agg.jerseyNumber = lp.jersey_number;
      matchPlayerIds.add(lp.player_id);

      let playedInMatch = false;
      for (const seg of lp.positions) {
        const fromSec = toSeconds(seg.from);
        const toSec = seg.to ? toSeconds(seg.to) : matchEndSeconds;
        const durationMin = Math.max(0, (toSec - fromSec) / 60);
        if (durationMin <= 0) continue;
        playedInMatch = true;
        agg.minutes += durationMin;
        agg.positionMinutes[seg.position] = (agg.positionMinutes[seg.position] ?? 0) + durationMin;
      }
      if (playedInMatch) agg.matchesPlayed += 1;
    }
  }

  // 2) 이벤트 id -> 이벤트 매핑 (Shot ↔ Goal Keeper 상호참조용)
  const byId = new Map<string, SBEvent>();
  for (const e of events) byId.set(e.id, e);

  const directions = computeTeamDirections(events);

  for (const e of events) {
    if (!e.player || !e.location) continue;
    const agg = players.get(e.player.id);
    if (!agg) continue; // lineups에 없는 선수(비정상 케이스) 방어

    // 활동량 + 히트맵 (location이 있는 모든 이벤트)
    agg.totalActions += 1;
    agg.heatmapRaw[binCell(e.location)] += 1;

    switch (e.type.name) {
      case "Shot": {
        const shot = e.shot as { statsbomb_xg?: number; outcome?: SBRef } | undefined;
        agg.shots += 1;
        agg.xg += shot?.statsbomb_xg ?? 0;
        if (shot?.outcome?.name === "Goal") agg.goals += 1;

        // 이 슛을 막은/실점한 GK 귀속 (related_events 중 Goal Keeper 타입)
        for (const relId of e.related_events ?? []) {
          const rel = byId.get(relId);
          if (rel?.type.name === "Goal Keeper" && rel.player) {
            const gk = players.get(rel.player.id);
            if (gk) {
              if (shot?.outcome?.name === "Saved") gk.saves += 1;
              if (shot?.outcome?.name === "Goal") gk.concededGoals += 1;
            }
          }
        }
        break;
      }
      case "Pass": {
        const pass = e.pass as
          | {
              outcome?: SBRef;
              shot_assist?: boolean;
              goal_assist?: boolean;
              assisted_shot_id?: string;
              end_location?: [number, number];
            }
          | undefined;
        agg.passAttempts += 1;
        const success = !pass?.outcome;
        if (success) agg.passCompleted += 1;
        if (pass?.shot_assist) {
          agg.keyPasses += 1;
          const shotEvent = pass.assisted_shot_id ? byId.get(pass.assisted_shot_id) : undefined;
          const shotObj = shotEvent?.shot as { statsbomb_xg?: number } | undefined;
          agg.xa += shotObj?.statsbomb_xg ?? 0;
        }
        if (pass?.goal_assist) agg.assists += 1;

        if (success && pass?.end_location && e.team) {
          const dir = directions.get(`${e.team.id}_${e.period}`) ?? 1;
          const delta = (pass.end_location[0] - e.location[0]) * dir;
          if (delta > FORWARD_THRESHOLD) agg.forwardPasses += 1;
        }
        break;
      }
      case "Dribble": {
        const dribble = e.dribble as { outcome?: SBRef } | undefined;
        agg.dribbleAttempts += 1;
        if (dribble?.outcome?.name === "Complete") agg.dribbleSuccess += 1;
        break;
      }
      case "Carry": {
        const carry = e.carry as { end_location?: [number, number] } | undefined;
        if (carry?.end_location) {
          const dx = carry.end_location[0] - e.location[0];
          const dy = carry.end_location[1] - e.location[1];
          agg.carryDistance += Math.sqrt(dx * dx + dy * dy);
        }
        break;
      }
      case "Interception": {
        const interception = e.interception as { outcome?: SBRef } | undefined;
        agg.interceptions += 1;
        if (interception?.outcome?.name && /Won|Success/.test(interception.outcome.name)) {
          agg.interceptionsWon += 1;
        }
        break;
      }
      case "Duel": {
        const duel = e.duel as { type?: SBRef; outcome?: SBRef } | undefined;
        if (duel?.type?.name === "Aerial Lost") {
          agg.aerialLost += 1;
        } else if (duel?.type?.name === "Tackle") {
          agg.tacklesAttempted += 1;
          if (duel?.outcome?.name && /Won|Success/.test(duel.outcome.name)) {
            agg.tacklesWon += 1;
          }
        }
        break;
      }
      case "Clearance": {
        const clearance = e.clearance as { aerial_won?: boolean } | undefined;
        agg.clearances += 1;
        if (clearance?.aerial_won) agg.aerialWon += 1;
        break;
      }
      case "Ball Recovery":
        agg.recoveries += 1;
        break;
      case "Pressure":
        agg.pressures += 1;
        break;
      default:
        break;
    }
  }
}

export async function aggregateSeason(season: number): Promise<AggregateResult> {
  const matchList = await readCached<SBMatch[]>(`matches/${season}.json`);
  const players = new Map<number, RawPlayerAgg>();

  const matches: MatchInfo[] = matchList.map((m) => ({
    matchId: m.match_id,
    date: m.match_date,
    stageName: m.competition_stage.name,
    homeTeamId: m.home_team.home_team_id,
    homeTeamName: m.home_team.home_team_name,
    homeScore: m.home_score,
    awayTeamId: m.away_team.away_team_id,
    awayTeamName: m.away_team.away_team_name,
    awayScore: m.away_score,
  }));

  let done = 0;
  for (const m of matchList) {
    await aggregateMatch(m.match_id, players);
    done++;
    if (done % 16 === 0 || done === matchList.length) {
      console.log(`  [aggregate] season ${season}: ${done}/${matchList.length}경기 처리`);
    }
  }

  return { players: [...players.values()], matches };
}

/** 선수의 주 포지션(누적 분 최대) → group/label. */
export function primaryPosition(agg: RawPlayerAgg): { group: PositionGroup; label: string } {
  let best: string | undefined;
  let bestMin = -1;
  for (const [pos, min] of Object.entries(agg.positionMinutes)) {
    if (min > bestMin) {
      bestMin = min;
      best = pos;
    }
  }
  return mapPosition(best ?? "Center Midfield");
}

/** raw count 히트맵 → 선수별 max=100 정규화된 HeatmapGrid. */
export function toHeatmapGrid(raw: number[]): HeatmapGrid {
  const max = Math.max(1, ...raw);
  const cells = raw.map((c) => Math.round((c / max) * 100));
  return { cols: GRID_COLS, rows: GRID_ROWS, cells };
}
