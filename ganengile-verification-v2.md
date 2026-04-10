# 가넹길(ganengile-new) 프로젝트 재검증 보고서 v2

> 분석 일시: 2026-04-10 (2차 심층 분석)
> 이전 분석 대비 변경사항 중심
> 목적: 개선 후 미비된 부분 식별, 기존 시스템 안정성 확보

---

## 변경 요약 (v1 → v2)

### ✅ 해결된 문제 (4건)

| # | 항목 | 이전 상태 | 현재 상태 |
|---|------|----------|----------|
| 1 | **calculateDeliveryPricing 인증 없음** | ❌ 인증 없음 | ✅ `requireCallableAuth(context, 'calculateDeliveryPricing')` 추가 (index.ts:1517) |
| 2 | **Storage /users/{userId}/ 공개 읽기** | ❌ `allow read: if true` | ✅ `request.auth != null && request.auth.uid == userId` (storage.rules:8) |
| 3 | **beta1-orchestration 거대 파일** | ❌ 1,756줄 단일 파일 | ✅ 988줄로 축소 + 6개 모듈 분리 |
| 4 | **Firestore 채팅 메시지 참여자 검증** | ⚠️ `chats/{chatId}` 미검증 | ✅ `chatRooms/{chatRoomId}/messages/` 참여자 검증 추가 (firestore.rules:607-620) |

### 🔴 새로 발견된 문제 (v2에서 처음 식별)

| # | 항목 | 심각도 | 설명 |
|---|------|--------|------|
| 1 | **Firestore 규칙 미커버 컬렉션** | 🔴 HIGH | B2B_DELIVERIES, B2B_TAX_INVOICES, B2B_NOTIFICATION, TRANSFER_MATCHES 등 코드에서 사용되나 규칙에 없음 |
| 2 | **requestPhoneOtp / confirmPhoneOtp 인증 없음** | 🔴 HIGH | OTP 함수들이 `requireCallableAuth` 없이 구현됨. 남용 가능성 |
| 3 | **onRequest 엔드포인트 rate limiting 없음** | 🟡 MEDIUM | naver*Proxy, jusoAddressSearchProxy, ciMock, syncConfigStations 등 인증/rate limiting 없음 |
| 4 | **chats/{chatId}/messages 이중 경로** | 🟡 MEDIUM | `chats/{chatId}/messages/`(미검증)와 `chatRooms/{chatRoomId}/messages/`(검증됨)가 공존. 앱이 어느 경로를 사용하는지 확인 필요 |
| 5 | **beta1-orchestration 부분 분리** | 🟡 MEDIUM | 모듈 분리는 진행됐으나 파사드/인덱스 없이, 새 모듈들이 imported-by=0인 상태 |

---

## 1. 서비스 연결도 재분석

### 1.1 현재 규모

| 항목 | v1 (이전) | v2 (현재) | 변화 |
|------|----------|----------|------|
| 서비스 파일 수 | ~67개 | **82개** | +15 (신규 beta1 모듈 + 신규 서비스) |
| 화면 파일 수 | 58개 | **57개** | -1 |
| Functions 트리거 | 35개 | **34+** | 유사 (index.ts 3,122줄) |
| Admin API 라우트 | 28개 | **28개** | 동일 |

### 1.2 순환 의존 (변화 없음, 여전히 존재)

**7-노드 강결합 컴포넌트 (SCC)**:
```
request-service → matching-service → delivery-service → beta1-orchestration-service → beta1-engine-service → request-service
                    ↕
                chat-service → user-service → request-service
```

**영향**: 빌드에는 문제없으나, 리팩토링 시 순환 참조 오류 가능. 모듈 분리 시 인터페이스 도입 필요.

### 1.3 허브 서비스 (Fan-in 상위)

| 순위 | 서비스 | import 횟수 | 역할 |
|------|--------|-----------|------|
| 🥇 | **firebase.ts** | ~32 | DB/Auth/Storage 기반 (변화 없음) |
| 🥈 | **config-service.ts** | 6 | 역/시간/요금 설정 (↑ from 7→6, 의존성 감소) |
| 🥉 | **matching-service.ts** | 4 | 매칭 엔진 (↑ from 3) |
| 4 | **integration-config-service.ts** | 4 | 외부 연동 설정 |
| 5 | **beta1-orchestration-service.ts** | 2 | Beta1 오케스트레이션 (↑ 모듈 분리로 감소) |

### 1.4 Fan-out 높은 서비스 (과도한 의존)

