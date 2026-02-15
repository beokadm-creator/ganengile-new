# 🛡️ 남은 작업 계획서

**분석일자:** 2026-02-14
**작성자:** OpenClaw DevOps Assistant
**프로젝트:** 가는길에 (GaneunGile)

---

## 📊 전체 진행 상황

### ✅ 완료된 단계

**P0: 디자인 시스템 + 역할 전환** ✅
- 공통 컴포넌트 생성 (7개)
- 색상 체계 적용 (#00BCD4, #4CAF50, #FF9800)
- 아이콘 교체 (React Native Vector Icons)
- 역할 전환 UX (RoleSlider 슬라이더)

**P1: 온보딩 + 동선 등록 + 매칭 결과** ✅
- 온보딩 플로우 구현 (글러/길러 별도)
- 동선 등록 UX 개선 (AddRoute, EditRoute, RouteManagement)
- 매칭 결과 UX 개선 (MatchingResultScreen, GillerProfileCard, 순위별 수수료 차등)
- **코드:** 21,080줄 (약 742KB)

**P2: 배송 플로우 전체** ✅
- 배송 요청 (CreateRequestScreen)
- 매칭 (MatchingResultScreen)
- 픽업 (GillerPickupAtLockerScreen)
- 배송 (DeliveryTrackingScreen)
- 완료 (DeliveryCompletionScreen)
- 평가 (RatingScreen)

**P3: 커뮤니케이션** ✅
- 인앱 채팅 (ChatListScreen, ChatScreen)
- 푸시 알림 (notification-service, NotificationSettingsScreen)
- FCM 연동

**P4: 테스트 및 QA** ⚠️ 부분 완료
- 단위 테스트: 작성됨
- 통합 테스트: 작성됨
- E2E 테스트: ⚠️ 불안정 (배포 영향 없음)

**P5: 버그 수정** ✅
- 총 5개 버그 수정 완료 (35분 소요)

**P6: 프로덕션 배포** 🔄 진행 중 (83%)
- P6-1: 버그 수정 ✅
- P6-2: 테스트 커버리지 향상 ✅
- P6-3: 성능 최적화 ✅
- P6-4: 문서화 ✅
- P6-5: 프로덕션 배포 준비 ✅
- **P6-6: 배포 후 모니터링** 🔄 진행 중

---

## 🎯 즉시 실행 (P6-6 완료)

### 1. EAS Build 실행 (수동 작업)

**상태:** ⏳ 사용자 대기 중
**예상 소요 시간:** 2-4시간

```bash
cd ~/ganengile-new
eas login  # Expo 계정 로그인 필요
eas build --platform all --profile production
```

**완료 후:**
1. App Store Connect 업로드 (iOS)
2. Google Play Console 업로드 (Android)
3. 스토어 리스팅 정보 입력
4. 앱 심사 제출

### 2. 배포 후 모니터링 시스템 구축

**파일:** `scripts/post-deployment-monitor.sh` (이미 존재)

**매일 확인:**
- [ ] EAS Build 상태 확인
- [ ] Firebase 배포 상태 확인
- [ ] 앱/패키지 버전 일치 확인
- [ ] Git 상태 확인
- [ ] 에러 로그 모니터링 (Firebase Crashlytics)

**매주 확인:**
- [ ] 성능 메트릭 추적 (번들 사이즈, 로딩 시간)
- [ ] 사용자 피드백 수집 (App Store, Play Store 리뷰)
- [ ] 크래시 보고서 확인

### 3. 성능 최적화 P0 적용

**파일:** `PERFORMANCE_OPTIMIZATION_REPORT.md` (이미 완료)

**P0 즉시 실행 작업:**
- [ ] React.memo 적용 (상위 20개 컴포넌트)
- [ ] useMemo/useCallback 적용 (빈번한 값 계산)
- [ ] Firestore 쿼리 최적화 (select()로 필요한 필드만)

**기대 효과:**
- 초기 번들 크기: -28%
- 첫 화면 로딩: -37%
- 스크롤 프레임률: +18%
- 메모리 사용: -22%

---

## 📋 단기 작업 (1-2주)

### 4. 배포 안정화

**목표:** 초기 사용자 경험 안정화

**작업 항목:**
- [ ] 크래시 로그 모니터링 및 수정
- [ ] 사용자 피드백 수집 및 대응
- [ ] 긴급 버그 수정
- [ ] 성능 모니터링 및 튜닝

**성과 지표:**
- 크래시율: <1%
- 평균 별점: >4.0/5.0
- 로딩 시간: <3초

### 5. 초기 사용자 피드백 수집

**목표:** 100명 초기 사용자 온보딩

**작업 항목:**
- [ ] 베타 테스터 모집 (50명)
- [ ] 피드백 폼 구축 (Google Forms / Typeform)
- [ ] 인앱 피드백 시스템 구현
- [ ] 1주일간 피드백 수집 및 분석

**성과 지표:**
- 피드백 응답률: >60%
- NPS (Net Promoter Score): >40

---

## 🔥 중기 작업 (3-4주)

### 6. 전문 길러 시스템

**기획 문서:** `PLANNING_PROFESSIONAL_GILLER.md` (33.9KB)

**목표:** 길러 등급 구분 및 배지 시스템

**작업 항목:**
- [ ] 길러 등급 구분 (일반, 전문, 마스터)
- [ ] 승급/강감 기준 구현 (50건, 평점 4.5+)
- [ ] 배지 시스템 구현 (Bronze, Silver, Gold, Platinum)
- [ ] 배지 획득 로직 구현 (활동, 품질, 전문성, 커뮤니티)
- [ ] 길러 프로필 화면 개선
- [ ] 등급별 혜택 적용 (요금 보너스, 우선 매칭)

**데이터베이스:**
```javascript
users 컬렉션에 추가:
- gillerLevel: 'normal' | 'professional' | 'master'
- badges: array of badge objects
- completedDeliveries: number
- totalEarnings: number
```

**UI/UX:**
- 길러 프로필 화면 (등급, 배지 표시)
- 배지 획득 팝업
- 등급별 혜택 안내 화면

**기대 효과:**
- 전문 길러 비율: 30% (1년차)
- 길러 유지율: 80% (3개월)
- 평균 수익: 일반 30만원 → 전문 50만원 (+67%)

### 7. 유연한 매칭 시스템

**기획 문서:** `PLANNING_FLEXIBLE_MATCHING.md` (28.3KB)

**목표:** 일회성 모드 + 환승 매칭

**작업 항목:**
- [ ] 일회성 모드 구현 (현재 위치 기반)
- [ ] 환승 매칭 알고리즘 (환승역 찾기, 경로 계산)
- [ ] 환승 보너스 계산 (1회당 1,000원)
- [ ] 지하첗 요금 자동 차감
- [ ] 길러 플로우 구현 (정기 동선 / 일회성 모드)
- [ ] 요금 정책 업데이트

**데이터베이스:**
```javascript
routes 컬렉션에 추가:
- routeType: 'regular' | 'onetime'
- allowTransfer: boolean
- maxDetourTime: number (최대 우회 시간, 기본 15분)

requests 컬렉션에 추가:
- requiresTransfer: boolean
- transferStations: array of station objects
- subwayFare: number (지하첗 요금)
```

**UI/UX:**
- 모드 전환 토글 (정기 동선 / 일회성 모드)
- 환승 가능 여부 설정
- 요금 상세 화면 (환승 보너스 표시)

**기대 효과:**
- 매칭 성공률: 60% → 85%
- 길러 수익: 월 30만원 → 50만원 (+67%)
- 이용자 만족도: 3.8/5.0 → 4.5/5.0

---

## 🚀 장기 작업 (5-8주)

### 8. 비대면 배송 시스템

**기획 문서:** `PLANNING_CONTACTLESS_DELIVERY.md` (25.8KB)

**목표:** 사물함 연동 + QR/사진 인증

**작업 항목:**
- [ ] 사물함 위치 선정 (강남, 사당, 서울역, 고속터미널)
- [ ] 사물함 종류별 요금 정책 (공공 2,000원, 민간 3,000원)
- [ ] QR코드 생성/검증 시스템 (JWT 기반, 10분 유효)
- [ ] 사진 인증 시스템 (인수/인계 시 필수 촬영)
- [ ] 분쟁 해결 시스템 (파손/분실 신고, 증거 수집)
- [ ] 길러/이용자 플로우 구현

**데이터베이스:**
```javascript
lockers 컬렉션 생성:
- lockerId: string
- location: { station, line, floor, number }
- type: 'public' | 'private'
- price: number
- timeLimit: number
- availability: array of time slots

locker_logs 컬렉션 생성:
- logId: string
- lockerId: string
- userId: string
- action: 'open' | 'close'
- timestamp: Timestamp
- photoEvidence: string (URL)
```

**UI/UX:**
- 사물함 선택 화면 (지도 기반)
- QR코드 스캔 화면
- 사진 촬영 화면 (인수/인계)
- 분쟁 신고 화면

**파트너십:**
- 공공 사물함: 서울메트로
- 민간 사물함: CU, GS25

**기대 효과:**
- 비대면 배송 이용률: 60% 이상
- 사물함 만족도: 4.3/5.0
- 분쟁 발생률: 1% 미만
- 평균 배송 시간: 45분 → 35분

### 9. B2B 위치사업자 모델

**기획 문서:** `PLANNING_B2B_BUSINESS.md` (27.1KB)

**목표:** 기업 고객 타겟팅 + 구독 모델

**작업 항목:**
- [ ] 기업 온보딩 플로우 구현
- [ ] 구독 티어 시스템 구현 (Basic, Standard, Premium)
- [ ] B2B 배송 요청 화면
- [ ] B2B 길러 매칭 시스템
- [ ] 세금계산서 발행 시스템 (홈택스 연동)
- [ ] 기업 대시보드 구현
- [ ] 월간 정산 시스템

**데이터베이스:**
```javascript
businesses 컬렉션 생성:
- businessId: string
- businessName: string
- businessType: 'cafe' | 'restaurant' | 'office' | 'retail'
- subscriptionTier: 'basic' | 'standard' | 'premium'
- monthlyRequests: number
- billing: { monthlyFee, perRequestFee, taxInvoice }

b2b_requests 컬렉션 생성:
- requestId: string
- businessId: string
- pickupStation: object
- deliveryStation: object
- packageInfo: object
- urgency: 'normal' | 'fast' | 'urgent'
- status: 'pending' | 'matched' | 'in_progress' | 'completed'

b2b_matches 컬렉션 생성:
- matchId: string
- requestId: string
- gillerId: string
- fee: number
- status: 'accepted' | 'in_progress' | 'completed'
```

**UI/UX:**
- B2B 온보딩 화면 (사업자 등록, 계약서 동의)
- B2B 대시보드 (배송 현황, 비용, 정산)
- 구독 티어 선택 화면
- 세금계산서 발행 화면

**타겟:**
- 프랜차이즈 카페 (Starbucks, Megacoffee)
- 식당/요식업
- 오피스
- 소매점

**기대 효과:**
- 1년차: 150개사, 3,000만원/월, 1,500건/월
- 2년차: 500개사, 1억원/월, 5,000건/월
- 3년차: 1,000개사, 3억원/월, 15,000건/월

---

## 🔧 기술 부채 해결

### 10. E2E 테스트 안정화

**현재 문제:**
- E2E 테스트가 불안정하여 배포에 영향을 주지 않음
- Detox + Maestro 설정됨

**해결 방안:**
- [ ] E2E 테스트 케이스 검토
- [ ] 불안정한 테스트 수정 또는 제거
- [ ] CI/CD 파이프라인에 통합
- [ ] 테스트 커버리지 80% 이상 목표

### 11. TypeScript 타입 안전성 개선

**현재 문제:**
- TypeScript 에러 1,339개 (E2E/성능 파일 - 배포 영향 없음)

**해결 방안:**
- [ ] `any` 타입 제거
- [ ] 엄격한 타입 검사 활성화 (`strict: true`)
- [ ] 타입 정의 파일 구조화
- [ ] 타입 커버리지 90% 이상 목표

### 12. 문서화 완료

**현재 문제:**
- README 업데이트 필요
- CHANGELOG 누락

**해결 방안:**
- [ ] README 최신화 (2026-02-14 기준)
- [ ] CHANGELOG.md 작성
- [ ] API 문서 완료
- [ ] 배포 가이드 업데이트

---

## 📊 작업 우선순위

### 🔴 P0 (즉시 실행)
1. EAS Build 실행 (수동 작업)
2. 배포 후 모니터링 시스템 구축
3. 성능 최적화 P0 적용 (React.memo, useMemo, useCallback, Firestore 쿼리)

### 🟡 P1 (1-2주)
4. 배포 안정화
5. 초기 사용자 피드백 수집

### 🟢 P2 (3-4주)
6. 전문 길러 시스템 (4주)
7. 유연한 매칭 시스템 (3주)

### 🔵 P3 (5-8주)
8. 비대면 배송 시스템 (5주)
9. B2B 위치사업자 모델 (6주)

### ⚪ P4 (기술 부채)
10. E2E 테스트 안정화
11. TypeScript 타입 안전성 개선
12. 문서화 완료

---

## 📅 타임라인

```
2026-02-14 (금)  ✅ P1 완료, 성능 최적화 보고서 작성
2026-02-17 (월)  🚀 P6-6 완료 예정 (배포 후 모니터링)
2026-02-21 (금)  📊 초기 사용자 피드백 수집 완료 예정
2026-02-24 (월)  🔥 P2 시작 (전문 길러 시스템)
2026-03-10 (월)  🔥 P2 시작 (유연한 매칭 시스템)
2026-03-31 (월)  🚀 P3 시작 (비대면 배송 시스템)
2026-04-14 (월)  🚀 P3 시작 (B2B 위치사업자 모델)
```

---

## 💡 추가 고려사항

### 파트너십
- **비대면 배송:** 사물함 운영사 (서울메트로, CU, GS25)
- **B2B:** 프랜차이즈 본사 (Starbucks, Megacoffee)

### 법적 검토
- 개인정보 처리방침
- 이용약관
- 보증금 정책
- 세금 처리

### 마케팅
- 소셜 미디어 마케팅 (Instagram, YouTube)
- 초기 사용자 모집
- 베타 테스터 관리
- 오픈 베타 이벤트

---

_작성 완료: 2026-02-14 18:50_
_총 작업 항목: 12개 (P0: 3, P1: 2, P2: 2, P3: 2, P4: 3)_
_예상 완료일: 2026-04-14 (약 2개월)_
