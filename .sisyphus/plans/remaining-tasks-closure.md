# 가는길에 — 남은 과업 마감 (Production Readiness Closure)

## TL;DR

> **Quick Summary**: 가는길에 앱의 실서비스 출시 전 남은 과업을 모두 마감합니다. 지도(Naver Maps) 연결, 실시간 GPS, 취소/분쟁 UX 개선, 관리자 분쟁/보증금 UI, B2B 세금계산서 외부 API 연동, src/services 타입 정리, 대시보드 경고 패널 등 19개 구현 + 4개 검증 태스크를 4 웨이브로 병렬 실행합니다.
> 
> **Deliverables**:
> - Naver Maps SDK 연동된 지도 컴포넌트 (사물함 위치, 배송 추적)
> - 실제 GPS 기반 실시간 위치 추적
> - 취소→분쟁 원활한 UX 흐름 (앱 + 관리자)
> - 관리자 분쟁/보증금/정산 통합 관리 UI
> - B2B 세금계산서 외부 API 연동 레이어
> - src/services 타입 경계 정리 (as any 33건 제거)
> - 대시보드 통합 경고 패널
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T1(Naver Maps) → T7(LockerMap) → T14(Delivery Tracking) → F1-F4

---

## Context

### Original Request
사용자가 판단한 4대 남은 과업(취소/분쟁 마감, 정산/운영 민감 구간, 실서비스 연결 고도화, 전역 품질)을 6개 병렬 코드 감사로 검증한 후, 실서비스 출시를 위해 전체 과업을 하나의 워크플랜으로 생성.

### Interview Summary
**Key Discussions**:
- 지도 SDK: Naver Maps 선택 (한국 실서비스 표준)
- 범위: 전체 남은 과업 포함 (단일 플랜)
- 테스트: QA 시나리오 기반 (TDD 불포함)

**Research Findings** (6 병렬 감사 결과):
- 취소/분쟁: 앱은 텍스트 안내만 있고 CTA 없음, 관리자는 API 완비 but UI 없음
- 정산: 3.3% 구조 정상, 출금 가드 견고, BUT B2B 세율 혼동 가능
- 지도: 전부 Placeholder (SVG/canvas), 어떤 지도 SDK도 연결 안 됨
- 실시간: Firestore 실시간 OK, GPS 위치는 mock
- 알림: FCM 기반 실제 연동 완료 (우선순위 낮음)
- 품질: admin-web 깨끗, src/services에 as any 33건

### Metis Review
Metis consultation timed out. Self-conducted gap analysis incorporated directly.

---

## Work Objectives

### Core Objective
가는길에 앱의 모든 남은 기능/품질 과업을 마감하여 실서비스 출시 준비를 완료합니다.

### Concrete Deliverables
- `src/components/map/NaverMapView.tsx` — Naver Maps 재사용 컴포넌트
- `src/screens/main/LockerMapScreen.tsx` — Naver Maps 기반 사물함 지도
- `src/screens/main/DeliveryTrackingScreen.tsx` — Naver Maps 기반 배송 추적
- `src/screens/main/RequestDetailScreen.tsx` — 취소 차단 시 분쟁 CTA 추가
- `src/screens/main/ChatScreen.tsx` — 분쟁 신고 버튼 추가
- `src/screens/main/CancelResultScreen.tsx` (또는 모달) — 취소 결과 요약 카드
- `admin-web/app/(admin)/disputes/page.tsx` — 관리자 분쟁 관리 UI
- `admin-web/app/(admin)/deposits/page.tsx` — 관리자 보증금 관리 UI
- `admin-web/app/(admin)/settlements/checklist/page.tsx` — 정산 체크리스트
- `admin-web/app/(admin)/dashboard/page.tsx` — 통합 경고 패널 추가
- `src/services/location-service.ts` — 실제 GPS 위치 서비스
- `src/services/external-tax-service.ts` — NTS/Hometax API 연동 레이어
- src/services as any 33건 타입 정리

### Definition of Done
- [ ] `npx tsc --noEmit` — admin-web 0 errors, src 0 new errors
- [ ] 지도 화면에서 실제 Naver Maps 렌더링 확인
- [ ] 배송 추적에서 실시간 GPS 위치 업데이트 확인
- [ ] 취소 차단 → 분쟁 신고 원활한 흐름 확인
- [ ] 관리자에서 분쟁 해결/보증금 환불 직접 조작 가능
- [ ] src/services as any 건수 0

### Must Have
- Naver Maps 지도가 실제로 렌더링되고 역/사물함 마커가 표시되어야 함
- 실시간 GPS 위치가 Firestore를 통해 업데이트되어야 함
- 취소 차단 시 사용자가 한 번의 탭으로 분쟁 신고 화면에 도달해야 함
- 관리자가 분쟁을 조회하고 해결(responsibility/compensation) 조치할 수 있어야 함
- 관리자가 보증금을 조회하고 환불/공제 조치할 수 있어야 함
- B2B 세금계산서 세율이 UI에서 명확히 구분되어 표시되어야 함

### Must NOT Have (Guardrails)
- ❌ 기존 취소/정산/알림 로직을 변경하지 말 것 (확장만)
- ❌ Naver Maps API 키를 코드에 하드코딩하지 말 것 (환경변수)
- ❌ 새로운 Firebase collection을 무단 생성하지 말 것 (기존 스키마 확장만)
- ❌ admin-web의 기존 페이지 레이아웃/스타일을 파괴하지 말 것
- ❌ src/screens 기존 네비게이션 구조를 변경하지 말 것 (새 화면은 기존 패턴 추가)
- ❌ 불필요한 JSDoc, 과도한 주석, AI-slop 코드 생성하지 말 것
- ❌ NTS/Hometax API 실제 호출은 이 플랜에서 스텁으로만 구현 (실제 인증은 별도 설정 필요)
- ❌ src/services type cleanup 시 기존 함수 시그니처를 변경하지 말 것 (타입만 구체화)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (for this specific work)
- **Automated tests**: QA Scenarios only
- **Framework**: None (agent-executed QA via Playwright, Bash, interactive_bash)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI (앱)**: Playwright (web) — 앱이 React Native Web이므로 웹으로 검증
- **Admin UI**: Playwright — 관리자 웹 화면 직접 검증
- **API/Backend**: Bash (curl) — API 엔드포인트 동작 확인
- **TypeScript**: Bash (npx tsc --noEmit) — 타입 체크

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + independent scaffolding):
├── Task 1: Naver Maps SDK setup + NaverMapView wrapper component [visual-engineering]
├── Task 2: Shared type definitions for new features [quick]
├── Task 3: Admin dashboard error/warning panel [visual-engineering]
├── Task 4: Subscription tier Firestore config migration [quick]
├── Task 5: admin-web shared types boundary (admin-web/types/) [quick]
└── Task 6: B2B tax rate UI clarification labels [quick]

