# Playwright E2E 테스트 환경 셋업

## TL;DR

> **Quick Summary**: 프로젝트 루트에 Playwright 설치 및 설정, 브라우저 바이너리 다운로드, 앱+관리자 웹에 대한 기본 E2E 스모크 테스트 작성
>
> **Deliverables**:
> - `playwright.config.ts` — 앱 + 관리자 웹 양쪽 dev server 자동 시작 설정
> - `e2e-playwright/` — Playwright 전용 테스트 디렉토리 (기존 Detox `e2e/`는 보존)
> - 4개 스모크 테스트: 랜딩/로그인, 관리자 대시보드, 관리자 데이터 로딩, 앱 홈 화면
> - `package.json`에 `test:e2e` 스크립트 추가
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 (테스트 작성)

---

## Context

### Original Request
"테스트 전 단계 설치를 비롯한 환경을 셋업해주세요" — Playwright 런타임 검증 환경 구축

### Interview Summary
**Key Discussions**:
- 정적 분석으로 10건의 기능적 단절을 발견하고 재확인 완료 (모두 해결)
- 런타임 검증을 위해 Playwright 도입 결정
- 대상: Expo React Native Web 앱 + Next.js 관리자 웹

**Research Findings**:
- `@playwright/test` 미설치, `playwright.config.ts` 없음
- Playwright CLI v1.59.0은 `npx`로 사용 가능하지만 프로젝트 의존성 아님
- 브라우저 바이너리 전부 미설치 (chromium, firefox, webkit)
- 기존 `e2e/` 폴더는 Detox 프레임워크용 (Playwright 비호환)
- Firebase API 키 미설정으로 Firebase 연동 테스트 불가

### Metis Review
**Identified Gaps** (addressed):
- 기존 Detox `e2e/`와 분리하여 `e2e-playwright/` 디렉토리 사용 — 기존 테스트 보존
- Expo web은 `npm run web`으로 포트 8081에서 실행, admin-web은 `npm run dev`로 포트 3000에서 실행
- CI 환경에서는 webServer 자동 시작, 로컬에서는 이미 실행 중인 서버 사용하도록 구성

---

## Work Objectives

### Core Objective
Playwright 브라우저 자동화 환경을 구축하고, 앱/관리자 웹의 핵심 화면 로딩을 검증하는 스모크 테스트를 작성

### Concrete Deliverables
- `playwright.config.ts` (프로젝트 루트)
- `e2e-playwright/` 디렉토리 + 4개 테스트 파일
- `package.json`에 `test:e2e` 스크립트 추가
- 브라우저 바이너리 설치 완료

### Definition of Done
- [ ] `npx playwright test` 명령이 성공적으로 4개 테스트를 실행
- [ ] 테스트 결과가 PASS/FAIL 명확히 출력

### Must Have
- Chromium 브라우저 설치 (Firefox/WebKit은 선택사항)
- Expo 앱 dev server 자동 시작 설정
- Next.js admin dev server 자동 시작 설정
- `BASE_URL` 환경변수로 배포된 URL 테스트도 가능하도록 구성

### Must NOT Have (Guardrails)
- 기존 `e2e/` Detox 테스트 파일 수정/삭제 금지
- Firebase 실제 API 키를 테스트에 하드코딩 금지
- 테스트용 계정 생성이나 사용자 데이터 변경 금지
- production DB에 영향을 주는 쓰기 테스트 금지
- `.env` 파일 생성/수정 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: Tests-after (Playwright E2E 테스트 자체가 검증)
- **Framework**: Playwright

### QA Policy
Every task includes agent-executed QA scenarios.
- Task 1-2: `npx playwright --version` 및 브라우저 설치 확인
- Task 3-5: `npx playwright test --project=app` 또는 `--project=admin-web`로 테스트 실행

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 설치 + 설정):
├── Task 1: Playwright 의존성 설치 [quick]
├── Task 2: 브라우저 바이너리 설치 [quick]
├── Task 3: playwright.config.ts 생성 [quick]
└── Task 4: e2e-playwright/ 디렉토리 구조 생성 [quick]

Wave 2 (After Wave 1 — 테스트 작성):
├── Task 5: 앱 스모크 테스트 작성 [unspecified-high]
├── Task 6: 관리자 웹 스모크 테스트 작성 [unspecified-high]
└── Task 7: package.json 스크립트 추가 [quick]

