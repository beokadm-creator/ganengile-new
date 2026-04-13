# 사용자 가이드 — FAQ

`precedence`: 60  
`required-for`: user-help  
`optional-for`: support  
`memory-type`: reference  
`token-estimate`: 300

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- “가입(계정 생성)”과 “온보딩(첫 사용 직전 준비)”을 구분한다.
- 길러 절차는 요청자 흐름과 분리된 별도 진입점이다.
- 결제/정산/보증금 등 민감 기능은 운영 정책에 따라 변할 수 있다.

## Q. 가입할 때 왜 정보를 많이 안 받나요?
A. 가입은 “로그인 가능한 계정 생성”이 목적이며, 서비스 이용에 필요한 정보는 **첫 사용 직전**에 최소로 받는 것을 원칙으로 한다. (표준: `../USER-ENTRY-FLOW-STANDARD.md`)

## Q. 요청자와 길러는 동시에 될 수 있나요?
A. 기본적으로 한 계정에서 두 역할을 가질 수 있으나, 길러 역할 활성화는 별도 절차(심사/승급 등)를 거칠 수 있다.

## Q. 웹에서도 쓸 수 있나요?
A. 웹앱이 제공된다(환경/기능 범위는 릴리즈에 따라 다를 수 있음). https://ganengile.web.app/

## Q. 결제/보증금/환불 같은 민감 기능은 어디를 참고하나요?
A. 운영/배포 관점의 체크는 `../deployment-preflight.md`와 `../ops/` 문서를 우선 참고한다. 제품 정책 문서는 별도로 유지/추가 예정이다.

## Changelog
- 2026-04-13: 사용자 FAQ 초안 추가.
