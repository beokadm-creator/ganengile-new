# 작업자/에이전트 인수인계 (Handoff)

`precedence`: 70  
`required-for`: onboarding, repo-navigation  
`optional-for`: code-change, docs-change  
`memory-type`: runbook  
`token-estimate`: 380

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 문서 시작점: `docs/README.md` → 그다음 `README.md`/`CLAUDE.md`.
- 실행 진입점은 3개: 앱(Expo), 관리자 웹(Next.js), Functions(Firebase).
- 운영/배포 작업은 `docs/deployment-preflight.md`를 “항상” 같이 본다.

## [STATIC] Read Order (권장)
1. `docs/README.md` (문서 인덱스)
2. `README.md` (로컬 실행)
3. `CLAUDE.md` (작업 규칙)
4. 작업 목적에 따라:
   - 배포/운영: `docs/deployment-preflight.md`, `docs/ops/*`
   - 회원/온보딩: `docs/USER-ENTRY-FLOW-STANDARD.md`
   - CI/CD: `docs/ops/cicd-pipeline-guide.md`

## [STATIC] Local Run (빠른 실행)

### 앱(Expo / RN Web)
```bash
npm install
npm run web
```

### 관리자 웹(Next.js)
```bash
cd admin-web
npm install
npm run dev
```

### Functions (Emulator)
```bash
cd functions
npm install
npm run serve
```

## [STATIC] Where To Look (코드 위치 가이드)
- 앱:
  - 진입: `App.tsx`, `index.ts`, `index.web.js`
  - 공통 로직: `src/services/`, `shared/`
  - 테스트: `tests/`, `__tests__/`, `e2e/`
- 관리자:
  - Next.js App Router: `admin-web/app/`
- Functions:
  - 엔트리포인트: `functions/src/index.ts` (리팩토링 후보로 자주 언급됨)

## [DYNAMIC] Known Pitfalls
- 문서 링크가 깨져있을 수 있다 → `docs/README.md`를 기준으로 정리한다.
- 환경변수/시크릿 누락이 배포 실패 원인인 경우가 많다 → `docs/ops/deployment-and-env.md` 참고.

## Changelog
- 2026-04-13: 문서 혼재 상태를 고려해 “진입점/실행/탐색”만 최소로 정리한 인수인계 문서 추가.
