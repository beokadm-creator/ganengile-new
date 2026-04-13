# 배포 & 환경변수 (Deployment & Env)

`precedence`: 70  
`required-for`: deploy, env, local-run  
`optional-for`: code-change, ci  
`memory-type`: runbook  
`token-estimate`: 420

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- 환경변수의 “진실”은 `.env.example`이며, 배포 전에는 **앱/관리자/Functions** 3영역을 분리해 확인한다.
- 앱(Expo)은 `EXPO_PUBLIC_*`가 번들에 포함될 수 있다 → 비밀키는 Functions로만 둔다.
- 지도/주소/요금 API는 프록시(Functions) URL과 서버 시크릿을 한 세트로 맞춘다.

## [STATIC] Source Of Truth
- 템플릿: `../.env.example`
- 배포 전 점검: `../docs/deployment-preflight.md`

## [STATIC] 앱(Expo) — 주요 Env
> 원칙: 앱에서 쓰는 값은 `EXPO_PUBLIC_*`로만 둔다.

### Firebase (Public)
- `EXPO_PUBLIC_FIREBASE_*`
- `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`

### OAuth / Verification (Public)
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (+ secret은 앱에 넣지 않는 것을 권장)
- `EXPO_PUBLIC_KAKAO_APP_KEY`
- `EXPO_PUBLIC_PASS_VERIFY_URL`
- `EXPO_PUBLIC_KAKAO_VERIFY_URL`

### Maps (Public)
- `EXPO_PUBLIC_MAP_PROVIDER`
- `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`
- `EXPO_PUBLIC_NAVER_STATIC_MAP_PROXY_URL`
- `EXPO_PUBLIC_NAVER_GEOCODE_PROXY_URL`
- `EXPO_PUBLIC_NAVER_DIRECTIONS_PROXY_URL`

### Public transport / fare APIs (Public)
- `EXPO_PUBLIC_SEOUL_FARE_API_URL`
- `EXPO_PUBLIC_SEOUL_FARE_SERVICE_KEY` (가능하면 프록시로 숨기는 것을 권장)

## [STATIC] Functions (Server-only secrets)
> 원칙: 비밀키/서버 인증은 Functions에만 둔다.

- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`
- `JUSO_API_KEY`
- `SEOUL_FARE_SERVICE_KEY` (서버에서 호출/캐시하는 경우)

## [STATIC] 관리자 웹(admin-web)
- 기본적으로 Firebase 프로젝트/리전/인증 설정이 필요하다.
- App Hosting 사용 시(현재 가이드 기준) 환경변수는 App Hosting 설정에 반영한다.
- 자세한 운영 포인트는 `../../admin-web/README.md` 참고.

## [DYNAMIC] TODO / 확인 필요(실제 배포 환경 기준)
- 관리자 웹에서 사용하는 env 키 목록(Next.js runtime/public 구분) 확정
- 요금/락커 API 키를 앱 번들에서 제거하고 Functions 프록시로만 운용하는지 정책 확정

## Changelog
- 2026-04-13: `.env.example` 기반으로 “앱/Functions/관리자” 3영역 env 정리를 문서화.
