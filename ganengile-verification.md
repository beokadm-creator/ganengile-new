# 가넹길(ganengile-new) 프로젝트 종합 검증 보고서

> 분석 일시: 2026-04-10  
> 분석 대상: src/services/ (67개 서비스), src/screens/ (58개 화면), src/types/ (35개 타입), functions/ (35개 트리거), admin-web/ (28개 API 라우트)

---

## 1. 서비스 연결도 (Import 의존 관계)

### 1.1 서비스 간 Import 인접 리스트

src/services/ 내 67개 서비스의 상호 import 관계 (firebase.ts는 기반 인프라로 제외):

| 서비스 | import하는 다른 서비스 |
|--------|----------------------|
| **beta1-orchestration-service** | firebase, request-draft-service, pricing-service, integration-config-service, beta1-wallet-service, matching-service, matching-notification, b2b-delivery-service |
| **delivery-service** | firebase, beta1-orchestration-service, beta1-ai-service, storage-service, DepositService, penalty-service, pricing-service |
| **matching-service** | delivery-service, chat-service, BadgeService, route-service, location-service |
| **DepositService** | firebase, PointService, TossPaymentService, deposit-compensation-service |
| **deposit-compensation-service** | firebase, PointService, TossPaymentService |
| **request-service** | firebase, beta1-engine-service, config-service, matching-service |
| **PointService** | beta1-wallet-service, integration-config-service |
| **chat-service** | firebase, user-service |
| **locker-service** | firebase, config-service, qrcode-service |
| **verification-service** | firebase, profile-service |
| **user-service** | firebase, request-service |
| **payment-service** | firebase, matching-service |
| **profile-service** | firebase, grade-service |
| **rating-service** | firebase, notification-service |
| **delivery-tracking-service** | firebase, location-service |
| **b2b-settlement-service** | b2b-giller-service |
| **b2b-delivery-service** | firebase, config-service |
| **matching-auto-retry** | firebase, matching-service |
| **SettlementService** | CommissionService |
| **route-validator-service** | PathfindingService |
| **social-auth-service** | kakao-auth (type only) |
| **beta1-engine-service** | firebase, beta1-orchestration-service |
| **photo-service** | firebase, storage-service |
| **TossPaymentService** | integration-config-service |
| **beta1-infrastructure-service** | config-service, integration-config-service |
| **PathfindingService** | config-service |
| **RealtimeSubwayService** | config-service |
| **integration-config-service** | firebase |

### 1.2 허브 서비스 (다른 서비스에서 가장 많이 import)

| 순위 | 서비스 | in-degree (import되는 횟수) | 역할 |
|------|--------|---------------------------|------|
| 🥇 | **firebase.ts** | 32 | DB, Auth, Storage, Messaging 기반 |
| 🥈 | **config-service.ts** | 7 | 역/시간/요금 설정 조회 |
| 🥉 | **integration-config-service.ts** | 5 | 외부 연동(PG, 본인확인) 설정 |
| 4 | **pricing-service.ts** | 4 | 배송 요금 계산 |
| 5 | **beta1-wallet-service.ts** | 3 | 지갑/출금 자격 |
| 5 | **matching-service.ts** | 3 | 매칭 엔진 |
| 5 | **PointService.ts** | 3 | 포인트 관리 |
| 8 | **beta1-orchestration-service.ts** | 3 | Beta1 오케스트레이션 |
| 8 | **location-service.ts** | 3 | 위치 서비스 |
| 10 | **beta1-ai-service.ts** | 1 | AI 분석 |

### 1.3 완전 독립 서비스 (다른 서비스를 import하지 않음)

다음 서비스들은 src/services/ 내 다른 서비스를 import하지 않습니다:

- **address-geocode-service.ts** — 외부 API만 사용
- **address-search-service.ts** — 외부 API만 사용
- **auth-error-handler.ts** — 유틸리티
- **b2b-firestore-service.ts** — firebase.ts만 사용
- **b2b-giller-service.ts** — firebase.ts만 사용
- **badge-service.ts** — firebase.ts만 사용
- **channel-attribution-service.ts** — firebase.ts만 사용
- **commission-service.ts** — firebase.ts만 사용
- **config-service.ts** — firebase.ts만 사용
- **consent-service.ts** — firebase.ts만 사용
- **fare-service.ts** — firebase.ts만 사용
- **giller-service.ts** — firebase.ts만 사용
- **google-auth.ts** — firebase.ts만 사용
- **grade-service.ts** — firebase.ts만 사용
- **kakao-auth.ts** — firebase.ts만 사용
- **location-tracking-service.ts** — firebase.ts만 사용
- **media-service.ts** — firebase.ts만 사용
- **naver-route-service.ts** — 독립
- **notification-service.ts** — firebase.ts만 사용
- **otp-service.ts** — 독립
- **penalty-service.ts** — firebase.ts만 사용
- **professional-giller-service.ts** — 독립
- **qrcode-service.ts** — 독립
- **realtime-delivery-tracking.ts** — firebase.ts만 사용
- **route-service.ts** — firebase.ts만 사용
- **storage-service.ts** — firebase.ts만 사용
- **tax-invoice-service.ts** — 독립
- **transfer-service.ts** — firebase.ts만 사용

