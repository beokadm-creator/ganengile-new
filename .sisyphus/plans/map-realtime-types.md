# 가는길에: 지도 확장 + 실시간 위치 + 타입 경계 + 서비스 정리

## TL;DR

> **Quick Summary**: Naver Maps SDK를 앱에 연결하고, mock GPS를 실제 Expo Location으로 교체한 뒤 지도 마커 + 지하철 실시간 ETA를 통합합니다. 동시에 admin-web/functions 타입 경계를 정리하고, src/services의 as any 33건을 제거하며, 발견된 퀵픽스(LSP 에러 6건, 네비게이션 끊김 2건)를 수정합니다.
> 
> **Deliverables**:
> - Naver Maps SDK가 통합된 지도 화면 3개 (LockerMapScreen, DeliveryTrackingScreen, RealtimeTrackingScreen)
> - 실제 GPS 기반 실시간 위치 추적 + 지도 마커 + 지하철 ETA
> - tsc --noEmit 통과하는 admin-web + functions
> - 공유 타입 boundary (src/types → admin-web/functions)
> - as any 제거된 서비스 레이어
> - 재생성된 docs/core/architecture.md, docs/admin/admin-web.md
> 
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1(퀵픽스) → Task 2(Naver Maps setup) → Task 7(지도 화면) → Task 10(실시간 통합) → Final Verification

---

## Context

### Original Request
맵을 붙이고 여러 기능을 추가한 후 현재 로직을 판단하고, 4대 과업(운영 대시보드 타입 경계, 지도 확장, 실시간 위치 고도화, 서비스 레이어 warning 정리)을 중심으로 개편 필요 부분을 확인하여 개선.

### Interview Summary
**Key Discussions**:
- 지도 SDK: Naver Maps SDK 선정 (한국 최적화, 지하철 역 표현 우수)
- 실시간 위치 범위: GPS 실제 연결 + 지도 마커 + 지하철 실시간 ETA (전체 고도화 제외)
- 대시보드 타입 경계: 3단계 모두 포함 (admin-web tsc + fare-cache 타입 + 공유 타입 boundary)
- 서비스 분할: 나중으로 연기
- 테스트: Tests-after (인프라 존재: jest, .test.ts 파일)
- 문서: 필수 문서만 (architecture.md + admin-web.md)

