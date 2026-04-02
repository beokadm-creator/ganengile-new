# CRITICAL Fixes: 데이터 모듈, 요금 정합성, 매칭 엔진

## TL;DR

> **Quick Summary**: 가는길에 2차 개편 전체 코드 감사에서 발견된 3가지 CRITICAL 이슈를 수정합니다. (1) 누락된 데이터 모듈 4개 생성, (2) 서버-클라이언트 요금 상수 통합, (3) Cloud Functions 매칭 엔진 연동.
> 
> **Deliverables**:
> - `src/data/subway-stations.ts` — 서울 지하철 역 데이터 (MAJOR_STATIONS + getStationByName)
> - `src/data/travel-times.ts` — 주요 구간 이동 시간 매트릭스 (TRAVEL_TIME_MATRIX)
> - `src/data/express-trains.ts` — 급행 열차 스케줄 (EXPRESS_TRAIN_SCHEDULES)
> - `src/data/congestion.ts` — 혼잡도 데이터 (CONGESTION_DATA)
> - `functions/src/index.ts` — 매칭 엔진 연동 (onRequestCreated, matchRequests)
> - `src/services/pricing-service.ts` 또는 `functions/src/index.ts` — 요금 상수 정합성
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 7 → Final Verification

---

## Context

### Original Request
가는길에 서비스 2차 완전 개편 중, 로컬 소스의 구성 연결성, 단절된 곳, 부족한 부분 검증 요청.

### Interview Summary
**Key Discussions**:
- 전체 코드베이스(네비게이션, 서비스 66개, 타입 35개, 관리자 웹, Cloud Functions, 모듈/유틸)에 대한 6개 병렬 탐색 에이전트 실행
- CRITICAL 3건, HIGH 4건, MEDIUM 5건, LOW 5건 발견
- 사용자 선택: CRITICAL 3건만 우선 수정

**Research Findings**:
- `src/types/config.ts`에 데이터 모듈이 반환해야 할 타입이 완전히 정의됨 (Station, TravelTime, ExpressTrain, CongestionData 등)
- `data/stations-seoul.md`에 서울 지하철 전 노선 역 데이터 존재 (역명, 역코드, 위도, 경도)
- `src/data/matching-engine.ts`에 정교한 매칭 알고리즘 존재 (경로 일치 30pts, 요일 10pts, 시간 10pts, 배지 부스트)
- `docs/beta1-payment-settlement-strategy.md`에 PG/플랫폼 역할 분리 원칙 명시

---

## Work Objectives

### Core Objective
3가지 CRITICAL 이슈를 해결하여 앱이 정상적으로 빌드되고 핵심 기능(매칭, 요금 계산, 역 검색)이 동작하도록 복구.

### Concrete Deliverables
- 4개 누락 데이터 모듈 파일 생성 (기존 import 경로 호환)
- 서버↔클라이언트 요금 상수 단일화
- Cloud Functions 매칭 로직을 앱 매칭 엔진으로 교체

### Definition of Done
- [ ] `npx tsc --noEmit` 에러 없이 통과
- [ ] `config-service.ts`의 모든 import이 유효한 모듈을 가리킴
- [ ] `matching-service.ts`의 `@ts-nocheck` 제거 가능
- [ ] Cloud Functions `onRequestCreated`가 정교한 매칭 알고리즘 사용
- [ ] 서버와 클라이언트 요금 계산 결과가 동일한 입력에 대해 일치

### Must Have
- 기존 import 경로 그대로 호환 (`../../data/subway-stations`, `../../data/travel-times` 등)
- `src/types/config.ts`에 정의된 타입 준수
- `data/stations-seoul.md`의 역 데이터를 subway-stations.ts에 반영
- 기존 Cloud Functions 타입 (`functions/src/types.ts`) 호환 유지

