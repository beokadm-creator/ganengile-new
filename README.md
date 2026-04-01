# 가는길에

서울 지하철 기반의 릴레이 배송 서비스입니다. 사용자 앱, 길러 미션 흐름, 관리자 운영 화면, B2B 배송/정산 흐름이 하나의 Firebase 프로젝트를 기준으로 동작합니다.

현재 기준의 핵심 방향은 `beta1`입니다.
- 요청 생성: `RequestDraft -> AIAnalysis -> PricingQuote -> Request`
- 배송 실행: `Delivery -> DeliveryLeg -> Mission -> MissionBundle`
- 운영 판단: AI 보조 + 관리자 수동 검토

## 구성

- 사용자 앱: Expo + React Native Web
- 관리자: Next.js App Router
- 백엔드: Firebase Auth, Firestore, Functions, Hosting, App Hosting
- 지도: Naver Static Map Proxy + Naver Web Map 준비 구조

## 빠른 실행

```bash
npm install
npm run web
```

관리자 웹:

```bash
cd admin-web
npm install
npm run dev
```

## 환경 변수

지도와 Firebase는 배포 전에 반드시 채워야 합니다.

주요 항목:
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`
- `EXPO_PUBLIC_MAP_PROVIDER`
- `EXPO_PUBLIC_NAVER_MAP_ENABLED`
- `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`
- `EXPO_PUBLIC_NAVER_STATIC_MAP_PROXY_URL`
- `EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED`
- `EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID`
- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`

자세한 순서는 [docs/deployment-preflight.md](C:\Users\whhol\Documents\trae_projects\ganengile\docs\deployment-preflight.md)를 기준으로 진행합니다.

## 문서

- 기준 문서: `docs/`
- beta1 기획/상태 계약/AI 오케스트레이션: `docs/beta1-*.md`
- 배포 전 점검: [docs/deployment-preflight.md](C:\Users\whhol\Documents\trae_projects\ganengile\docs\deployment-preflight.md)

## 현재 상태

- 핵심 사용자/길러/관리자/B2B 흐름은 beta1 기준으로 재정렬됨
- Naver 정적지도 프록시가 실제 화면에 연결됨
- 웹 동적 지도 SDK는 env 활성화 후 바로 켤 수 있는 상태
- 배포 전에는 Functions 배포와 env 최종 검증이 필요함
