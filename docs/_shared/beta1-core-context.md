# Beta1 Shared Context

`precedence`: 88  
`required-for`: beta1-docs, product-planning, flow-design  
`optional-for`: onboarding, admin-ops  
`memory-type`: spec  
`token-estimate`: 220

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- beta1은 지하철 기반 하이브리드 배송 운영 모델이다.
- 요청 생성은 `RequestDraft -> AIAnalysis -> PricingQuote -> Request` 흐름을 따른다.
- 수행 구조는 `Delivery -> DeliveryLeg -> HandoverEvent` 중심으로 나뉜다.
- AI는 추천과 보조를 맡고, 민감한 확정은 정책/운영이 맡는다.
- 문서보다 코드와 상태 계약이 더 최신일 수 있다.

## [STATIC] Core
- 사용자 목표: 적은 입력으로 배송 옵션을 고르고 진행 상태를 이해할 수 있어야 한다.
- 길러 목표: 전체 배송이 아니라 수행 가능한 구간 미션 중심으로 참여한다.
- 운영 목표: 예외, 분쟁, 요금, 신원, 지급을 관리자에서 통제 가능해야 한다.
- 시스템 목표: AI는 입력 보조, 분류, 추천, 경고를 맡고 최종 확정 책임은 넘지 않는다.

## [DYNAMIC] Current Reading Hint
- 상태/필드 정의는 `docs/beta1-state-contract.md`를 우선 확인한다.
- 화면/정책 우선순위는 `docs/beta1-service-plan.md`를 우선 확인한다.
- 배포 전 체크는 `docs/deployment-preflight.md`를 본다.

## Changelog
- 2026-04-02: beta1 문서군 공통 배경을 shared include로 분리.
