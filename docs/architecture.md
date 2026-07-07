# 블라인드 일레븐 — 기술 아키텍처

- 작성: architect / 2026-07-06
- 근거: `docs/requirements.md`(PRD), `docs/research/data-source-verification.md`, `docs/research/hackathon-brief.md`
- 데이터 계약: `docs/data-schema.md` (병렬 작업의 SSOT)
- 원칙: **3주 완성도 최우선. 검증된 심플 스택. 과설계 금지.** 서버 없음, 런타임 외부 호출 없음, 정적 번들.

---

## 1. 기술 스택 (선택 + 이유 + 버린 대안)

| 레이어 | 선택 | 이유 | 버린 대안 |
|---|---|---|---|
| 프레임워크 | **React 18 + Vite** | 정적 SPA에 최적, 빠른 HMR, `dist/` 정적 산출 → Vercel 직행. 팀 친숙도 최고. | **Next.js**: SSR/서버라우트 불필요한데 복잡도만↑. **SvelteKit**: 생태계·dnd/차트 라이브러리 성숙도 낮아 3주 리스크. |
| 언어 | **TypeScript** | 데이터 스키마를 타입으로 못박아 **병렬 에이전트 간 계약 강제**. 컴파일 타임에 스키마 위반 검출. | JS: 계약 강제 불가 → 통합 시 런타임 버그. |
| 상태관리 | **Zustand** | 단일 스토어, 보일러플레이트 최소, 드래그 중 리렌더 제어 쉬움. UI 팀 분할의 경계로 사용(§5 스토어 계약). | **Redux**: 이 규모에 과함. **Context**: 드래그 빈번 업데이트 시 리렌더 폭발. |
| 배치 인터랙션 | **클릭/탭 모드** | 터치·마우스 동일 조작감, 직관적 선택 플로우. (v1: @dnd-kit에서 클릭/탭으로 교체, 2026-07-07 오너 피드백) | — |
| 애니메이션 | **Framer Motion** | **정체 공개(S4)가 제품의 심장** — `AnimatePresence`+stagger+flip이 순차 공개 연출에 정확히 맞음. 카드 플립·마이크로인터랙션도 선언적. | **GSAP**: 강력하나 API 무겁고 React 통합 수작업. **CSS only**: 11장 순차 오케스트레이션 난이도↑. |
| 차트(스파이더) | **직접 SVG** (라이브러리 X) | 6축 폴리곤 = 삼각함수 몇 줄. 라이브러리 의존·번들 절감, 드라마틱 톤 커스텀 자유. | recharts/nivo: 6축 폴리곤에 과한 의존성·번들. |
| 히트맵 | **사전 비닝 그리드 → SVG rect (또는 canvas)** | 파이프라인이 밀도 그리드로 비닝(§data-schema §3) → 런타임 연산 0. 16×10 rect 색칠만. | 런타임 KDE/heatmap.js: 60카드 동시 렌더 시 성능·번들 리스크. **금지.** |
| 스타일 | **Tailwind CSS + CSS 변수(디자인 토큰)** | 빠른 반복, designer 토큰(팔레트/타이포)을 CSS 변수로 주입해 일관성. | CSS-in-JS 런타임: 불필요한 런타임 비용. |
| 이미지 | **코드 생성(SVG/canvas)** | 실루엣·도형·아이콘·배경은 벡터로. 사진/로고 미사용은 IP 요건이자 컨셉(익명). Gemini API 불필요. | 래스터 생성: 컨셉상 금지(익명), 비용. |
| 파이프라인 | **Node + tsx (TypeScript 스크립트)** | 앱과 **동일 언어·타입 공유**(SSOT 재사용). 단일 툴체인. | Python(pandas): 강력하나 타입 계약을 앱과 공유 못 함 → 이중 정의. |
| 배포 | **Vercel 정적 호스팅 + GitHub** | Vite 프리셋 zero-config, PR 프리뷰 URL 자동(심사·검수에 유용), 무료. | Netlify/GH Pages: 동등하나 Vercel 프리뷰 UX가 검수 루프에 유리. |

---

## 2. 시스템 구조 (레이어 / 모듈)

