# 문서 운영 규칙 (Documentation Rules)

`precedence`: 70  
`required-for`: docs-change, repo-navigation  
`optional-for`: code-change, onboarding  
`memory-type`: policy  
`token-estimate`: 360

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 문서는 **Markdown로 통일**하고, 진입점은 `docs/README.md` 하나로 유지한다.
- “최신 계약/런북”과 “메모/보고서”를 분리한다. 메모는 계약을 덮어쓰지 못한다.
- 링크는 **상대경로**로 통일하고, 깨진 링크는 PR에서 같이 고친다.

## [STATIC] 문서 배치 규칙

### 1) 기본 구조
- `README.md` (루트): 프로젝트 개요 + 실행 진입점(최소한)
- `CLAUDE.md` (루트): 작업 규칙/우선순위/탐색 가이드(에이전트 포함)
- `docs/README.md`: 문서 인덱스(항상 최신)
- `docs/ops/`: 배포/운영/환경변수/체크리스트(런북)
- `docs/user/`: 사용자 도움말(앱 사용법, FAQ)
- `docs/_shared/`: 공통 거버넌스/공유 컨텍스트(`@include` 대상)
- `docs/archive/`: 과거 문서, 조사 리포트, 정리 메모(필요 시)

### 2) 루트에 문서 추가 금지(원칙)
- 루트에 임시 보고서/정리 문서를 추가하지 않는다.
- 불가피하면 `docs/archive/`에 두고, `docs/README.md`의 “메모/정리 대상” 섹션에만 링크한다.

## [STATIC] 작성 규칙

### 1) 메타 헤더(권장)
가능하면 아래 메타를 문서 상단에 둔다.
- `precedence`: 충돌 시 우선순위
- `required-for` / `optional-for`: 읽기 트리거
- `memory-type`: policy/index/spec/runbook/report/log/note
- `token-estimate`: 대략적 크기(문서 팽창 방지)

### 2) 문서 길이/스코프
- “상위 요약(Essential)” + “필요한 상세”만 남기고, 중복 설명은 `_shared`로 보낸다.
- 실행 가능한 runbook에는 **명령어/체크리스트/실패 시 조치**를 포함한다.

### 3) 링크/경로
- 저장소 내부 링크만 사용한다(외부 링크는 참고로만).
- 상대경로 예시:
  - 같은 폴더: `./deployment-preflight.md`
  - 상위 폴더: `../README.md`

## [DYNAMIC] 운영 메모
- 문서 갱신은 “코드 변경 PR”과 같이 진행하는 것을 기본으로 한다(문서만 바뀌는 PR도 허용).
- `docs/README.md`의 링크가 깨지면 “문서 최신화 실패”로 보고 즉시 수정한다.

## Changelog
- 2026-04-13: 문서 혼재 상태를 정리하기 위한 기본 규칙을 추가. `/docs`를 단일 진입점으로 재정의.
