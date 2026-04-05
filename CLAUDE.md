# CLAUDE.md

`precedence`: 99  
`required-for`: code-change, repo-navigation  
`optional-for`: onboarding, docs-navigation  
`memory-type`: overview  
`token-estimate`: 700

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/beta1-core-context.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- 이 문서는 저장소 진입점이며, 먼저 읽고 작업별 문서로 이동한다.
- 우선순위는 `MANDATORY_WORKFLOW.md (100)`이 가장 높고, 이 문서는 `AGENTS.md`와 같은 레벨인 `99`로 해석한다.
- 문서 계획보다 코드와 상태 계약이 최신일 수 있으므로 구현과 계약을 먼저 대조한다.
- `[STATIC]`은 캐시 가능한 규칙, `[DYNAMIC]`은 릴리즈 태그, 런타임 상태, 최근 판단처럼 다시 확인해야 하는 정보다.
- 상세 정책과 스타일 규칙은 여기서 반복하지 않고 `AGENTS.md`, `MANDATORY_WORKFLOW.md`, 작업별 문서로 위임한다.

## [STATIC] Role
- 이 파일은 저장소 전체를 설명하는 상세 정책 문서가 아니라, 코덱스와 다른 에이전트가 빠르게 진입하기 위한 루트 오버뷰다.
- 공통 거버넌스, beta1 배경, 운영 기본값은 shared include에서 상속받고 여기에는 루트 판단 기준만 둔다.
- 코드 변경이나 저장소 탐색을 시작할 때는 이 파일을 먼저 읽고, 그다음 `docs/README.md`와 작업 관련 문서로 내려간다.

## [STATIC] Read Order
1. `CLAUDE.md`
2. `docs/README.md`
3. 작업별 핵심 문서

코드/도메인 변경이면 `docs/beta1-state-contract.md`를 먼저 본다.  
제품 우선순위나 UX 판단이면 `docs/beta1-service-plan.md`를 먼저 본다.  
빠른 전체 맥락이 필요하면 `docs/beta1-master-brief.md`를 먼저 본다.  
운영/배포 작업이면 `docs/deployment-preflight.md`와 `admin-web/README.md`를 함께 본다.

## [STATIC] Source Of Truth
- 상태, 필드, 흐름 계약: `docs/beta1-state-contract.md`
- 제품 우선순위, UX, 정책 방향: `docs/beta1-service-plan.md`
- 빠른 전체 브리프: `docs/beta1-master-brief.md`
- 운영 및 관리자 맥락: `docs/deployment-preflight.md`, `admin-web/README.md`

## [STATIC] Loading Rules
- `required-for`에 해당하는 작업에서는 이 파일을 항상 로드한다.
- 루트 파일은 짧게 유지하고, 세부 정책이나 예외 규칙은 shared 문서나 작업 문서에 둔다.
- 현재 파일과 include가 충돌하면 현재 파일의 루트 안내를 우선하되, 실제 제품 판단은 source of truth 문서를 다시 확인한다.

## [DYNAMIC] Current Notes
- `.sisyphus/`, `memory/`, `data/`는 실행 보조 또는 참고 자료로만 사용한다.
- 릴리즈 태그, 런타임 상태, 최근 실험 결과, 임시 메모는 항상 재확인 대상으로 본다.
- 문서와 구현이 어긋나 보이면 먼저 코드와 상태 계약을 확인한 뒤 필요한 문서를 갱신한다.

## Changelog
- 2026-04-03: 코덱스 진입용 루트 오버뷰로 재작성. `precedence 99`, `memory-type overview`, `required-for code-change/repo-navigation` 반영.
- 2026-04-03: `[STATIC]`와 `[DYNAMIC]`를 분리하고 shared include 3개를 참조하도록 정리.
- 2026-04-03: 상세 정책을 루트 문서에서 제거하고 `AGENTS.md`, `MANDATORY_WORKFLOW.md`, beta1 핵심 문서로 위임.
- 2026-04-03: 압축 후에도 유지할 핵심 5개 규칙을 `Essential (Post-Compact)`에 고정.
