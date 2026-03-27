# Plan 1: 현재 수정사항 테스트 및 커밋

## TL;DR

> **Quick Summary**: 로컬 수정사항 27개 파일을 테스트 후 커밋합니다. 신규 통합 기능(Identity, Fare Cache, Payment), API 라우트, 앱 화면 25개를 전체 기능 테스트로 검증합니다.
>
> **Deliverables**:
> - 신규 어드민 페이지 3개 (Identity, Fare Cache, Payment) 테스트 및 커밋
> - API 라우트 2개 테스트 완료
> - 앱 화면 25개 연결 테스트 완료
> - 빌드/TypeScript/Lint 통과 확인
> - 깃 커밋 완료
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Build check → Admin tests → App tests → Final commit

---

## Context

### Original Request
사용자가 웹 어드민 개선 계획을 요청하던 중, 현재 로컬에 있는 27개 수정사항(신규 통합 기능 + 앱 개선)을 발견하고 테스트 후 커밋을 원함

### Interview Summary
**Key Discussions**:
- 현재 로컬과 원격 커밋은 동일하지만 Working Directory에 27개 수정사항 존재
- 대부분 완성된 수정사항 (신규 통합 기능, useGillerAccess hook, 앱 화면 연결)
- 테스트 범위: 전체 기능 테스트

**Research Findings**:
- 신규 통합 기능: Identity (PASS/Kakao auth), Fare Cache, Payment 관리
- API 라우트: GET/PATCH 지원, Firestore 저장 (admin_settings + config_integrations)
- 앱 개선: 길러 접근 권한 로직 통합 (useGillerAccess hook)

### Metis Review
Metis 응답 타임아웃으로 진행 없음. 제 분석으로 진행

---

## Work Objectives

### Core Objective
로컬 수정사항 27개 파일의 기능을 전면 테스트하고, 안정적으로 커밋하여 원격 저장소에 반영

### Concrete Deliverables
- `.sisyphus/evidence/` 하위 테스트 증적 파일들
- 깃 커밋 메시지와 변경사항
- 테스트 결과 리포트

### Definition of Done
- [ ] TypeScript 빌드 통과 (`tsc --noEmit`)
- [ ] ESLint 통과 (admin-web 전체)
- [ ] 신규 어드민 페이지 3개 기능 동작 확인
- [ ] API 라우트 2개 응답 확인
- [ ] 앱 화면 25개 빌드 및 라우팅 확인
- [ ] 테스트 증적 파일 캡처
- [ ] 깃 커밋 완료

### Must Have
- 빌드 오류 없어야 함
- TypeScript 타입 에러 없어야 함
- 신규 기능 기본 동작 확인
- API 엔드포인트 응답 확인

### Must NOT Have (Guardrails)
- 테스트를 건너뛰고 바로 커밋 금지
- 에러를 무시하고 커밋 금지
- 불안정한 기능 포함 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Next.js test infrastructure)
- **Automated tests**: NO (Functional testing via agent execution)
- **Framework**: None (Direct agent testing with Playwright/Curl/Bun)

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Admin Pages**: Playwright - Navigate, fill forms, submit, assert DOM
- **API Routes**: Bash (curl) - Send requests, parse JSON, assert fields
- **App Build**: Bash (bun) - Build command, check exit code
- **TypeScript/Lint**: Bash - Run tsc, eslint, check output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Build & Type Check):
├── Task 1: TypeScript Build Check [quick]
└── Task 2: ESLint Check (admin-web) [quick]

Wave 2 (After Wave 1 — Admin Integration Pages):
├── Task 3: Identity Integration Page Test [unspecified-high]
├── Task 4: Fare Cache Page Test [unspecified-high]
└── Task 5: Payment Integration Page Test [unspecified-high]

Wave 3 (After Wave 2 — API Routes):
├── Task 6: Identity API Route Test [quick]
└── Task 7: Payment API Route Test [quick]

Wave 4 (After Wave 3 — App Screens):
├── Task 8: App Build Verification [quick]
└── Task 9: Key App Screen Routing Test [unspecified-high]