### Must NOT Have (Guardrails)
- ❌ Firestore 컬렉션 스키마 변경 (data 모듈은 로컬 fallback 용도)
- ❌ `config-service.ts`의 캐시 로직 변경
- ❌ beta1 서비스들의 인터페이스 변경
- ❌ 네비게이션 구조 변경
- ❌ 문서 변경 (이 플랜은 코드 수정만)
- ❌ 새로운 npm 패키지 추가

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (jest.config.js, __tests__/ 디렉토리 존재)
- **Automated tests**: Tests-after (구조 복구 후 검증)
- **Framework**: jest (기존 설정 기준)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Data modules**: Bash (node REPL) — import, type check, function call
- **Pricing**: Bash (node REPL) — compare server vs client output for same input
- **Matching engine**: Bash (curl) — trigger Cloud Function with test data
- **Build**: Bash (`npx tsc --noEmit`) — full TypeScript compilation

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 6 parallel tasks):
├── Task 1: Create subway-stations.ts [quick]
├── Task 2: Create travel-times.ts [quick]
├── Task 3: Create express-trains.ts [quick]
├── Task 4: Create congestion.ts [quick]
├── Task 5: Align pricing server↔client [unspecified-high]
└── Task 6: Integrate matching engine into Cloud Functions [unspecified-high]

Wave 2 (After Wave 1 — verification):
├── Task 7: Verify full TypeScript compilation [quick]
└── Task 8: Integration smoke test [unspecified-high]

