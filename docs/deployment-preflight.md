# Deployment Preflight

배포 직전 확인용 문서입니다. 현재 기준은 `beta1` 흐름과 `Naver Maps` 연결 상태를 기준으로 정리했습니다.

## 1. 앱 환경 변수

필수:
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION`
- `EXPO_PUBLIC_MAP_PROVIDER`
- `EXPO_PUBLIC_NAVER_MAP_ENABLED`
- `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`

정적 지도 프록시를 직접 지정할 때:
- `EXPO_PUBLIC_NAVER_STATIC_MAP_PROXY_URL`

웹 동적 지도를 켤 때:
- `EXPO_PUBLIC_MAP_PROVIDER=naver-web`
- `EXPO_PUBLIC_NAVER_WEB_MAP_ENABLED=true`
- `EXPO_PUBLIC_NAVER_MAP_WEB_CLIENT_ID`

## 2. Functions 환경 변수

필수:
- `NAVER_MAP_CLIENT_ID`
- `NAVER_MAP_CLIENT_SECRET`

주의:
- 네이버 정적지도는 IAM Access Key / Secret Key가 아니라 Maps Application에 발급된 `Client ID / Client Secret` 기준으로 확인하는 것이 안전합니다.
- 현재 프록시가 `Authentication Failed`를 반환하면 지도 API 상품 활성화와 Maps Application 인증값부터 다시 확인합니다.

배포 후 확인:
- `naverStaticMapProxy`가 정상 이미지 응답을 반환하는지 확인

현재 배포 기준 리전:
- `us-central1`

## 3. 지도 확인 화면

다음 화면에서 지도 이미지 또는 동적 지도가 정상 표시되어야 합니다.
- 사용자 사물함 지도: `LockerMapScreen`
- 사용자 실시간 추적: `RealtimeTrackingScreen`
- 사용자 배송 추적: `DeliveryTrackingScreen`
- 사물함 선택 컴포넌트: `LockerLocator`
- B2B 요청: `B2BRequestScreen`
- B2B 대시보드: `B2BDashboardScreen`
- 관리자 대시보드 / 분쟁 / 보증금 / 정산 지도 카드

## 4. 관리자 운영 확인

다음 운영 화면이 실제 데이터로 열리는지 확인합니다.
- 대시보드
- 분쟁
- 보증금
- 정산
- 길러 승급 심사
- AI 설정 / AI 관제

## 5. 민감 구간 확인

- 요청 취소 후 보증금 환불 또는 분쟁 유도
- 길러 수락 후 취소 시 패널티 반영
- 출금 요청 시 계좌 인증 / 운영 보류 체크
- 정산 시 개인 길러 3.3%와 B2B 월 정산 구분

## 6. 점검 명령

앱:
```bash
npm run web
```

관리자:
```bash
cd admin-web
npm run dev
```

Functions 타입 점검:
```bash
npx tsc -p functions/tsconfig.json --noEmit
```

지도 핵심 화면 lint:
```bash
npx eslint "src/screens/main/LockerMapScreen.tsx" "src/screens/main/RealtimeTrackingScreen.tsx" "src/screens/main/DeliveryTrackingScreen.tsx" "src/screens/b2b/B2BRequestScreen.tsx" "src/screens/b2b/B2BDashboardScreen.tsx" "src/components/delivery/LockerLocator.tsx" --max-warnings 1000
```

배포 전 환경 변수 점검:
```bash
node scripts/preflight-maps.mjs
```

## 7. 배포 기준

배포 가능:
- 지도 프록시 응답 정상
- 지도 핵심 화면 lint 에러 0
- Functions 타입 검사 통과
- 관리자 운영 화면 접속 가능

배포 보류:
- 지도 프록시 401 / 403
- Firebase 프로젝트 또는 env 불일치
- 정산 / 분쟁 / 출금 운영 화면 응답 실패