Wave FINAL (After ALL tasks — Git Commit):
├── Task F1: Git Status & Diff Review [quick]
└── Task F2: Git Commit with Message [git-master]

Critical Path: Task 1 → Task 2 → Task 3-5 → Task 6-7 → Task 8-9 → F1 → F2
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Wave 2)
```

### Dependency Matrix

- **1-2**: — — 3-7, 2
- **3-5**: 1, 2 — 6, 2
- **6-7**: 1, 2 — 8, 2
- **8-9**: 1, 2 — F1, 2
- **F1**: 3-9 — F2, 1
- **F2**: F1 — —, 1

### Agent Dispatch Summary

- **1**: **2** — T1 → `quick`, T2 → `quick`
- **2**: **3** — T3 → `unspecified-high`, T4 → `unspecified-high`, T5 → `unspecified-high`
- **3**: **2** — T6 → `quick`, T7 → `quick`
- **4**: **2** — T8 → `quick`, T9 → `unspecified-high`
- **FINAL**: **2** — F1 → `git-master`, F2 → `git-master`

---

## TODOs

- [ ] 1. TypeScript Build Check

  **What to do**:
  - admin-web 디렉토리에서 TypeScript 빌드 실행
  - 타입 에러 확인
  - `tsc --noEmit` 명령어 사용

  **Must NOT do**:
  - 에러를 무시하고 진행 금지

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Simple command execution, quick verification
  - **Skills**: []
    - No specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3-9
  - **Blocked By**: None (can start immediately)

  **References**:
  **API/Type References**:
  - `admin-web/tsconfig.json` - TypeScript 설정 확인

  **External References**:
  - TypeScript CLI: `tsc --noEmit`

  **Acceptance Criteria**:
  - [ ] TypeScript build exits with code 0 (no errors)
  - [ ] No type errors in output

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: TypeScript build passes
    Tool: Bash
    Preconditions: admin-web directory exists
    Steps:
      1. cd admin-web && npx tsc --noEmit
      2. Check exit code
    Expected Result: Exit code 0, no type errors
    Failure Indicators: Non-zero exit code, type errors in output
    Evidence: .sisyphus/evidence/task-1-tsc-build.log
  ```

  **Evidence to Capture**:
  - [ ] TypeScript build output log

  **Commit**: NO (groups with other tasks)
  - Message: `fix(admin): TypeScript build check passed`

---