| 서비스 | import 수 | 경고 |
|--------|----------|------|
| **beta1-orchestration-service.ts** | 6 | 🔴 주의 — 여전히 6개 서비스 의존 |
| **delivery-service.ts** | 6 | 🔴 주의 |
| **matching-service.ts** | 6 | 🔴 주의 |

---

## 2. beta1-orchestration 리팩토링 현황

### 2.1 파일 구조 변화

| 이전 (v1) | 현재 (v2) |
|-----------|----------|
| `beta1-orchestration-service.ts` (1,756줄) | `beta1-orchestration-service.ts` (**988줄**) |
| 단일 파일 | + `beta1-orchestration-snapshot-service.ts` |
| | + `beta1-orchestration-leg-service.ts` |
| | + `beta1-orchestration-quote-service.ts` |
| | + `beta1-engine-service.ts` (분리됨) |
| | + `beta1-infrastructure-service.ts` (분리됨) |

### 2.2 함수별 복잡도

| 함수 | 줄수 | 복잡도 | Firestore 작업 | 에러 처리 |
|------|------|--------|---------------|----------|
| `createBeta1Request` | ~286 (219-504) | 🔴 높음 | addDoc×5, setDoc×3, updateDoc×14+, getDoc×다수 | ✅ try/catch |
| `acceptMissionBundleForGiller` | ~176 (730-905) | 🔴 높음 | 다중 updateDoc, B2B 폴백 | ✅ try/catch |
| `bundleMissionsForDelivery` | ~94 (540-633) | 🟡 중간 | Firestore 다중 쓰기 | ✅ |
| `syncDeliveryToBeta1Execution` | ~65 (924-988) | 🟡 중간 | 동기화 업데이트 | ✅ |
| `createMissionForDeliveryLeg` | ~44 (635-678) | 🟢 낮음 | 단일 생성 | ✅ |
| `selectActorForMission` | ~33 (506-538) | 🟢 낮음 | 읽기+쓰기 | ✅ |
| `persistActorSelectionDecision` | ~16 (907-922) | 🟢 낮음 | 단일 생성 | ✅ |

### 2.3 미해결 문제

1. **파사드/인덱스 없음**: 분리된 모듈들이 re-export되는 진입점이 없어, import 경로가 분산됨
2. **새 모듈 imported-by=0**: `beta1-orchestration-leg-service.ts`, `beta1-orchestration-quote-service.ts` 등이 아직 다른 서비스에서 import되지 않음 (실제 사용 여부 확인 필요)
3. **PRICING_ENGINE, REQUEST_LIFECYCLE 모듈 미생성**: 이전 권장사항 중 2개 모듈 분리가 아직 진행되지 않음

---

## 3. Firebase Functions 보안 재분석

### 3.1 인증 현황 (onCall 함수)

| 함수 | 인증 | 입력 검증 | 에러 처리 | 변화 |
|------|------|----------|----------|------|
| calculateDeliveryPricing | ✅ **requireCallableAuth** | ✅ | ✅ | 🔥 **수정됨** |
| triggerMatching | ✅ | ✅ | ✅ | - |
| saveFCMToken | ✅ | ✅ | ✅ | - |
| beta1AnalyzeRequestDraft | ✅ | ✅ | ✅ | - |
| beta1GeneratePricingQuotes | ✅ | ✅ | ✅ | - |
| beta1PlanMissionExecution | ✅ | ✅ | ✅ | - |
| sendPushNotification | ✅ | ✅ | ✅ | - |
| reviewPromotion | ✅ | ❌ | ✅ | - |
| calculateDeliveryRate | ✅ | ✅ | ✅ | - |
| matchRequests | ✅ | ✅ | ✅ | - |
| acceptMatch | ✅ | ✅ | ✅ | - |
| rejectMatch | ✅ | ✅ | ✅ | - |
| completeMatch | ✅ | ✅ | ✅ | - |
| triggerFareCacheSync | ✅ (admin) | ❌ | ✅ | - |
| startCiVerificationSession | ✅ | ✅ | ✅ | - |
| **issueKakaoCustomToken** | ⚠️ **부분** | ✅ | ✅ | - |
| completeCiVerificationTest | ✅ | ✅ | ✅ | - |
| **requestPhoneOtp** | ❌ **없음** | ✅ | ✅ | 🔴 **새 발견** |
| **confirmPhoneOtp** | ❌ **없음** | ✅ | ✅ | 🔴 **새 발견** |

### 3.2 issueKakaoCustomToken 상세 분석