Wave FINAL (After ALL tasks — 검증):
├── Task F1: 전체 테스트 실행 및 스크린샷 캡처 [quick]
```

### Dependency Matrix
- **1-4**: — — 5-7
- **5**: 1, 2, 3 — F1
- **6**: 1, 2, 3 — F1
- **7**: 1 — —

### Agent Dispatch Summary
- **1**: **4** — T1→`quick`, T2→`quick`, T3→`quick`, T4→`quick`
- **2**: **3** — T5→`unspecified-high`, T6→`unspecified-high`, T7→`quick`
- **FINAL**: **1** — F1→`quick`

---

## TODOs

- [ ] 1. Playwright 의존성 설치

  **What to do**:
  - 프로젝트 루트(`C:\Users\whhol\Documents\trae_projects\ganengile`)에서 `npm install -D @playwright/test` 실행
  - 설치 완료 후 `package.json` devDependencies에 `@playwright/test` 항목이 추가되었는지 확인

  **Must NOT do**:
  - 기존 `e2e/` 폴더의 Detox 관련 파일 수정 금지
  - `@playwright/test` 이외의 패키지 설치 금지
  - `.env` 파일 생성/수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: npm install 단일 명령어
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: git 작업이 아님

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 3, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - `package.json` — 현재 devDependencies에 Playwright 없음. 64-82행에 새 항목 추가됨
  - Playwright 공식 문서: `https://playwright.dev/docs/intro` — 설치 가이드

  **Acceptance Criteria**:
  - [ ] `node -e "require('@playwright/test')"` 에러 없이 완료
  - [ ] `package.json`에 `"@playwright/test"` 항목 존재

  **QA Scenarios**:
  ```
  Scenario: Playwright 모듈 로드 확인
    Tool: Bash
    Preconditions: npm install 완료
    Steps:
      1. node -e "const pw = require('@playwright/test'); console.log('OK')"
    Expected Result: stdout에 "OK" 출력
    Evidence: .sisyphus/evidence/task-1-module-load.txt

  Scenario: 이미 설치된 경우 중복 설치 확인
    Tool: Bash
    Preconditions: 이전에 이미 설치되어 있을 수 있음
    Steps:
      1. npm ls @playwright/test
    Expected Result: @playwright/test 버전번호 출력 (빨간 에러 없음)
    Evidence: .sisyphus/evidence/task-1-dependency-check.txt
  ```

  **Commit**: NO (Task 3과 묶어서 커밋)

---