- [ ] 2. ESLint Check (admin-web)

  **What to do**:
  - admin-web 디렉토리에서 ESLint 실행
  - 린트 에러/경고 확인
  - `npm run lint` 또는 `npx eslint` 사용

  **Must NOT do**:
  - 에러를 무시하고 진행 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple command execution
  - **Skills**: []
    - No specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3-9
  - **Blocked By**: None (can start immediately)

  **References**:
  **API/Type References**:
  - `admin-web/eslint.config.mjs` - ESLint 설정 확인

  **Acceptance Criteria**:
  - [ ] ESLint exits with no errors
  - [ ] Warnings acceptable if documented

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: ESLint passes
    Tool: Bash
    Preconditions: admin-web directory exists
    Steps:
      1. cd admin-web && npm run lint
      2. Check exit code and output
    Expected Result: Exit code 0, no ESLint errors
    Failure Indicators: Non-zero exit code, ESLint errors
    Evidence: .sisyphus/evidence/task-2-eslint.log
  ```

  **Evidence to Capture**:
  - [ ] ESLint output log

  **Commit**: NO (groups with other tasks)
  - Message: `fix(admin): ESLint check passed`

---

- [ ] 3. Identity Integration Page Test

  **What to do**:
  - Identity 통합 페이지 로드 확인
  - PASS/Kakao 설정 폼 동작 테스트
  - 테스트 모드 토글 확인
  - 저장 기능 동작 확인

  **Must NOT do**:
  - 실제 API 호출로 인증 테스트 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: UI interaction and form testing
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for form testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4, 5)
  - **Blocks**: Task 6-7
  - **Blocked By**: Task 1, 2 (build/lint must pass)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/integrations/identity/page.tsx` - Identity 페이지 구조

  **API/Type References**:
  - `admin-web/app/api/admin/integrations/identity/route.ts` - API 엔드포인트

  **Acceptance Criteria**:
  - [ ] Page loads successfully
  - [ ] Test mode toggle works
  - [ ] PASS form fields render
  - [ ] Kakao form fields render
  - [ ] Save button triggers API call

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Identity page loads and renders forms
    Tool: Playwright
    Preconditions: admin-web dev server running on localhost:3000
    Steps:
      1. Navigate to http://localhost:3000/integrations/identity
      2. Wait for page load
      3. Assert "CI 인증 연동 설정" heading exists
      4. Assert test mode toggle exists
      5. Assert PASS form section exists
      6. Assert Kakao form section exists
      7. Assert save button exists
    Expected Result: All elements present and visible
    Failure Indicators: Missing elements, page not loading
    Evidence: .sisyphus/evidence/task-3-identity-load.png

  Scenario: Test mode toggle works
    Tool: Playwright
    Preconditions: On identity page
    Steps:
      1. Click test mode toggle
      2. Assert label changes from "테스트 모드" to "라이브"
      3. Click toggle again
      4. Assert label changes back to "테스트 모드"
    Expected Result: Toggle works, label updates correctly
    Failure Indicators: Toggle not responsive, label not updating
    Evidence: .sisyphus/evidence/task-3-identity-toggle.png

  Scenario: Save button triggers API call
    Tool: Playwright + Bash (curl monitoring)
    Preconditions: On identity page, API monitor running
    Steps:
      1. Fill test mode toggle (checked)
      2. Click "설정 저장" button
      3. Wait 2 seconds
      4. Check API logs for PATCH /api/admin/integrations/identity
    Expected Result: PATCH request sent to API
    Failure Indicators: No API call, button disabled
    Evidence: .sisyphus/evidence/task-3-identity-save-api.log
  ```

  **Evidence to Capture**:
  - [ ] Page load screenshot
  - [ ] Toggle test screenshot
  - [ ] API call log

  **Commit**: NO (groups with other tasks)
  - Message: `fix(admin): Identity integration page tested`

---

- [ ] 4. Fare Cache Page Test

  **What to do**:
  - Fare Cache 페이지 로드 확인
  - 요금 캐시 관리 UI 확인
  - 기본 동작 확인

  **Must NOT do**:
  - 실제 캐시 데이터 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: UI interaction testing
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for UI testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3, 5)
  - **Blocks**: Task 6-7
  - **Blocked By**: Task 1, 2 (build/lint must pass)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/integrations/identity/page.tsx` - Similar structure reference

  **API/Type References**:
  - `admin-web/app/(admin)/integrations/fare-cache/page.tsx` - Fare Cache 페이지

  **Acceptance Criteria**:
  - [ ] Page loads successfully
  - [ ] Cache management UI renders
  - [ ] Basic controls work

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Fare Cache page loads
    Tool: Playwright
    Preconditions: admin-web dev server running
    Steps:
      1. Navigate to http://localhost:3000/integrations/fare-cache
      2. Wait for page load
      3. Assert heading exists
      4. Assert cache table/list exists
      5. Assert refresh/clear buttons exist
    Expected Result: Page loads, UI elements present
    Failure Indicators: Page not loading, missing elements
    Evidence: .sisyphus/evidence/task-4-fare-cache-load.png

  Scenario: Cache controls work
    Tool: Playwright
    Preconditions: On fare cache page
    Steps:
      1. Click refresh button
      2. Wait 1 second
      3. Click clear button (if exists)
      4. Assert action feedback shown
    Expected Result: Buttons respond, UI updates
    Failure Indicators: No button response
    Evidence: .sisyphus/evidence/task-4-fare-cache-controls.png
  ```

  **Evidence to Capture**:
  - [ ] Page load screenshot
  - [ ] Controls test screenshot

  **Commit**: NO (groups with other tasks)
  - Message: `fix(admin): Fare cache page tested`

---

- [ ] 5. Payment Integration Page Test

  **What to do**:
  - Payment Integration 페이지 로드 확인
  - 결제 연동 설정 UI 확인
  - 기본 동작 확인

  **Must NOT do**:
  - 실제 결제 설정 저장 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: UI interaction testing
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for UI testing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3, 4)
  - **Blocks**: Task 6-7
  - **Blocked By**: Task 1, 2 (build/lint must pass)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/integrations/identity/page.tsx` - Similar structure reference

  **API/Type References**:
  - `admin-web/app/(admin)/integrations/payment/page.tsx` - Payment 페이지

  **Acceptance Criteria**:
  - [ ] Page loads successfully
  - [ ] Payment config UI renders
  - [ ] Basic controls work

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Payment page loads
    Tool: Playwright
    Preconditions: admin-web dev server running
    Steps:
      1. Navigate to http://localhost:3000/integrations/payment
      2. Wait for page load
      3. Assert heading exists
      4. Assert config forms exist
      5. Assert save button exists
    Expected Result: Page loads, UI elements present
    Failure Indicators: Page not loading, missing elements
    Evidence: .sisyphus/evidence/task-5-payment-load.png

  Scenario: Payment config form works
    Tool: Playwright
    Preconditions: On payment page
    Steps:
      1. Fill sample config field (e.g., provider name)
      2. Click save button
      3. Assert save button shows loading state
    Expected Result: Form fills, save button responds
    Failure Indicators: Form not fillable, save button not responding
    Evidence: .sisyphus/evidence/task-5-payment-form.png
  ```

  **Evidence to Capture**:
  - [ ] Page load screenshot
  - [ ] Form test screenshot

  **Commit**: NO (groups with other tasks)
  - Message: `fix(admin): Payment integration page tested`

---

- [ ] 6. Identity API Route Test

  **What to do**:
  - Identity API GET 요청 테스트
  - Identity API PATCH 요청 테스트
  - 응답 포맷 확인

  **Must NOT do**:
  - 실제 admin_settings 데이터 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple API endpoint testing
  - **Skills**: []
    - No specific skills needed (curl sufficient)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 8-9
  - **Blocked By**: Task 3 (admin page test ensures UI works)

  **References**:
  **API/Type References**:
  - `admin-web/app/api/admin/integrations/identity/route.ts` - API 엔드포인트 구현

  **Acceptance Criteria**:
  - [ ] GET /api/admin/integrations/identity returns 200
  - [ ] GET response includes testMode, pass, kakao
  - [ ] PATCH /api/admin/integrations/identity returns 200
  - [ ] PATCH updates Firestore

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: GET identity config returns data
    Tool: Bash (curl)
    Preconditions: admin-web server running
    Steps:
      1. curl -i http://localhost:3000/api/admin/integrations/identity
      2. Check status code is 200
      3. Parse JSON response
      4. Assert response has 'item' field
      5. Assert item.testMode exists
      6. Assert item.pass exists
      7. Assert item.kakao exists
    Expected Result: 200 OK, valid JSON structure
    Failure Indicators: 401 Unauthorized, 500 error, missing fields
    Evidence: .sisyphus/evidence/task-6-identity-get-response.json

  Scenario: PATCH identity config updates data
    Tool: Bash (curl)
    Preconditions: Admin auth available
    Steps:
      1. curl -X PATCH http://localhost:3000/api/admin/integrations/identity \
           -H "Content-Type: application/json" \
           -d '{"testMode":true,"pass":{"enabled":true},"kakao":{"enabled":false}}'
      2. Check status code is 200
      3. Parse response
      4. Assert response.ok is true
    Expected Result: 200 OK, response.ok = true
    Failure Indicators: 401 Unauthorized, 400 Bad Request
    Evidence: .sisyphus/evidence/task-6-identity-patch-response.json
  ```

  **Evidence to Capture**:
  - [ ] GET response JSON
  - [ ] PATCH response JSON

  **Commit**: NO (groups with other tasks)
  - Message: `test(admin): Identity API routes tested`