> 대부분의 서비스가 firebase.ts에만 의존하고 서로 간 의존이 적어 구조적으로 건전합니다.

### 1.4 순환 의존 (Circular Dependency)

다음 **순환 의존 체인**이 감지되었습니다:

| 순환 경로 | 심각도 |
|-----------|--------|
| `request-service` → `matching-service` → `delivery-service` → `beta1-orchestration-service` → ... → `request-service` (간접) | ⚠️ 주의 |
| `matching-service` → `delivery-service` → `beta1-orchestration-service` → `matching-service` | ⚠️ 주의 |
| `user-service` → `request-service` → ... → `user-service` (간접) | ⚠️ 주의 |

> **평가**: 직접적인 A↔B 순환은 없으나, 3~4단계를 거치는 간접 순환이 존재합니다. 현재는 빌드에 문제가 없지만, 리팩토링 시 순환 참조 오류가 발생할 수 있습니다.

---

## 2. 화면-서비스 매핑

### 2.1 화면 카테고리

| 카테고리 | 화면 수 | 주요 경로 |
|---------|---------|----------|
| auth/ | 3 | LoginScreen, LandingScreen, NewSignUpScreen |
| main/ | 38 | HomeScreen, CreateRequestScreen, DeliveryTrackingScreen 등 |
| b2b/ | 9 | B2BDashboardScreen, B2BRequestScreen 등 |
| giller/ | 2 | GillerPickupAtLockerScreen, GillerDropoffAtLockerScreen |
| requester/ | 1 | GillerPickupFromLockerScreen |
| onboarding/ | 1 | BasicInfoOnboarding |

### 2.2 화면에서 호출되는 서비스 (35개)

화면에서 직접 import하는 서비스 (firebase.ts 포함):

| 서비스 | 사용 화면 수 | 주요 화면 |
|--------|------------|----------|
| **firebase.ts** | 35+ | 거의 모든 화면 |
| **delivery-service.ts** | 8 | DeliveryCompletionScreen, PickupVerificationScreen, RealtimeTrackingScreen 등 |
| **config-service.ts** | 6 | AddRouteScreen, CreateAuctionScreen, LockerMapScreen 등 |
| **beta1-orchestration-service.ts** | 6 | HomeScreen, CreateRequestScreen, ChatListScreen, ChatScreen 등 |
| **request-service.ts** | 6 | RequestsScreen, RequestDetailScreen, MatchingResultScreen 등 |
| **photo-service.ts** | 6 | DeliveryCompletionScreen, PickupVerificationScreen, DisputeReportScreen 등 |
| **integration-config-service.ts** | 5 | ProfileScreen, DepositPaymentScreen, GillerLevelUpgradeScreen 등 |
| **locker-service.ts** | 5 | UnlockLockerScreen, LockerSelectionScreen, LockerMapScreen 등 |
| **location-service.ts** | 4 | AddRouteScreen, RealtimeTrackingScreen, LockerMapScreen 등 |
| **route-service.ts** | 4 | EditRouteScreen, RouteManagementScreen, AddRouteScreen 등 |
| **qrcode-service.ts** | 3 | UnlockLockerScreen, QRCodeScannerScreen, GillerPickupAtLockerScreen 등 |
| **b2b-firestore-service.ts** | 4 | B2BDashboardScreen, B2BGillerScreen, BusinessProfileScreen, TaxInvoiceRequestScreen |
| **verification-service.ts** | 3 | ProfileScreen, GillerApplyScreen, GillerLevelUpgradeScreen |
| **chat-service.ts** | 3 | ChatScreen, ChatListScreen, DeliveryTrackingScreen |
| **PointService.ts** | 3 | PointWithdrawScreen, PointHistoryScreen, DepositPaymentScreen |
| **rating-service.ts** | 2 | RatingScreen, MyRatingScreen |
| **profile-service.ts** | 2 | AddressBookScreen, CreateRequestScreen |
| **matching-service.ts** | 2 | MatchingResultScreen, B2BMatchingResultScreen |
| **google-auth.ts** | 2 | LoginScreen, NewSignUpScreen |
| **kakao-auth.ts** | 2 | LoginScreen, NewSignUpScreen |
| **consent-service.ts** | 2 | BasicInfoOnboarding, NewSignUpScreen |
| **naver-route-service.ts** | 2 | DeliveryTrackingScreen, RealtimeTrackingScreen |
| **auction-service.ts** | 2 | AuctionListScreen, CreateAuctionScreen |
| **beta1-ai-service.ts** | 1 | CreateRequestScreen |
| **otp-service.ts** | 1 | CreateRequestScreen |
| **notification-service.ts** | 1 | NotificationSettingsScreen |
| **pricing-service.ts** | 1 | CreateAuctionScreen |
| **DepositService.ts** | 1 | DepositPaymentScreen |
| **BadgeService.ts** | 1 | B2BMatchingResultScreen |
| **grade-service.ts** | 1 | B2BMatchingResultScreen |
| **giller-service.ts** | 1 | GillerLevelUpgradeScreen |
| **b2b-delivery-service.ts** | 1 | B2BRequestScreen |
| **b2b-giller-service.ts** | 1 | B2BGillerScreen |
| **b2b-settlement-service.ts** | 1 | MonthlySettlementScreen |
| **business-contract-service.ts** | 1 | SubscriptionTierSelectionScreen |
| **tax-invoice-service.ts** | 1 | TaxInvoiceRequestScreen |