```typescript
// index.ts:2459-2462 — 인증 게이트
const uid = `kakao_${kakaoId}`;
if (context.auth?.uid && context.auth.uid !== uid) {
  throw new functions.https.HttpsError('permission-denied', '...');
}
```

**평가**: 이미 인증된 사용자의 경우 ID 일치를 검증하지만, **익명(미인증) 호출은 허용**됨. 카카오 로그인 플로우에서는 정상이나, 남용 방지를 위해 rate limiting 필요.

### 3.3 requestPhoneOtp / confirmPhoneOtp — 새로 발견된 위험

- **requestPhoneOtp** (index.ts:2972-3038): 인증 없이 OTP 발송 가능. 대량 OTP 발송 공격 가능.
- **confirmPhoneOtp** (index.ts:3040-3120): 인증 없이 OTP 확인 가능. 세션 하이재킹 위험.

**권장**: `requireCallableAuth` 추가 또는 최소한 rate limiting 구현.

### 3.4 onRequest 엔드포인트 보안

| 엔드포인트 | 인증 | Rate Limiting | 외부 API |
|-----------|------|--------------|----------|
| ciMock | ❌ | ❌ | 없음 (개발용) |
| naverStaticMapProxy | ❌ | ❌ | Naver API |
| naverGeocodeProxy | ❌ | ❌ | Naver API |
| naverDirectionsProxy | ❌ | ❌ | Naver API |
| jusoAddressSearchProxy | ❌ | ❌ | Juso API |
| ciVerificationCallback | ❌ | ❌ | 없음 |
| syncConfigStationsFromSeoulApi | ❌ | ❌ | Seoul API |

> **평가**: 모든 onRequest 엔드포인트가 인증 없이 공개되어 있음. 외부 API 키 노출 방지 목적이나, 남용 시 API 할당량 소진 가능.

---

## 4. Firestore + Storage 보안 재분석

### 4.1 Storage 규칙 (개선됨 ✅)

| 경로 | v1 (이전) | v2 (현재) |
|------|----------|----------|
| /users/{userId} | ❌ `allow read: if true` (공개) | ✅ `auth != null && uid == userId` (본인만) |
| /photos/{userId} | 인증 필요 | ✅ 동일 |
| /pickup-photos/ | 인증만 쓰기 | ⚠️ 동일 — 참여자 검증 없음 |
| /delivery-photos/ | 인증만 쓰기 | ⚠️ 동일 — 참여자 검증 없음 |
| /chat-photos/ | 인증만 | ⚠️ 동일 — 참여자 검증 없음 |

### 4.2 Firestore 규칙 — 커버리지 갭 (새 발견 🔴)

**코드에서 사용되나 규칙에 없는 컬렉션**:

| 컬렉션 | 사용 서비스 | 위험도 |
|--------|-----------|--------|
| b2b_deliveries | b2b-delivery-service | 🔴 HIGH |
| b2b_tax_invoices | tax-invoice-service | 🔴 HIGH |
| b2b_notifications | (코드에 존재) | 🟡 MEDIUM |
| transfer_matches | transfer-service | 🟡 MEDIUM |
| user_badges | badge-service | 🟡 MEDIUM |
| tiers | (타입에 정의) | 🟡 MEDIUM |
| contract_history | business-contract-service | 🟡 MEDIUM |
| config_policies | (코드에 존재) | 🟢 LOW |

> **영향**: 규칙이 없는 컬렉션은 **기본 거부**가 적용되어 앱 클라이언트에서 직접 접근 불가. Admin SDK로만 접근 가능하므로 기능적으로는 동작하나, 명시적 규칙이 없으면 보안 감사가 불가능.

### 4.3 이중 경로 문제 — chats vs chatRooms

```
firestore.rules:
  chats/{chatId}/messages/{messageId}      → allow read/write: if isAuthenticated() (참여자 미검증)
  chatRooms/{chatRoomId}/messages/{messageId} → 참여자 검증 있음 ✅
```

**확인 필요**: 앱이 어느 경로를 실제로 사용하는지. `chats/` 경로를 사용한다면 참여자 검증이 누락됨.

### 4.4 Auctions/Bids — 여전히 "임시"

```javascript
// firestore.rules:559-560
match /auctions/{auctionId} {
  allow create: if isAuthenticated(); // 임시: 개발 테스트용
}
match /bids/{bidId} {
  allow create: if isAuthenticated(); // 임시: 개발 테스트용
}
```