---

- [ ] 7. Payment API Route Test

  **What to do**:
  - Payment API GET 요청 테스트
  - Payment API PATCH 요청 테스트
  - 응답 포맷 확인

  **Must NOT do**:
  - 실제 payment_settings 데이터 수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple API endpoint testing
  - **Skills**: []
    - No specific skills needed (curl sufficient)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 8-9
  - **Blocked By**: Task 5 (admin page test ensures UI works)

  **References**:
  **API/Type References**:
  - `admin-web/app/api/admin/integrations/payment/route.ts` - API 엔드포인트 구현

  **Acceptance Criteria**:
  - [ ] GET /api/admin/integrations/payment returns 200
  - [ ] GET response includes config data
  - [ ] PATCH /api/admin/integrations/payment returns 200

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: GET payment config returns data
    Tool: Bash (curl)
    Preconditions: admin-web server running
    Steps:
      1. curl -i http://localhost:3000/api/admin/integrations/payment
      2. Check status code is 200
      3. Parse JSON response
      4. Assert response has data structure
    Expected Result: 200 OK, valid JSON
    Failure Indicators: 401 Unauthorized, 500 error
    Evidence: .sisyphus/evidence/task-7-payment-get-response.json

  Scenario: PATCH payment config works
    Tool: Bash (curl)
    Preconditions: Admin auth available
    Steps:
      1. curl -X PATCH http://localhost:3000/api/admin/integrations/payment \
           -H "Content-Type: application/json" \
           -d '{"enabled":true,"provider":"sample"}'
      2. Check status code is 200
    Expected Result: 200 OK
    Failure Indicators: 401 Unauthorized, 400 Bad Request
    Evidence: .sisyphus/evidence/task-7-payment-patch-response.json
  ```

  **Evidence to Capture**:
  - [ ] GET response JSON
  - [ ] PATCH response JSON

  **Commit**: NO (groups with other tasks)
  - Message: `test(admin): Payment API routes tested`

---

- [ ] 8. App Build Verification

  **What to do**:
  - React Native 앱 빌드 확인
  - 타입스크립트 에러 확인
  - 의존성 해결 확인

  **Must NOT do**:
  - 실제 앱 빌드/배포 금지 (로컬 빌드만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Build verification command
  - **Skills**: []
    - No specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 9)
  - **Blocks**: Task F1 (final review)
  - **Blocked By**: Task 1 (TypeScript check), Task 2 (ESLint)

  **References**:
  **API/Type References**:
  - `package.json` - Build scripts 확인

  **Acceptance Criteria**:
  - [ ] App build command completes
  - [ ] No TypeScript errors
  - [ ] No critical build errors

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: App TypeScript build passes
    Tool: Bash
    Preconditions: Root directory, node_modules installed
    Steps:
      1. npx tsc --noEmit --project tsconfig.json
      2. Check exit code
      3. Review output for errors
    Expected Result: Exit code 0, no type errors
    Failure Indicators: Non-zero exit code, type errors
    Evidence: .sisyphus/evidence/task-8-app-tsc.log

  Scenario: App dependency resolution works
    Tool: Bash
    Preconditions: Root directory
    Steps:
      1. npm run type-check || tsc --noEmit
      2. Check for import errors
    Expected Result: No import resolution errors
    Failure Indicators: "Cannot find module" errors
    Evidence: .sisyphus/evidence/task-8-deps-check.log
  ```

  **Evidence to Capture**:
  - [ ] TypeScript build log
  - [ ] Dependency check log

  **Commit**: NO (groups with other tasks)
  - Message: `test(app): App build verified`

