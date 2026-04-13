# 가넹길

`precedence`: 85  
`required-for`: onboarding, repo-navigation, local-run  
`optional-for`: beta1-docs, deploy  
`memory-type`: index  
`token-estimate`: 220

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 이 저장소는 가넹길 앱, 관리자 웹, Firebase 백엔드를 함께 관리한다.
- 최신 문서 인덱스는 `docs/README.md`이며, 문서/운영 기준은 `docs/` 아래에서 관리한다.
- 실행 진입점은 모바일/웹 앱, `admin-web`, `functions` 세 영역이다.

## [STATIC] Repository Map
- 앱: `src/` 기반 Expo + React Native Web
- 관리자: `admin-web/` 기반 Next.js App Router
- 백엔드: `functions/src/` 기반 Firebase Functions
- 제품/운영 문서: `docs/`
- 실행 계획/검증 초안: `.sisyphus/`
- 참고 데이터: `data/`

## [STATIC] Read Order
1. `CLAUDE.md`
2. `docs/README.md`
3. 작업별 문서(운영이면 `docs/deployment-preflight.md`부터)

## [DYNAMIC] Local Start
```bash
npm install
npm run web
```

```bash
cd admin-web
npm install
npm run dev
```

## Changelog
- 2026-04-02: 루트 README를 압축형 메타 포맷으로 재작성.
