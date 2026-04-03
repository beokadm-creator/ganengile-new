# AI Documentation Governance

`precedence`: 90  
`required-for`: 모든 문서 수정, 충돌 해석, 압축 후 복원  
`optional-for`: 탐색, 리뷰, 온보딩  
`memory-type`: policy  
`token-estimate`: 260

## Essential (Post-Compact)
- 문서 충돌 시 더 높은 `precedence`가 이긴다.
- `[STATIC]`는 캐시 가능, `[DYNAMIC]`는 매번 새로 읽는다.
- 공통 규칙은 `@include`로 재사용하고, 파일 고유 내용만 본문에 남긴다.
- `required-for`에 없으면 필요 시에만 읽는다.
- `changelog`는 문서 내부 마지막 섹션에 유지한다.

## [STATIC] Rules

### 1. Precedence
- 100: `CLAUDE.md`
- 95: 제품/운영 공통 강제 규칙
- 90: 이 문서와 같은 shared governance 문서
- 80: 도메인 계약 문서 (`docs/beta1-state-contract.md`)
- 75: 상위 계획 문서 (`docs/beta1-service-plan.md`, `docs/beta1-master-brief.md`)
- 70: 개별 전략/정책 문서
- 65: 런북/운영/데이터 안내 문서
- 60: `.sisyphus` 계획 및 검증 문서
- 50 이하: 메모, 참고 노트, 성능 팁

### 2. Conflict Resolution
- 같은 범위에서 충돌하면 더 높은 `precedence`를 따른다.
- 같은 `precedence`면 더 구체적인 문서가 이긴다.
- 계획 문서와 코드가 충돌하면 코드와 상태 계약을 먼저 확인한다.
- 초안, 메모, 검증 보고서는 제품 계약을 덮어쓰지 못한다.

### 3. Static And Dynamic Markers
- `[STATIC]`: 오래 유지되는 목적, 규칙, 계약, 표준, 링크.
- `[DYNAMIC]`: 체크리스트, 상태, 최근 판단, TODO, 최신 관측.
- 압축 시 `[STATIC]`의 Essential만 남기고 `[DYNAMIC]`는 필요 시 재조회한다.

### 4. Include Rules
- 형식은 `@include 경로` 한 줄로 쓴다.
- include는 상속 개념이며, included file의 규칙이 기본값이다.
- 현재 파일에 같은 항목을 다시 쓰면 현재 파일이 우선한다.

### 5. Required And Optional For
- `required-for`: 이 작업이면 반드시 읽어야 한다.
- `optional-for`: 도움은 되지만 필수는 아니다.
- 태그는 짧고 작업 중심으로 유지한다.

### 6. Memory Types
- `policy`: 강제 규칙
- `index`: 문서 탐색용 목차
- `spec`: 계약/스키마/행동 정의
- `plan`: 실행 계획
- `runbook`: 배포/운영 절차
- `reference`: 참고 데이터
- `report`: 검증 결과
- `log`: 시점 기록
- `note`: 저우선순위 참고

### 7. Token Budget
- 문서는 가급적 150~350 토큰 안쪽으로 유지한다.
- 길어지는 세부사항은 shared 문서나 코드로 이동한다.
- 한 파일 안에서 같은 배경 설명을 반복하지 않는다.

### 8. Changelog
- 각 문서 마지막에 `## Changelog` 유지.
- 최신 변경만 3~5개 이내로 남긴다.
- 오래된 세부 이력은 Git이 담당한다.

### 9. Shared Rules
- 공통 배경, 범용 정의, 읽기 규칙은 shared 문서로 분리한다.
- 개별 문서는 해당 문서만의 결정과 예외만 담는다.

## [DYNAMIC] Adoption Status
- 2026-04-02: 전체 Markdown 문서를 메타 표준 기반으로 재정리.
- 2026-04-02: beta1 문서군에서 반복되던 서비스 설명을 shared include로 이동.
- 2026-04-02: 초안/메모/참고 문서에도 동일한 읽기 규칙을 적용.

## Changelog
- 2026-04-02: 최초 작성. 저장소 Markdown 공통 거버넌스 정의.