---

- [ ] 9. Key App Screen Routing Test

  **What to do**:
  - 주요 앱 화면 라우팅 확인
  - useGillerAccess hook 동작 확인
  - Giller/Gller 역할별 화면 접근 확인

  **Must NOT do**:
  - 실제 Firebase 인증 테스트 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: App routing and hook behavior testing
  - **Skills**: []
    - Direct verification via code inspection and build

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 8)
  - **Blocks**: Task F1 (final review)
  - **Blocked By**: Task 8 (app build must pass)

  **References**:
  **Pattern References**:
  - `src/hooks/useGillerAccess.ts` - Giller 접근 훅 구조
  - `src/navigation/MainNavigator.tsx` - 메인 네비게이터

  **API/Type References**:
  - `src/types/user.ts` - User 타입 정의

  **Acceptance Criteria**:
  - [ ] useGillerAccess hook exports correct types
  - [ ] MainNavigator imports useGillerAccess
  - [ ] Giller/Gller role routing logic works

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: useGillerAccess hook compiles correctly
    Tool: Bash (tsc)
    Preconditions: src/hooks/useGillerAccess.ts exists
    Steps:
      1. npx tsc --noEmit src/hooks/useGillerAccess.ts
      2. Check for type errors
      3. Verify GillerAccessInfo interface is exported
    Expected Result: No type errors, interface exported
    Failure Indicators: Type errors, missing exports
    Evidence: .sisyphus/evidence/task-9-hook-compile.log

  Scenario: MainNavigator uses useGillerAccess
    Tool: Bash (grep)
    Preconditions: src/navigation/MainNavigator.tsx exists
    Steps:
      1. grep "useGillerAccess" src/navigation/MainNavigator.tsx
      2. Check import statement exists
      3. Check hook usage exists
    Expected Result: useGillerAccess imported and used
    Failure Indicators: Hook not imported/used
    Evidence: .sisyphus/evidence/task-9-navigator-check.log
  ```

  **Evidence to Capture**:
  - [ ] Hook compile log
  - [ ] Navigator import check log

  **Commit**: NO (groups with other tasks)
  - Message: `test(app): App routing and hook verified`

---

## Final Verification Wave (MANDATORY — after ALL tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Git Status & Diff Review** — `git-master`
  Check git status, review all 27 modified files, ensure no unintended changes. Review diff for each file category (admin pages, API routes, app screens, other). Verify file permissions and encoding.
  Output: `Files [N modified] | Admin [N] | API [N] | App [N] | Other [N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **All Test Results Review** — `unspecified-high`
  Review all evidence files (.sisyphus/evidence/). Verify:
  - TypeScript build passed (Task 1, 8)
  - ESLint passed (Task 2)
  - Admin pages load (Tasks 3, 4, 5)
  - API routes respond (Tasks 6, 7)
  - App routing works (Task 9)
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Admin [N/N] | API [N/N] | App [PASS/FAIL] | VERDICT`

- [ ] F3. **Cross-Task Integration Check** — `deep`
  Verify integration between tasks:
  - Admin pages call correct API routes
  - API routes return data expected by UI
  - App hooks used correctly in screens
  - No circular dependencies
  Output: `Integration [CLEAN/N issues] | Dependencies [CLEAN] | VERDICT`

- [ ] F4. **User Acceptance Criteria Check** — `deep`
  Verify against user's requirements:
  - Full functionality testing completed
  - All 27 modified files tested
  - Ready for commit
  Output: `Requirements [N/N met] | Commit Ready [YES/NO] | VERDICT`

---

## Commit Strategy

- **1-9**: NO (defer to final)
- **F1-F4**: NO (verification only)
- **Final**: `feat: Add admin integrations (Identity, Fare Cache, Payment) + app improvements`
  - Files: All 27 modified files
  - Pre-commit: All tests pass, evidence files reviewed

---

## Success Criteria

### Verification Commands
```bash
# Build checks
cd admin-web && npx tsc --noEmit
cd admin-web && npm run lint
npx tsc --noEmit

# Git status
git status
git diff --stat
```

### Final Checklist
- [ ] TypeScript build passes (admin-web + app)
- [ ] ESLint passes (admin-web)
- [ ] All admin pages load
- [ ] All API routes respond
- [ ] App build succeeds
- [ ] All evidence files captured
- [ ] Git commit created
