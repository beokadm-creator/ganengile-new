# 가는길에 — CLAUDE.md

서울 지하철 기반 크라우드 배송 서비스입니다.

---

## 로컬 경로 기준

> 문서 내 모든 `/Users/aaron/ganengile-new/` 경로는 이 머신에서 아래로 대응합니다.
> `/c/Users/whhol/Documents/trae_projects/ganengile/` (bash) 또는 `C:\Users\whhol\Documents\trae_projects\ganengile\` (Windows)

---

## 문서 목차 경로

| 분류 | 경로 |
|---|---|
| 문서 인덱스 (기준점) | `docs/README.md` |
| 전체 아키텍처 | `docs/core/architecture.md` |
| 역할/인증/승급 | `docs/core/identity-and-roles.md` |
| 매칭/동선 | `docs/core/matching-and-routing.md` |
| 요금/운임/정산 | `docs/core/pricing-and-fares.md` |
| 사물함/전달 방식 | `docs/core/lockers-and-handover.md` |
| 요청자 앱 흐름 | `docs/flows/requester-app.md` |
| 길러 앱 흐름 | `docs/flows/giller-app.md` |
| 관리자 웹 | `docs/admin/admin-web.md` |
| 배포/환경변수 | `docs/ops/deployment-and-env.md` |
| 스모크 테스트 | `docs/ops/smoke-test.md` |
| 에이전트 인수인계 | `docs/ops/agent-handoff.md` |
| 문서 운영 규칙 | `docs/ops/documentation-rules.md` |
| 역/운임/사물함 데이터 | `docs/data/station-and-fare-data.md` |

---

## 프로젝트 구성

- **앱**: `src/` — Expo + React Native Web
- **관리자 웹**: `admin-web/` — Next.js App Router
- **백엔드**: `functions/src/` — Firebase Cloud Functions
- **데이터**: Firebase Auth, Firestore, Hosting, App Hosting

### 앱 코드 주요 경로

| 역할 | 경로 |
|---|---|
| 네비게이션 | `src/navigation/` |
| 화면 (메인) | `src/screens/main/` |
| 화면 (길러) | `src/screens/giller/` |
| 화면 (요청자) | `src/screens/requester/` |
| 화면 (B2B) | `src/screens/b2b/` |
| 화면 (온보딩) | `src/screens/onboarding/` |
| 서비스/비즈니스 로직 | `src/services/` |
| 컨텍스트 | `src/contexts/` |
| 타입 | `src/types/` |
| 관리자 API | `admin-web/app/api/` |
| 관리자 화면 | `admin-web/app/(admin)/` |

---

## 핵심 역할 모델

- `gller` (오타 주의): 배송 요청자
- `giller`: 배송 수행자
- `both`: 두 역할 동시 가능

---

## 요금 구조

기본요금 + 거리 + 무게 + 크기 + 긴급도 + 지하철 운임 + 서비스 수수료 + VAT

- 운임 캐시 기준 컬렉션: `config_fares`
- 앱 기본 동작: cache-only (캐시 없으면 요청 생성 차단)
- `publicFare <= 0` 요청은 생성 금지

---

## 배송 상태 흐름

`accepted` → `in_transit` → `at_locker` (사물함 경유 시) → `delivered` → `completed`

---

## ⚠️ 문서-코드 단절 현황 (2026-03-18 기준)

현재 `docs/`에 **문서화되지 않은** 기능이 다수 존재합니다.

### 미문서화 주요 기능

| 기능 | 관련 파일 |
|---|---|
| **B2B 서비스** | `src/screens/b2b/`, `src/services/b2b-*.ts` |
| **경매(Auction)** | `src/screens/main/CreateAuctionScreen.tsx`, `src/services/auction-service.ts` |
| **배지(Badge) 시스템** | `src/services/badge-service.ts`, `src/screens/main/BadgeCollectionScreen.tsx` |
| **포인트 시스템** | `src/services/PointService.ts`, `src/screens/main/PointHistoryScreen.tsx`, `PointWithdrawScreen.tsx` |
| **전문 길러(Professional Giller)** | `src/services/ProfessionalGillerService.ts`, `GillerLevelUpgradeScreen.tsx`, `LevelBenefitsScreen.tsx` |
| **실시간 배송 추적** | `src/services/RealtimeSubwayService.ts`, `realtime-delivery-tracking.ts`, `RealtimeTrackingScreen.tsx` |
| **보증금(Deposit)** | `src/services/DepositService.ts`, `DepositPaymentScreen.tsx` |
| **QR/픽업 검증** | `src/services/qrcode-service.ts`, `pickup-verification-service.ts`, `QRCodeScannerScreen.tsx`, `PickupVerificationScreen.tsx` |
| **원타임 매칭** | `src/screens/main/OnetimeModeScreen.tsx`, `src/services/matching/OneTimeMatchingService.ts` |
| **환승 매칭** | `src/services/matching/TransferMatchingService.ts`, `src/services/transfer-service.ts` |
| **등급 시스템** | `src/services/grade-service.ts`, `CommissionService.ts` |
| **패널티** | `src/services/penalty-service.ts` |
| **세금계산서** | `src/services/tax-invoice-service.ts`, `TaxInvoiceRequestScreen.tsx` |
| **법인 계약/정기결제** | `src/services/business-contract-service.ts`, `BusinessProfileScreen.tsx`, `MonthlySettlementScreen.tsx`, `SubscriptionTierSelectionScreen.tsx` |
| **평점** | `src/services/rating-service.ts`, `RatingScreen.tsx`, `MyRatingScreen.tsx` |

### 관리자 웹 미문서화 페이지

문서(`docs/admin/admin-web.md`)에는 없지만 실제 존재하는 페이지:
- `admin-web/app/(admin)/gillers/` — 길러 목록 전용
- `admin-web/app/(admin)/integrations/` — 외부 연동
- `admin-web/app/(admin)/points/` — 포인트 관리

### 문서 내 경로 불일치

docs 내 모든 절대경로가 `/Users/aaron/ganengile-new/`를 기준으로 작성되어 있어 다른 머신에서 직접 사용 불가. 이 CLAUDE.md의 경로 매핑 표를 기준으로 보정해야 합니다.

---

## 문서 갱신 규칙

1. `src/screens` 동선이 바뀌면 `docs/flows/` 문서를 **같은 커밋**에 포함합니다.
2. `src/services` 로직이 바뀌면 대응 `docs/core/` 문서를 갱신합니다.
3. Firebase 설정/배포/환경변수 변경 시 `docs/ops/deployment-and-env.md`를 갱신합니다.
4. 문서와 코드가 다르면 **코드 기준**으로 문서를 즉시 수정합니다. (코드 우선 원칙)
5. 새 기능 추가 시 `docs/README.md` 목차에도 항목을 추가합니다.
6. 중복 문서를 만들지 않습니다. 기존 파일을 갱신합니다.
7. 임시 보고서성 파일은 루트에 만들지 않습니다.

## 규칙 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-03-18 | 초기 CLAUDE.md 작성. 문서-코드 단절 현황 정리. |
| 2026-03-18 | UX 흐름 단절 1차 수정: useGillerAccess hook, PASS_TEST_MODE guard, DepositService import, ChatScreen 수락 후 추적 이동, RequestDetail 채팅/수령→평가 연결, EarningsScreen 출금 연결, DeliveryTracking 고객센터 연결. |
| 2026-03-18 | UX 흐름 단절 2차 수정: PointHistoryScreen/PointWithdrawScreen/BadgeCollectionScreen hardcoded userId → useUser() 적용. ProfileScreen 심사중 빈 onPress → Alert 안내. GillerLevelUpgradeScreen 승급 후 refreshUser + Profile 이동. GillerPickupFromLockerScreen/GillerDropoffAtLockerScreen 카메라권한/완료 후 흐름 개선. |

---

## 에이전트 시작 순서

1. 이 파일(`CLAUDE.md`) 먼저 확인
2. `docs/README.md` 목차 확인
3. 작업 관련 `docs/core/*` 또는 `docs/flows/*` 확인
4. 배포/환경변수 작업이면 `docs/ops/deployment-and-env.md`
5. 역/운임/사물함 데이터 작업이면 `docs/data/station-and-fare-data.md`
