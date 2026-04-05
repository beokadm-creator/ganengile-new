# CI/CD 파이프라인 가이드

`precedence`: 70
`required-for`: deploy, ci, release-check
`optional-for`: dev, code-review
`memory-type`: runbook
`token-estimate`: 400

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- CI/CD는 4개 GitHub Actions 워크플로우로 구성된다.
- 관리자 웹은 Firebase App Hosting이 main push 시 자동 배포한다.
- 앱(EAS Build)은 main/develop push 또는 수동 트리거로 빌드된다.
- Firebase 배포는 workflow_dispatch로 수동 실행한다.
- PR 머지 시 Firestore rules/functions 자동 배포가 설정되어 있다.

## [STATIC] 워크플로우 구성

### 1. CI — `ci.yml`
**트리거**: `push`(main, develop), `pull_request`(main, develop)

| 단계 | 내용 | 실패 시 |
|------|------|---------|
| Lint & Type Check | ESLint + `tsc --noEmit` | PR 머지 차단 |
| Test | `npm test` | PR 머지 차단 |
| Build Check | `npm run web -- --no-dev --minify` | PR 머지 차단 |

### 2. EAS Build — `eas-build.yml`
**트리거**: `push`(main, develop), `tags(v*)`, `workflow_dispatch`

| 단계 | 내용 |
|------|------|
| Install | `npm ci --legacy-peer-deps` |
| Build | `eas build --platform {platform} --profile {profile} --non-interactive` |

수동 실행 시 `platform`(all/ios/android)과 `profile`(production/preview) 선택 가능.

### 3. Firebase 배포 — `deploy-firebase.yml`
**트리거**: `workflow_dispatch` (수동 전용)

| 옵션 | 설명 |
|------|------|
| `target` | firestore / hosting / functions / all |
| `environment` | production / staging |

필수 Secret: `FIREBASE_SERVICE_ACCOUNT` (Firebase Admin SDK JSON)

### 4. PR 머지 자동 배포 — `deploy-on-merge.yml`
**트리거**: `push`(main 브랜치)

| 단계 | 조건 | 내용 |
|------|------|------|
| Firestore rules | 항상 | `firebase deploy --only firestore:rules` |
| Functions | `functions/` 변경 시 | `firebase deploy --only functions` |
| Hosting | `src/` 또는 `public/` 변경 시 | `firebase deploy --only hosting` |
| Pre-flight check | 배포 성공 후 | `scripts/pre-flight-check.sh` |

### 5. Firebase App Hosting (관리자 웹)
**자동 배포**: main 브랜치 push 시 Firebase App Hosting이 자동 감지하여 배포

| 항목 | 값 |
|------|------|
| Backend ID | `ganengile-admin` |
| Root Dir | `admin-web` |
| Region | `us-central1` |
| URL | `https://ganengile-admin--ganengile.us-central1.hosted.app` |

## [STATIC] 배포 순서 (PR 머지 시)

```
1. CI 통과 확인 (PR 상태 체크)
2. main으로 머지
3. Firebase App Hosting 자동 감지 → 관리자 웹 배포
4. deploy-on-merge 워크플로우 실행:
   a. Firestore rules 배포
   b. Functions 빌드 + 배포 (변경 시)
   c. Hosting 배포 (변경 시)
   d. Pre-flight check 실행
5. EAS Build 실행 (태그 push 또는 수동)
```

## [STATIC] 필수 GitHub Secrets

| Secret | 용도 | 설정법 |
|--------|------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin SDK 인증 | Firebase 콘솔 → 서비스 계정 키 JSON |
| `EXPO_TOKEN` | EAS Build 인증 | Expo 계정 → Access Token |
| `GITHUB_TOKEN` | 자동 생성 (Actions) | 별도 설정 불필요 |

## [STATIC] 로컬 배포 명령

```bash
# Firestore rules만 배포
firebase deploy --only firestore:rules --project ganengile

# Functions만 배포
firebase deploy --only functions --project ganengile

# Hosting(웹앱)만 배포
npm run web:deploy

# 전체 배포
firebase deploy --project ganengile

# EAS 빌드 (프로덕션)
eas build --platform all --profile production

# 배포 전 체크리스트
bash scripts/pre-flight-check.sh
```

## [DYNAMIC] Current Status
- CI 파이프라인: 활성화 완료
- 관리자 웹: App Hosting 자동 배포 동작 중
- EAS Build: main/develop push 시 자동
- PR 머지 자동 배포: 신규 추가

## Changelog
- 2026-04-06: CI/CD 파이프라인 가이드 최초 작성. 4개 워크플로우 구조, 배포 순서, 필수 Secrets 정리.