```
[빌드 타임]  StatsBomb raw JSON  ──►  data-pipeline (Node/TS)  ──►  정적 JSON (src/data/)
                                        fetch→aggregate→normalize→curate→score→emit
                                              │ (계약: docs/data-schema.md)
[런타임]                                       ▼
   React SPA (Vite) ── Zustand store ── features:
      onboarding(S0) → cards(S1) → formation(S2/S3) → reveal(S4) → result(S5/S6)
      정적 JSON을 fetch/import만, 외부 API 0
```

**책임 분리**
- **data-pipeline**: raw → 게임용 정적 JSON. 앱과 분리된 빌드 전용 패키지. 산출물만 커밋(원본 raw는 gitignore).
- **store (Zustand)**: 게임 phase·풀·슬롯·점수의 단일 진실원. features는 스토어를 통해서만 상태 공유.
- **features/cards**: 익명 카드 렌더(스파이더·히트맵·keyStat), 상세/비교 뷰. (M1)
- **features/formation**: 포메이션 보드, dnd 배치/검증, 확정 CTA. (M2/M3전단)
- **features/reveal**: 순차 정체 공개 연출. store.finalXI() 읽기 전용. (M3)
- **features/result**: 안목 점수·성적 대조·공유 카드. store.score() 읽기 전용. (M4)
- **features/onboarding**: 훅 카피 + CTA + 대회/포메이션 선택. (M5)
- **lib**: 런타임 점수 계산, 포맷 헬퍼.

---

## 3. 데이터 파이프라인 (상세)

**실행 방식**: `data-pipeline/`는 독립 npm 패키지. `npm run build:data`로 로컬 실행 → `src/data/*.json` 생성 → **커밋**. Vercel 빌드는 이미 커밋된 JSON을 쓰므로 배포 시 200MB raw를 받지 않는다(안정·빠름).

**단계 (스크립트)**
1. `fetch.ts` — competition 43, season 106(2022)·3(2018)의 matches/events/lineups를 로컬 `cache/`(gitignore)로 다운로드. 한 번 받아 보관(라이선스 존속 리스크 대비).
2. `aggregate.ts` — 경기별 events를 `player.id`로 그룹. raw 지표 산출: 출전분(lineups positions from/to 합), 슛/xG/득점/슛정확도, 드리블 성공, 패스/성공률/키패스/전진패스/xA(shot.key_pass_id 역링크), 태클/인터셉트/볼리커버리/압박, 공중경합. 이벤트 `location`을 16×10 그리드에 카운트 → 히트맵.
3. `normalize.ts` — 포지션군(GK/DEF/MID/FWD) **내에서** 각 지표를 백분위(0~100)로 정규화 → 스파이더 6축 산출. **익명 카드 비교 공정성의 핵심**: 포지션군 내 정규화로 "수비수 중 상위 X%"를 표현. 최소 출전 임계값(`minMinutesThreshold`, 예 180분) 미만 제외.
4. `curate.ts` — 포지션군별 상위 N 선발로 풀 규모 관리(대회당 ~50~60명 목표: 탐색 피로 ↔ 다양성 균형). GK/DEF/MID/FWD 정원 배분해 포메이션 채우기 가능하게.
5. `score.ts` — `statExcellence`(정규화 지표 가중합), `achievement`(matches.json에서 팀 도달 라운드 → roundScore), `fameProxy`(성취+출전+득점) 사전 산출. 팀 성적은 matches.json의 스코어/라운드로 파생.
6. `emit.ts` — `players.<year>.json`, `meta.json` 출력. 스키마는 `types.ts`로 컴파일 검증.

**지표 정의 & 정규화**: 상세는 `docs/data-schema.md` §1(SpiderAxes). 축별 구성 지표는 aggregate 결과에서 가중합 후 포지션군 백분위.

**메타데이터 갭**: 나이/키는 StatsBomb에 없음(검증 문서 §5). **MVP는 불필요 → 조달 안 함(de-scope).** 실명·국적·등번호·팀성적은 lineups+matches로 충분.

---

## 4. 안목 점수 알고리즘 (PRD "혼합" 구현)

**설계**: 무거운 런타임 연산 없이 **사전 산출 facet의 런타임 가중 평균**. 설명 가능·결정적(임의값 금지 = M4 수용기준).