- [ ] 2. 브라우저 바이너리 설치

  **What to do**:
  - `npx playwright install chromium` 실행 — Chrome for Testing 설치
  - 완료 후 `Test-Path "C:\Users\whhol\AppData\Local\ms-playwright\chromium-*"` 로 설치 확인
  - **Firefox/WebKit은 설치하지 않음** (스모크 테스트에는 Chromium만 충분)

  **Must NOT do**:
  - `npx playwright install` (전체 브라우저 설치) 실행 금지 — 시간/디스크 낭비
  - Firefox, WebKit 설치 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 install 명령어
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: F1
  - **Blocked By**: Task 1 (@playwright/test 필요)

  **References**:
  - Playwright 브라우저 설치: `https://playwright.dev/docs/browsers`
  - 설치 경로: `C:\Users\whhol\AppData\Local\ms-playwright\`

  **Acceptance Criteria**:
  - [ ] `C:\Users\whhol\AppData\Local\ms-playwright\chromium-1217` 디렉토리 존재
  - [ ] `npx playwright install --dry-run` 실행 시 chromium 항목에 체크표시

  **QA Scenarios**:
  ```
  Scenario: Chromium 바이너리 설치 확인
    Tool: Bash
    Preconditions: Task 1 완료
    Steps:
      1. Test-Path "C:\Users\whhol\AppData\Local\ms-playwright\chromium-1217"
    Expected Result: True 반환
    Evidence: .sisyphus/evidence/task-2-browser-installed.txt

  Scenario: Playwright가 브라우저를 찾을 수 있는지 확인
    Tool: Bash
    Preconditions: Task 1, 2 완료
    Steps:
      1. npx playwright install --dry-run 2>&1 | Select-String "chromium" | Select-String "Install location"
    Expected Result: 경로가 존재하는 디렉토리를 가리킴
    Evidence: .sisyphus/evidence/task-2-browser-path.txt
  ```

  **Commit**: NO (Task 1과 묶어서 커밋)

---

- [ ] 3. playwright.config.ts 생성

  **What to do**:
  - 프로젝트 루트(`C:\Users\whhol\Documents\trae_projects\ganengile\playwright.config.ts`) 생성
  - **두 개의 projects** 정의: `app` (Expo web)과 `admin-web` (Next.js)
  - `webServer` 설정으로 각 dev server를 자동 시작
  - `baseURL`은 환경변수 `APP_URL` / `ADMIN_URL`로 override 가능하도록 구성
  - 스크린샷/테스트 결과는 `e2e-playwright/results/`에 저장
  - timeout은 E2E 기준 넉넉하게 30초 설정

  **config 구조**:
  ```typescript
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './e2e-playwright',
    outputDir: './e2e-playwright/results',
    snapshotDir: './e2e-playwright/snapshots',
    timeout: 30_000,
    retries: 0,
    reporter: [['list']],
    use: {
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
    },
    projects: [
      {
        name: 'app',
        use: { baseURL: process.env.APP_URL || 'http://localhost:8081' },
        testMatch: '**/app/**/*.spec.ts',
        webServer: {
          command: 'npm run web',
          port: 8081,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      },
      {
        name: 'admin-web',
        use: { baseURL: process.env.ADMIN_URL || 'http://localhost:3000' },
        testMatch: '**/admin-web/**/*.spec.ts',
        webServer: {
          command: 'npm run dev',
          port: 3000,
          cwd: './admin-web',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      },
    ],
  });
  ```

  **Must NOT do**:
  - 기존 `e2e/detox.config.js` 수정 금지
  - Firefox/WebKit device 설정 금지 (Chromium만 사용)
  - `.env` 파일 생성/수정 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 1개 생성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6, F1
  - **Blocked By**: Task 1

  **References**:
  - Playwright config API: `https://playwright.dev/docs/api/class-testproject`
  - `package.json:9` — `"web": "expo start --web"` (포트 8081)
  - `admin-web/package.json:6` — `"dev": "next dev"` (포트 3000)

  **Acceptance Criteria**:
  - [ ] `playwright.config.ts` 파일이 프로젝트 루트에 존재
  - [ ] `npx playwright test --list` 가 에러 없이 실행됨 (테스트가 0개여도 OK)

  **QA Scenarios**:
  ```
  Scenario: 설정 파일 유효성 확인
    Tool: Bash
    Preconditions: Task 1, 3 완료
    Steps:
      1. npx playwright test --list 2>&1
    Expected Result: "No tests found" 또는 테스트 목록 출력. "Error" 또는 "Cannot find config" 없음
    Evidence: .sisyphus/evidence/task-3-config-valid.txt
  ```

  **Commit**: YES (Task 1, 2와 함께 `chore(e2e): add playwright dependency and config`)

---

- [ ] 4. e2e-playwright/ 디렉토리 구조 생성

  **What to do**:
  - 프로젝트 루트에 `e2e-playwright/` 디렉토리 생성
  - 하위 디렉토리: `app/`, `admin-web/`, `screenshots/`, `results/`
  - 각 하위 디렉토리에 `.gitkeep` 파일 생성 (빈 디렉토리 git 추적용)

  **디렉토리 구조**:
  ```
  e2e-playwright/
  ├── app/
  │   └── .gitkeep
  ├── admin-web/
  │   └── .gitkeep
  ├── screenshots/
  │   └── .gitkeep
  └── results/
      └── .gitkeep
  ```

  **Must NOT do**:
  - 기존 `e2e/` 디렉토리에 접근 금지
  - Detox 파일 수정/삭제 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mkdir 명령어만

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: None

  **References**:
  - 기존 `e2e/` 디렉토리 구조 참고 — Detox 테스트가 10개 파일 존재 (보존 대상)

  **Acceptance Criteria**:
  - [ ] `e2e-playwright/app/` 디렉토리 존재
  - [ ] `e2e-playwright/admin-web/` 디렉토리 존재

  **QA Scenarios**:
  ```
  Scenario: 디렉토리 구조 확인
    Tool: Bash
    Steps:
      1. Test-Path "e2e-playwright/app"
      2. Test-Path "e2e-playwright/admin-web"
    Expected Result: 모두 True
    Evidence: .sisyphus/evidence/task-4-dir-structure.txt
  ```

  **Commit**: NO (Task 3과 묶어서 커밋)

