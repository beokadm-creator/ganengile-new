# 기능 분석 (현재 구현 기준)

> 기준: “지금 저장소에 존재하는 화면/서비스/관리자 페이지”를 근거로 기능을 분류했습니다.  
> 용어/흐름의 표준은 `docs/*` 문서가 우선이며, 구현과 어긋나면 코드를 재확인합니다.

## 1) 인증/계정/역할
- 계정 생성/로그인
  - 화면: `src/screens/auth/*`
  - 컨텍스트: `src/contexts/AuthContext.tsx`
- 온보딩(요청자)
  - 화면: `src/screens/onboarding/BasicInfoOnboarding.tsx`
  - 표준: `docs/USER-ENTRY-FLOW-STANDARD.md`
- 길러 신청/전환(역할 확장)
  - 화면: `src/screens/main/GillerApplyScreen.tsx`, `src/hooks/useGillerAccess.ts`
  - 관리자: `admin-web/app/(admin)/gillers/applications/page.tsx`

## 2) 요청 생성(UX 플로우) + 초안/견적
- 단계형 요청 생성
  - 화면: `src/screens/main/create-request/steps/*`
  - 상태/스토어: `src/screens/main/create-request/store/useCreateRequestStore.ts`
  - 서비스(초안/어댑터): `src/services/request-draft-service.ts`, `src/utils/request-draft-adapters.ts`
- 견적/요금 구성 UI
  - 화면: `src/screens/main/create-request/components/*`
  - 서비스: `src/services/pricing-service.ts`, `src/services/request/request-pricing-service.ts`

## 3) 요금/가격 정책
- 기본 요금 계산(거리/무게/사이즈/긴급도/공공요금/수수료/VAT)
  - 서비스: `src/services/pricing-service.ts`
  - 공유 정책: `shared/pricing-policy.ts`
- 관리자 가격 정책/오버라이드/인사이트
  - 관리자: `admin-web/app/(admin)/pricing/policy/page.tsx`
  - 관리자: `admin-web/app/(admin)/pricing/overrides/page.tsx`
  - 관리자: `admin-web/app/(admin)/pricing/insights/page.tsx`

## 4) 매칭(길러 라우트 기반) + 알림/채팅 연계
- 매칭 엔진 + Firestore 연동
  - 서비스: `src/services/matching-service.ts`
  - 엔진: `src/data/matching-engine.ts`
- 길러 라우트(동선) 관리
  - 화면: `src/screens/main/AddRouteScreen.tsx`, `EditRouteScreen.tsx`, `RouteManagementScreen.tsx`
  - 서비스: `src/services/route-service.ts`
- 매칭 알림/자동 재시도(추정)
  - 서비스: `src/services/matching-notification.ts`, `src/services/matching-auto-retry.ts`

## 5) 배송/수행(Delivery Lifecycle) + 추적
- 수락/취소/픽업 인증/도착/완료 등 라이프사이클
  - 서비스: `src/services/delivery-service.ts` → `src/services/delivery/*`로 모듈화 진행
  - 화면: `src/screens/main/DeliveryTrackingScreen.tsx`, `DeliveryCompletionScreen.tsx`, `PickupVerificationScreen.tsx`
- 실시간 위치/추적
  - 화면: `src/screens/main/RealtimeTrackingScreen.tsx`
  - 서비스: `src/services/location-tracking-service.ts`, `src/services/delivery-tracking-service.ts`
  - UI: `src/screens/main/tracking/components/TrackingTimeline.tsx`

## 6) 락커/QR
- 락커 지도/선택
  - 화면: `src/screens/main/LockerMapScreen.tsx`, `LockerSelectionScreen.tsx`
  - 컴포넌트: `src/components/delivery/LockerLocator.tsx`
- QR 스캔/검증/락커 열기
  - 화면: `src/screens/main/QRCodeScannerScreen.tsx`, `UnlockLockerScreen.tsx`
  - 서비스: `src/services/qrcode-service.ts`, `src/services/locker-service.ts`
- 외부 락커 데이터(예: KRIC)
  - 서비스: `src/services/locker-service.ts`(KRIC URL/키 env 사용)

## 7) 결제/보증금/포인트(지갑)/출금/세금
- 보증금(포인트+외부결제 혼합 가능)
  - 화면: `src/screens/main/DepositPaymentScreen.tsx`
  - 서비스: `src/services/DepositService.ts` (컬렉션: `deposits`)
- 포인트/지갑/출금
  - 화면: `src/screens/main/PointHistoryScreen.tsx`, `PointWithdrawScreen.tsx`, `EarningsScreen.tsx`
  - 서비스: `src/services/PointService.ts` (컬렉션: `withdraw_requests` 등)
- 정산/세금(원천징수 등 고려)
  - 서비스: `src/services/payment-service.ts` (세금 정책 주석 포함)
- 관리자(정산/출금/포인트)
  - 관리자: `admin-web/app/(admin)/settlements/page.tsx`
  - 관리자: `admin-web/app/(admin)/points/withdrawals/page.tsx`
  - 관리자: `admin-web/app/(admin)/points/balances/page.tsx`
  - 관리자: `admin-web/app/(admin)/accounting/page.tsx`

## 8) 분쟁/패널티/신뢰
- 분쟁(신고/해결)
  - 화면: `src/screens/main/DisputeReportScreen.tsx`, `DisputeResolutionScreen.tsx`
  - 관리자: `admin-web/app/(admin)/disputes/page.tsx`
- 패널티/경고(지각/노쇼/취소 등)
  - 서비스: `src/services/penalty-service.ts` (컬렉션: `penalties`, `warnings`)
- 평점/리뷰
  - 화면: `src/screens/main/RatingScreen.tsx`
  - 서비스: `src/services/rating-service.ts`

## 9) 커뮤니케이션(채팅/알림)
- 채팅
  - 화면: `src/screens/main/ChatListScreen.tsx`, `ChatScreen.tsx`
  - 서비스: `src/services/chat-service.ts`
- 푸시 알림(FCM 등)
  - 훅: `src/hooks/useNotifications.ts` (+ `.web.ts`)
  - 서비스: `src/services/notification-service.ts`

## 10) 운영/설정/연동(관리자 중심)
- 사용자/검증/동의/심사
  - 관리자: `admin-web/app/(admin)/users/page.tsx`, `verifications/page.tsx`, `consents/page.tsx`, `gillers/applications/page.tsx`
- 락커/파트너/디스패치
  - 관리자: `admin-web/app/(admin)/lockers/page.tsx`, `delivery-partners/page.tsx`, `partner-dispatches/page.tsx`
- 연동 설정(신원/은행/결제/세금/AI/운임캐시/알림톡 등)
  - 관리자: `admin-web/app/(admin)/integrations/*`
- 운영 대시보드/지표/대기열
  - 관리자: `admin-web/app/(admin)/dashboard/page.tsx`
  - beta1: `admin-web/app/(admin)/beta1/*`

## 11) 기능 공백(문서/코드 불일치 후보)
아래는 “과거 문서/메모에서 언급되지만 현재 docs에 정식 문서가 없는 항목” 또는 “코드엔 있는데 사용자/기획 문서가 얕은 영역”이다.
- 결제 프로바이더/정책(카카오/토스 등) 최종 확정 및 문서화
- beta1 AI 분석/수동검토 흐름(운영 기준/정책)
- B2B/외부 파트너 컬렉션을 관리자에서 어떻게 운영할지(대시보드/권한/정산)