Wave FINAL (After Wave 2 — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 7 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 7 |
| 2 | — | 7 |
| 3 | — | 7 |
| 4 | — | 7 |
| 5 | — | 7, 8 |
| 6 | — | 8 |
| 7 | 1, 2, 3, 4, 5 | F1-F4 |
| 8 | 5, 6 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **6** — T1-T4 → `quick`, T5 → `unspecified-high`, T6 → `unspecified-high`
- **Wave 2**: **2** — T7 → `quick`, T8 → `unspecified-high`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Create `src/data/subway-stations.ts` — 서울 지하철 역 데이터 모듈

  **What to do**:
  - `data/stations-seoul.md`의 역 데이터(역명, 역코드, 위도, 경도)를 TypeScript 모듈로 변환
  - `MAJOR_STATIONS` 배열 export: 주요 환승역 + 터미널역 (약 50-80개) 포함
  - 각 역 객체는 `src/types/config.ts`의 `Station` 타입을 따를 것 (필드: stationId, stationName, stationNameEnglish, lines, location, isTransferStation, isExpressStop, isTerminus, facilities, isActive, region, priority)
  - `getStationByName(name: string): Station | undefined` 함수 export (matching-service.ts에서 사용)
  - `Station` 타입도 export (config-service.ts에서 `type Station as LocalStation`으로 import)
  - `data/stations-seoul.md`에서 모든 노선(1~9호선, 공항철도 등)의 역 데이터를 변환
  - 노선별 색상, 노선 코드도 `lines` 배열에 포함 (StationLine 타입 준수)
  - 환승역은 `isTransferStation: true`로 설정

  **Must NOT do**:
  - Firestore `config_stations` 컬렉션 직접 읽기 (이 파일은 로컬 fallback 용도)
  - API 호출이나 비동기 로직 포함
  - 기존 `config-service.ts` 수정

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일 생성, 데이터 변환 작업, 복잡한 로직 없음
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: UI 작업 없음
    - `git-master`: 커밋은 Final에서

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/data/matching-engine.ts` — 기존 데이터 모듈 예시 (export 패턴, 인터페이스 정의 방식)
  - `src/data/badges.ts` — 또 다른 데이터 모듈 예시

  **API/Type References**:
  - `src/types/config.ts:Station` — MAJOR_STATIONS 배열의 각 요소가 준수해야 할 타입 (lines 27-50)
  - `src/types/config.ts:StationLine` — 노선 정보 타입 (lines 8-14)
  - `src/types/config.ts:StationLocation` — 위도/경도 타입 (lines 16-19)
  - `src/types/config.ts:StationFacilities` — 편의시설 타입 (lines 21-25)

  **External References**:
  - `data/stations-seoul.md` — 전체 역 원본 데이터 (1~9호선, 공항철도, 신분당 등)

  **Import Consumer References** (어떻게 사용되는지):
  - `src/services/config-service.ts:16` — `import { MAJOR_STATIONS, type Station as LocalStation } from '../../data/subway-stations'`
  - `src/services/config-service.ts:103-124` — `convertLocalStation()` 함수에서 LocalStation → Station 변환 로직
  - `src/services/matching-service.ts:27` — `import { getStationByName } from '../../data/subway-stations'`

  **WHY Each Reference Matters**:
  - `types/config.ts`의 Station 타입을 정확히 준수해야 config-service.ts가 컴파일됨
  - `config-service.ts:103-124`의 `convertLocalStation`이 어떤 필드를 기대하는지 확인하면 필드 누락 방지 가능
  - `matching-service.ts`가 `getStationByName`으로 역 검색하므로 이 함수의 시그니처가 정확해야 함

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Module imports without error
    Tool: Bash
    Preconditions: File created at src/data/subway-stations.ts
    Steps:
      1. Run: node -e "const m = require('./src/data/subway-stations'); console.log('MAJOR_STATIONS count:', m.MAJOR_STATIONS.length); console.log('getStationByName type:', typeof m.getStationByName);"
      2. Assert MAJOR_STATIONS.length >= 50
      3. Assert typeof getStationByName === 'function'
    Expected Result: No MODULE_NOT_FOUND error, count >= 50, function exists
    Failure Indicators: MODULE_NOT_FOUND, undefined exports
    Evidence: .sisyphus/evidence/task-1-import-check.txt

  Scenario: Station type shape is correct
    Tool: Bash
    Preconditions: Module loads successfully
    Steps:
      1. Run: node -e "const { MAJOR_STATIONS } = require('./src/data/subway-stations'); const s = MAJOR_STATIONS[0]; const required = ['stationId','stationName','lines','location','isTransferStation']; const missing = required.filter(k => !(k in s)); if (missing.length) { console.log('MISSING FIELDS:', missing); process.exit(1); } else { console.log('All required fields present'); console.log('Sample station:', s.stationName); }"
      2. Assert no missing fields
    Expected Result: All required fields present, sample station name logged
    Failure Indicators: "MISSING FIELDS:" in output
    Evidence: .sisyphus/evidence/task-1-type-shape.txt

  Scenario: getStationByName finds stations
    Tool: Bash
    Preconditions: Module loads successfully
    Steps:
      1. Run: node -e "const { getStationByName } = require('./src/data/subway-stations'); const r1 = getStationByName('서울역'); const r2 = getStationByName('강남역'); console.log('서울역:', r1 ? r1.stationId : 'NOT FOUND'); console.log('강남역:', r2 ? r2.stationId : 'NOT FOUND');"
      2. Assert 서울역 is found
      3. Assert 강남역 is found (2호선)
    Expected Result: Both stations found with valid stationId
    Failure Indicators: "NOT FOUND" for either station
    Evidence: .sisyphus/evidence/task-1-station-lookup.txt

  Scenario: config-service.ts compiles with new module
    Tool: Bash
    Preconditions: subway-stations.ts created
    Steps:
      1. Run: npx tsc --noEmit src/services/config-service.ts 2>&1 | head -20
      2. Assert no "Cannot find module" errors for subway-stations
    Expected Result: No module resolution errors for subway-stations
    Failure Indicators: "Cannot find module '../../data/subway-stations'"
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES (groups with 2, 3, 4)
  - Message: `fix(data): add missing subway-stations data module`
  - Files: `src/data/subway-stations.ts`
  - Pre-commit: `node -e "require('./src/data/subway-stations')"`

- [ ] 2. Create `src/data/travel-times.ts` — 이동 시간 매트릭스

  **What to do**:
  - `TRAVEL_TIME_MATRIX` 객체 export: 키는 `"{fromStationId}-{toStationId}"`, 값은 이동 시간 정보
  - 각 엔트리는 `normalTime`(초), `expressTime`(초, 선택), `transferCount`, `transferStations`(배열), `hasExpress`(boolean), `walkingDistance`(미터) 포함
  - 주요 구간 30-50개 커버 (1호선 구간, 2호선 구간, 환승 구간 포함)
  - `getFallbackTravelTimes()` (config-service.ts:130-157)에서 이 매트릭스를 순회하므로 `Object.entries()`로 순회 가능한 구조여야 함

  **Must NOT do**:
  - 실시간 API 호출
  - Firestore 읽기

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 데이터 파일, 구조 단순
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `src/services/config-service.ts:130-157` — `getFallbackTravelTimes()`에서 TRAVEL_TIME_MATRIX를 사용하는 방식
  - `src/types/config.ts:TravelTime` — 최종 변환 타입 (lines 54-81)
  - `src/data/stations-seoul.md` — 역 간 거리 추정의 기준 역 데이터

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Travel time matrix exports correctly
    Tool: Bash
    Steps:
      1. Run: node -e "const { TRAVEL_TIME_MATRIX } = require('./src/data/travel-times'); const keys = Object.keys(TRAVEL_TIME_MATRIX); console.log('Route count:', keys.length); console.log('Sample keys:', keys.slice(0, 3)); const sample = TRAVEL_TIME_MATRIX[keys[0]]; console.log('Sample has normalTime:', 'normalTime' in sample);"
      2. Assert keys.length >= 20
      3. Assert sample has normalTime property
    Expected Result: Matrix loaded with 20+ routes, entries have normalTime
    Evidence: .sisyphus/evidence/task-2-travel-times.txt
  ```

  **Commit**: YES (groups with 1, 3, 4)

- [ ] 3. Create `src/data/express-trains.ts` — 급행 열차 스케줄

  **What to do**:
  - `EXPRESS_TRAIN_SCHEDULES` 배열 export
  - 각 스케줄: `lineId`, `lineName`, `type` (special/express), `typeName`, `operatingDays` (숫자 배열), `firstTrain`, `lastTrain`, `intervals` (rushHourMorning, rushHourEvening, daytime, night — 초 단위), `stops` (역 ID 배열), `timeSavings` (객체)
  - 1호선 특급, 수인·분당 급행 등 실제 운행 스케줄 기반

  **Must NOT do**:
  - 실시간 API 호출

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `src/services/config-service.ts:159-179` — `getFallbackExpressTrains()`에서 EXPRESS_TRAIN_SCHEDULES를 사용하는 방식
  - `src/types/config.ts:ExpressTrain` — 타입 정의 (lines 91-121)
  - `data/stations-seoul.md` — 역 코드 참조

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Express train schedules export
    Tool: Bash
    Steps:
      1. Run: node -e "const { EXPRESS_TRAIN_SCHEDULES } = require('./src/data/express-trains'); console.log('Schedule count:', EXPRESS_TRAIN_SCHEDULES.length); if (EXPRESS_TRAIN_SCHEDULES.length > 0) { const s = EXPRESS_TRAIN_SCHEDULES[0]; console.log('Has lineId:', 'lineId' in s); console.log('Has stops:', 'stops' in s); }"
      2. Assert count >= 3 (at least 3 express types)
      3. Assert entries have lineId and stops
    Expected Result: Schedules loaded with proper structure
    Evidence: .sisyphus/evidence/task-3-express-trains.txt
  ```

  **Commit**: YES (groups with 1, 2, 4)

- [ ] 4. Create `src/data/congestion.ts` — 혼잡도 데이터

  **What to do**:
  - `CONGESTION_DATA` 배열 export (config-service.ts에서 `LOCAL_CONGESTION_DATA`로 import)
  - 각 엔트리: `congestionId`, `lineId`, `lineName`, `timeSlots` (earlyMorning~evening 혼잡도 1-10), `sections` (역별 혼잡도), `dataSource`, `lastUpdated`, `isValid`
  - 주요 노선 (1~9호선, 공항철도) 커버
  - `getFallbackCongestionData()` (config-service.ts 뒷부분)에서 이 데이터를 사용

  **Must NOT do**:
  - 실시간 API 호출

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `src/types/config.ts:CongestionData` — 타입 정의 (lines 143-160)
  - `src/types/config.ts:CongestionTimeSlots` — 시간대별 혼잡도 타입 (lines 127-135)
  - `src/types/config.ts:CongestionSection` — 구간별 혼잡도 타입 (lines 137-141)
  - `src/services/config-service.ts:19` — import 경로: `import { CONGESTION_DATA as LOCAL_CONGESTION_DATA } from '../../data/congestion'`

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Congestion data exports correctly
    Tool: Bash
    Steps:
      1. Run: node -e "const { CONGESTION_DATA } = require('./src/data/congestion'); console.log('Line count:', CONGESTION_DATA.length); if (CONGESTION_DATA.length > 0) { const c = CONGESTION_DATA[0]; console.log('Has timeSlots:', 'timeSlots' in c); console.log('Has sections:', 'sections' in c); }"
      2. Assert count >= 5 (at least 5 lines)
      3. Assert entries have timeSlots and sections
    Expected Result: Congestion data loaded with proper structure
    Evidence: .sisyphus/evidence/task-4-congestion.txt
  ```

  **Commit**: YES (groups with 1, 2, 3)

- [ ] 5. Align pricing: server ↔ client 상수 통합

  **What to do**:
  - 현재 상태 분석:
    - 서버 (`functions/src/index.ts` PRICING_CONSTANTS): BASE_FARE=4000, PG_FEE=0.03, SERVICE_FEE=0.08, TAX=0.033
    - 클라이언트 (`src/services/pricing-service.ts` PRICING_POLICY): BASE_FEE=2000, PLATFORM_FEE=0.10, VAT=0.10, MIN=3000, MAX=10000
  - `pricing-service.ts`를 **단일 진실 공급원(SSOT)**으로 삼아 Cloud Functions를 정합
  - Cloud Functions의 `calculateDeliveryPricing` 함수를 수정:
    - `PRICING_CONSTANTS`를 클라이언트의 `PRICING_POLICY` 값으로 교체
    - `calculateBaseFare()`를 클라이언트의 거리/시간 기반 로직에 맞춤
    - PG 수수료, 원천징수세는 서버 전용이므로 유지하되, **총액(totalFare) 기준**을 클라이언트와 일치시킴
    - 최소/최대 요금(3000/10000) 적용
  - 또는: Cloud Functions의 `calculateDeliveryPricing`을 클라이언트와 **동일한 공식**으로 완전 교체
  - `docs/beta1-payment-settlement-strategy.md`의 PG/플랫폼 역할 분리 원칙 준수

  **Must NOT do**:
  - 클라이언트 `pricing-service.ts`의 핵심 구조(PRICE1_PHASE1 정책, 90/10 분배) 변경
  - `pricing-service.ts`의 `estimateDeliveryFee()` 함수 시그니처 변경
  - `PRICING_POLICY`의 기본 값(BASE_FEE=2000 등) 변경

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 두 파일 간 정합성 분석 + 정교한 수식 조정 필요, 비즈니스 로직 포함
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: UI 없음

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Task 7, Task 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/services/pricing-service.ts:74-79` — PRICING_POLICY 상수 정의 (SSOT)
  - `src/services/pricing-service.ts` 전체 — 클라이언트 요금 계산 로직 (estimateDeliveryFee, calculatePhase1DeliveryFee)
  - `functions/src/index.ts:1069-1106` — 서버 PRICING_CONSTANTS
  - `functions/src/index.ts:1258-1332` — calculateBaseFare(), calculateActualPricing() 헬퍼

  **API/Type References**:
  - `functions/src/types.ts:CalculateDeliveryPricingData` — 서버 요금 입력 타입
  - `functions/src/types.ts:CalculateDeliveryPricingResult` — 서버 요금 출력 타입
  - `src/services/pricing-service.ts:39-69` — DeliveryFeeBreakdown (클라이언트 출력 타입)

  **External References**:
  - `docs/beta1-payment-settlement-strategy.md` — PG/플랫폼 역할 분리 원칙

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Same input produces same total between server and client
    Tool: Bash
    Preconditions: Both pricing modules use aligned constants
    Steps:
      1. Run: node -e "
        const { PRICING_POLICY, estimateDeliveryFee } = require('./src/services/pricing-service');
        const params = { stationCount: 5, weight: 2, packageSize: 'medium', urgency: 'normal', publicFare: 1250 };
        const result = estimateDeliveryFee(params);
        console.log('Client totalFee:', result.totalFee);
        console.log('Client MIN_FEE:', PRICING_POLICY.MIN_FEE);
        console.log('Client MAX_FEE:', PRICING_POLICY.MAX_FEE);
        if (result.totalFee < PRICING_POLICY.MIN_FEE || result.totalFee > PRICING_POLICY.MAX_FEE) {
          console.log('ERROR: Fee out of range!');
          process.exit(1);
        }
      "
      2. Verify totalFee is within MIN_FEE (3000) and MAX_FEE (10000)
    Expected Result: Client pricing produces valid fee within range
    Evidence: .sisyphus/evidence/task-5-client-pricing.txt

  Scenario: Server pricing constants match client policy
    Tool: Bash
    Steps:
      1. Run: node -e "
        const { PRICING_POLICY } = require('./src/services/pricing-service');
        // Read server constants from source
        const fs = require('fs');
        const serverCode = fs.readFileSync('functions/src/index.ts', 'utf8');
        const baseFareMatch = serverCode.match(/BASE_FARE:\s*(\d+)/);
        const serviceFeeMatch = serverCode.match(/SERVICE_FEE_RATE:\s*([\d.]+)/);
        console.log('Client BASE_FEE:', PRICING_POLICY.BASE_FEE);
        console.log('Server BASE_FARE:', baseFareMatch ? baseFareMatch[1] : 'NOT FOUND');
        console.log('Client PLATFORM_FEE_RATE:', PRICING_POLICY.PLATFORM_FEE_RATE);
        console.log('Server SERVICE_FEE_RATE:', serviceFeeMatch ? serviceFeeMatch[1] : 'NOT FOUND');
      "
      2. After fix: server BASE_FARE should match client BASE_FEE (2000)
    Expected Result: Constants aligned (post-fix)
    Evidence: .sisyphus/evidence/task-5-constants-compare.txt
  ```

  **Commit**: YES (separate commit)
  - Message: `fix(pricing): align server and client pricing constants`
  - Files: `functions/src/index.ts`
  - Pre-commit: `node -e "require('./src/services/pricing-service')"`

- [ ] 6. Integrate matching engine into Cloud Functions

  **What to do**:
  - `functions/src/index.ts`의 `onRequestCreated` 트리거 수정:
    - 현재 단순 휴리스틱 (`rating * 20`)을 `src/data/matching-engine.ts`의 알고리즘으로 교체
    - `matchGillersToRequest()` 로직을 Cloud Functions 환경에 맞게 포팅:
      - 경로 일치 (+30pts), 요일 일치 (+10pts), 시간 근접 (+10pts), 배지 부스트
    - `estimatedTravelTime: 30` 하드코딩을 `src/data/travel-times.ts` 데이터 기반으로 계산
    - Firestore `routes` 컬렉션에서 조회한 gillerRoutes를 matching-engine 포맷으로 변환
  - `matchRequests` HTTPS 함수 수정:
    - 현재 빈 배열 반환 → 실제 매칭 로직으로 교체
    - `onRequestCreated`와 동일한 매칭 알고리즘 사용
  - `triggerMatching` HTTPS 함수:
    - `requestId`로 요청 조회 후 매칭 실행

  **Must NOT do**:
  - `src/data/matching-engine.ts` 파일 자체 변경 (클라이언트 코드)
  - `functions/src/types.ts`의 Match, GillerRoute 타입 변경
  - 새로운 Firebase 컬렉션 생성

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cloud Functions 로직 수정, Firestore 쿼리, 타입 변환 복잡
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1)
  - **Blocks**: Task 8
  - **Blocked By**: None (매칭 엔진은 data 모듈에 의존하지 않음)

  **References**:

  **Pattern References**:
  - `src/data/matching-engine.ts:38-80` — `matchGillersToRequest()` 핵심 알고리즘 (경로 일치, 요일, 시간, 배지)
  - `src/data/matching-engine.ts:81-95` — `getTopMatches()` 상위 N 필터링
  - `functions/src/index.ts:66-202` — 현재 `onRequestCreated` 구현 (교체 대상)
  - `functions/src/index.ts:1341-1516` — 현재 `matchRequests` 구현 (교체 대상)
  - `functions/src/index.ts:493-529` — 현재 `triggerMatching` 구현 (빈 배열 반환)

  **API/Type References**:
  - `functions/src/types.ts:Match` — 매치 결과 타입 (서버)
  - `functions/src/types.ts:GillerRoute` — 길러 경로 타입 (서버)
  - `functions/src/types.ts:ScoredGiller` — 점수付き 길러 타입
  - `functions/src/types.ts:RouteData` — Firestore routes 컬렉션 데이터 타입
  - `src/data/matching-engine.ts:GillerRoute` — 매칭 엔진 입력 타입 (클라이언트)
  - `src/data/matching-engine.ts:DeliveryRequest` — 매칭 엔진 요청 타입

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: onRequestCreated uses scoring algorithm (not just rating*20)
    Tool: Bash (grep)
    Preconditions: functions/src/index.ts modified
    Steps:
      1. Run: grep -c "rating \* 20" functions/src/index.ts
      2. Assert count is 0 (old heuristic removed)
      3. Run: grep -c "routeMatch\|departureStation.*pickupStation\|arrivalStation.*deliveryStation" functions/src/index.ts
      4. Assert count > 0 (new algorithm present)
    Expected Result: Old heuristic removed, new algorithm present
    Evidence: .sisyphus/evidence/task-6-matching-algorithm.txt

  Scenario: matchRequests returns actual matches (not empty array)
    Tool: Bash (grep)
    Steps:
      1. Run: grep -A5 "const matches: Match\[\]" functions/src/index.ts
      2. Verify the function no longer has `const matches: Match[] = []` without population
    Expected Result: matchRequests builds matches from algorithm
    Evidence: .sisyphus/evidence/task-6-match-requests.txt

  Scenario: estimatedTravelTime no longer hardcoded to 30
    Tool: Bash (grep)
    Steps:
      1. Run: grep "estimatedTravelTime: 30" functions/src/index.ts
      2. Assert no match (hardcoded 30 removed)
    Expected Result: No hardcoded travel time
    Evidence: .sisyphus/evidence/task-6-travel-time.txt
  ```

  **Commit**: YES (separate commit)
  - Message: `fix(matching): integrate proper scoring algorithm into Cloud Functions`
  - Files: `functions/src/index.ts`
  - Pre-commit: `grep -c "rating \* 20" functions/src/index.ts`

- [ ] 7. Verify full TypeScript compilation

  **What to do**:
  - `npx tsc --noEmit` 실행하여 전체 프로젝트 컴파일 검증
  - `src/services/config-service.ts` — 4개 데이터 모듈 import 에러 확인
  - `src/services/matching-service.ts` — `@ts-nocheck` 제거 후 에러 확인
  - `functions/src/index.ts` — 매칭 엔진/요금 수정 후 타입 에러 확인
  - 발견된 에러를 수정 (import 경로, 타입 불일치 등)

  **Must NOT do**:
  - 기능 로직 변경
  - LSP에서 이미 감지된 기존 에러(MainNavigator, B2BNavigator 등) 수정 — 이 플랜 범위 밖

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2, 3, 4, 5, 6

  **References**:
  - `tsconfig.json` — TypeScript 컴파일 설정
  - `functions/tsconfig.json` — Cloud Functions 타입스크립트 설정 (존재 여부 확인)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: TypeScript compilation passes for app source
    Tool: Bash
    Steps:
      1. Run: npx tsc --noEmit 2>&1 | head -50
      2. Check for errors in src/services/config-service.ts, src/services/matching-service.ts
    Expected Result: No "Cannot find module" errors for data modules
    Failure Indicators: "Cannot find module '../../data/subway-stations'" etc.
    Evidence: .sisyphus/evidence/task-7-tsc-app.txt

  Scenario: matching-service.ts @ts-nocheck can be removed
    Tool: Bash
    Steps:
      1. Check if matching-service.ts still has @ts-nocheck
      2. If yes, attempt removal and check for compile errors
    Expected Result: @ts-nocheck removable (or document why it must stay)
    Evidence: .sisyphus/evidence/task-7-ts-nocheck.txt
  ```

  **Commit**: YES (if adjustments needed)
  - Message: `fix(build): resolve TypeScript compilation errors from critical fixes`