---

- [ ] 5. 앱 스모크 테스트 작성

  **What to do**:
  - `e2e-playwright/app/app-smoke.spec.ts` 생성
  - 2개 테스트 작성:

  **테스트 1: 랜딩 페이지 로딩**
  - Expo web 랜딩 화면(`http://localhost:8081`)에 접속
  - 페이지 제목 또는 핵심 UI 요소(가는길에 로고/텍스트)가 표시되는지 확인
  - `page.goto('/')` 후 특정 텍스트 또는 element selector 확인
  - `expect(page).toHaveTitle(/가는길에|ganengile/i)` 또는 `expect(page.locator('text=가는길에')).toBeVisible()`

  **테스트 2: 로그인 페이지 접근**
  - `navigation.navigate('Login')`에 해당하는 버튼이 있으면 클릭
  - 로그인 폼의 이메일/비밀번호 입력 필드가 보이는지 확인
  - `expect(page.locator('input[placeholder*="이메일"], input[type="email"]')).toBeVisible()`

  **주의사항**:
  - Expo web은 로딩이 느릴 수 있으므로 `waitForLoadState('networkidle')` 사용
  - Firebase API 키 없어도 정적 UI 렌더링은 가능 (로그인 폼 UI만 확인, 실제 로그인 시도 안 함)
  - 선택자는 `text=`, `role=` 기반으로 작성 (React Native Web은 testID 설정이 안 되어 있을 수 있음)

  **Must NOT do**:
  - 실제 로그인/회원가입 시도 금지 (Firebase 필요)
  - 사용자 데이터 생성/수정 금지
  - Firebase API 키를 테스트에 하드코딩 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 앱 화면 구조를 파악하고 적절한 selector를 찾아야 함
  - **Skills**: [`playwright`]
    - `playwright`: Playwright 테스트 작성에 직접 필요

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  - `src/screens/auth/LandingScreen.tsx` — 랜딩 화면. "가는길에" 텍스트, 회원가입/로그인 버튼 포함
  - `src/screens/auth/LoginScreen.tsx` — 로그인 화면. 이메일/비밀번호 입력 폼
  - `src/screens/auth/NewSignUpScreen.tsx` — 회원가입 화면
  - `src/navigation/AppNavigator.tsx` — 네비게이션 구조. 인증 안 된 경우 Auth 네비게이터 표시

  **Acceptance Criteria**:
  - [ ] `e2e-playwright/app/app-smoke.spec.ts` 파일 존재
  - [ ] 2개 describe/test 블록 존재

  **QA Scenarios**:
  ```
  Scenario: 테스트 파일이 Playwright에서 인식되는지 확인
    Tool: Bash
    Preconditions: Tasks 1-5 완료
    Steps:
      1. npx playwright test --list --project=app 2>&1
    Expected Result: 2개 테스트 목록 출력 (app-smoke.spec.ts)
    Evidence: .sisyphus/evidence/task-5-app-tests-listed.txt
  ```

  **Commit**: YES (Task 6, 7과 함께 `test(e2e): add smoke tests for app and admin-web`)

---

