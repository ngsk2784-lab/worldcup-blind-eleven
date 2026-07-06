# 데이터 소스 실사 검증 — StatsBomb Open Data (블라인드 일레븐)

조사일: 2026-07-06
조사자: 리서치 애널리스트

## 결론 (요약)

**판정: 조건부 가능(Conditional Go)**

StatsBomb Open Data는 실존하며 월드컵 2018/2022 이벤트 데이터를 무료로 제공하고, 슛/xG/패스/드리블/듀얼/위치좌표 등 게임에 필요한 지표를 실제로 포함한다. 단, **라이선스가 "데이터 또는 그로부터 파생된 분석의 상업적 이용(commercially exploit)"을 명시적으로 금지**하고 있어, 게임을 유료화·광고수익화·상금이 걸린 대회에 출품할 계획이 있다면 이 라이선스 조건과 정면으로 충돌한다. 무료/비상업(포트폴리오·해커톤·비영리) 프로젝트로 간다면 로고 출처표기 의무만 지키면 문제없다.

---

## 1. Repo 실존 여부 · URL · 라이선스

- Repo: **https://github.com/statsbomb/open-data** — 실접속 확인됨. "Free football data from StatsBomb" 명시. 2024~2026년까지 issue·커밋이 이어지는 활성 저장소(최근 갱신 2026-05-26 확인, [github.com/statsbomb/open-data](https://github.com/statsbomb/open-data)).
- 라이선스 원문: **https://raw.githubusercontent.com/statsbomb/open-data/master/LICENSE.pdf** (StatsBomb Public Data User Agreement). r.jina.ai 프록시로 PDF 텍스트 추출해 실제 조항 확인.
  - **1.1** (허용 목적): "…to be used for **analysis, research and to facilitate the shared ideas & understanding** of the data"
  - **1.2.1** (금지): "edit, distort, distribute, reproduce, **sell** or in any way provide the data to any external or third party" — 재배포·판매·제3자 제공 금지
  - **1.2.2** (금지, 핵심): "**commercially exploit** the data or any analysis derived from the use of the Service" — 데이터/파생 분석의 **상업적 이용 명시적 금지**
  - **1.2.5**: 서비스(전달 방식)의 디컴파일·리버스엔지니어링 금지 (데이터 자체보다 API 전달체계 관련)
  - **1.4** (출처표기 의무): "The User is required to **accredit any publication of analysis** formed from StatsBomb Data with the **StatsBomb brand logo**" — 로고 포함 출처표기 필수 (미디어팩에서 로고 제공)
  - **7** (지적재산권): 모든 데이터는 StatsBomb 소유, 서면 승인 없는 이용 불가
  - **2**: GitHub를 통한 전달, StatsBomb이 예고 없이 서비스를 중단할 수 있음, 사용자 등록(간단한 개인정보) 요청
  - **3**: 데이터는 "as is" 제공, 정확성 보증 없음

## 2. 월드컵 2018·2022 데이터 포함 여부