> 본인 확인 없이 누구나 경매/입찰 생성 가능. 프로덕션 전 본인 확인 추가 필요.

---

## 5. 화면-서비스 매핑 재분석

### 5.1 무서비스 화면 (고아 화면)

| 화면 | 서비스 import | 상태 |
|------|-------------|------|
| RequestConfirmationScreen | 0 | ⚠️ 순수 UI 또는 네비게이션 전용 |

### 5.2 무거운 화면 (서비스 import ≥5)

| 화면 | 서비스 수 | 서비스 목록 |
|------|----------|-----------|
| UnlockLockerScreen | 5 | firebase, locker, delivery, qrcode, photo |
| GillerDropoffAtLockerScreen | 5 | locker, delivery, photo, qrcode, firebase |

### 5.3 화면에서 사용되지 않는 서비스 (여전히 존재)

이전 분석에서 ~10개로 식별됨. 신규 beta1 모듈 중 일부(imported-by=0)가 추가됨:

- beta1-orchestration-leg-service
- beta1-orchestration-quote-service
- ProfessionalGillerService
- SettlementService (functions에서만 사용)
- RealtimeSubwayService
- media-service
- fare-service
- transfer-service

---

## 6. 데드 코드 재분석

### 6.1 이전 5개 데드 타입 — 4개 정리됨 ✅

| 타입 파일 | v1 상태 | v2 상태 |
|-----------|---------|---------|
| qrcode.ts | ❌ 데드 (0 import) | ✅ **삭제됨** |
| partner.ts | ❌ 데드 (0 import) | ✅ **삭제됨** |
| location.ts | ❌ 데드 (0 import) | ✅ **삭제됨** |
| module.ts | ❌ 데드 (0 import) | ✅ **삭제됨** |
| delivery-method.ts | ❌ 데드 (0 import) | ⚠️ **존재함** — DeliveryMethod, DeliveryMethodOption, DELIVERY_METHODS 정의 |

### 6.2 고아 익스포트 (새 발견)

| 서비스 | 익스포트 | import 횟수 | 상태 |
|--------|---------|-----------|------|
| beta1-infrastructure-service.ts | `getBeta1InfrastructureSnapshot()` | **0** | 🔴 고아 |

### 6.3 shared/ 모듈 — 모두 활성

| 모듈 | 사용처 |
|------|--------|
| pricing-policy.ts | functions/src/index.ts, pricing-service.ts |
| matching-engine.ts | functions/src/index.ts, data/index.ts |
| bank-account.ts | GillerApplyScreen.tsx 등 |

### 6.4 data/ — 모두 활성

8개 파일 모두 서비스/스크립트에서 사용됨. 미사용 없음.

### 6.5 TODO/FIXME 인벤토리

| 파일 | 개수 | 내용 |
|------|------|------|
| functions/src/scheduled/settlement-scheduler.ts | ~2 | 정산 스케줄러 미구현 |
| functions/src/scheduled/tax-invoice-scheduler.ts | ~2 | 세금 계산서 PDF 생성 미구현 |
| src/services/transfer-service.ts | ~2 | 이체 실행 미구현 |

---

## 7. 테스트 커버리지 재분석

### 7.1 테스트 실행 결과

```
✅ 27 test suites passed
✅ 286 tests passed
✅ 0 failures
```

### 7.2 테스트 파일 인벤토리 (36개)

| 구분 | 파일 수 | 설명 |
|------|---------|------|
| 단위 테스트 | 29 | services/__tests__/, tests/, __tests__/ |
| UI 컴포넌트 테스트 | 2 | TimePicker, GillerProfileCard |
| E2E 테스트 | 5 | Playwright (01-auth ~ 05-user-scenarios) |

### 7.3 v1 대비 개선 — 신규 테스트 6개 추가 ✅