**Research Findings**:
- 지도 SDK 전무 — StaticMapPreview(이미지 URL 기반)과 LockerLocator만 존재
- naverStaticMapProxy CF 함수는 이미 존재 (서버 사이드 정적 지도 프록시)
- LSP 에러 6건 (Location 타입, private 접근, Hook deps 등)
- 네비게이션 끊김 2건 (navigate('Profile') → navigate('Tabs', { screen: 'Profile' }))
- src/services as any 33건 (8개 파일 집중)
- fare-cache-scheduler.ts FareApiItem = Record<string, any>
- docs/core/*, docs/flows/*, docs/admin/admin-web.md 누락
- 67개 서비스 파일, 순환 의존성 없음
- admin-web 타입 깨끗 (strict: true, as any 0건)

---

## Work Objectives

### Core Objective
Naver Maps SDK를 연결하여 실제 지도 기반 UX를 제공하고, 타입 안전성을 확보하여 프로덕션 배포 준비 상태로 만든다.

### Concrete Deliverables
- Naver Maps SDK가 설치되고 설정된 프로젝트
- 3개 화면에 실제 지도 렌더링 (사물함 지도, 배송 추적, 실시간 추적)
- Expo Location API로 GPS 실제 위치 획득
- 지도 위에 실시간 마커 + 지하철 ETA 표시
- `tsc --noEmit`이 admin-web과 functions에서 모두 통과
- src/types에 공유 타입 boundary 정의
- src/services에 as any 0건
- docs/core/architecture.md 재생성
- docs/admin/admin-web.md 재생성

### Definition of Done
- [ ] `npx tsc --noEmit` (admin-web) → 0 errors
- [ ] `npx tsc --noEmit` (functions) → 0 errors
- [ ] `npx tsc --noEmit` (root) → 0 errors (or only pre-existing non-critical warnings)
- [ ] grep -r "as any" src/services/ → 0 matches
- [ ] Naver Maps가 3개 화면에서 실제 렌더링
- [ ] GPS 위치가 실제 기기에서 수집됨
- [ ] 지도 마커가 배송 위치에 표시됨

### Must Have
- Naver Maps SDK가 web/iOS/Android에서 모두 작동
- 기존 StaticMapPreview 기능이 Naver Maps로 대체되면서 레이아웃 유지
- Naver Maps API 키가 .env에 관리되고 코드에 노출되지 않음
- Expo Location API가 적절한 권한 요청 후 동작
- 기존 지도 관련 데이터(subway-stations.ts, travel-times.ts)가 새 지도와 호환
- 타입 변경이 기존 API 계약을 깨뜨리지 않음

### Must NOT Have (Guardrails)
- ❌ 기존 화면 레이아웃을 대규모 변경하지 않음 (지도 영역만 교체)
- ❌ 새로운 외부 라이브러리를 Naver Maps + Expo Location 외에 추가하지 않음
- ❌ 서비스 파일 분할을 수행하지 않음 (이번 범위 제외)
- ❌ docs/flows/*, docs/ops/*, docs/data/*를 생성하지 않음
- ❌ 취소→분쟁 UX 연결을 변경하지 않음
- ❌ B2B 구독 티어 하드코딩을 수정하지 않음
- ❌ AI 슬롭 패턴: 불필요한 JSDoc, 과도한 추상화, generic 네이밍(data/result/item)
- ❌ console.log 프로덕션 코드에 추가
- ❌ `// @ts-ignore` 또는 `// @ts-expect-error`로 에러 숨기기

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (jest in root/functions, .test.ts files in src/services/)
- **Automated tests**: YES (Tests-after)
- **Framework**: jest
- **Approach**: 구현 후 타입 체크 + 기존 테스트 통과 확인. 새 테스트는 타입 계약 검증에 집중.

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Use interactive_bash (tmux) — Run command, send keystrokes, validate output
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Type Safety**: Use Bash (npx tsc --noEmit) — Compile check

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 퀵픽스 + 기초 설정):
├── Task 1: LSP 에러 6건 수정 [quick]
├── Task 2: 네비게이션 끊김 2건 수정 [quick]
├── Task 3: Naver Maps SDK 설치 + 설정 [quick]
├── Task 4: Expo Location API 설치 + 설정 [quick]
├── Task 5: 공유 타입 boundary 스캐폴딩 [quick]
├── Task 6: docs/core/architecture.md 재생성 [writing]
└── Task 7: src/types 공유 타입 정의 [quick]

Wave 2 (After Wave 1 — 지도 통합 + 타입 정리):
├── Task 8: LockerMapScreen Naver Maps 적용 [visual-engineering]
├── Task 9: DeliveryTrackingScreen Naver Maps 적용 [visual-engineering]
├── Task 10: RealtimeTrackingScreen Naver Maps 적용 [visual-engineering]
├── Task 11: GPS 실제 위치 연결 (Expo Location) [deep]
├── Task 12: src/services as any 제거 그룹 A (request, kakao, badge) [unspecified-high]
├── Task 13: src/services as any 제거 그룹 B (fare, delivery, settlement, deposit, chat) [unspecified-high]
├── Task 14: fare-cache-scheduler 타입 정리 [unspecified-high]
└── Task 15: admin-web tsc 통과 보장 [quick]

Wave 3 (After Wave 2 — 통합 + 고도화):
├── Task 16: 지도 마커 + 실시간 위치 결합 [deep]
├── Task 17: 지하철 실시간 ETA + 지도 통합 [deep]
├── Task 18: 공유 타입 boundary 연결 (admin-web ↔ src/types ↔ functions) [unspecified-high]
├── Task 19: docs/admin/admin-web.md 재생성 [writing]
├── Task 20: StaticMapPreview 레거시 정리 [quick]
└── Task 21: tsc 전체 통과 검증 [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan Compliance Audit (oracle)
├── Task F2: Code Quality Review (unspecified-high)
├── Task F3: Real Manual QA (unspecified-high)
└── Task F4: Scope Fidelity Check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1+T2 → T3+T4 → T8+T9+T10 → T11 → T16 → T17 → T21 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 7 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 21 | 1 |
| 2 | — | — | 1 |
| 3 | — | 8, 9, 10 | 1 |
| 4 | — | 11 | 1 |
| 5 | — | 7, 18 | 1 |
| 6 | — | — | 1 |
| 7 | 5 | 18 | 1 |
| 8 | 3 | 16 | 2 |
| 9 | 3 | 16 | 2 |
| 10 | 3 | 16, 17 | 2 |
| 11 | 4, 10 | 16, 17 | 2 |
| 12 | — | 21 | 2 |
| 13 | — | 21 | 2 |
| 14 | — | 21 | 2 |
| 15 | — | 21 | 2 |
| 16 | 8, 9, 10, 11 | 17, 21 | 3 |
| 17 | 10, 11, 16 | 21 | 3 |
| 18 | 7 | 21 | 3 |
| 19 | — | — | 3 |
| 20 | 8, 9, 10 | — | 3 |
| 21 | 1, 12, 13, 14, 15, 16, 17, 18 | F1-F4 | 3 |

### Agent Dispatch Summary

| Wave | Tasks | Dispatch |
|------|-------|----------|
| 1 | 7 | T1,T2 → `quick`, T3,T4 → `quick`, T5 → `quick`, T6 → `writing`, T7 → `quick` |
| 2 | 8 | T8,T9,T10 → `visual-engineering`, T11 → `deep`, T12,T13 → `unspecified-high`, T14 → `unspecified-high`, T15 → `quick` |
| 3 | 6 | T16 → `deep`, T17 → `deep`, T18 → `unspecified-high`, T19 → `writing`, T20 → `quick`, T21 → `quick` |
| FINAL | 4 | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval.**

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `jest` for all 3 workspaces. Review all changed files for `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute QA scenarios from map tasks (3 screens render, GPS works, markers show). Test type safety tasks (tsc passes all 3 workspaces). Test navigation fixes (Profile reachable from GillerApply/LevelUpgrade). Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(app): resolve LSP errors and navigation breaks` — 4 files
- **Wave 2a**: `feat(map): integrate Naver Maps SDK` — map files
- **Wave 2b**: `fix(types): remove as any from service layer` — 8 service files
- **Wave 3a**: `feat(realtime): integrate GPS and subway ETA with map` — tracking files
- **Wave 3b**: `feat(types): establish shared type boundary` — types + admin-web
- **Wave 3c**: `docs: restore architecture and admin-web documentation` — docs files

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit --project admin-web/tsconfig.json     # Expected: 0 errors
npx tsc --noEmit --project functions/tsconfig.json       # Expected: 0 errors
npx tsc --noEmit                                          # Expected: 0 errors (root)
grep -r "as any" src/services/                            # Expected: 0 matches
grep -r "navigate('Profile')" src/screens/                # Expected: 0 matches
npm test                                                 # Expected: all pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] tsc --noEmit clean in all 3 workspaces
- [ ] Naver Maps renders on 3 screens
- [ ] GPS provides real location
- [ ] Evidence files exist in .sisyphus/evidence/
