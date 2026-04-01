# CLAUDE.md

`precedence`: 100  
`required-for`: all-repo-work  
`optional-for`: none  
`memory-type`: policy  
`token-estimate`: 320

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/beta1-core-context.md

## Essential (Post-Compact)
- 이 파일은 저장소 전역에서 가장 높은 우선순위를 가진다.
- 문서보다 코드와 상태 계약을 우선 확인하되, 문서 갱신 책임은 같이 진다.
- beta1의 핵심 계약 문서는 `docs/beta1-state-contract.md`와 `docs/beta1-service-plan.md`다.
- 공통 설명은 shared include로 관리하고 개별 문서에는 예외와 결정만 남긴다.

## [STATIC] Global Rules
- 작업 시작 순서: 이 파일 -> `docs/README.md` -> 작업별 필수 문서.
- 충돌 시 우선순위: `CLAUDE.md` -> shared governance -> state contract -> service plan -> 개별 전략 -> 초안/메모.
- 문서 수정 시 `required-for`, `memory-type`, `token-estimate`, `Essential`, `STATIC/DYNAMIC`, `changelog`를 유지한다.
- 경로 참조는 현재 워크스페이스 기준으로 관리한다.

## [STATIC] Source Of Truth
- 상태/엔터티/참조 규칙: `docs/beta1-state-contract.md`
- 제품 흐름/우선순위: `docs/beta1-service-plan.md`
- 운영 체크: `docs/deployment-preflight.md`
- 관리자 웹 개요: `admin-web/README.md`

## [DYNAMIC] Current Notes
- 루트 및 `docs/` 문서는 2026-04-02 기준으로 압축형 규칙 체계로 정리됨.
- `.sisyphus`, `memory`, `data`, 성능 노트도 같은 메타 규칙을 따르도록 갱신됨.

## Changelog
- 2026-04-02: 전역 문서 우선순위, include 규칙, 메타 표준을 반영해 재작성.