| 테스트 파일 | 테스트 대상 | v1 상태 | v2 상태 |
|------------|-----------|---------|---------|
| `__tests__/beta1-orchestration-service.test.ts` | Beta1 오케스트레이션 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/beta1-state-mappers.test.ts` | Beta1 상태 매핑 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/wallet-balance.test.ts` | 지갑 잔액 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/withdrawal-guards.test.ts` | 출금 가드 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/payment-guards.test.ts` | 결제 가드 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/social-auth-service.test.ts` | 소셜 인증 | ❌ 없음 | ✅ **추가됨** |
| `__tests__/request-draft-adapters.test.ts` | 요청 초안 어댑터 | ❌ 없음 | ✅ **추가됨** |

### 7.4 여전히 테스트 없는 핵심 서비스

| 서비스 | 위험도 | 설명 |
|--------|--------|------|
| chat-service | 🟡 중간 | 채팅 로직 무테스트 |
| verification-service | 🟡 중간 | 본인확인 무테스트 |
| locker-service | 🟡 중간 | 락커 관리 무테스트 |
| SettlementService | 🟡 중간 | 정산 계산 무테스트 |
| TossPaymentService | 🔴 높음 | 결제 연동 무테스트 |
| DepositService | 🔴 높음 | 보증금 처리 무테스트 |

### 7.5 테스트 품질 평가

| 등급 | 기준 | 해당 테스트 |
|------|------|------------|
| 🟢 REAL | 실제 로직 검증, 의미 있는 assertion | 대부분의 서비스 테스트, location-service, matching-service |
| 🟡 MOCK-HEAVY | 대부분 mock, 일부 로직 검증 | payment-service, delivery-service |
| 🔴 SKELETON | 최소 assertion | (해당 없음 — v1에서 식별된 것들이 개선됨) |

### 7.6 테스트 설정

- **jest.config.js**: 커버리지 임계값 70% (branches, functions, lines, statements)
- **E2E**: Playwright 기반, jest 실행에서 제외됨 (testPathIgnorePatterns)
- **스킵된 테스트**: 없음 (0건)

---

## 종합 우선순위 행동 계획

### 🔴 P0 — 즉시 수정 (보안)

| # | 항목 | 작업 | 예상 규모 |
|---|------|------|----------|
| 1 | requestPhoneOtp 인증 없음 | `requireCallableAuth` 추가 | 소규모 |
| 2 | confirmPhoneOtp 인증 없음 | `requireCallableAuth` 추가 | 소규모 |
| 3 | Firestore 미커버 컬렉션 | b2b_deliveries, b2b_tax_invoices 등 규칙 추가 | 중규모 |
| 4 | chats/{chatId} 이중 경로 | 실제 사용 경로 확인 후 미사용 경로 제거 또는 검증 추가 | 소규모 |

### 🟡 P1 — 단기 개선 (1-2주)

| # | 항목 | 작업 | 예상 규모 |
|---|------|------|----------|
| 5 | onRequest rate limiting | naver/juso/ciMock 엔드포인트에 rate limiting | 중규모 |
| 6 | beta1-orchestration 파사드 | beta1/index.ts 진입점 생성, import 경로 통일 | 중규모 |
| 7 | Auctions/Bids 본인 확인 | `request.resource.data.userId == request.auth.uid` 추가 | 소규모 |
| 8 | 핵심 서비스 테스트 보완 | chat, verification, locker, Settlement, TossPayment, Deposit 테스트 | 대규모 (6개 신규 테스트 이미 추가됨, 6개 잔여) |

### 🟢 P2 — 중기 개선 (1개월)

| # | 항목 | 작업 |
|---|------|------|
| 9 | 순환 의존 해소 | 인터페이스/이벤트 기반 패턴 도입 |
| 10 | 새 모듈 연결 | imported-by=0인 beta1 모듈 실제 사용 또는 제거 |
| 11 | 미사용 서비스 정리 | ~10개 서비스 사용처 최종 확인 |
| 12 | Firestore 필드 검증 | 중요 컬렉션에 필드 존재/타입 검증 추가 |

### 통계 비교

| 항목 | v1 (이전) | v2 (현재) |
|------|----------|----------|
| 보안 이슈 (HIGH) | 2개 | **3개** (+OTP 미인증) |
| 보안 이슈 (MEDIUM) | 5개 | **7개** (+미커버 컬렉션, 이중 경로) |
| 해결된 보안 이슈 | - | **4개** ✅ |
| beta1-orchestration 줄수 | 1,756 | **988** (-43.7%) |
| 서비스 파일 수 | ~67 | **82** |
| 인증 없는 onCall 함수 | 2개 | **3개** (+OTP 2개, -calculateDeliveryPricing) |
| 테스트 파일 수 | ~41 | **36** (정밀 카운트) |
| 테스트 실행 결과 | 미확인 | **27 suites, 286 tests, ALL PASS** |
| 신규 테스트 | - | **7개** ✅ (beta1, wallet, payment, auth 등) |
| 테스트 없는 핵심 서비스 | 10개 | **6개** (4개 개선) |

---

> **최종 업데이트**: 데드 코드, 테스트 커버리지 분석 완료 후 섹션 6, 7 업데이트 예정