`competitions.json` (https://raw.githubusercontent.com/statsbomb/open-data/master/data/competitions.json) 확인 결과, **competition_id = 43 (FIFA World Cup)** 아래 아래 시즌들이 존재:

| season_id | 연도 |
|---|---|
| 106 | **2022** |
| 3 | **2018** |
| 55/54/51/272/270/269 | 1990/1986/1974/1970/1962/1958 |

- **2022 대회**: `data/matches/43/106.json` 확인 — **64경기** 전부 포함. 첫 경기 Canada vs Morocco(2022-12-01, match_id 3857276), 마지막 결승전 Argentina vs France(2022-12-18, match_id 3869685).
- **2018 대회**: `data/matches/43/3.json` 확인 — **64경기** 전부 포함. 예시 match_id 8650 (Brazil vs Belgium 8강).
- 2022 대회는 StatsBomb 360(프리즈프레임 위치데이터) 도 포함, 2018 대회는 이벤트 데이터만 있고 360은 없음(공식 안내 및 검색 결과 기준).

## 3. 데이터 구조 — 실제 JSON 샘플 확인 (match_id 3869685, 3857276)

- **Events** (`data/events/{match_id}.json`): 이벤트 배열. Shot 이벤트 실 샘플 확인(https://raw.githubusercontent.com/statsbomb/open-data/master/data/events/3857276.json, r.jina.ai 프록시로 파싱):
  ```
  "shot": {
    "statsbomb_xg": 0.038882375,
    "end_location": [...], "key_pass_id": "...",
    "technique": {"id":93,"name":"Normal"},
    "body_part": {"id":38,"name":"Left Foot"},
    "outcome": {"id":96,"name":"Blocked"},
    "freeze_frame": [...]  // 슛 순간 22명 위치
  }
  ```
  → **xG, 슛 위치/기술/신체부위/결과, 프리즈프레임(주변 선수 위치) 확보 가능.**
  - Pass 이벤트: `pass.length/angle/height/end_location/outcome/body_part/cross/through_ball/recipient` 등 확인 — 키패스는 shot.key_pass_id로 역추적 가능, 패스 성공률 산출 가능.
  - Duel 이벤트 존재("Aerial Lost" 등 duel.type) — 태클/인터셉션은 별도 event type(Interception, Duel, Ball Recovery, Pressure)으로 StatsBomb 스펙에 정의되어 있음(공식 스펙 PDF, 일부만 파싱 성공: https://raw.githubusercontent.com/statsbomb/open-data/master/doc/StatsBomb%20Open%20Data%20Specification%20v1.1.pdf).
  - 모든 이벤트에 `location`(x,y 좌표, 120x80 피치 기준) 필드 존재 → **히트맵 생성 가능.**
  - 이벤트 단위로 `player.id/name`과 `position.id/name`(그 순간 포지션) 포함 — 다만 jersey_number는 이벤트에는 없고 lineups 파일에만 있음.

- **Lineups** (`data/lineups/{match_id}.json`): 확인 필드 — `team_id, team_name`, 선수별 `player_id, player_name, player_nickname, jersey_number, country{id,name}, cards[], positions[](position_id, position, from/to)`.
  → **이름·포지션·등번호·국가 전부 포함.** 단 **나이/키/생년월일은 이 파일에 없음** (확인됨, 없음).

- **Three-sixty** (`data/three-sixty/{match_id}.json`, 2022만): freeze_frame 배열(선수 위치 x,y, teammate/actor/keeper 플래그) — 슛 순간 외에도 확장된 위치 스냅샷 제공.

## 4. 데이터 용량

GitHub API(`api.github.com/repos/statsbomb/open-data/contents/data/events/{id}.json`)로 실측:
- 일반 경기(연장 없음, match 8650): **약 3.0MB** (3,018,417 bytes)
- 결승전(연장전 포함, match 3869685): **약 3.6MB** (3,757,121 bytes)

→ **경기당 이벤트 JSON 약 3~3.6MB**, 3600~4000개 이벤트 수준으로 추정. 64경기 기준 전체 이벤트 데이터는 대략 200MB 안팎(추정치, 정확한 총합은 미측정 — 사전집계 파이프라인 설계 시 여유 두고 산정 권장). lineups/matches 파일은 이보다 훨씬 작음(수십 KB 수준으로 추정, 개별 실측 안 함).

## 5. 선수 메타데이터 — 부족분과 대체 소스

- **포함됨**: 이름, 등번호, 국가, 경기 내 포지션 변화, 카드 기록 (lineups 파일, 위 3번 항목 확인).
- **없음(확인됨)**: 생년월일/나이, 신장, 체중.
- **대체 무료 소스 후보** (실접속 확인):
  - **openfootball/worldcup** (https://github.com/openfootball/worldcup, CC0-1.0 퍼블릭도메인) — 2018/2022 대회 폴더 존재 확인. 다만 페이지 확인상 생년월일 필드는 기본 저장소에 없고 "worldcup.more" 서브저장소 안내가 있으나 별도 검증 필요(미검증).
  - **Wikidata/Wikipedia** — 선수별 생년월일·신장 정보가 구조화되어 있고 SPARQL로 무료 조회 가능(CC-BY-SA, 출처표기 필요). 별도 리포지토리 실접속 검증은 이번 조사에서 하지 않았으나, 업계에서 표준적으로 쓰이는 방식(예: withqwerty/reep 프로젝트가 Wikidata 기반 선수 식별자 매핑을 제공 — https://github.com/withqwerty/reep, 상세 내용은 미검증).
  - **BALLDONTLIE FIFA World Cup API** (https://fifa.balldontlie.io/) — date_of_birth/height_cm 제공하나, **선수 데이터는 유료 티어($9.99/월~) 필요** — 무료 목적엔 부적합.
  → 나이/키가 게임에 꼭 필요하면 **Wikidata 연동 또는 수동 큐레이션**을 권장, 별도 검증 세션 필요.

## 6. 리스크

1. **상업적 이용 금지 (최우선 리스크)**: 라이선스 1.2.2 "commercially exploit" 명시 금지. 게임에 광고·인앱결제·상금 있는 공모전 출품 등이 계획되어 있다면 위반 소지. **비상업(무료, 포트폴리오/학습용) 배포**라면 리스크 낮음.
2. **재배포/제3자 제공 금지 (1.2.1)**: 원본 JSON을 그대로 재호스팅해 제3자에게 다운로드 제공하는 형태는 금지. 게임 서버가 자체 DB에 사전가공(집계)해 내부적으로만 쓰는 것은 통상적 해석상 더 안전하나, 원본 이벤트 데이터를 그대로 API로 외부 제공하면 리스크.
3. **로고 출처표기 의무 (1.4)**: 게임 내 어딘가(크레딧/정보 화면 등)에 StatsBomb 로고+출처 명시 필요. 안 하면 라이선스 위반.
4. **Repo 존속 리스크**: 낮음 — 2024~2026년까지 활발히 갱신되는 공식 저장소(https://github.com/statsbomb/open-data). 다만 "StatsBomb이 예고 없이 서비스를 중단할 수 있다"는 조항(1.3/2) 존재 — 장기적으로 로컬에 데이터를 다운로드해 보관하는 것을 권장.
5. **등록 요구**: 라이선스 2조에 사용자 등록 절차 언급됨(간단한 개인정보 등록으로 추정, 상세 절차는 이번 조사에서 실제 등록 폼까지는 확인 안 함).
6. **1958~1990년 월드컵도 포함**되어 있어(위 표 참고), 추후 게임 확장 시 데이터 소스 추가 확보 없이도 다른 연도 확장 가능성 있음(참고사항).

---

## 확인 불가 / 검증 제외 항목
- LICENSE.pdf 자체를 GitHub 웹뷰어/직접 다운로드로는 파싱 불가(바이너리 인코딩) — **r.jina.ai 프록시로 텍스트 추출해 원문 조항 확인**하는 방식으로 우회 검증함. 원 PDF 링크는 살아있음(https://raw.githubusercontent.com/statsbomb/open-data/master/LICENSE.pdf).
- Interception/Tackle 이벤트의 정확한 필드 스키마는 공식 스펙 PDF가 부분적으로만 파싱되어 100% 확인은 못 함(Duel 이벤트는 실샘플로 확인됨).
- openfootball/worldcup.more 서브저장소의 생년월일 데이터 포함 여부는 미검증.
- StatsBomb 사용자 등록 절차의 구체적 내용(가입 후 승인 여부 등)은 미검증.