### 2.3 화면에서 호출되지 않는 서비스 (32개, 48%)

| 서비스 | 실제 사용처 |
|--------|------------|
| **address-geocode-service.ts** | 화면에서 직접 import 없음 (CreateRequestScreen, AddRouteScreen에서는 import 확인됨) ✅ |
| **address-search-service.ts** | ❓ 사용처 불명확 |
| **auth-error-handler.ts** | 서비스 내부 (social-auth, kakao-auth 등) |
| **b2b-giller-service.ts** | b2b-settlement-service에서 import |
| **beta1-engine-service.ts** | request-service에서 import |
| **beta1-infrastructure-service.ts** | admin-web에서 간접 사용 가능 |
| **channel-attribution-service.ts** | ❓ 사용처 불명확 |
| **CommissionService.ts** | SettlementService에서 import |
| **deposit-compensation-service.ts** | DepositService에서 import |
| **delivery-tracking-service.ts** | ❓ 화면에서 미사용 (별도 추적 서비스) |
| **fare-service.ts** | ❓ 사용처 불명확 |
| **integration/mocking-utils.ts** | 개발/테스트용 |
| **matching-auto-retry.ts** | ❓ 백그라운드 매칭 재시도 |
| **matching-notification.ts** | beta1-orchestration-service에서 import |
| **matching/TransferMatchingService.ts** | 매칭 서브모듈 |
| **matching/OneTimeMatchingService.ts** | 매칭 서브모듈 |
| **matching/PricingService.ts** | 매칭 서브모듈 |
| **media-service.ts** | ❓ 사용처 불명확 |
| **PathfindingService.ts** | route-validator-service에서 import |
| **performance/monitoring.ts** | 성능 모니터링 (개발) |
| **performance/optimization.ts** | 성능 최적화 (개발) |
| **performance/firestore-optimization.ts** | Firestore 최적화 (개발) |
| **pickup-verification-service.ts** | ❓ 화면에서 직접 미사용 |
| **ProfessionalGillerService.ts** | ❓ 사용처 불명확 |
| **RealtimeSubwayService.ts** | ❓ 사용처 불명확 |
| **realtime-delivery-tracking.ts** | ❓ 화면에서 미사용 |
| **request-draft-service.ts** | beta1-orchestration-service에서 import |
| **route-validator-service.ts** | ❓ 사용처 불명확 |
| **SettlementService.ts** | functions에서 사용 가능 |
| **social-auth-service.ts** | ❓ 사용처 불명확 |
| **TossPaymentService.ts** | DepositService에서 import |
| **transfer-service.ts** | ❓ 사용처 불명확 |

> **요약**: 67개 서비스 중 **35개(52%)**만 화면에서 직접 호출, **32개(48%)**는 서비스 간 간접 사용이거나 미사용. 그 중 **~10개**는 사용처를 확인하기 어려워 잠재적 데드 코드.

---

## 3. 데드 코드 탐지

### 3.1 타입 파일 사용 현황

src/types/의 35개 타입 파일에서 **402개** export가 정의되어 있습니다.

| 타입 파일 | export 수 | 주요 사용처 | 상태 |
|-----------|----------|------------|------|
| index.ts | 11 | 다수의 서비스/화면 | ✅ 활성 (re-export 허브) |
| delivery.ts | 16 | delivery-service, delivery-tracking | ✅ 활성 |
| user.ts | 14 | user-service, 다수 화면 | ✅ 활성 |
| config.ts | 31 | config-service, data/ | ✅ 활성 |
| beta1.ts | 30 | beta1-orchestration, request-draft | ✅ 활성 |
| matching.ts | 19 | matching-service | ✅ 활성 |
| payment.ts | 13 | payment-service | ✅ 활성 |
| request.ts | 10 | request-service | ✅ 활성 |
| chat.ts | 13 | chat-service | ✅ 활성 |
| location.ts | 12 | location-service | ✅ 활성 |
| route.ts | 10 | route-service | ✅ 활성 |
| profile.ts | 9 | profile-service | ✅ 활성 |
| point.ts | 12 | PointService | ✅ 활성 |
| giller.ts | 10 | giller-service | ✅ 활성 |
| locker.ts | 12 | locker-service | ✅ 활성 |
| auction.ts | 12 | auction-service | ✅ 활성 |
| badge.ts | 9 | BadgeService | ✅ 활성 |
| rating.ts | 8 | rating-service | ✅ 활성 |
| penalty.ts | 13 | penalty-service | ✅ 활성 |
| consent.ts | 12 | consent-service | ✅ 활성 |
| qrcode.ts | 6 | qrcode-service | ✅ 활성 |
| matching-extended.ts | 12 | matching-service | ✅ 활성 |
| beta1-wallet.ts | 11 | beta1-wallet-service | ✅ 활성 |
| beta1-payment.ts | 9 | payment 관련 | ✅ 활성 |
| b2b-delivery.ts | 13 | b2b-delivery-service | ✅ 활성 |
| b2b-settlement.ts | 9 | b2b-settlement-service | ✅ 활성 |
| b2b-giller-tier.ts | 9 | b2b-giller-service | ✅ 활성 |
| business-contract.ts | 8 | business-contract-service | ✅ 활성 |
| tax-invoice.ts | 7 | tax-invoice-service | ✅ 활성 |
| photo.ts | 5 | photo-service | ✅ 활성 |
| transfer.ts | 4 | transfer-service | ⚠️ 사용처 적음 |
| partner.ts | 8 | ❓ | ⚠️ 확인 필요 |
| navigation.ts | 19 | 화면 네비게이션 | ✅ 활성 |
| module.ts | 3 | ❓ | ⚠️ 사용처 적음 |
| delivery-method.ts | 3 | ❓ | ⚠️ 사용처 적음 |

