# beta1 Gap Fix Plan

`precedence`: 60  
`required-for`: beta1-gap-fix, sisyphus-plans  
`optional-for`: implementation-review  
`memory-type`: plan  
`token-estimate`: 230

@include docs/_shared/ai-doc-governance.md
@include .sisyphus/_shared/workflow-rules.md
@include docs/_shared/beta1-core-context.md

## Essential (Post-Compact)
- beta1 문서 대비 구현 공백을 메우는 실행 계획이다.
- 핵심 공백은 요청 생성 UX, 채팅 고도화, 운영 관제, 수령 검증, 파트너 연동이다.
- 상태 계약과 기존 AI 파이프라인은 가급적 유지한다.

## [STATIC] Fix Scope
- 요청 생성 흐름을 beta1 UX와 맞춘다.
- 운영 관제와 AI 검토 UI를 강화한다.
- 게스트/수령인 채널과 OTP 검증을 보완한다.
- mock 기반 연결은 실제 데이터 흐름으로 전환한다.

## [DYNAMIC] Current Priority
- 사용자 요청 생성과 운영 관제의 연결 구간이 가장 중요하다.

## Changelog
- 2026-04-02: 공백 보완 계획을 범위 중심으로 압축 정리.
