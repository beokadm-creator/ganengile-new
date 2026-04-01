# Ops Shared Context

`precedence`: 86  
`required-for`: deploy, env, ops-check  
`optional-for`: admin-web, incident-review  
`memory-type`: runbook  
`token-estimate`: 180

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 운영 문서는 실제 배포 전 확인 항목만 남긴다.
- 환경 변수 이름, 배포 지역, 검증 명령은 `[STATIC]`에 둔다.
- 최신 배포 상태나 이슈는 `[DYNAMIC]`에 둔다.

## [STATIC] Defaults
- 기본 확인 범위: 앱, 관리자 웹, Functions, Firestore rules/indexes.
- 지도 계열 변경은 프론트 env와 Functions secret을 함께 확인한다.
- 운영 문서는 재현 가능한 명령과 실패 시 확인 포인트를 짝으로 기록한다.

## [DYNAMIC] Current Focus
- beta1 관련 관리자 설정과 지도 프록시가 현재 운영 체크의 핵심이다.

## Changelog
- 2026-04-02: 운영 문서 공통 규칙 분리.