> **평가**: 대부분의 타입 파일이 적극 사용 중. 5개 데드 타입이 확인됨 (아래 참조).

### 3.1.1 확정 데드 타입 (5개 — import 0건)

| 타입 파일 | export 수 | 상태 |
|-----------|----------|------|
| **qrcode.ts** | 6 | ❌ import 없음 — qrcode-service.ts에서 타입을 자체 정의하여 사용 |
| **partner.ts** | 8 | ❌ import 없음 — 파트너 관련 기능이 미구현 상태 |
| **location.ts** | 12 | ❌ import 없음 — 실제 위치 로직은 location-service.ts에 직접 구현 |
| **module.ts** | 3 | ❌ import 없음 — 모듈 상태 관련 타입 미사용 |
| **delivery-method.ts** | 3 | ❌ import 없음 — 배송 방식 관련 타입이 다른 곳에서 정의됨 |

> 이 5개 파일은 코드베이스 전체에서 한 번도 import되지 않았습니다. 제거 또는 다른 타입으로 통합을 권장합니다.

### 3.2 shared/ 모듈 사용 현황

| 파일 | 사용처 | 상태 |
|------|--------|------|
| **pricing-policy.ts** | PointService, SettlementService, pricing-service, data/matching-engine, functions/index.ts, admin-web/gillers, admin-web/withdrawals | ✅ 핵심 공유 모듈 |
| **matching-engine.ts** | data/matching-engine, BadgeService, matching-service, config-service, 테스트 | ✅ 활성 |
| **bank-account.ts** | functions/index.ts, admin-web, 서비스들 | ✅ 활성 |

> **평가**: shared/의 3개 모듈 모두 다수 위치에서 사용 중. 데드 코드 없음.

### 3.3 data/ 정적 데이터 사용 현황

| 파일 | 사용처 | 상태 |
|------|--------|------|
| **index.ts** | 서비스 및 화면에서 import | ✅ 진입점 |
| **subway-stations.ts** | config-service, 스크립트 | ✅ 활성 |
| **travel-times.ts** | config-service | ✅ 활성 |
| **congestion.ts** | config-service | ✅ 활성 |
| **express-trains.ts** | config-service | ✅ 활성 |
| **matching-engine.ts** | BadgeService, matching-service | ✅ 활성 |
| **seoul-line-1-stations.json** | data/index.ts 또는 스크립트 | ⚠️ 확인 필요 |
| **gyeongki-incheon-stations.json** | data/index.ts 또는 스크립트 | ⚠️ 확인 필요 |

> **평가**: data/ 파일들은 config-service를 통해 간접 사용. JSON 파일들은 Firestore 초기화 스크립트에서 사용 가능.

---

## 4. beta1-orchestration-service.ts 분석

> 파일 경로: `src/services/beta1-orchestration-service.ts`  
> 총 라인 수: ~1,756줄

### 4.1 논리적 모듈 분리 제안 (7개 모듈)

| # | 모듈명 | 라인 범위 | 줄수 | 책임 |
|---|--------|----------|------|------|
| A | **Beta1ModelHelpers** | 193~461 | ~270 | 도메인 모델(PARTNER_QUOTES, 타입, 유틸리티) |
| B | **Beta1PricingEngine** | 497~691 | ~195 | 요금 계산, 견적 카드 생성 |
| C | **Beta1RequestLifecycle** | 49~91, 693~976 | ~330 | 요청 생성 입력 타입 + createBeta1Request |
| D | **Beta1ActorBundleOrchestration** | 978~1377 | ~400 | 배우 선택, 번들 생성, 미션 수락 |
| E | **Beta1Snapshots** | 1390~1670 | ~280 | Home/Chat/Admin 스냅샷 빌더 |
| F | **Beta1PersistenceSync** | 1672~1755 | ~84 | 상태 영속화, 배송 동기화 |
| G | **Beta1Types** | 93~191 | ~100 | 인터페이스/타입 정의 |

### 4.2 복잡도 핫스팟 (Top 3)

| 함수 | 줄수 | 복잡도 | 이유 |
|------|------|--------|------|
| `createBeta1Request` | ~284줄 | 🔴 높음 | AI 분석 → 견적 → Firestore 다중 쓰기 |
| `acceptMissionBundleForGiller` | ~176줄 | 🔴 높음 | 검증 → 미션/다리 업데이트 → B2B 폴백 |
| `getBeta1HomeSnapshot` | ~192줄 | 🟡 중간 | 다중 컬렉션 집계 |

