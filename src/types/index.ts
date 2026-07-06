/**
 * 블라인드 일레븐 — 공유 데이터 계약 (SSOT)
 *
 * 이 파일은 `docs/data-schema.md`를 TypeScript로 그대로 옮긴 것이다.
 * data-pipeline(생산자)과 UI(소비자) 양쪽이 이 타입에 대해 개발한다.
 *
 * 동기화 규칙:
 * - data-pipeline/src/types.ts 는 이 파일의 사본이어야 한다(WT-A 구현 시 복사).
 * - 스키마를 변경할 때는 반드시 `docs/data-schema.md`를 먼저 갱신하고 이 파일에 반영한다.
 */

// ---------------------------------------------------------------------------
// 0. 산출물 파일 (참고용 — 실제 파일 시스템 경로는 아래)
// ---------------------------------------------------------------------------
// src/data/players.2022.json  — 2022 월드컵 큐레이션 선수 카드 배열
// src/data/players.2018.json  — 2018 월드컵 (SHOULD)
// src/data/meta.json          — 정규화 파라미터, 포지션 그룹, 대회 메타
// src/data/players.mock.json  — 손으로 만든 픽스처 (UI 팀 개발용, 스키마 100% 일치)

// ---------------------------------------------------------------------------
// 1. PlayerCard
// ---------------------------------------------------------------------------

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export type Round = "Group" | "R16" | "QF" | "SF" | "Final" | "Winner";

/** 스파이더 6축: 모든 포지션 동일 축. 각 값은 "포지션군 내 백분위(0~100)". */
export interface SpiderAxes {
  attack: number; // 슛/xG/득점 종합
  passing: number; // 패스성공률/키패스/전진패스/xA
  defending: number; // 태클/인터셉트/리커버리/압박
  dribbling: number; // 드리블 성공/볼 운반
  aerial: number; // 공중볼 승률/경합
  activity: number; // 액션 수/커버 범위(히트맵 확산)
}

/** 히트맵: 피치(120x80)를 저해상 그리드로 비닝. cells는 0~100 정수, row-major. */
export interface HeatmapGrid {
  cols: number; // 예: 16 (공격방향 x)
  rows: number; // 예: 10 (y)
  cells: number[]; // 길이 = cols*rows, 값 0~100(정규화 밀도)
}

export interface KeyStat {
  label: string; // 예: "90분당 슛"
  value: number; // raw 집계값
  unit?: string; // 예: "회", "%"
}

export interface TeamResult {
  team: string; // 국가명
  furthestRound: Round; // 도달 최고 라운드
  roundScore: number; // 0~100, 성취도 점수 (achievement)
}

export interface RevealInfo {
  realName: string; // 실명 (텍스트만, 사진 없음)
  country: string; // 국적
  jerseyNumber?: number;
  teamResult: TeamResult; // 소속 국가대표팀의 대회 성적
  epithet?: string; // 서사용 한 줄, 예: "결승전 선발", "무명의 발견" (데이터 파생, 비하 금지)
}

/** 안목 점수 = 사전산출 facet의 런타임 가중 평균 */
export interface ScoringFacets {
  statExcellence: number; // 0~100, 포지션군 내 종합 우수도(정규화 지표 가중합)
  achievement: number; // 0~100, = teamResult.roundScore
  fameProxy: number; // 0~100, "유명세" 근사(성취+출전+득점) → 반전 강조용
}

export interface PlayerCard {
  id: string; // 익명 안정 ID, 예: "p2022_017"
  tournament: 2018 | 2022;

  // --- 익명 단계에 노출 (실명/국적/사진 절대 금지) ---
  positionGroup: PositionGroup;
  positionLabel: string; // 세부 포지션 표시용, 예: "중앙 수비" (국적 힌트 금지)
  sampleMinutes: number; // 출전 시간(신뢰도 표시용)
  spider: SpiderAxes;
  heatmap: HeatmapGrid;
  keyStats: KeyStat[]; // 카드 앞면 핵심 수치 3~5개

  // --- 정체 공개(S4) 단계에서만 UI가 노출 ---
  reveal: RevealInfo;

  // --- 점수 계산용 사전 산출값 (런타임 합산만) ---
  scoring: ScoringFacets;
}

// ---------------------------------------------------------------------------
// 2. meta.json
// ---------------------------------------------------------------------------

export interface TournamentMeta {
  year: 2018 | 2022;
  playerCount: number;
  label: string; // "2022 카타르 월드컵"
}

export interface PositionGroupMeta {
  key: PositionGroup;
  label: string; // "수비수"
}

export interface FormationSlot {
  id: string; // "GK", "LB", "CM1" 등 유일
  group: PositionGroup; // 이 슬롯이 허용하는 포지션군 (배치 규칙)
  x: number; // 필드 위 상대좌표 0~1 (렌더링용)
  y: number;
}

export interface Formation {
  key: string; // "4-3-3"
  label: string;
  slots: FormationSlot[]; // 길이 11
}

export interface Meta {
  tournaments: TournamentMeta[];
  positionGroups: PositionGroupMeta[]; // 슬롯 매칭/라벨용
  formations: Formation[]; // 지원 포메이션
  attribution: string; // StatsBomb 출처표기 문구
  minMinutesThreshold: number; // 큐레이션 임계값(신뢰도)
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. 스토어 계약 (Zustand 단일 스토어. WT-B 구현, WT-C 읽기 전용 소비)
// ---------------------------------------------------------------------------

export type GamePhase = "onboarding" | "explore" | "formation" | "reveal" | "result";

export interface XIScore {
  total: number; // 0~100
  grade: "S" | "A" | "B" | "C" | "D";
  statAvg: number;
  achievementAvg: number;
  bestPick: { playerId: string; reason: string };
  biggestUpset: { playerId: string; reason: string };
}

export interface FinalXIEntry {
  slot: FormationSlot;
  player: PlayerCard;
}

export interface GameStore {
  phase: GamePhase;
  tournament: 2018 | 2022;
  pool: PlayerCard[]; // 로드된 카드 풀
  formationKey: string;
  slots: Record<string, string | null>; // slotId -> playerId | null

  // actions
  setTournament(year: 2018 | 2022): void;
  place(slotId: string, playerId: string): void; // 규칙 검증 포함
  remove(slotId: string): void;
  confirmXI(): void; // phase -> reveal
  reset(): void;

  // selectors (WT-C가 읽음)
  finalXI(): FinalXIEntry[];
  isComplete(): boolean;
  score(): XIScore; // 런타임 안목 점수
}
