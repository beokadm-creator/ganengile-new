# Sisyphus Workflow Rules

`precedence`: 60  
`required-for`: sisyphus-plans, verification-report  
`optional-for`: retrospective  
`memory-type`: policy  
`token-estimate`: 170

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- `.sisyphus` 문서는 실행 보조 자료이며 제품 계약을 덮어쓰지 않는다.
- 계획은 작업 범위와 검증 기준만 남기고 구현 세부는 줄인다.
- 검증 보고서는 관측 사실, 갭, 후속 액션만 남긴다.

## [STATIC] Rules
- 제품 결정은 `docs/` 문서를 참조하고 여기에는 실행 관점만 기록한다.
- 오래된 파동(wave) 세부 로그는 압축하고 핵심 판단만 유지한다.
- TODO는 코드가 아니라 작업 단위 기준으로 쓴다.

## [DYNAMIC] Current Status
- 2026-04-02: 기존 계획/검증 문서를 압축형 포맷으로 전환 중.

## Changelog
- 2026-04-02: 최초 작성.