Wave 2 (After Wave 1 — core implementations, MAX PARALLEL):
├── Task 7: LockerMapScreen → Naver Maps migration [visual-engineering]
├── Task 8: Real GPS location service (replace mock) [unspecified-high]
├── Task 9: Admin disputes management UI page [visual-engineering]
├── Task 10: Admin deposits management UI page [visual-engineering]
├── Task 11: App cancel→dispute CTA + ChatScreen escalation [unspecified-high]
├── Task 12: Cancel completion summary card [visual-engineering]
└── Task 13: src/services type cleanup batch 1 [unspecified-high]

Wave 3 (After Wave 2 — integration + advanced):
├── Task 14: Delivery tracking with Naver Maps + real GPS [visual-engineering]
├── Task 15: Admin settlement checklist consolidated view [visual-engineering]
├── Task 16: src/services type cleanup batch 2 [unspecified-high]
├── Task 17: Fix LSP errors (B2BRequestScreen, LoginScreen, b2b-giller-service) [quick]
├── Task 18: SubwayMapVisualizer geo-coordinate enrichment [quick]
└── Task 19: B2B NTS/Hometax API integration layer [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T7 → T14 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1   | —         | T7, T14, T18 | 1 |
| T2   | —         | T6, T8, T9, T10, T11, T12, T13, T14, T15, T19 | 1 |
| T3   | —         | — | 1 |
| T4   | —         | — | 1 |
| T5   | —         | T9, T10, T15 | 1 |
| T6   | —         | — | 1 |
| T7   | T1, T2    | T14 | 2 |
| T8   | T2        | T14 | 2 |
| T9   | T2, T5    | T15 | 2 |
| T10  | T2, T5    | T15 | 2 |
| T11  | T2        | T12 | 2 |
| T12  | T2, T11   | — | 2 |
| T13  | T2        | T16 | 2 |
| T14  | T7, T8    | — | 3 |
| T15  | T9, T10   | — | 3 |
| T16  | T13       | T17 | 3 |
| T17  | T16       | — | 3 |
| T18  | T1        | — | 3 |
| T19  | T2, T6    | — | 3 |
| F1-F4| ALL       | — | FINAL |

### Agent Dispatch Summary

- **Wave 1**: 6 tasks — T1 `visual-engineering`, T2-T6 `quick`
- **Wave 2**: 7 tasks — T7 `visual-engineering`, T8,T11,T13 `unspecified-high`, T9,T10,T12 `visual-engineering`
- **Wave 3**: 6 tasks — T14,T15 `visual-engineering`, T16 `unspecified-high`, T17,T18 `quick`, T19 `deep`
- **FINAL**: 4 tasks — F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [ ] 1. Naver Maps SDK 설치 + NaverMapView 재사용 컴포넌트

  **What to do**:
  - `react-native-naver-map` 패키지 설치 및 Expo plugin 설정 (`app.json` 또는 `app.config.js`)
  - Naver Maps API 키를 환경변수로 설정 (`app.config.js`에서 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` 등)
  - `src/components/map/NaverMapView.tsx` 재사용 래퍼 컴포넌트 생성:
    - Props: `initialRegion`, `markers` (배열), `onMarkerPress`, `showsUserLocation`, `children`
    - Expo web 호환: 웹에서는 Naver Maps 지도 API v3 iframe 또는 fall-forward
  - `src/components/map/StationMarker.tsx`, `LockerMarker.tsx` 마커 컴포넌트
  - `src/config/map.ts` — API 키 설정 및 기본 지도 옵션

  **Must NOT do**:
  - API 키를 코드에 하드코딩하지 말 것
  - 기존 `SubwayMapVisualizer.tsx`를 삭제하지 말 것 (다른 화면에서 사용 중)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]
    - `frontend-design`: 지도 컴포넌트 UI/UX 패턴 필요
  - **Skills Evaluated but Omitted**:
    - `adapt`: 지도 컴포넌트는 반응형이 기본이므로 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4, T5, T6)
  - **Blocks**: T7, T14, T18
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/components/subway/SubwayMapVisualizer.tsx` — 기존 지도 시각화 패턴 (SVG 기반, props 구조 참고)
  - `src/screens/main/LockerMapScreen.tsx` — 현재 사물함 지도 화면 (교체 대상, 현재 구조 파악용)
  - `src/screens/main/RealtimeTrackingScreen.tsx` — 현재 추적 화면 (교체 대상, 현재 구조 파악용)

  **API/Type References**:
  - `src/types/` — 기존 타입 패턴 참고
  - `docs/data/station-and-fare-data.md` — 역 데이터 구조

  **External References**:
  - react-native-naver-map 공식 문서: https://github.com/ququzone/react-native-naver-map
  - Naver Maps API v3: https://api.ncloud-docs.com/docs/ai-naver-mapsmap

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: NaverMapView 컴포넌트가 마커와 함께 렌더링
    Tool: Bash (npx expo export --platform web)
    Preconditions: EXPO_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수 설정됨
    Steps:
      1. npx tsc --noEmit — 컴파일 에러 없음 확인
      2. NaverMapView.tsx에서 export default 존재 확인
      3. Props 타입이 initialRegion, markers, onMarkerPress, showsUserLocation 포함 확인
    Expected Result: TypeScript 컴파일 성공, 컴포넌트 export 확인
    Failure Indicators: tsc 에러, missing export
    Evidence: .sisyphus/evidence/task-1-naver-map-component.txt

  Scenario: API 키가 환경변수에서 읽히고 코드에 노출되지 않음
    Tool: Bash (grep)
    Preconditions: None
    Steps:
      1. grep -r "ncloud\\.naver\\.com" src/components/map/ — API 키 문자열 없어야 함
      2. grep -r "EXPO_PUBLIC_NAVER" src/config/map.ts — 환경변수 참조 확인
    Expected Result: 하드코딩된 API 키 0건, 환경변수 참조 존재
    Evidence: .sisyphus/evidence/task-1-api-key-check.txt
  ```

  **Commit**: YES (groups with T2-T6)
  - Message: `feat(map): add naver maps sdk setup and NaverMapView wrapper component`
  - Files: `src/components/map/NaverMapView.tsx`, `src/components/map/StationMarker.tsx`, `src/components/map/LockerMarker.tsx`, `src/config/map.ts`, `app.json`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 2. 신규 기능용 공유 타입 정의

  **What to do**:
  - `src/types/map.ts` — 지도 관련 타입:
    - `MapRegion`: `{ latitude, longitude, latitudeDelta, longitudeDelta }`
    - `MapMarker`: `{ id, coordinate, title, type: 'station' | 'locker' | 'user', ... }`
  - `src/types/dispute.ts` — 분쟁 관련 타입 보강 (기존이 있으면 확장):
    - `DisputeDetail`: 기존 dispute 타입 + `cancelReason`, `penaltyApplied`, `depositRefundStatus` 필드 추가
    - `AdminDisputeAction`: `{ responsibility, compensation, note }` — 관리자 조치 타입
  - `src/types/deposit.ts` — 보증금 관련 타입 보강:
    - `DepositDetail`: 기존 + `refundStatus`, `deductionReason` 필드
    - `AdminDepositAction`: `{ action: 'refund' | 'deduct', amount?, reason? }`
  - `src/types/location.ts` — 위치 서비스 타입:
    - `LocationUpdate`: `{ latitude, longitude, accuracy, timestamp, heading?, speed? }`
    - `LocationConfig`: `{ minDistanceMeters, updateIntervalMs, backgroundEnabled }`

  **Must NOT do**:
  - 기존 타입 파일의 기존 필드를 변경/삭제하지 말 것
  - as any를 사용하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T19
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/types/payment.ts` — 기존 타입 파일 패턴 (interface/export 구조)
  - `src/types/beta1-wallet.ts` — enum + interface 조합 패턴

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 모든 신규 타입이 tsc --noEmit 통과
    Tool: Bash
    Steps:
      1. npx tsc --noEmit — 0 new errors
      2. grep -c "as any" src/types/map.ts src/types/dispute.ts src/types/deposit.ts src/types/location.ts — 모두 0
    Expected Result: 컴파일 성공, as any 0건
    Evidence: .sisyphus/evidence/task-2-type-definitions.txt
  ```

  **Commit**: YES (groups with T1, T3-T6)

- [ ] 3. 관리자 대시보드 통합 경고/에러 패널

  **What to do**:
  - `admin-web/app/(admin)/components/GlobalAlertPanel.tsx` 생성:
    - API 호출 실패 시 상단에 빨간 배너 표시 ("대시보드 데이터 로딩 실패. 다시 시도하세요.")
    - 엔드포인트별 로딩 상태 표시 (dashboard API, beta1-infrastructure, beta1-ai-review)
    - "다시 시도" 버튼으로 데이터 재로드
  - `admin-web/app/(admin)/dashboard/page.tsx` 수정:
    - 기존 3개 API fetch에 에러 상태 수집
    - GlobalAlertPanel 컴포넌트를 페이지 상단에 렌더링
    - 에러 시 메트릭 카드에 "데이터 없음" 상태 표시 (빈/제로 방지)

  **Must NOT do**:
  - 기존 메트릭 카드 구조/스타일을 변경하지 말 것
  - 새로운 API 엔드포인트를 만들지 말 것

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `admin-web/app/(admin)/dashboard/page.tsx` — 기존 대시보드 (fetch 구조, 에러 처리 방식, AlertRow 컴포넌트 패턴)
  - `admin-web/app/(admin)/layout.tsx` — 관리자 레이아웃 구조

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: API 실패 시 경고 배너 표시
    Tool: Bash (npx tsc --noEmit + 구조 확인)
    Preconditions: None
    Steps:
      1. npx tsc --noEmit --project admin-web/tsconfig.json — 0 errors
      2. GlobalAlertPanel.tsx export 존재 확인
      3. dashboard/page.tsx에 GlobalAlertPanel import 확인
      4. dashboard/page.tsx에 "다시 시도" 관련 로직 존재 확인 (retry 또는 refetch)
    Expected Result: 컴포넌트 생성됨, 대시보드에 통합됨
    Evidence: .sisyphus/evidence/task-3-dashboard-alerts.txt
  ```

  **Commit**: YES (groups with T1, T2, T4-T6)

- [ ] 4. 구독 티어 Firestore Config 마이그레이션

  **What to do**:
  - `src/services/business-contract-service.ts` 수정:
    - `SUBSCRIPTION_TIERS` 상수 배열을 Firestore `config_subscription_tiers` 컬렉션에서 동적 조회로 변경
    - `getSubscriptionTiers()` → Firestore read + 캐싱
    - 기존 상수를 fallback으로 유지 (Firestore에 데이터 없을 때)
  - `src/config/subscription-tiers.ts` — 기본 티어 정의 (fallback)
  - Firestore seed 스크립트 또는 문서에 `config_subscription_tiers` 컬렉션 구조 명시

  **Must NOT do**:
  - 기존 `subscribeToTier()` 함수 시그니처를 변경하지 말 것
  - 화면 컴포넌트를 수정하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/services/business-contract-service.ts:SUBSCRIPTION_TIERS` — 현재 하드코딩된 티어 배열
  - `src/services/b2b-firestore-service.ts` — Firestore 캐싱 패턴 참고

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 하드코딩된 상수가 fallback으로 유지되고 Firestore 조회가 추가됨
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "SUBSCRIPTION_TIERS" src/services/business-contract-service.ts — fallback으로만 사용됨
      3. grep "config_subscription_tiers" src/services/business-contract-service.ts — Firestore 조회 존재
    Expected Result: 상수가 fallback, Firestore 조회 추가됨
    Evidence: .sisyphus/evidence/task-4-subscription-tiers.txt
  ```

  **Commit**: YES (groups with T1-T3, T5-T6)

- [ ] 5. admin-web 공유 타입 boundary 생성

  **What to do**:
  - `admin-web/types/index.ts` — 공유 타입 파일 생성:
    - 관리자 API 응답 타입 (DashboardMetrics, DisputeSummary, DepositSummary 등)
    - `admin-web/app/api/admin/disputes/route.ts` 응답 타입 추출
    - `admin-web/app/api/admin/deposits/route.ts` 응답 타입 추출
    - `admin-web/app/api/admin/dashboard/route.ts` 응답 타입 추출
  - 기존 API 라우트에서 응답 타입을 `admin-web/types`에서 import하도록 변경

  **Must NOT do**:
  - admin-web의 기존 동작을 변경하지 말 것
  - src/ 타입을 admin-web으로 복사하지 말 것 (독립적 정의)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T9, T10, T15
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `admin-web/app/api/admin/disputes/route.ts` — disputes API 응답 구조
  - `admin-web/app/api/admin/deposits/route.ts` — deposits API 응답 구조
  - `admin-web/app/api/admin/dashboard/route.ts` — dashboard API 응답 구조

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 타입 파일 생성 및 API 라우트에서 import
    Tool: Bash
    Steps:
      1. npx tsc --noEmit --project admin-web/tsconfig.json
      2. test -f admin-web/types/index.ts — 파일 존재
    Expected Result: 컴파일 성공, 타입 파일 존재
    Evidence: .sisyphus/evidence/task-5-admin-types.txt
  ```

  **Commit**: YES (groups with T1-T4, T6)

- [ ] 6. B2B 세율 UI 명확화 (10% vs 3.3%)

  **What to do**:
  - `src/screens/b2b/TaxInvoiceRequestScreen.tsx` 수정:
    - 세금 항목에 "(부가세 10%)" 명시 라벨 추가
    - "원천징수 3.3%는 별도 정산에서 공제됩니다" 안내 문구 추가
  - `src/screens/main/EarningsScreen.tsx` 확인/수정:
    - 기존 3.3% 표시에 "(사업소득 원천징수)" 라벨 명확화
  - 두 세율의 차이를 설명하는 간단한 info tooltip 또는 footnote 추가

  **Must NOT do**:
  - 세율 계산 로직을 변경하지 말 것 (표시만 명확화)
  - 새로운 화면을 만들지 말 것

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`clarify`]
    - `clarify`: UX 카피 명확화 목적

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T19
  - **Blocked By**: T2

  **References**:

  **Pattern References**:
  - `src/screens/b2b/TaxInvoiceRequestScreen.tsx:93-100` — 현재 10% 세금 계산 UI
  - `src/screens/main/EarningsScreen.tsx:29-35` — TAX_GUIDE, 3.3% 표시
  - `src/constants/settlementPolicy.ts` — combinedWithholdingLabel: "사업소득 원천징수 3.3%"
  - `src/types/tax-invoice.ts:TAX_RATE` — 0.1 (10%)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 세금계산서 화면에 부가세 10% 라벨 표시
    Tool: Bash (grep)
    Steps:
      1. grep -n "부가세" src/screens/b2b/TaxInvoiceRequestScreen.tsx — 매치 존재
      2. grep -n "원천징수" src/screens/b2b/TaxInvoiceRequestScreen.tsx — 안내 문구 존재
    Expected Result: 두 라벨 모두 표시됨
    Evidence: .sisyphus/evidence/task-6-tax-rate-labels.txt
  ```

  **Commit**: YES (groups with T1-T5)

- [ ] 7. LockerMapScreen Naver Maps 마이그레이션

  **What to do**:
  - `src/screens/main/LockerMapScreen.tsx` 수정:
    - 기존 canvas mini-map을 `NaverMapView` 컴포넌트로 교체
    - 사물함 위치를 Naver Maps 마커로 표시 (`LockerMarker` 사용)
    - 사용자 현재 위치 표시 (`showsUserLocation`)
    - 사물함 마커 탭 시 사물함 상세 카드 표시 (기존 동작 유지)
    - 거리 계산은 유지하되 지도에서 직선 거리 + 도보 경로 표시
  - `src/data/lockers/` 또는 Firestore에서 사물함 좌표 데이터 매핑

  **Must NOT do**:
  - 기존 사물함 목록/상세 화면 네비게이션을 변경하지 말 것
  - `SubwayMapVisualizer.tsx`를 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`, `adapt`]
    - `frontend-design`: 지도 UI 디자인
    - `adapt`: 모바일/웹 반응형 지도

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T8-T13)
  - **Blocks**: T14
  - **Blocked By**: T1, T2

  **References**:

  **Pattern References**:
  - `src/screens/main/LockerMapScreen.tsx` — 현재 사물함 지도 화면 전체 (교체 대상)
  - `src/components/map/NaverMapView.tsx` — T1에서 생성한 지도 컴포넌트
  - `src/components/map/LockerMarker.tsx` — T1에서 생성한 마커
  - `src/types/map.ts` — T2에서 생성한 지도 타입

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: NaverMapView가 LockerMapScreen에 통합됨
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "NaverMapView" src/screens/main/LockerMapScreen.tsx — import 확인
      3. 기존 canvas/mapCanvas 관련 코드가 제거되었는지 확인
    Expected Result: NaverMapView 통합, 기존 placeholder 제거
    Evidence: .sisyphus/evidence/task-7-locker-map-migration.txt

  Scenario: 사물함 마커 데이터가 올바른 타입으로 매핑됨
    Tool: Bash
    Steps:
      1. grep "LockerMarker\|markers" src/screens/main/LockerMapScreen.tsx — 마커 사용 확인
    Expected Result: 마커에 coordinate (위도/경도) 포함
    Evidence: .sisyphus/evidence/task-7-locker-markers.txt
  ```

  **Commit**: YES (groups with T8-T13)
  - Message: `feat(map): migrate LockerMapScreen to Naver Maps`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 8. 실제 GPS 위치 서비스 (mock 교체)

  **What to do**:
  - `src/services/location-service.ts` 생성:
    - `startLocationUpdates(userId, deliveryId)` — Expo Location으로 GPS 위치 가져오기
    - `stopLocationUpdates()` — 위치 추적 중지
    - `getCurrentPosition()` — 단발 위치 조회
    - 권한 요청 로직 (foreground + background)
    - Firestore `deliveries/{deliveryId}/location` 에 실시간 위치 업데이트
  - `src/services/realtime-delivery-tracking.ts` 수정:
    - mock `getCurrentLocation()`을 `LocationService.getCurrentPosition()`으로 교체
    - `startLocationUpdates` → `LocationService.startLocationUpdates` 위임
    - 배터리 최적화: 이동 중에만 업데이트 (속도 임계값)
  - `app.json`에 Expo Location plugin 설정

  **Must NOT do**:
  - `RealtimeSubwayService.ts`를 변경하지 말 것 (지하철 API는 별개)
  - 기존 Firestore onSnapshot 구독을 변경하지 말 것 (위치 데이터만 교체)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T14
  - **Blocked By**: T2

  **References**:

  **Pattern References**:
  - `src/services/realtime-delivery-tracking.ts:getCurrentLocation()` — 교체 대상 mock 함수
  - `src/services/realtime-delivery-tracking.ts:startLocationUpdates` — 교체 대상
  - `src/types/location.ts` — T2에서 생성한 위치 타입

  **External References**:
  - Expo Location docs: https://docs.expo.dev/versions/latest/sdk/location/
  - expo-location `requestForegroundPermissionsAsync`, `requestBackgroundPermissionsAsync`

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: mock 위치 함수가 실제 LocationService로 교체됨
    Tool: Bash (grep)
    Steps:
      1. grep "getCurrentLocation" src/services/realtime-delivery-tracking.ts — LocationService 참조 확인
      2. grep "mock\|simulate\|fake" src/services/location-service.ts — mock 코드 없음
    Expected Result: mock 참조 제거, LocationService 사용
    Evidence: .sisyphus/evidence/task-8-gps-service.txt

  Scenario: 위치 서비스가 Firestore에 위치 업데이트
    Tool: Bash (grep)
    Steps:
      1. grep "firestore\|doc\|update" src/services/location-service.ts — Firestore 쓰기 확인
      2. grep "latitude\|longitude" src/services/location-service.ts — 좌표 사용 확인
    Expected Result: Firestore 위치 업데이트 로직 존재
    Evidence: .sisyphus/evidence/task-8-firestore-update.txt
  ```

  **Commit**: YES (groups with T7, T9-T13)

- [ ] 9. 관리자 분쟁 관리 UI 페이지

  **What to do**:
  - `admin-web/app/(admin)/disputes/page.tsx` 생성/수정:
    - 분쟁 목록 테이블 (상태 필터: pending/resolved/rejected, 날짜, 사용자)
    - 각 행: 분쟁 ID, 사용자, 유형, 상태, 생성일, "상세" 버튼
    - 상세 모달/페이지: 분쟁 사유, 관련 배송, 증거, 대화 내역
    - 관리자 조치: "해결" 버튼 → 책임자 선택, 보상 금액, 메모 입력 → PATCH /api/admin/disputes
    - 해결 후 상태 업데이트 (resolved/rejected)
  - `admin-web/app/(admin)/disputes/[disputeId]/page.tsx` (선택: 상세 페이지)

  **Must NOT do**:
  - 기존 `/api/admin/disputes` API를 변경하지 말 것
  - 기존 관리자 레이아웃/스타일 시스템을 위반하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`, `harden`]
    - `frontend-design`: 관리자 UI 디자인
    - `harden`: 에러 상태, 빈 상태 처리

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T15
  - **Blocked By**: T2, T5

  **References**:

  **Pattern References**:
  - `admin-web/app/api/admin/disputes/route.ts` — GET (목록), PATCH (해결) API
    - GET: status 쿼리 파라미터로 필터링
    - PATCH: disputeId, responsibility, compensation, note
  - `admin-web/app/(admin)/points/withdrawals/page.tsx` — 유일한 완전한 관리자 액션 UI (패턴 참고: 모달, 테이블, 액션 버튼)
  - `admin-web/app/(admin)/dashboard/page.tsx` — pendingDisputes 지표 (클릭 시 disputes 페이지로 이동하도록 수정 가능)
  - `admin-web/types/index.ts` — T5에서 생성한 타입

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 분쟁 목록 페이지가 API에서 데이터를 가져와 렌더링
    Tool: Bash
    Steps:
      1. npx tsc --noEmit --project admin-web/tsconfig.json
      2. grep "GET.*disputes\|fetchDisputes" admin-web/app/(admin)/disputes/page.tsx — API 호출 확인
      3. grep "PATCH.*disputes\|resolveDispute" admin-web/app/(admin)/disputes/page.tsx — 해결 액션 확인
    Expected Result: 목록 + 해결 액션 UI 구현
    Evidence: .sisyphus/evidence/task-9-admin-disputes.txt
  ```

  **Commit**: YES (groups with T7, T8, T10-T13)
  - Message: `feat(admin): add disputes management UI page`

- [ ] 10. 관리자 보증금 관리 UI 페이지

  **What to do**:
  - `admin-web/app/(admin)/deposits/page.tsx` 생성/수정:
    - 보증금 목록 테이블 (상태 필터: paid/refunded/deducted)
    - 각 행: 보증금 ID, 사용자, 금액, 배송 ID, 상태, "상세" 버튼
    - 상세 모달: 결제 내역, 환불/공제 이력
    - 관리자 조치: "환불" 버튼 → 포인트 환불 + 상태 업데이트 / "공제" 버튼 → 보증금 공제
    - PATCH /api/admin/deposits 호출
  - 대시보드의 보증금 관련 지표와 링크

  **Must NOT do**:
  - 기존 `/api/admin/deposits` API를 변경하지 말 것
  - `src/services/DepositService.ts`를 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`, `harden`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T15
  - **Blocked By**: T2, T5

  **References**:

  **Pattern References**:
  - `admin-web/app/api/admin/deposits/route.ts` — GET (목록), PATCH (refund/deduct) API
    - GET: status 쿼리 파라미터
    - PATCH: depositId, action ('refund' | 'deduct')
  - `admin-web/app/(admin)/points/withdrawals/page.tsx` — 관리자 액션 UI 패턴 (모달, 승인/반려)
  - `src/services/DepositService.ts` — 보증금 서비스 구조 이해용
  - `src/services/deposit-compensation-service.ts` — 환불/공제 로직 이해용

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 보증금 목록 + 환불/공제 액션 UI
    Tool: Bash
    Steps:
      1. npx tsc --noEmit --project admin-web/tsconfig.json
      2. grep "GET.*deposits\|fetchDeposits" admin-web/app/(admin)/deposits/page.tsx
      3. grep "refund\|deduct" admin-web/app/(admin)/deposits/page.tsx — 액션 버튼 확인
    Expected Result: 목록 + 환불/공제 액션
    Evidence: .sisyphus/evidence/task-10-admin-deposits.txt
  ```

  **Commit**: YES (groups with T7-T9, T11-T13)
  - Message: `feat(admin): add deposits management UI page`

- [ ] 11. 앱 취소→분쟁 CTA + 채팅 분쟁 신고 버튼

  **What to do**:
  - `src/screens/main/RequestDetailScreen.tsx` 수정:
    - 취소 차단 시 Alert 대신, "취소할 수 없습니다" 안내 + **"분쟁 신고하기" 버튼** 추가
    - 버튼 탭 시 `navigation.navigate('DisputeReport', { requestId, deliveryId })`
  - `src/screens/main/RequestsScreen.tsx` 수정:
    - 취소 차단 메시지에 "분쟁 접수" CTA 추가 (RequestDetail과 동일 패턴)
  - `src/screens/main/ChatScreen.tsx` 수정:
    - 채팅 화면 상단 또는 하단에 **"분쟁 신고" 버튼** 추가
    - 탭 시 DisputeReportScreen으로 이동 (현재 채팅의 requestId/deliveryId pre-fill)
  - `src/screens/main/DisputeReportScreen.tsx` 확인:
    - route params에서 requestId/deliveryId를 수신하도록 확인/수정

  **Must NOT do**:
  - 취소 가능 상태(PENDING/MATCHED)의 기존 취소 버튼을 변경하지 말 것
  - 기존 분쟁 제출 로직을 변경하지 말 것 (네비게이션만 추가)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`frontend-design`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T12
  - **Blocked By**: T2

  **References**:

  **Pattern References**:
  - `src/screens/main/RequestDetailScreen.tsx:355-376` — 기존 취소 버튼 (상태 조건부)
  - `src/screens/main/RequestDetailScreen.tsx:156-174` — 취소 차단 Alert 메시지
  - `src/screens/main/RequestsScreen.tsx:69-76` — 목록에서 취소 차단
  - `src/screens/main/RequestsScreen.tsx:73-75` — "채팅 또는 분쟁 접수" 안내 텍스트
  - `src/screens/main/ChatScreen.tsx` — 채팅 UI (분쟁 버튼 추가 위치)
  - `src/screens/main/DisputeReportScreen.tsx:34-193` — 분쟁 제기 화면 (route params 확인)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 취소 차단 시 분쟁 CTA가 표시됨
    Tool: Bash (grep)
    Steps:
      1. grep "DisputeReport\|분쟁 신고" src/screens/main/RequestDetailScreen.tsx — CTA 존재
      2. grep "DisputeReport\|분쟁" src/screens/main/RequestsScreen.tsx — CTA 존재
      3. grep "DisputeReport\|분쟁 신고" src/screens/main/ChatScreen.tsx — 버튼 존재
    Expected Result: 3개 파일 모두에 분쟁 네비게이션 추가됨
    Evidence: .sisyphus/evidence/task-11-cancel-dispute-cta.txt
  ```

  **Commit**: YES (groups with T7-T10, T12-T13)
  - Message: `feat(app): add cancel-to-dispute CTAs and chat escalation button`

- [ ] 12. 취소 완료 결과 요약 카드

  **What to do**:
  - 취소 완료 후 보증금/패널티 결과를 보여주는 요약 컴포넌트:
    - `src/components/cancel/CancelResultCard.tsx` 생성
    - 표시 항목: 취소 상태, 보증금 환불 여부/금액, 패널티 적용 여부/금액, 다음 단계 안내
  - `src/screens/main/RequestDetailScreen.tsx`에 통합:
    - cancelDeliveryFlow 응답의 depositStatus, penaltyStatus를 CancelResultCard에 전달
  - `src/screens/main/RequestsScreen.tsx`에도 동일 통합

  **Must NOT do**:
  - 취소 로직 자체를 변경하지 말 것
  - 새로운 화면(별도 route)을 만들지 말 것 (인라인 카드)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: T2, T11

  **References**:

  **Pattern References**:
  - `src/services/delivery-service.ts` cancelDeliveryFlow 반환값 — depositStatus, penaltyStatus
  - `src/screens/main/RequestDetailScreen.tsx` — 취소 후 UI 위치
  - `src/services/penalty-service.ts` — 패널티 정보 구조

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: CancelResultCard가 보증금/패널티 상태를 표시
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "CancelResultCard" src/screens/main/RequestDetailScreen.tsx — 통합 확인
      3. grep "depositStatus\|penaltyStatus" src/components/cancel/CancelResultCard.tsx — 데이터 표시 확인
    Expected Result: 카드 컴포넌트 생성 및 통합
    Evidence: .sisyphus/evidence/task-12-cancel-result-card.txt
  ```

  **Commit**: YES (groups with T7-T11, T13)
  - Message: `feat(app): add cancel completion summary card`

- [ ] 13. src/services 타입 정리 배치 1

  **What to do**:
  - `src/services/request-service.ts` — `as any` 7건 제거:
    - 각 `as any`를 구체적인 타입으로 교체
    - Firebase 문서 응답 → Firestore DocumentData 대신 명시적 인터페이스
  - `src/services/kakao-auth.ts` — `as any` 6건 제거:
    - Kakao SDK 응답 타입 정의
    - OAuth 토큰/사용자 프로필 타입 구체화
  - 타입 정의가 필요한 경우 `src/types/`에 추가

  **Must NOT do**:
  - 함수 시그니처를 변경하지 말 것 (파라미터/반환값 타입만 구체화)
  - 기존 동작을 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16
  - **Blocked By**: T2

  **References**:

  **Pattern References**:
  - `src/services/request-service.ts` — as any 7건 (각 라인 확인 필요)
  - `src/services/kakao-auth.ts` — as any 6건 (Kakao SDK 응답)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: request-service.ts와 kakao-auth.ts에서 as any 제거
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep -c "as any" src/services/request-service.ts — 0
      3. grep -c "as any" src/services/kakao-auth.ts — 0
    Expected Result: 두 파일 모두 as any 0건, 컴파일 성공
    Evidence: .sisyphus/evidence/task-13-type-cleanup-batch1.txt
  ```

  **Commit**: YES (groups with T7-T12)
  - Message: `refactor(types): remove as any from request-service and kakao-auth`

- [ ] 14. 배송 추적 화면 Naver Maps + 실제 GPS 통합

  **What to do**:
  - `src/screens/main/DeliveryTrackingScreen.tsx` 수정:
    - 기존 합성 ETA UI를 Naver Maps 기반 지도로 교체
    - 길러 실시간 위치를 지도에 마커로 표시 (Firestore onSnapshot 구독 유지)
    - 출발지/목적지 역 마커 표시
    - 배송 경로 라인 표시 (지하철 노선 경로 → 지도 polyline)
    - ETA 정보를 지도 위 오버레이로 표시
  - `src/screens/main/RealtimeTrackingScreen.tsx`와 통합 고려:
    - 두 화면의 기능을 하나로 합치거나 명확히 분리
  - 지하철 실시간 도착 정보를 지도 상에 표시

  **Must NOT do**:
  - `RealtimeSubwayService.ts`를 변경하지 말 것
  - 기존 배송 상태 표시 UI를 완전히 제거하지 말 것 (지도 + 상태 모두 표시)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`, `adapt`, `animate`]
    - `frontend-design`: 지도 + 추적 UI
    - `adapt`: 모바일/웹 반응형 지도
    - `animate`: 위치 마커 애니메이션 (부드러운 이동)

  **Parallelization**:
  - **Can Run In Parallel**: NO (의존관계)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T7, T8

  **References**:

  **Pattern References**:
  - `src/screens/main/DeliveryTrackingScreen.tsx` — 기존 추적 화면 (교체 대상)
  - `src/screens/main/RealtimeTrackingScreen.tsx` — 실시간 UI (통합 고려)
  - `src/components/map/NaverMapView.tsx` — T1 지도 컴포넌트
  - `src/services/realtime-delivery-tracking.ts` — T8에서 GPS 교체된 위치 서비스
  - `src/services/RealtimeSubwayService.ts` — 지하철 실시간 데이터 (그대로 사용)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: DeliveryTrackingScreen이 NaverMapView를 사용함
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "NaverMapView" src/screens/main/DeliveryTrackingScreen.tsx — 지도 통합 확인
      3. grep "onSnapshot\|realtime" src/screens/main/DeliveryTrackingScreen.tsx — 실시간 구독 유지 확인
    Expected Result: Naver Maps + 실시간 위치 표시
    Evidence: .sisyphus/evidence/task-14-delivery-tracking-map.txt
  ```

  **Commit**: YES (groups with T15-T19)
  - Message: `feat(map): integrate Naver Maps into delivery tracking screen`

- [ ] 15. 관리자 정산 체크리스트 통합 뷰

  **What to do**:
  - `admin-web/app/(admin)/settlements/checklist/page.tsx` 생성:
    - 운영자가 정산 전 확인해야 할 항목 통합:
      - 분쟁 중 건수 (pending disputes count)
      - 미해결 패널티 건수
      - 미환불 보증금 건수
      - 출금 대기 건수
      - 수동 보류 계정 수
    - 각 항목을 클릭하면 대응 관리 페이지로 이동 (disputes, deposits, withdrawals)
    - "정산 처리 가능" / "정산 보류 필요" 상태 배너
  - `admin-web/app/(admin)/settlements/page.tsx`에 체크리스트 링크 추가

  **Must NOT do**:
  - 기존 정산 API를 변경하지 말 것
  - `SettlementService.ts`를 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`, `harden`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T9, T10

  **References**:

  **Pattern References**:
  - `admin-web/app/(admin)/settlements/page.tsx` — 기존 정산 페이지
  - `admin-web/app/api/admin/dashboard/route.ts` — pendingDisputes 등 지표
  - `admin-web/app/(admin)/disputes/page.tsx` — T9에서 생성한 분쟁 UI
  - `admin-web/app/(admin)/deposits/page.tsx` — T10에서 생성한 보증금 UI
  - `admin-web/app/(admin)/points/withdrawals/page.tsx` — 출금 관리 UI
  - `src/types/beta1-wallet.ts:WithdrawalEligibilityStatus` — 출금 차단 사유 enum

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 체크리스트 페이지에 모든 운영 항목이 표시됨
    Tool: Bash
    Steps:
      1. npx tsc --noEmit --project admin-web/tsconfig.json
      2. grep "dispute\|deposit\|withdrawal\|penalty" admin-web/app/(admin)/settlements/checklist/page.tsx — 모든 항목 언급
    Expected Result: 5개 이상 운영 항목 표시 + 대응 페이지 링크
    Evidence: .sisyphus/evidence/task-15-settlement-checklist.txt
  ```

  **Commit**: YES (groups with T14, T16-T19)
  - Message: `feat(admin): add settlement checklist consolidated view`

- [ ] 16. src/services 타입 정리 배치 2

  **What to do**:
  - `src/services/BadgeService.ts` — `as any` 5건 제거
  - `src/services/fare-service.ts` — `as any` 5건 제거
  - `src/services/delivery-service.ts` — `as any` 3건 제거
  - `src/services/SettlementService.ts` — `as any` 3건 제거
  - `src/services/deposit-compensation-service.ts` — `as any` 2건 제거
  - `src/services/chat-service.ts` — `as any` 2건 제거
  - `src/services/media-service.ts` — `as any` 1건 제거
  - 타입 정의가 필요한 경우 `src/types/`에 추가
  - T13의 패턴을 따라: 구체적 인터페이스로 교체

  **Must NOT do**:
  - 함수 시그니처 변경하지 말 것
  - 기존 동작 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T17
  - **Blocked By**: T13

  **References**:

  **Pattern References**:
  - T13 완료 후의 `src/services/request-service.ts` — 타입 정리 패턴 참고

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 배치 2 파일에서 as any 전부 제거
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep -c "as any" src/services/BadgeService.ts src/services/fare-service.ts src/services/delivery-service.ts src/services/SettlementService.ts src/services/deposit-compensation-service.ts src/services/chat-service.ts src/services/media-service.ts — 모두 0
    Expected Result: 7개 파일 모두 as any 0건
    Evidence: .sisyphus/evidence/task-16-type-cleanup-batch2.txt
  ```

  **Commit**: YES (groups with T14, T15, T17-T19)
  - Message: `refactor(types): remove as any from remaining services (batch 2)`

- [ ] 17. LSP 에러 수정

  **What to do**:
  - `src/screens/b2b/B2BRequestScreen.tsx:78,84` — `latitude` does not exist in `Location`:
    - `Location` 타입에 `latitude`/`longitude` 필드 추가 또는 올바른 타입 사용
  - `src/screens/auth/LoginScreen.tsx:39` — hook dependency `loadSavedEmail`:
    - useEffect/useState dependency array에 `loadSavedEmail` 추가
  - `src/screens/b2b/B2BDashboardScreen.tsx:64` — hook dependency `loadDashboardData`:
    - dependency array 수정
  - `src/services/b2b-giller-service.ts:122` — private `calculateNextEvaluation`:
    - 메서드를 public으로 변경하거나 호출을 public 메서드로 라우팅
  - `src/screens/auth/NewSignUpScreen.tsx:225,322` — User 타입 에러 + ViewStyle 에러:
    - `user` 프로퍼티 접근 수정, `width: string`을 숫자로 변경

  **Must NOT do**:
  - 관련 없는 파일을 수정하지 말 것
  - 기존 동작을 변경하지 말 것

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T16

  **References**:

  **Pattern References**:
  - 각 파일의 해당 라인 (LSP 에러 메시지에 명시된 line:col)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 모든 LSP 에러가 해결됨
    Tool: Bash
    Steps:
      1. npx tsc --noEmit — 0 errors (또는 기존 에러 수보다 감소)
    Expected Result: 지적된 5개 파일의 에러 해결
    Evidence: .sisyphus/evidence/task-17-lsp-fixes.txt
  ```

  **Commit**: YES (groups with T14, T15, T16, T18, T19)
  - Message: `fix: resolve LSP errors in B2BRequest, Login, B2BDashboard, and SignUp screens`

- [ ] 18. SubwayMapVisualizer 지리 좌표 보강

  **What to do**:
  - `src/components/subway/SubwayMapVisualizer.tsx` 수정:
    - 각 역 SVG 좌표에 실제 위도/경도 메타데이터 추가
    - `onStationPress` 콜백에 위도/경도 포함
    - NaverMapView와 SubwayMapVisualizer 간 좌표 매핑 유틸 추가
  - `src/utils/map-coordinate-mapping.ts` — SVG 좌표 → 지리 좌표 변환

  **Must NOT do**:
  - 기존 SVG 렌더링을 변경하지 말 것
  - 노선도 시각화를 Naver Maps로 대체하지 말 것 (보완)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T1

  **References**:

  **Pattern References**:
  - `src/components/subway/SubwayMapVisualizer.tsx` — 기존 SVG 역 좌표
  - `docs/data/station-and-fare-data.md` — 역 데이터 (위도/경도 포함 가능)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 역에 지리 좌표 메타데이터 추가됨
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "latitude\|longitude\|coordinate" src/components/subway/SubwayMapVisualizer.tsx — 지리 데이터 존재
    Expected Result: 역 데이터에 좌표 포함
    Evidence: .sisyphus/evidence/task-18-subway-coordinates.txt
  ```

  **Commit**: YES (groups with T14-T17, T19)

- [ ] 19. B2B NTS/Hometax API 연동 레이어

  **What to do**:
  - `src/services/external-tax-service.ts` 생성:
    - `issueTaxInvoiceToNTS(invoiceData)` — 세금계산서 외부 전송 (스텁 구현)
    - `getTaxInvoiceStatus(invoiceId)` — 전송 상태 조회
    - `verifyBusinessRegistration(businessNumber)` — 사업자등록번호 진위확인
  - 스텁 구현:
    - 실제 NTS/Hometax API 호출 대신 mock 함수로 구현
    - `// TODO: Replace with actual NTS/Hometax API call` 주석
    - 인터페이스와 반환 타입은 실제 API 명세에 맞게 정의
  - `src/services/tax-invoice-service.ts` 수정:
    - `issueTaxInvoice` 후 `externalTaxService.issueTaxInvoiceToNTS` 호출 추가 (선택적)
    - 외부 전송 상태를 Firestore에 기록
  - `src/types/external-tax.ts` — NTS/Hometax API 관련 타입

  **Must NOT do**:
  - 실제 NTS/Hometax API를 호출하지 말 것 (스텁만)
  - API 자격증명을 코드에 포함하지 말 것
  - 기존 tax-invoice-service의 내부 문서 생성 로직을 변경하지 말 것 (외부 전송만 추가)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: T2, T6

  **References**:

  **Pattern References**:
  - `src/services/tax-invoice-service.ts:issueTaxInvoice` — 기존 세금계산서 발행 로직
  - `src/types/tax-invoice.ts` — 기존 세금계산서 타입
  - `src/screens/b2b/TaxInvoiceRequestScreen.tsx` — UI 호출부

  **External References**:
  - NTS 홈택스 세금계산서 API: https://www.etax.or.kr/ (API 명세 참고용)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: 외부 세금 서비스 스텁이 정상 동작
    Tool: Bash
    Steps:
      1. npx tsc --noEmit
      2. grep "TODO.*NTS\|TODO.*Hometax\|TODO.*external" src/services/external-tax-service.ts — 스텁 마크 존재
      3. grep "issueTaxInvoiceToNTS\|getTaxInvoiceStatus" src/services/tax-invoice-service.ts — 호출부 추가 확인
    Expected Result: 스텁 구현 + 기존 서비스에 통합
    Evidence: .sisyphus/evidence/task-19-external-tax-stub.txt
  ```

  **Commit**: YES (groups with T14-T18)
  - Message: `feat(b2b): add NTS/Hometax external tax API integration layer (stub)`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` in both admin-web/ and root. Run linter. Check for: `as any`, `@ts-ignore`, console.log in prod, commented-out code, unused imports. Check AI slop patterns.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | as any [N remaining] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: compare "What to do" vs actual diff. Verify 1:1 compliance. Check "Must NOT do". Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1 complete**: `feat: add naver maps sdk and foundation types` — T1-T6 files, npx tsc --noEmit
- **Wave 2 complete**: `feat: implement map screens, admin dispute/deposit UI, cancel-dispute UX` — T7-T13 files, npx tsc --noEmit
- **Wave 3 complete**: `feat: integrate delivery tracking, type cleanup, external tax API layer` — T14-T19 files, npx tsc --noEmit

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit          # Expected: 0 errors (admin-web + src)
npx tsc --noEmit --project admin-web/tsconfig.json  # Expected: 0 errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Naver Maps renders with station/locker markers
- [ ] Real GPS updates flow through Firestore
- [ ] Cancel→dispute flow is 1-2 taps from blocked state
- [ ] Admin can resolve disputes and manage deposits from UI
- [ ] B2B tax rates clearly labeled (10% vs 3.3%)
- [ ] `as any` count in src/services is 0
- [ ] Dashboard shows consolidated warnings/errors
