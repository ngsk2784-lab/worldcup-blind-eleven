# 블라인드 일레븐 — 데이터 스키마 (병렬 작업의 계약)

- 작성: architect / 2026-07-06
- 역할: **이 스키마가 파이프라인(생산자)과 UI(소비자) 사이의 유일한 계약이다.** 파이프라인이 이 포맷으로 JSON을 내고, UI는 이 포맷을 소비한다. 양쪽이 mock 픽스처로 병렬 개발하다가 마지막에 실데이터로 교체한다.
- 원천: StatsBomb Open Data, competition_id=43, season 106(2022)·3(2018).
- 타입 정의(TS)는 `data-pipeline/src/types.ts`가 **단일 진실원(SSOT)**. 앱은 이 파일을 `src/types/`로 심링크/복사해 import.

---

## 0. 산출물 파일 (정적 번들)

| 파일 | 위치 | 내용 |
|---|---|---|
| `players.2022.json` | `src/data/` | 2022 월드컵 큐레이션된 선수 카드 배열 |
| `players.2018.json` | `src/data/` | 2018 월드컵 (SHOULD, 2022 완료 후) |
| `meta.json` | `src/data/` | 정규화 파라미터, 포지션 그룹 정의, 대회 메타 |
| `players.mock.json` | `src/data/` | **손으로 만든 6~11명 픽스처** — 실데이터 나오기 전 UI 팀이 사용. 스키마 100% 일치. |

**용량 예산: 대회당 gzip 후 < 500KB.** 히트맵을 사전 비닝(bin)해 이 예산을 지킨다(§3).

---

## 1. PlayerCard (카드 1장 = 스키마의 심장)

```ts
interface PlayerCard {
  id: string;              // 익명 안정 ID, 예: "p2022_017" (공개 전 유일 식별자)
  tournament: 2018 | 2022;

  // --- 익명 단계에 노출 (실명/국적/사진 절대 금지) ---
  positionGroup: PositionGroup;   // "GK" | "DEF" | "MID" | "FWD"
  positionLabel: string;          // 세부 포지션 표시용, 예: "중앙 수비" (국적 힌트 금지)
  sampleMinutes: number;          // 출전 시간(신뢰도 표시용)
  spider: SpiderAxes;             // 스파이더 차트 6축 (0~100, 포지션군 내 정규화)
  heatmap: HeatmapGrid;           // 사전 비닝된 밀도 그리드
  keyStats: KeyStat[];            // 카드 앞면 핵심 수치 3~5개 (raw 값, 라벨 포함)

  // --- 정체 공개(S4) 단계에서만 UI가 노출 ---
  reveal: RevealInfo;

  // --- 점수 계산용 사전 산출값 (런타임 합산만) ---
  scoring: ScoringFacets;
}

type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

// 스파이더 6축: 모든 포지션 동일 축, 각 값은 "포지션군 내 백분위(0~100)".
// → 수비수의 Attack 70 = 수비수들 중 상위 30%. 익명 비교가 공정해짐.
interface SpiderAxes {
  attack: number;      // 슛/xG/득점 종합
  passing: number;     // 패스성공률/키패스/전진패스/xA
  defending: number;   // 태클/인터셉트/리커버리/압박
  dribbling: number;   // 드리블 성공/볼 운반
  aerial: number;      // 공중볼 승률/경합
  activity: number;    // 액션 수/커버 범위(히트맵 확산)
}

// 히트맵: 피치(120x80)를 저해상 그리드로 비닝. count를 0~100으로 양자화한 1차원 배열(row-major).
interface HeatmapGrid {
  cols: number;        // 예: 16 (공격방향 x)
  rows: number;        // 예: 10 (y)
  cells: number[];     // 길이 = cols*rows, 값 0~100(정규화 밀도). 압축용 정수.
}

interface KeyStat {
  label: string;       // 예: "90분당 슛"
  value: number;       // raw 집계값
  unit?: string;       // 예: "회", "%"
}

interface RevealInfo {
  realName: string;    // 실명 (텍스트만, 사진 없음)
  country: string;     // 국적
  jerseyNumber?: number;
  teamResult: TeamResult;   // 소속 국가대표팀의 대회 성적
  epithet?: string;         // 서사용 한 줄, 예: "결승전 선발", "무명의 발견" (데이터 파생, 비하 금지)
}

interface TeamResult {
  team: string;              // 국가명
  furthestRound: Round;      // 도달 최고 라운드
  roundScore: number;        // 0~100, 성취도 점수 (achievement)
}

type Round = "Group" | "R16" | "QF" | "SF" | "Final" | "Winner";

// 안목 점수 = 사전산출 facet의 런타임 가중 평균 (§안목점수 알고리즘)
interface ScoringFacets {
  statExcellence: number;    // 0~100, 포지션군 내 종합 우수도(정규화 지표 가중합)
  achievement: number;       // 0~100, = teamResult.roundScore
  fameProxy: number;         // 0~100, "유명세" 근사(성취+출전+득점) → 반전 강조용
}
```