### 4.3 분리 시 주의사항

1. **공유 상태**: `PARTNER_QUOTES` 상수, `db`(Firestore) 인스턴스가 모든 모듈에서 사용
2. **의존 관계**: `createBeta1Request`가 pricing, AI, wallet, matching 서비스를 모두 호출
3. **권장 접근**: 
   - `src/services/beta1/` 하위 디렉토리에 7개 파일로 분리
   - 파사드 패턴으로 기존 export 호환성 유지
   - DI(의존성 주입) 도입으로 테스트 가능성 향상

---

## 5. Firebase Functions 분석

> 파일 경로: `functions/src/index.ts` (3,037줄) + 보조 파일 4개  
> **총 트리거 수: 34개** (index.ts) + 1개 (station-sync.ts) = **35개**

### 5.1 트리거 인벤토리

#### onCall (클라이언트 직접 호출) — 19개

| # | 함수명 | 라인 | 인증 | 설명 |
|---|--------|------|------|------|
| 1 | triggerMatching | 870 | ✅ | 매칭 트리거 |
| 2 | saveFCMToken | 920 | ✅ | FCM 토큰 저장 |
| 3 | beta1AnalyzeRequestDraft | 958 | ✅ | AI 요청 분석 |
| 4 | beta1GeneratePricingQuotes | 977 | ✅ | 견적 생성 |
| 5 | beta1PlanMissionExecution | 996 | ✅ | 미션 계획 |
| 6 | sendPushNotification | 1150 | ✅ | 푸시 알림 |
| 7 | reviewPromotion | 1206 | ✅ | 길러 승급 심사 |
| 8 | calculateDeliveryRate | 1420 | ✅ | 배송 요율 계산 |
| 9 | **calculateDeliveryPricing** | 1477 | ❌ **_context** | 배송 요금 계산 |
| 10 | matchRequests | 1618 | ✅ | 요청 매칭 |
| 11 | acceptMatch | 1666 | ✅ | 매칭 수락 |
| 12 | rejectMatch | 1778 | ✅ | 매칭 거절 |
| 13 | completeMatch | 1853 | ✅ | 매칭 완료 |
| 14 | triggerFareCacheSync | 2053 | ✅ | 요금 캐시 동기화 |
| 15 | startCiVerificationSession | 2239 | ✅ | CI 본인확인 시작 |
| 16 | **issueKakaoCustomToken** | 2350 | ❌ **auth 없음** | 카카오 커스텀 토큰 발급 |
| 17 | completeCiVerificationTest | 2864 | ✅ | CI 테스트 완료 |
| 18 | requestPhoneOtp | 2887 | ✅ | OTP 발송 |
| 19 | confirmPhoneOtp | 2953 | ✅ | OTP 확인 |

#### onRequest (HTTPS 엔드포인트) — 6개

| # | 함수명 | 라인 | 설명 |
|---|--------|------|------|
| 1 | ciMock | 2319 | CI 모의 화면 (개발용) |
| 2 | naverStaticMapProxy | 2478 | 네이버 정적 지도 프록시 |
| 3 | naverGeocodeProxy | 2532 | 네이버 지오코드 프록시 |
| 4 | naverDirectionsProxy | 2609 | 네이버 경로 프록시 |
| 5 | jusoAddressSearchProxy | 2715 | 주소 검색 프록시 |
| 6 | ciVerificationCallback | 2765 | CI 본인확인 콜백 |

#### Firestore Trigger (백그라운드) — 5개

| # | 함수명 | 라인 | 트리거 | 경로 |
|---|--------|------|--------|------|
| 1 | onRequestCreated | 550 | onCreate | requests/{requestId} |
| 2 | sendMatchFoundNotification | 634 | onCreate | matches/{matchId} |
| 3 | onRequestStatusChanged | 702 | onUpdate | requests/{requestId} |
| 4 | onChatMessageCreated | 1072 | onCreate | chatRooms/{chatRoomId}/messages/{messageId} |
| 5 | onDeliveryCompleted | 1321 | onUpdate | deliveries/{deliveryId} |

#### Scheduled (정기 실행) — 4개

| # | 함수명 | 라인 | 스케줄 | 설명 |
|---|--------|------|--------|------|
| 1 | cleanupOldNotifications | 1037 | 일별 | 오래된 알림 정리 |
| 2 | scheduledTaxInvoice | 1996 | 매월 1일 00:00 | 세금계산서 발행 |
| 3 | scheduledGillerSettlement | 2015 | 매월 5일 00:00 | 길러 정산 |
| 4 | scheduledFareCacheSync | 2034 | 매주 월 03:00 | 요금 캐시 갱신 |

### 5.2 가장 무거운 함수

| 함수 | 줄수 | 복잡도 |
|------|------|--------|
| **calculateDeliveryPricing** | ~130줄 (1477-1609) | 🔴 높음 — 요금/세금/수수료 전체 계산 |
| **acceptMatch** | ~110줄 (1666-1777) | 🔴 높음 — 매칭 수락/배송 생성 |
| **completeMatch** | ~140줄 (1853-1995) | 🔴 높음 — 완료/정산/포인트 처리 |
| **issueKakaoCustomToken** | ~120줄 (2350-2477) | 🟡 중간 — 카카오 연동/사용자 생성 |