- 선수별 사전 산출(파이프라인): `statExcellence`(스탯 우수도, 포지션군 내 정규화 종합), `achievement`(실제 성적 = 팀 도달 라운드 점수).
- 런타임 XI 점수:
  `total = 0.6 * mean(statExcellence) + 0.4 * mean(achievement)` → S/A/B/C/D 등급 매핑.
  - 0.6/0.4는 "데이터 안목"에 무게, 실제 성적으로 반전 서사 보강. (튜닝 가능, meta에 노출 가능.)
- 서사(S5): `bestPick` = total 기여 최대 선수. `biggestUpset` = 익명 인상(예: 낮은 단일 축/무명 fameProxy)과 reveal(높은 achievement/legend) 간 격차 최대 → "무명인 줄 알았는데 결승 주역" 강조. `fameProxy`로 판별.

런타임 계산은 배열 평균 수준 → 버그·성능 리스크 없음.

---

## 5. 프로젝트 구조 & 모듈 경계 (병렬 작업 단위)

```
blind-eleven/
  data-pipeline/           # [WT-A] 빌드 전용 Node/TS 패키지
    src/{fetch,aggregate,normalize,curate,score,emit,types}.ts
    cache/                 # gitignore (raw ~200MB)
    package.json
  src/                     # React 앱
    data/                  # 생성 JSON + players.mock.json (커밋)
    types/                 # data-pipeline/types.ts 미러 (SSOT)
    store/                 # [WT-B] zustand 게임 스토어
    features/
      onboarding/          # [WT-C]
      cards/               # [WT-B] PlayerCard, SpiderChart, Heatmap, CompareView
      formation/           # [WT-B] FormationBoard, Slot, dnd
      reveal/              # [WT-C]
      result/              # [WT-C] Score, ShareCard, 성적대조
    components/            # 공유 UI(디자인 토큰 기반)
    lib/                   # 런타임 점수/헬퍼
    App.tsx, main.tsx
  public/, index.html, vite.config.ts, tailwind.config, package.json
```

**상태 관리**: Zustand 단일 스토어(`src/store`). phase 머신(onboarding→explore→formation→reveal→result). features는 스토어 셀렉터로만 상태 공유 → 파일 소유권 충돌 없음.

### 병렬 작업 분할 (worktree + 계약 + 의존순서)

**의존 순서**
1. **선행(직렬, 반나절)**: architect가 `data-schema.md` + `types.ts` + `players.mock.json`(손수 6~11명) 확정 → **전 트리 언블록.** designer가 `docs/design/` 토큰·컴포넌트 스펙 병행.
2. **병렬(본 개발, ~2주)**: WT-A · WT-B · WT-C 동시. 모두 스키마·mock에 대해 작업 → 서로 안 기다림.
3. **통합(~3일)**: WT-A 실데이터를 `src/data/`에 넣고 mock 스왑. 머지. qa→ui-reviewer→security→devops.

| 트리 | 브랜치 | 소유 | 범위 | 계약(인터페이스) | 의존 |
|---|---|---|---|---|---|
| **WT-A 데이터** | `feat/data-pipeline` | 개발자1(backend/developer) | `data-pipeline/` 전체. raw→정적 JSON 생성 | **산출: `data-schema.md` 포맷의 JSON.** UI와 파일로만 교신. | 스키마만. UI와 독립. |
| **WT-B 코어UI** | `feat/core-ui` | 프론트1 | `store/`, `features/cards`, `features/formation`, `components/` | **소유: 스토어 계약(§data-schema §5).** mock JSON 소비. finalXI/score/isComplete 셀렉터 제공. | 스키마 + mock + 디자인토큰. |
| **WT-C 연출·결과** | `feat/reveal-result` | 프론트2 | `features/onboarding`, `features/reveal`, `features/result`(공유카드 포함) | **소비: 스토어 셀렉터 읽기 전용**(finalXI/score). 자체 로컬 애니메이션 상태. | 스키마 + 스토어 시그니처 + 디자인토큰. |

