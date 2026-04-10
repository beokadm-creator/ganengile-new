# Admin-App 단절, 미비 기능, 고아 코드 분석

> 분석일: 2026-04-10 (빠른 검증)
> 목적: 관리자-앱 데이터 불일치, 미사용 기능, 고아 코드 식별

---

## 1. Admin-App 데이터 불일치 분석

### ✅ 확인된 일관성

| 컬렉션 | Admin-web | App | 상태 |
|---------|-----------|-----|------|
| `users` | ✅ 사용 | ✅ 사용 | 일치 |
| `requests` | ✅ 사용 | ✅ 사용 | 일치 |
| `payments` | ✅ 사용 | ✅ 사용 | 일치 |
| `b2b_deliveries` | - | ✅ 사용 (B2B_DELIVERIES_COLLECTION) | App만 사용 |
| `settlements` | ✅ 사용 | ✅ 간접 사용 | 일치 |
| `consentTemplates` | ✅ 사용 | ✅ 사용 | 일치 |
| `giller_applications` | ✅ 사용 | ✅ 사용 | 일치 |
| `non_subway_lockers` | ✅ 사용 | ✅ 사용 | 일치 |

### 🔍 발견된 패턴

**Admin-web 접근 방식**:
- Firebase Admin SDK 직접 사용
- `/api/admin/*` 라우트에서 Firestore에 직접 접근
- 인증: 쿠키 기반 (ADMIN_SECRET)

**App 접근 방식**:
- Firebase Client SDK 사용
- src/services/ 레이어 통해 접근
- 인증: Firebase Auth

### ⚠️ 잠재적 우려 사항

1. **외부 배송업체 컬렉션**: `b2b_deliveries`, `b2b_settlements`, `b2b_tax_invoices`는 App에서만 사용, Admin-web에서 직접 관리 안 함
   - **영향**: 관리자가 외부 배송업체 위임 건을 직접 볼 수 없음
   - **권장**: Admin-web에 외부 파트너 운영 보드 추가

2. **결제 데이터 접근**: Admin-web가 payments를 직접 조회하지만, App에서는 TossPaymentService를 통해 처리
   - **영향**: 관리자가 본 결제 데이터와 App이 보는 데이터가 다를 수 있음
   - **상태**: 모니터링 필요

---

## 2. 미사용 기능 단절 분석

### ✅ 연결됨 확인

| 기능 | 화면 | 서비스 | 네비게이션 | 상태 |
|------|------|--------|-----------|------|
| **경매** | CreateAuctionScreen, AuctionListScreen | auction-service.ts | MainNavigator.tsx | ✅ 연결됨 |
| **길러 신청** | GillerApplyScreen | giller-application-flow.ts | MainNavigator.tsx | ✅ 연결됨 |
| **외부 파트너 레거시 UI** | MonthlySettlementScreen 등 | b2b-*-service.ts | B2BNavigator.tsx | ✅ 연결됨 |
| **락커** | LockerScreens | locker-service.ts | 각 Navigator | ✅ 연결됨 |
| **인증** | VerificationScreens | verification-service.ts | AuthNavigator.tsx | ✅ 연결됨 |

### ⚠️ 부분 연결/미확인

| 기능 | 구현 | 사용 여부 | 비고 |
|------|------|----------|------|
| **ProfessionalGillerService** | 삭제됨 | - | 제거 완료 |
| **TransferMatchingService** | ✅ 구현됨 | ✅ matching-service에서 사용 | 연결됨 |
| **RealtimeSubwayService** | 삭제됨 | - | 제거 완료 |
| **fare-service** | ✅ 구현됨 | ⚠️ 제한적 사용 | 특정 화면에서만 사용 |
| **media-service** | ✅ 구현됨 | ✅ 활발 사용 | 연결됨 |

---

## 3. 고아 코드 분석

### 🔴 고아 서비스 (import 0회)

| 서비스 | 파일 | 기능 | 심각도 | 권장 조치 |
|--------|------|------|--------|----------|
| **ProfessionalGillerService** | src/services/ProfessionalGillerService.ts | 전문 길러 관리 | 제거 완료 | 삭제됨 |
| **rating-service** (일부) | src/services/rating-service.ts | 별점 평가 | 🟡 MEDIUM | 사용처 확인 |
| **fare-service** (부분) | src/services/fare-service.ts | 요금 계산 | 🟢 LOW | 문서화 |

### ⚠️ 고아 익스포트 (서비스 내)

| 서비스 | 익스포트 | 사용 여부 | 비고 |
|--------|---------|----------|------|
| **beta1-infrastructure-service** | `getBeta1InfrastructureSnapshot()` | ❌ import 0회 | Admin API에서 간접 사용 (데이터 소스) |
| **config-service** | 일부 함수 | ⚠️ 일부만 사용 | 일부 함수 미사용 |
| **locker-service** | 특정 메서드 | ⚠️ 일부만 사용 | unlockLocker 등 일부 미호출 |

---

## 4. 핵심 발견 요약

### ✅ 문제없음 (안심)

1. **주요 컬렉션 일관성**: users, requests, payments는 Admin-App 간 일관됨
2. **핵심 기능 연결**: 경매, 길러 신청, enterprise legacy UI, 락커 모두 화면-서비스-네비게이션 연결됨
3. **테스트 커버리지**: 핵심 서비스 테스트 완료됨

### ⚠️ 주의 필요 (모니터링)

1. **외부 파트너 관리자 화면 부재**: Admin-web에 외부 파트너 주문/정산 대시보드 없음
2. **RealtimeSubwayService 제거 완료**: 더 이상 정리 대상 아님
3. **일부 서비스 함수 미사용**: 각 서비스 내 미사용 export 존재

### 🔴 즉시 조치 권장

| 우선순위 | 항목 | 조치 |
|---------|------|------|
| 🟡 P1 | 외부 파트너 운영 보드 | Admin-web에 external_partner 관리 화면 추가 |
| 🟢 P2 | 서비스 내 미사용 export 정리 | 코드 정리 |

---

## 5. 데이터 흐름 다이어그램

```
┌─────────────────┐
│   Admin-web     │
│  (Admin SDK)    │
└────────┬────────┘
         │
         ├─→ users ✅
         ├─→ requests ✅
         ├─→ payments ✅
         ├─→ giller_applications ✅
         ├─→ settlements ✅
         ├─→ consentTemplates ✅
         └─→ non_subway_lockers ✅

┌─────────────────┐
│     App         │
│  (Client SDK)   │
└────────┬────────┘
         │
         ├─→ users ✅
         ├─→ requests ✅
         ├─→ payments ✅
         ├─→ b2b_deliveries ⚠️ (외부 파트너 위임, Admin 미연결)
         ├─→ chatRooms ✅
         ├─→ deliveries ✅
         └─→ matches ✅
```

---

## 6. 권장 후속 작업

### 단기 (1주)

1. **외부 파트너 운영 보드 기획**: 관리자 웹에 external_partner 주문/정산 화면 추가
2. **서비스 내 미사용 export 정리**: 정리 지속

### 중기 (1개월)

1. **서비스 내 미사용 export 정리**: 각 서비스 파일 검토
2. **Admin-App 데이터 동기화 모니터링**: 로그/메트릭 추가
3. **불일치 자동 감지**: CI에 컬렉션 이름 일관성 체크 추가

---

**보고서 생성**: 2026-04-10  
**상태**: 빠른 분석 완료  
**심층 분석 필요**: external_partner Admin 연결