### 5.3 클라이언트 호출 vs 백그라운드 비율

| 분류 | 개수 | 비율 |
|------|------|------|
| 클라이언트 직접 호출 (onCall + onRequest) | 25 | **71%** |
| 백그라운드 트리거 (onCreate + onUpdate + Scheduled) | 9 | **26%** |
| station-sync.ts 추가 | 1 | 3% |

---

## 6. Admin Web - App 연결 분석

### 6.1 Admin Web API 라우트 (28개)

| 경로 | 접근 방식 | Firestore 컬렉션 |
|------|----------|-----------------|
| /api/login | Firebase Auth (IdToken → 세션 쿠키) | users |
| /api/logout | 세션 쿠키 삭제 | - |
| /api/admin/dashboard | `getAdminDb()` 직접 | withdraw_requests, disputes, giller_applications, delivery_requests, users, config_integrations, ai_analyses, actor_selection_decisions, request_drafts, config_fares |
| /api/admin/withdrawals | `getAdminDb()` 직접 | withdraw_requests, point_transactions |
| /api/admin/verifications | `getAdminDb()` 직접 | users (verification 하위컬렉션) |
| /api/admin/points | `getAdminDb()` 직접 | point_transactions, users |
| /api/admin/settlements | `getAdminDb()` 직접 | settlements |
| /api/admin/lockers | `getAdminDb()` 직접 | lockers |
| /api/admin/non-subway-lockers | `getAdminDb()` 직접 | non_subway_lockers |
| /api/admin/users | `getAdminDb()` 직접 | users |
| /api/admin/deliveries | `getAdminDb()` 직접 | delivery_requests |
| /api/admin/deposits | `getAdminDb()` 직접 | deposits, delivery_requests |
| /api/admin/disputes | `getAdminDb()` 직접 | disputes |
| /api/admin/fare-cache | `getAdminDb()` 직접 | config_fares |
| /api/admin/gillers | `getAdminDb()` 직접 | users, shared/pricing-policy |
| /api/admin/consents | `getAdminDb()` 직접 | consentTemplates |
| /api/admin/consents/[id] | `getAdminDb()` 직접 | consentTemplates |
| /api/admin/consents/[id]/versions | `getAdminDb()` 직접 | consentTemplates |
| /api/admin/requests/[id]/fee | `getAdminDb()` 직접 | delivery_requests |
| /api/admin/integrations/bank | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/payment | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/identity | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/bank/test | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/payment/test | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/ai | `getAdminDb()` 직접 | config_integrations |
| /api/admin/integrations/ai/test | `getAdminDb()` 직접 | AI 테스트 |
| /api/admin/beta1-infrastructure | `getAdminDb()` 직접 | config_* |
| /api/admin/beta1-ai-review | `getAdminDb()` 직접 | ai_analyses |

### 6.2 접근 패턴 분석

| 패턴 | 비율 | 설명 |
|------|------|------|
| **Admin SDK 직접 Firestore** | **100%** | 모든 라우트가 `getAdminDb()` 사용 |
| Functions 경유 | **0%** | admin-web은 Functions를 거치지 않음 |
| src/services/ 직접 import | **0%** | admin-web은 앱 서비스를 import하지 않음 |

> **핵심 발견**: admin-web은 Firebase Admin SDK로 Firestore에 직접 접근합니다. Functions나 src/services/를 거치지 않습니다.

### 6.3 중복 로직

| 영역 | 앱 (src/services/) | Admin Web | 중복 여부 |
|------|-------------------|-----------|----------|
| 출금 요청 조회 | PointService.ts (`WITHDRAW_COLLECTION = 'withdraw_requests'`) | admin/withdrawals, admin/dashboard | ⚠️ 컬렉션명 중복 |
| 요금 정책 | shared/pricing-policy.ts | admin/gillers에서 import | ✅ shared로 공유 중 |
| 정산 계산 | SettlementService.ts | admin/settlements (직접 조회만) | ✅ 계산 로직 중복 없음 |
| 사용자 조회 | user-service.ts | admin/users (직접 Firestore) | ⚠️ 조회 로직 중복 |

### 6.4 Admin 전용 기능

다음은 모바일 앱에 없고 admin-web에만 있는 기능입니다:

- 관리자 대시보드 (전체 현황 집계)
- 분쟁 관리 (상태 변경)
- 출금 승인/거절
- 길러 신청 심사
- 동의 템플릿 관리 (CRUD)
- 연동 설정 (은행/PG/본인확인/AI)
- 요금 캐시 관리
- Beta1 인프라 설정
- AI 분석 리뷰

---

## 7. 보안 체크

### 7.1 Firestore 보안 규칙

> 파일: `firestore.rules` (623줄)

**강점**:
- `isAuthenticated()`, `isOwner()`, `isAdmin()` 헬퍼 함수 체계적 사용
- 대부분의 컬렉션이 인증 + 소유자/관리자 검증
- wallet, payments, settlements는 관리자만 쓰기 가능
- Beta1 컬렉션(request_drafts, missions 등)도 참여자/관리자 검증

**공개 읽기 허용 컬렉션** (의도적, 비민감):
- `config_stations`, `config_travel_times`, `config_express_trains`, `config_congestion`, `config_algorithm_params`

