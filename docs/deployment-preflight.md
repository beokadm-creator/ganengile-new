# Deployment Preflight

`precedence`: 65  
`required-for`: deploy, env, release-check  
`optional-for`: admin-web, maps  
`memory-type`: runbook  
`token-estimate`: 260

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- 배포 전에는 앱, 관리자 웹, Functions, Firestore 설정을 함께 확인한다.
- 지도 관련 변경은 프론트 env와 Functions 자격 증명을 한 세트로 확인한다.
- 실패 시에는 먼저 환경 변수, 프록시 응답, 권한 구성을 점검한다.

## [STATIC] Required Env
- 앱: `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`, 지도 관련 `EXPO_PUBLIC_*`
- Functions: `NAVER_MAP_CLIENT_ID`, `NAVER_MAP_CLIENT_SECRET`
- 관리자 웹: Firebase 프로젝트/리전과 관리자 인증 설정
- 기본 리전: `us-central1`

## [STATIC] Checks
- 지도 화면과 프록시 응답 확인
- 관리자 운영 화면과 연동 설정 확인
- 환불/보증금/정산/출금 민감 구간 확인
- TypeScript 빌드와 필요한 앱 실행 명령 확인

## [DYNAMIC] Current Focus
- beta1 기준에서는 관리자 설정, 요금 캐시, 지도 프록시 검증이 중요하다.

## Changelog
- 2026-04-02: 배포 점검 문서를 환경 변수와 핵심 검증 포인트 위주로 정리.