## 2. meta.json

```ts
interface Meta {
  tournaments: {
    year: 2018 | 2022;
    playerCount: number;
    label: string;            // "2022 카타르 월드컵"
  }[];
  positionGroups: {           // 슬롯 매칭/라벨용
    key: PositionGroup;
    label: string;            // "수비수"
  }[];
  formations: Formation[];    // 지원 포메이션 (아래 §4)
  attribution: string;        // StatsBomb 출처표기 문구
  minMinutesThreshold: number;// 큐레이션 임계값(신뢰도)
  generatedAt: string;
}

interface Formation {
  key: string;                // "4-3-3"
  label: string;
  slots: FormationSlot[];     // 길이 11
}

interface FormationSlot {
  id: string;                 // "GK", "LB", "CM1" 등 유일
  group: PositionGroup;       // 이 슬롯이 허용하는 포지션군 (배치 규칙)
  x: number; y: number;       // 필드 위 상대좌표 0~1 (렌더링용)
}
```

## 3. 히트맵 사전 비닝 (용량·성능의 핵심)

- **런타임 KDE 금지.** 파이프라인이 각 선수의 모든 이벤트 `location`을 그리드 셀에 카운트 → 정규화(선수별 max=100) → 정수 배열로 저장.
- 그리드 16×10 = 160셀. 선수당 160바이트 수준. 60명 × 160 = 9,600 정수 → 대회당 히트맵 총량 수십 KB. 예산 안전.
- UI는 이 그리드를 SVG `<rect>` 또는 canvas로 셀 색칠만 하면 됨(연산 0).

## 4. 지원 포메이션 (MVP)

- MUST: **4-3-3** 1종.
- SHOULD: 4-4-2, 3-4-3 추가.
- 배치 규칙: 슬롯의 `group`과 카드의 `positionGroup` 일치해야 배치 가능(불일치 시 경고). GK 슬롯엔 GK만.

## 5. 스토어 계약 (UI 팀 공유)

Zustand 단일 스토어. WT-B가 구현, WT-C는 읽기 전용 소비.

```ts
interface GameStore {
  phase: "onboarding" | "explore" | "formation" | "reveal" | "result";
  tournament: 2018 | 2022;
  pool: PlayerCard[];              // 로드된 카드 풀
  formationKey: string;
  slots: Record<string, string|null>;   // slotId -> playerId | null
  // actions
  setTournament(y): void;
  place(slotId: string, playerId: string): void;   // 규칙 검증 포함
  remove(slotId: string): void;
  confirmXI(): void;               // phase -> reveal
  reset(): void;
  // selectors (WT-C가 읽음)
  finalXI(): { slot: FormationSlot; player: PlayerCard }[];
  isComplete(): boolean;
  score(): XIScore;                // 런타임 안목 점수
}

interface XIScore {
  total: number;        // 0~100
  grade: "S"|"A"|"B"|"C"|"D";
  statAvg: number; achievementAvg: number;
  bestPick: { playerId: string; reason: string };
  biggestUpset: { playerId: string; reason: string };
}
```

**이 스토어의 phase/slots/finalXI/score 시그니처가 WT-B ↔ WT-C 계약이다.** WT-C는 이 셀렉터만 읽고 자체 로컬 애니메이션 상태를 둔다.
</content>
</invoke>