**잠재적 위험**:

| 항목 | 심각도 | 설명 |
|------|--------|------|
| 채팅 메시지 쓰기 권한 | 🟡 중간 | `chats/{chatId}/messages/{messageId}` — `allow write: if isAuthenticated()` 참여자 확인 없이 모든 인증 사용자가 쓰기 가능 |
| 경매(auctions) 생성 | 🟡 중간 | `allow create: if isAuthenticated()` — 본인 확인 없이 누구나 경매 생성 가능 |
| 입찰(bids) 생성 | 🟡 중간 | `allow create: if isAuthenticated()` — 본인 확인 없이 누구나 입찰 가능 |

### 7.2 Storage 보안 규칙

> 파일: `storage.rules` (78줄)

| 경로 | 읽기 | 쓰기 | 평가 |
|------|------|------|------|
| /users/{userId} | **공개** (if true) | 본인만 | ⚠️ 의도치 않은 공개 |
| /photos/{userId} | 인증 필요 | 본인만 | ✅ 양호 |
| /public/ | 공개 | 쓰기 불가 | ✅ 양호 |
| /pickup-photos/ | 인증 필요 | 인증 필요 | ⚠️ 쓰기가 인증만으로 가능 |
| /delivery-photos/ | 인증 필요 | 인증 필요 | ⚠️ 동일 |
| /profile-photos/ | 공개 | 본인만 | ✅ 양호 |
| /id-photos/ | 본인만 | 본인만 | ✅ 양호 |
| /chat-photos/ | 인증 필요 | 인증 필요 | ⚠️ 참여자 검증 없음 |
| /locker-photos/ | 공개 | 인증 필요 | ✅ 양호 |

**🚨 HIGH**: `/users/{userId}/` 경로의 **공개 읽기**는 의도치 않게 모든 사용자 파일이 인터넷에 공개될 수 있습니다.

### 7.3 인증 없이 사용 가능한 Functions

| 함수 | 유형 | 위험도 | 설명 |
|------|------|--------|------|
| **calculateDeliveryPricing** | onCall | 🔴 높음 | `_context`로 인증 무시. 누구나 요금 계산 가능 (금액 조작은 서버에서 방어) |
| **issueKakaoCustomToken** | onCall | 🟡 중간 | 인증 게이트 없음. 카카오 액세스 토큰 검증 후 커스텀 토큰 발급. 정상적인 로그인 흐름이지만, 남용 방지 필요 |
| **ciMock** | onRequest | 🟢 낮음 | 개발/테스트용 모의 CI. 프로덕션에서는 비활성화 권장 |
| **ciVerificationCallback** | onRequest | 🟢 낮음 | CI 제공사 콜백. 세션 ID 검증으로 충분 |
| **naver*Proxy** (3개) | onRequest | 🟢 낮음 | API 키 숨기기 위한 프록시. rate limiting 필요 |
| **jusoAddressSearchProxy** | onRequest | 🟢 낮음 | 주소 검색 프록시. rate limiting 필요 |

### 7.4 결제/정산 보안

| 검증 항목 | 상태 | 설명 |
|-----------|------|------|
| 서버 측 요금 계산 | ✅ | `calculateDeliveryPricing`이 서버에서 계산 |
| TossPayments 콜백 검증 | ⚠️ | 콜백 검증 로직 확인 필요 |
| 정산 금액 서버 검증 | ✅ | `shared/pricing-policy.ts`로 서버에서 통일 |
| 클라이언트 금액 조작 방지 | ⚠️ | `calculateDeliveryPricing`에 인증 없음 |
| 포인트/출금 검증 | ✅ | beta1-wallet-service에서 자격 검증 |

### 7.5 하드코딩 시크릿

- **확인 결과**: 소스 코드에 하드코딩된 API 키/시크릿 **없음** ✅
- 모든 키는 환경 변수(`process.env`, `defineString`)로 관리

---

## 8. 테스트 커버리지 현실

### 8.1 테스트 파일 인벤토리

