# 문서 인덱스

`precedence`: 85  
`required-for`: onboarding, repo-navigation, docs-navigation  
`optional-for`: code-change, deploy  
`memory-type`: index  
`token-estimate`: 330

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 문서 진입점은 이 파일이다. 전체 맥락은 `../README.md`, 작업 규칙은 `../CLAUDE.md`로 이어진다.
- 운영/배포 작업은 `deployment-preflight.md`와 `ops/` 문서가 기준이다.
- 사용자(앱 사용) 문서는 `user/` 아래에 둔다.

## 1) 시작점

| 목적 | 문서 |
|---|---|
| 프로젝트 개요/실행 | [`../README.md`](../README.md) |
| 작업/문서 거버넌스(에이전트/코드 변경 포함) | [`../CLAUDE.md`](../CLAUDE.md) |
| 문서 작성/배치 규칙 | [`ops/documentation-rules.md`](ops/documentation-rules.md) |
| 새 작업자 인수인계(빠른 진입) | [`ops/agent-handoff.md`](ops/agent-handoff.md) |

## 2) 운영/배포 (Runbook)

| 주제 | 문서 |
|---|---|
| 배포 전 점검(필수) | [`deployment-preflight.md`](deployment-preflight.md) |
| 환경변수/Secrets 정리 | [`ops/deployment-and-env.md`](ops/deployment-and-env.md) |
| CI/CD 파이프라인 | [`ops/cicd-pipeline-guide.md`](ops/cicd-pipeline-guide.md) |
| 인코딩(Windows PowerShell 포함) | [`ENCODING_GUIDE.md`](ENCODING_GUIDE.md) |

## 3) 제품/UX 표준 (현재 유지되는 표준)

| 주제 | 문서 |
|---|---|
| 회원 진입/온보딩 표준 | [`USER-ENTRY-FLOW-STANDARD.md`](USER-ENTRY-FLOW-STANDARD.md) |
| B2B/배송 파트너 actor 표준 | [`CLOUD-DELIVERY-ACTOR-STANDARD.md`](CLOUD-DELIVERY-ACTOR-STANDARD.md) |

## 4) 데이터/참고

| 주제 | 문서 |
|---|---|
| 데이터 폴더 설명 | [`../data/README.md`](../data/README.md) |
| 정적 역 데이터 참고 | [`../data/stations-seoul.md`](../data/stations-seoul.md) |
| 하드코딩/임시값 점검 리포트(참고) | [`MOCK_HARDCODED_AUDIT.md`](MOCK_HARDCODED_AUDIT.md) |

## 5) 사용자 문서 (App Help)

| 주제 | 문서 |
|---|---|
| 시작하기 | [`user/getting-started.md`](user/getting-started.md) |
| FAQ | [`user/faq.md`](user/faq.md) |

## 6) 메모/기록/정리 대상
- `memory/`는 시점 기록(log)이며, 현재 계약/운영 문서를 덮어쓰지 않는다.
- 루트의 `DATA-INCONSISTENCY-ANALYSIS.md`, `LEGACY-CLEANUP-*.md`는 “보고서/정리 메모” 성격이라 `/docs/archive/`로 이동 후보(필요 시).

## Changelog
- 2026-04-13: 현재 저장소에 존재하는 문서 기준으로 인덱스/링크를 재정리하고, 사용자 문서(user/)를 추가하는 구조로 업데이트.
