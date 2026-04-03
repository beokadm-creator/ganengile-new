# Admin Web

`precedence`: 65  
`required-for`: admin-web, admin-ops, admin-local-run  
`optional-for`: deploy, beta1-docs  
`memory-type`: runbook  
`token-estimate`: 190

@include docs/_shared/ai-doc-governance.md
@include docs/_shared/ops-shared-context.md

## Essential (Post-Compact)
- `admin-web`은 운영자용 Next.js 앱이다.
- 관리자 웹은 분쟁, 보증금, 정산, 길러 심사, 연동 설정을 다룬다.
- 운영 변경 전에는 `docs/deployment-preflight.md`를 같이 본다.

## [STATIC] Local Run
```bash
npm install
npm run dev
```

- 기본 주소: `http://localhost:3000`
- 주요 영역: `dashboard`, `disputes`, `deposits`, `settlements`, `gillers`, `integrations`

## [STATIC] Required Checks
- Firebase 프로젝트/리전 env
- 관리자 인증 및 권한
- Functions 배포 상태
- 지도 프록시 응답 상태

## [DYNAMIC] Current Scope
- beta1 운영 설정과 요금 캐시, AI 연동 화면이 관리자 웹의 현재 확장 포인트다.

## Changelog
- 2026-04-02: 관리자 README를 운영 관점 런북으로 축약 정리.