| 위치 | 파일 수 | 설명 |
|------|---------|------|
| tests/ | 15 (2개 .skip) | 메인 테스트 디렉토리 |
| src/services/__tests__/ | 5 | 서비스 단위 테스트 |
| src/services/*.test.ts | 2 | 서비스 내 테스트 |
| __tests__/ | 8 | 루트 테스트 |
| e2e/ (Detox) | 4 (.test.ts) | E2E 테스트 |
| e2e/ (Playwright) | 5 (.spec.ts) | E2E 테스트 |
| src/components/*.test.tsx | 2 | 컴포넌트 테스트 |
| **총계** | **~41** | |

### 8.2 서비스별 테스트 현황

| 서비스 | 테스트 있음 | 테스트 파일 |
|--------|------------|------------|
| pricing-service | ✅ | tests/pricing-service.test.ts |
| payment-service | ✅ | tests/payment-service.test.ts |
| user-service | ✅ | tests/user-service.test.ts |
| route-service | ✅ | tests/route-service.test.ts, src/services/route-service.test.ts, __tests__/services/route-service.test.ts |
| matching-service | ✅ | tests/matching-service.test.ts, src/services/__tests__/matching-service.test.ts, __tests__/services/matching-service.test.ts |
| config-service | ✅ | src/services/config-service.test.ts, __tests__/services/config-service.test.ts |
| delivery-service | ✅ | tests/delivery-service.test.ts |
| request-service | ✅ | tests/request-service.test.ts |
| rating-service | ✅ | tests/rating-service.test.ts |
| notification-service | ✅ | tests/notification-service.test.ts |
| penalty-service | ✅ | tests/penalty-service.test.ts |
| b2b-services | ✅ | tests/b2b-services.test.ts |
| media-service | ✅ | src/services/__tests__/media-service.test.ts |
| delivery-tracking-service | ✅ | src/services/__tests__/delivery-tracking-service.test.ts |
| qrcode-service | ✅ | src/services/__tests__/qrcode-service.test.ts |
| location-service | ✅ | src/services/__tests__/location-service.test.ts |
| **핵심 서비스 테스트 없음** | ❌ | |
| beta1-orchestration-service | ❌ | **테스트 없음** — 가장 복잡한 서비스 |
| beta1-wallet-service | ❌ | **테스트 없음** — 지갑/출금 로직 |
| beta1-ai-service | ❌ | **테스트 없음** — AI 연동 |
| beta1-engine-service | ❌ | **테스트 없음** — 요청 생성 엔진 |
| DepositService | ❌ | **테스트 없음** — 보증금 처리 |
| TossPaymentService | ❌ | **테스트 없음** — 결제 연동 |
| SettlementService | ❌ | **테스트 없음** — 정산 계산 |
| chat-service | ❌ | **테스트 없음** — 채팅 |
| verification-service | ❌ | **테스트 없음** — 본인확인 |
| locker-service | ❌ | **테스트 없음** — 락커 관리 |

### 8.3 스킵된 테스트

| 파일 | 이유 |
|------|------|
| tests/compatibility.test.ts.skip | 호환성 테스트 |
| tests/security.test.ts.skip | 보안 테스트 |
| tests/chat.e2e.test.ts.skip | 채팅 E2E |

### 8.4 테스트 품질 평가

| 등급 | 기준 | 해당 테스트 |
|------|------|------------|
| 🟢 REAL | 실제 로직 검증, 의미 있는 assertion | pricing-service, route-service (3개 중복) |
| 🟡 MOCK-HEAVY | 대부분 mock, 일부 로직 검증 | payment-service, matching-service, delivery-service |
| 🔴 SKELETON | 최소 assertion, 형식적 | notification-service, penalty-service |

### 8.5 커버리지 추정

| 영역 | 추정 커버리지 | 근거 |
|------|-------------|------|
| 전체 서비스 | **~25%** | 67개 중 ~17개만 테스트 존재 |
| 핵심 비즈니스 로직 | **~15%** | orchestration, wallet, AI, 결제, 정산 무방비 |
| 화면/컴포넌트 | **~3%** | 58개 화면 중 2개만 컴포넌트 테스트 |
| E2E | **~10%** | 5개 Playwright 스펙, 4개 Detox 플로우 |

> **평가**: 핵심 오케스트레이션, 결제, 정산, 지갑 서비스에 테스트가 전혀 없는 것이 **가장 심각한 기술 부채**입니다.

---

## 종합 요약

### 🟢 잘 설계된 부분

1. **서비스 독립성**: 대부분의 서비스가 firebase.ts에만 의존하고 서로 간 결합도가 낮음
2. **Firestore 보안 규칙**: 소유자/관리자 기반 접근 제어 체계적
3. **shared/ 모듈**: 요금 정책, 매칭 엔진, 계좌 검증이 클라이언트-서버 간 공유
4. **환경 변수 관리**: 하드코딩 시크릿 없음
5. **관리자 인증**: admin-web의 쿠키 기반 인증 + Firebase Admin SDK

### 🔴 즉각 개선 필요

1. **calculateDeliveryPricing 인증 없음** — 누구나 요금 계산 API 호출 가능
2. **beta1-orchestration 1,756줄** — 7개 모듈로 분리 필요
3. **핵심 서비스 테스트 부재** — orchestration, wallet, payment, settlement 무방비
4. **Storage 공개 읽기** — /users/{userId}/ 경로 공개 노출

### 🟡 중기 개선 권장

1. **간접 순환 의존** — request ↔ matching ↔ delivery 간 정리
2. **~10개 미사용 서비스** — 실제 사용처 확인 후 제거 또는 통합
3. **Admin-App 중복 로직** — Firestore 직접 접근을 공유 모듈로 통합
4. **채팅/경매 보안 규칙** — 참여자 검증 추가
5. **공개 프록시 rate limiting** — 네이버/주소 프록시 남용 방지

### 통계 요약

| 항목 | 수치 |
|------|------|
| 서비스 총수 | 67개 |
| 화면 총수 | 58개 |
| Firebase Functions 트리거 | 35개 |
| Admin API 라우트 | 28개 |
| 타입 export | 402개 |
| 테스트 파일 | 41개 |
| 서비스 테스트 커버리지 | ~25% |
| 순환 의존 | 0개 직접, 3개 간접 |
| 화면 미사용 서비스 | ~32개 (48%) |
| 보안 이슈 (HIGH) | 2개 |
| 보안 이슈 (MEDIUM) | 5개 |
