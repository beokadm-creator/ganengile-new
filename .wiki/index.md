# 가는길 (ganengile) — 배달/수거/출장 매칭 플랫폼

## Stack
- **Mobile**: React Native + Expo (Expo Router) ~76K lines
- **Admin Web**: Next.js (App Router) + TypeScript
- **Backend**: Firebase Cloud Functions (Node.js 22)
- **DB**: Firestore, **인증**: Firebase Auth, **지도**: 네이버맵, **결제**: 카카오페이

## Key Files
- `functions/src/index.ts` — 전체 API (~5K lines, 리팩토링 필요)
- `src/services/` — DepositService, BadgeService, FCMService, KakaoPayService, LocationService

## 핵심 기능
- 이중 역할: 의뢰인(Requester) / 실무자(Giller)
- 서비스 매칭 → 수행 → 리뷰
- 카카오페이 결제, 보증금, QR 락커
- FCM 푸시, 네이버맵 반경 검색

## 알려진 이슈
- functions/index.ts 단일 파일 5K줄 → 분리 필요
- 환경변수 9개 미설정 → 배포 블로커
- enterprise-legacy 레거시 코드 존재

## 환경변수 (배포 시 설정 필요)
- CI_PASS_URL, CI_KAKAO_URL
- NAVER_MAP_CLIENT_ID, NAVER_MAP_CLIENT_SECRET
- JUSO_API_KEY
- SEOUL_FARE_API_URL, SEOUL_FARE_SERVICE_KEY

## Analysis
- 문서 인덱스: `docs/README.md`
