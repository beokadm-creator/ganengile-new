# Mock · 하드코딩 전수 점검

점검 기준일: 2026-04-03

이 문서는 테스트 전용 mock과 운영 경로에 남아 있는 mock·하드코딩·placeholder를 분리해서 정리한 목록입니다.

## 1. 테스트 전용 mock

아래는 운영 코드가 아니라 테스트/통합 유틸로 보이는 항목입니다.

- [src/services/integration/mocking-utils.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/integration/mocking-utils.ts)
- [src/services/__tests__/delivery-tracking-service.test.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/__tests__/delivery-tracking-service.test.ts)
- [src/services/__tests__/location-service.test.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/__tests__/location-service.test.ts)
- [src/services/route-service.test.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/route-service.test.ts)

## 2. 운영 경로에서 확인된 mock·하드코딩

### 2-1. 배송/미션/B2B fallback

- [src/services/beta1-orchestration-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/beta1-orchestration-service.ts#L194)
  - `partner-a`, `partner-b`가 고정 파트너 ID로 들어가 있습니다.
- [src/services/beta1-orchestration-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/beta1-orchestration-service.ts#L1178)
  - B2B fallback 호출 시 `beta1-fallback-contract`, `beta1-fallback`가 고정값입니다.
- [src/services/delivery-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/delivery-service.ts#L246)
  - 수령 인증 코드 fallback으로 `000000`이 사용됩니다.

### 2-2. 레거시 기업 계약 길러

- `src/services/enterprise-legacy-delivery-service.ts`
  - `checkCompatibility()`가 현재 항상 `true`를 반환합니다.
- `src/services/enterprise-legacy-delivery-service.ts`
  - 상위 3명에게만 알림을 보내는 고정 정책입니다.

### 2-3. 위치/실시간 추적

- [src/services/realtime-delivery-tracking.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/realtime-delivery-tracking.ts#L175)
  - 현재 위치가 `Math.random()` 기반 mock 좌표입니다.
- [src/services/realtime-delivery-tracking.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/realtime-delivery-tracking.ts#L181)
  - 주석상 실제 `navigator.geolocation` 연동 전 단계입니다.

### 2-4. 결제/인증

- [src/services/TossPaymentService.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/TossPaymentService.ts)
  - 실제 결제 연동 대신 test flow / live-ready placeholder 로그로 성공을 반환합니다.
- [src/services/otp-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/otp-service.ts#L20)
  - 개발 환경에서 OTP fallback 세션을 메모리에 저장합니다.
- [src/services/otp-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/otp-service.ts#L33)
  - fallback OTP 코드가 `123456`으로 고정됩니다.

### 2-5. 지하철/동선 계산

- [src/services/transfer-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/transfer-service.ts#L86)
  - 이동 시간을 고정 `30분`으로 반환합니다.
- [src/services/transfer-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/transfer-service.ts#L97)
  - 환승 도보 시간을 고정 `3분`으로 계산합니다.
- [src/services/matching-auto-retry.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/matching-auto-retry.ts#L135)
  - Firestore 미매칭 요청 조회가 `TODO` 상태입니다.

### 2-6. 기타 운영 fallback

- [src/services/matching-notification.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/matching-notification.ts#L75)
  - FCM 전송이 실제 발송 대신 queued 로그 + `Promise.resolve()`입니다.
- [src/services/locker-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/locker-service.ts#L541)
  - 일부 코드 생성이 `Math.random()` 기반입니다.
- [src/services/social-auth-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/social-auth-service.ts#L47)
  - Google 로그인은 fallback 문구 기준으로 남아 있습니다.

## 3. 한글 인코딩 깨짐이 확인된 파일

아래 파일은 실제 문자열 또는 주석에 깨진 한글 흔적이 있습니다.

- [src/services/realtime-delivery-tracking.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/realtime-delivery-tracking.ts)
- [src/services/transfer-service.ts](/C:/Users/whhol/Documents/trae_projects/ganengile/src/services/transfer-service.ts)
- `src/services/enterprise-legacy-delivery-service.ts`

## 4. 우선순위

### P1

- 실시간 위치 mock 제거
- Toss 결제 placeholder 제거
- B2B `checkCompatibility()` 실제 조건 구현
- 수령 인증 코드 `000000` fallback 제거 또는 운영 제한

### P2

- RealtimeSubway seed 기반 예측 제거
- transfer-service 고정 시간값 제거
- matching-notification 실제 발송 연동

### P3

- 깨진 한글 주석/문자열 일괄 정리
- 개발 fallback과 운영 fallback을 설정 플래그 기준으로 분리
