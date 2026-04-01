# Test Current Changes Plan

`precedence`: 60  
`required-for`: current-change-test, sisyphus-plans  
`optional-for`: release-check  
`memory-type`: plan  
`token-estimate`: 210

@include docs/_shared/ai-doc-governance.md
@include .sisyphus/_shared/workflow-rules.md

## Essential (Post-Compact)
- 이 문서는 현재 수정분 검증 계획 요약이다.
- 빌드, 타입, 관리자 기능, 주요 화면 흐름을 우선 검증한다.

## [STATIC] Verification Scope
- TypeScript/빌드 성공 여부
- 관리자 신규 화면과 API 응답
- 주요 앱 화면의 연결 상태
- 증적 파일과 결과 요약 정리

## [DYNAMIC] Current Hint
- 세부 증적은 `.sisyphus/evidence/`를 확인한다.

## Changelog
- 2026-04-02: 테스트 계획 문서를 검증 범위 중심으로 축약.