- [ ] 6. 관리자 웹 스모크 테스트 작성

  **What to do**:
  - `e2e-playwright/admin-web/admin-smoke.spec.ts` 생성
  - 2개 테스트 작성:

  **테스트 1: 대시보드 로딩**
  - 관리자 웹 대시보드(`http://localhost:3000`)에 접속
  - Firebase 연동이 안 되어 있으면 로그인 화면으로 리다이렉트될 수 있음
  - 로그인 화면인 경우: 로그인 폼 UI 확인 (`input[type="email"]`, `input[type="password"]` 존재)
  - 대시보드인 경우: "beta1 control tower" 텍스트 또는 지표 카드 확인

  **테스트 2: 정적 에러 없음**
  - `page.goto('/')` 후 `page.on('pageerror', ...)`로 런타임 JS 에러 캡처
  - 페이지 로딩 완료 후 `expect(pageErrors).toHaveLength(0)`

  **주의사항**:
  - 관리자 웹은 Next.js이므로 SSR 렌더링 가능
  - Firebase API 키 없어도 Next.js 화면이 렌더링됨 (빈 데이터지만 UI는 표시될 수 있음)
  - auth middleware가 있을 수 있으므로 `/login` 리다이렉트도 정상 동작으로 간주

  **Must NOT do**:
  - 관리자 로그인 시도 금지
  - API에 실제 요청 보내서 데이터 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 관리자 웹 라우팅/인증 구조를 파악해야 함
  - **Skills**: [`playwright`]
    - `playwright`: Playwright 테스트 작성에 직접 필요

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  - `admin-web/app/(admin)/dashboard/page.tsx` — 대시보드. "beta1 control tower", 지표 카드 포함
  - `admin-web/app/api/login/route.ts` — 로그인 API
  - `admin-web/app/(admin)/dashboard/page.tsx:274` — `<h1>요청, 길러, 정산, 분쟁을 한 화면에서 보는 운영 관제</h1>`
  - `admin-web/app/(admin)/dashboard/page.tsx:273` — `<p>beta1 control tower</p>`

  **Acceptance Criteria**:
  - [ ] `e2e-playwright/admin-web/admin-smoke.spec.ts` 파일 존재
  - [ ] 2개 describe/test 블록 존재

  **QA Scenarios**:
  ```
  Scenario: 테스트 파일이 Playwright에서 인식되는지 확인
    Tool: Bash
    Preconditions: Tasks 1-6 완료
    Steps:
      1. npx playwright test --list --project=admin-web 2>&1
    Expected Result: 2개 테스트 목록 출력 (admin-smoke.spec.ts)
    Evidence: .sisyphus/evidence/task-6-admin-tests-listed.txt
  ```

  **Commit**: YES (Task 5, 7과 함께 `test(e2e): add smoke tests for app and admin-web`)

---

- [ ] 7. package.json 스크립트 추가

  **What to do**:
  - 프로젝트 루트 `package.json`의 `scripts`에 다음 추가:
    ```json
    "test:e2e": "npx playwright test",
    "test:e2e:app": "npx playwright test --project=app",
    "test:e2e:admin": "npx playwright test --project=admin-web",
    "test:e2e:ui": "npx playwright test --ui"
    ```

  **Must NOT do**:
  - 기존 `test` 스크립트 수정 금지 (Jest 계속 사용)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: package.json에 4줄 추가

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6)
  - **Parallel Group**: Wave 2
  - **Blocks**: F1
  - **Blocked By**: Task 1

  **References**:
  - `package.json:14` — 기존 `"test": "jest"` 스크립트. 수정하지 말고 새 항목 추가

  **Acceptance Criteria**:
  - [ ] `npm run test:e2e -- --list` 명령이 에러 없이 실행됨

  **QA Scenarios**:
  ```
  Scenario: 스크립트 등록 확인
    Tool: Bash
    Steps:
      1. node -e "const pkg = require('./package.json'); console.log(Object.keys(pkg.scripts).filter(s => s.startsWith('test:e2e')).join(', '))"
    Expected Result: "test:e2e, test:e2e:app, test:e2e:admin, test:e2e:ui"
    Evidence: .sisyphus/evidence/task-7-scripts-registered.txt
  ```

  **Commit**: YES (Task 5, 6과 함께)

---

## Final Verification Wave

> 1개 검증 태스크. 전체 테스트 실행 후 스크린샷 캡처.

- [ ] F1. **E2E 테스트 전체 실행** — `quick`
  `npx playwright test` 실행하여 전체 테스트가 PASS하는지 확인.
  스크린샷은 `e2e-playwright/screenshots/`에 저장.
  실패 시 `e2e-playwright/test-results/`에서 trace 확인.
  Output: `Tests [N/N pass] | Screenshots captured | VERDICT: APPROVE/REJECT`

---

## Commit Strategy

- **1**: `chore(e2e): add playwright dependency and config` — playwright.config.ts, package.json
- **2**: (T1~T4 포함)
- **5-7**: `test(e2e): add smoke tests for app and admin-web` — e2e-playwright/

---

## Success Criteria

### Verification Commands
```bash
npx playwright --version           # Expected: 1.59.0
npx playwright test                # Expected: 4 passed
npx playwright test --project=app  # Expected: 2 passed
npx playwright test --project=admin-web  # Expected: 2 passed
```

### Final Checklist
- [ ] `@playwright/test`가 package.json devDependencies에 있음
- [ ] `playwright.config.ts`가 프로젝트 루트에 있음
- [ ] Chromium 브라우저가 설치되어 있음
- [ ] `npx playwright test`로 테스트가 실행됨
- [ ] 기존 `e2e/` Detox 파일이 변경되지 않음