- [ ] 8. Integration smoke test

  **What to do**:
  - 4개 데이터 모듈을 동시에 import하여 config-service 로드 검증
  - 요금 계산: 클라이언트에서 동일 입력으로 계산 후 서버와 결과 비교 개념 확인
  - 매칭 엔진: Cloud Functions 코드에서 매칭 알고리즘이 호출 가능한 구조인지 검증
  - `__tests__/` 기존 테스트가 통과하는지 확인

  **Must NOT do**:
  - 새로운 테스트 작성 (이 플랜은 복구 목적)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 5, 6

  **References**:
  - `__tests__/` — 기존 테스트 디렉토리
  - `jest.config.js` — 테스트 설정

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: All 4 data modules load together
    Tool: Bash
    Steps:
      1. Run: node -e "
        const stations = require('./src/data/subway-stations');
        const times = require('./src/data/travel-times');
        const express = require('./src/data/express-trains');
        const congestion = require('./src/data/congestion');
        console.log('stations:', stations.MAJOR_STATIONS.length);
        console.log('travel times:', Object.keys(times.TRAVEL_TIME_MATRIX).length);
        console.log('express:', express.EXPRESS_TRAIN_SCHEDULES.length);
        console.log('congestion:', congestion.CONGESTION_DATA.length);
        console.log('ALL MODULES LOADED SUCCESSFULLY');
      "
    Expected Result: All modules load, counts logged
    Evidence: .sisyphus/evidence/task-8-all-modules.txt

  Scenario: Existing tests still pass
    Tool: Bash
    Steps:
      1. Run: npx jest --passWithNoTests 2>&1 | tail -20
    Expected Result: Tests pass (no regressions from our changes)
    Evidence: .sisyphus/evidence/task-8-jest.txt
  ```

  **Commit**: NO (verification only)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + eslint. Review all changed/created files for: `@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Verify every QA scenario from every task. Import all 4 data modules and verify exports. Run pricing comparison for 3 test inputs. Verify matching engine returns scored results.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual file content. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(data): add missing data modules for config and matching services` — src/data/*.ts, functions/src/index.ts, src/services/pricing-service.ts
- **Wave 2**: `fix(build): verify TypeScript compilation after critical fixes` — (if any adjustment needed)
- **Final**: `fix(critical): resolve data module, pricing, and matching engine gaps` — (squash or sign-off)

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit          # Expected: 0 errors
node -e "require('./src/data/subway-stations')"  # Expected: no MODULE_NOT_FOUND
node -e "require('./src/data/travel-times')"     # Expected: no MODULE_NOT_FOUND
node -e "require('./src/data/express-trains')"   # Expected: no MODULE_NOT_FOUND
node -e "require('./src/data/congestion')"       # Expected: no MODULE_NOT_FOUND
```

### Final Checklist
- [ ] All 4 data modules exist at expected paths
- [ ] `config-service.ts` imports resolve without errors
- [ ] `matching-service.ts` can remove `@ts-nocheck`
- [ ] Server and client pricing produce consistent results
- [ ] Cloud Functions use proper matching engine (not heuristic)
- [ ] No "Must NOT Have" violations
- [ ] All evidence files exist in `.sisyphus/evidence/`
