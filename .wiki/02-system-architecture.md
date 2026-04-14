# 시스템 아키텍처 (System Architecture)

## 전체 구성(High-level)
이 저장소는 3개의 실행 단위를 함께 관리한다.

1. **App (Mobile/Web)**: Expo + React Native (`src/`)
2. **Admin Web**: Next.js App Router (`admin-web/`)
3. **Backend**: Firebase Cloud Functions (`functions/`)

공통으로 **Firestore + Firebase Auth** 를 사용하며, 지도/주소/요금 등은 외부 API 및 Functions 프록시를 통해 연동된다.

## 코드 구조(요약)

### App (`src/`)
- `src/screens/`: 화면(온보딩/요청 생성/매칭/채팅/추적/락커/정산/프로필 등)
- `src/services/`: 도메인 서비스(요청/매칭/배송/결제/포인트/락커/알림/검증 등)
- `src/types/`: Firestore 문서/도메인 타입(요청, 배송, 락커, 포인트, 패널티 등)
- `src/navigation/`: 네비게이션/탭 구조
- `src/components/`: 재사용 UI + 도메인 컴포넌트(락커, 지도, 미션보드 등)
- `shared/`: 요금정책/은행계좌 등 “앱/서버/관리자”에서 공유 가능한 로직

### Admin Web (`admin-web/`)
- `admin-web/app/(admin)/*`: 운영 기능 페이지(분쟁, 정산, 보증금, 가격정책, 연동 설정 등)
- Admin은 주로 “운영 관점”의 데이터/설정/대기열을 제공한다.

### Functions (`functions/`)
- Firebase Functions 엔드포인트(권한/프록시/서버 시크릿 처리/백오피스 작업 등)
- 지도/주소 같은 외부 API 연동에서 **서버 시크릿을 보호**하는 역할을 맡을 수 있다.

## 주요 데이터(추정/확인된 범위)
코드에서 컬렉션명이 드러나는 범위의 예시다(실제 전체 스키마는 `src/types/*` 및 서비스 코드를 우선).

- `users`: 사용자/역할/지갑 상태
- `requests`: 요청(생성/상태/매칭 결과 등)
- `deliveries`: 배송/수행(수락/픽업/완료/추적 이벤트 등)
- `chat_rooms`, `messages`(추정): 채팅/메시지
- `lockers`, `locker_reservations`, `non_subway_lockers`: 락커/예약/비지하철 락커
- `deposits`: 보증금
- `wallet_ledgers`, `wallet_entries`, `point_transactions`, `withdraw_requests`: 지갑/포인트/출금
- `penalties`, `warnings`: 패널티/경고

## “요청 → 매칭 → 수행” 데이터 흐름(개념)
> 아래는 코드를 기반으로 한 “개념적” 흐름이다(세부 단계는 리팩토링/모듈화로 변할 수 있음).

1. **요청 생성**
   - 화면: `src/screens/main/create-request/*`
   - 저장: `requests` 문서 생성/갱신
2. **견적/요금 산정**
   - 서비스: `src/services/pricing-service.ts`, `src/services/request/*`
   - 정책: `shared/pricing-policy.ts`(공유 정책 기반)
3. **매칭**
   - 서비스: `src/services/matching-service.ts`
   - 입력: 요청 정보 + 길러 라우트(`route-service`)
   - 결과: 후보/스코어/알림 + 채팅방 생성(연동)
4. **수행(배송 라이프사이클)**
   - 서비스: `src/services/delivery-service.ts` → `src/services/delivery/*`로 모듈화 진행
   - 이벤트: 수락/취소/픽업 인증/위치 업데이트/도착/락커 전달/완료 등
5. **정산/지갑**
   - 서비스: `src/services/payment-service.ts`, `src/services/PointService.ts`
   - 출금: `withdraw_requests` 중심(관리자 승인/대기 포함 가능)

## 환경변수/연동
- 템플릿: [`../.env.example`](../.env.example)
- 정리 문서: [`../docs/ops/deployment-and-env.md`](../docs/ops/deployment-and-env.md)
- 배포 전 점검: [`../docs/deployment-preflight.md`](../docs/deployment-preflight.md)