**핵심 계약 = 2개**: ①데이터 JSON 스키마(WT-A↔WT-B·C, 파일 경유) ②Zustand 스토어 시그니처(WT-B↔WT-C, 타입 경유). 둘 다 사전 확정되어 있어 세 트리가 완전 병렬 가능. 스토어 파일은 WT-B 단독 writer(WT-C는 import만) → writer 충돌 0.

---

## 6. 데이터 모델 (핵심 엔티티)

- **PlayerCard** (중심 엔티티): 익명필드(positionGroup, spider 6축, heatmap 그리드, keyStats) + reveal(realName, country, teamResult) + scoring facets. 상세 `data-schema.md §1`.
- **Formation / FormationSlot**: 슬롯 11칸, 각 슬롯의 허용 positionGroup + 필드 좌표. 배치 규칙의 근거.
- **TeamResult**: 국가팀 도달 라운드 → achievement 점수. 성적 대조·점수의 근거.
- **GameStore(런타임)**: phase, pool, slots(slotId→playerId), 파생 finalXI/score.

관계: PlayerCard N—1 PositionGroup, FormationSlot 1—0..1 PlayerCard(배치), PlayerCard 1—1 TeamResult. 서버 DB 없음(정적). 상세 스키마 확정은 이 문서로 충분 — dba 불필요.

---

## 7. 배포 & CI

- **GitHub repo** 신규(devops: `gh repo create`). main 보호, feature 브랜치 → PR → 검수 통과 후 머지.
- **Vercel**: Vite 프리셋, build `npm run build`, output `dist/`. **PR마다 프리뷰 URL 자동** → ui-reviewer/qa가 실제 배포로 검수, 심사 제출도 프로덕션 URL.
- **데이터**: 파이프라인 로컬 실행 → 생성 JSON 커밋. Vercel 빌드는 raw 안 받음(빠르고 안정).
- **CI(GitHub Actions, 최소)**: PR에서 `tsc --noEmit` + `vite build` 통과 검사만. 과한 파이프라인 지양.
- **출처표기**: StatsBomb attribution 상시 푸터 노출(라이선스 1.4, 로고 포함). 비상업 해커톤 범위 준수, 사진·로고 미사용.

---

## 8. 기술 리스크 & 대비

| 리스크 | 영향 | 대비 |
|---|---|---|
| **데이터 집계 정확도 + 번들 용량 (최대 리스크)** | 공정성·성능 붕괴 | 히트맵 **사전 비닝**(16×10 정수 그리드)으로 대회당 gzip <500KB. **2022 먼저** 완주 후 2018. Messi/Mbappé 등 알려진 선수로 집계값 sanity check. 출전 임계값으로 저표본 제거. |
| 순차 공개 애니메이션 잰크 | 감동 배점 손실 | Framer Motion transform/opacity만(레이아웃 스래시 회피), 11장 stagger GPU 친화. |
| 스파이더/히트맵 포지션 편향 | 익명 비교 불공정 | 포지션군 **내** 백분위 정규화. positionLabel로 맥락 제공. |
| 출전분 계산 엣지케이스(교체·포지션변경) | 지표 왜곡 | lineups positions from/to 우선, 서브 이벤트로 보정. MVP는 2022 검증 후 확장. |
| 세 트리 통합 충돌 | 일정 지연 | 계약 2개(스키마·스토어) 사전 확정 + mock 픽스처로 인터페이스 고정. 스토어 단독 writer. |
| StatsBomb repo 존속/라이선스 | 데이터 소실·실격 | 로컬 cache 보관. 비상업·출처표기 준수, 원본 raw 재배포 안 함(집계본만 번들). 사진/로고 미사용. |

---

## 부록: 확정 가정 (오너 OPEN-QUESTION 대응)
- **MVP 대회 범위**: 2022를 MUST로 완주, 2018은 SHOULD(파이프라인 재실행만으로 추가되게 설계). 일정 안전마진 확보.
- **안목 점수 정의**: 혼합(0.6 스탯 + 0.4 실제성적). PRD §10-B3 (c) 채택.
- **예산 제약**: MVP 제외(SHOULD). 넣을 경우 statExcellence를 예산가치로 재활용 가능(구조 이미 지원).
- 위 가정은 CEO/오너가 재정할 수 있으며, 파이프라인·스코어는 파라미터화되어 변경 비용 낮음.
</content>
