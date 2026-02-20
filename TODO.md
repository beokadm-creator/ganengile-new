# 🎯 TODO - 미구현 기능 구현

**마지막 업데이트:** 2026-02-20 19:20
**총 작업:** 19개 화면
**완료:** 18개 (95%) 🎉
**진행 중:** 0개
**남음:** 1개

---

## 🔴 P0 - 긴급 (핵심 기능)

### 1. 배지 컬렉션 화면
**파일:** `src/screens/main/BadgeCollectionScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 높음
**실제 시간:** 2시간

**기능:**
- 보유한 배지 표시 (Bronze/Silver/Gold/Platinum)
- 배지별 설명
- 획득 일자 표시
- 미획득 배지 흑백 표시

**연동 서비스:**
- BadgeService.ts

---

### 2. 배지 획득 팝업
**파일:** `src/components/BadgeEarnedPopup.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 높음
**실제 시간:** 1시간

**기능:**
- 배지 획득 시 애니메이션 팝업
- 배지 아이콘, 이름, 설명 표시
- "확인" 버튼으로 닫기
- 배지 획득 로그 기록

**연동 서비스:**
- BadgeService.ts
- notification-service.ts

---

### 3. 일회성 모드 활성화 화면
**파일:** `src/screens/main/OnetimeModeScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 높음
**실제 시간:** 3시간

**기능:**
- 현재 위치 기반 활성화
- 이용 가능 시간대 선택
- 환승 허용 설정 (토글)
- 최대 우회 시간 설정 (5~15분)

**연동 서비스:**
- route-service.ts (일회성 모드 추가 필요)
- matching-service.ts

---

### 4. 모드 전환 토글
**파일:** `src/components/ModeToggleSwitch.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 높음
**실제 시간:** 2시간

**기능:**
- 정기 동선 / 일회성 모드 전환
- 슬라이더 애니메이션
- 현재 모드 표시
- 모드별 설명 표시

**연동 화면:**
- HomeScreen.tsx (홈에 추가)

---

### 5. 환승 정보 UI 추가
**파일:** `src/screens/main/MatchingResultScreen.tsx` (수정)
**상태:** ❌ 미시작
**우선순위:** 높음
**예상 시간:** 1.5시간

**기능:**
- 환승역 표시
- 환승 횟수 표시
- 환승 보너스 요금 표시
- 지하첗 요금 표시

**연동 서비스:**
- PathfindingService.ts
- payment-service.ts

---

## 🟡 P1 - 중요 (UX 개선)

### 6. 길러 승급 신청 화면
**파일:** `src/screens/main/GillerLevelUpgradeScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 중간
**실제 시간:** 2시간

**기능:**
- 승급 기준 안내 (50건, 평점 4.5+, 30일 가입)
- 현재 달성 현황 표시
- 승급 신청 버튼
- 승급 심사 대기 알림

**연동 서비스:**
- ProfessionalGillerService.ts

---

### 7. 등급별 혜택 안내 화면
**파일:** `src/screens/main/LevelBenefitsScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 중간
**실제 시간:** 1.5시간

**기능:**
- 일반/전문/마스터 등급별 혜택 비교
- 요금 보너스 (0%, 15%, 25%)
- 동선 개수 (5, 10, 15개)
- 일일 배송 가능 수 (10, 20, 30건)

**연동 서비스:**
- grade-service.ts

---

### 8. 사물함 지도 화면
**파일:** `src/screens/main/LockerMapScreen.tsx`
**상태:** ✅ 완료 (2026-02-19)
**우선순위:** 중간
**실제 시간:** 3시간

**기능:**
- 지도 기반 사물함 위치 표시
- 역별 사물함 마커
- 사물함 상태 (예약 가능/불가)
- 필터 (공공/민간, 요금)

**연동 서비스:**
- locker-service.ts

---

### 9. QR코드 스캔 화면
**파일:** `src/screens/main/QRCodeScannerScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 중간
**실제 시간:** 2시간

**기능:**
- 카메라로 QR코드 스캔
- JWT 토큰 검증
- 사물함 잠금 해제
- 10분 유효 타이머

**연동 서비스:**
- qrcode-service.ts

---

### 10. 분쟁 신고 화면
**파일:** `src/screens/main/DisputeReportScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 중간
**실제 시간:** 2.5시간

**기능:**
- 분쟁 유형 선택 (파손, 분실, 지연, 기타)
- 사진 증거 업로드
- 상세 설명 입력
- 긴급도 선택 (일반, 긴급)

**연동 서비스:**
- photo-service.ts
- dispute-service.ts (신규 필요)

---

## 🟢 P2 - 일반 (부가 기능)

### 11. 사물함 선택 화면
**파일:** `src/screens/main/LockerSelectionScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 2시간

**기능:**
- 역별 사물함 목록
- 사물함 상세 정보 (가격, 시간, 위치)
- 예약 버튼
- 예약 가능 시간대 선택

**연동 서비스:**
- locker-service.ts

---

### 12. 분쟁 해결 화면
**파일:** `src/screens/main/DisputeResolutionScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 3시간

**기능:**
- 분쟁 내역 표시
- 증거 수집 현황
- 자동 판정 결과 표시
- 보상 지급 현황

**연동 서비스:**
- dispute-service.ts (신규 필요)

---

### 13. 구독 티어 선택 화면
**파일:** `src/screens/b2b/SubscriptionTierSelectionScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 2시간

**기능:**
- Basic/Standard/Premium 티어 비교
- 월 요금 (5만/15만/50만원)
- 포함 건수 (20/100/500건)
- 건당 요금 (3,000/2,500/2,000원)
- 선택 버튼

**연동 서비스:**
- business-contract-service.ts

---

### 14. 세금계산서 발행 화면
**파일:** `src/screens/b2b/TaxInvoiceRequestScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 2시간

**기능:**
- 발행 대상 기간 선택
- 발행 금액 표시
- 사업자등록번호 확인
- 발행 버튼
- 홈택스 전송 알림

**연동 서비스:**
- tax-invoice-service.ts

---

### 15. B2B 매칭 결과 화면
**파일:** `src/screens/b2b/B2BMatchingResultScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 2시간

**기능:**
- B2B 길러 매칭 결과 표시
- 길러 프로필 (등급, 배지)
- 예상 완료 시간
- 수락/거절 버튼

**연동 서비스:**
- b2b-giller-service.ts
- matching-service.ts

---

### 16. 월간 정산 화면
**파일:** `src/screens/b2b/MonthlySettlementScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 2.5시간

**기능:**
- 월간 배송 건수 표시
- 월간 요금 합계
- 결제 예정일
- 결제 내역 PDF 다운로드

**연동 서비스:**
- b2b-settlement-service.ts

---

### 17. 기업 프로필 화면
**파일:** `src/screens/b2b/BusinessProfileScreen.tsx`
**상태:** ✅ 완료 (2026-02-14)
**우선순위:** 낮음
**실제 시간:** 1.5시간

**기능:**
- 기업 정보 표시 (이름, 유형, 주소)
- 구독 티어 표시
- 월간 남은 건수
- 구독 관리 버튼

**연동 서비스:**
- business-contract-service.ts

---

### 18. 배지 프로필 프레임 (ProfileScreen 수정)
**파일:** `src/screens/main/ProfileScreen.tsx` (수정)
**상태:** ✅ 완료 (2026-02-20)
**우선순위:** 낮음
**실제 시간:** 1시간

**기능:**
- 배지 10개 보유 시 프레임 추가
- 등급별 색상 구분 (일반/전문/마스터)
- 등급 아이콘 표시

**연동 서비스:**
- BadgeService.ts
- grade-service.ts

---

### 19. 배지별 요금 보너스 로직
**파일:** `src/services/matching-service.ts` (수정)
**상태:** ❌ 미시작
**우선순위:** 낮음
**예상 시간:** 1.5시간

**기능:**
- Bronze (3개): 요금 5% 보너스
- Silver (5개): 요금 10% 보너스
- Gold (7개): 요금 15% 보너스 + 우선순위
- Platinum (10개): 요금 20% 보너스 + 높은 우선순위

**연동 서비스:**
- BadgeService.ts
- payment-service.ts

---

## 📊 진행 상황 추적

### 완료된 작업 (P0 완료! 🎉)
- ✅ P0-1: 배지 컬렉션 화면 (BadgeCollectionScreen.tsx, 20KB)
- ✅ P0-2: 배지 획득 팝업 (BadgeEarnedPopup.tsx, 7.3KB)
- ✅ P0-3: 일회성 모드 활성화 화면 (OnetimeModeScreen.tsx, 15KB)
- ✅ P0-4: 모드 전환 토글 (ModeToggleSwitch.tsx, 7.7KB)
- ✅ P0-5: 환승 정보 UI 추가 (TransferInfoCard.tsx, 4.5KB + MatchingResultScreen 수정)

### 완료된 작업
**✅ P0 완료!** (2026-02-14 19:30)
- 배지 컬렉션 화면 (BadgeCollectionScreen.tsx, 20KB)
- 배지 획득 팝업 (BadgeEarnedPopup.tsx, 7.3KB)
- 일회성 모드 활성화 화면 (OnetimeModeScreen.tsx, 15KB)
- 모드 전환 토글 (ModeToggleSwitch.tsx, 7.7KB)
- 환승 정보 UI (TransferInfoCard.tsx, 4.5KB)

**✅ P1-1 완료!** (2026-02-14 19:55)
- 길러 승급 신청 화면 (GillerLevelUpgradeScreen.tsx, 17.4KB)

### 완료된 작업
**✅ P1-3 완료!** (2026-02-14 20:58)
- 사물함 지도 화면 (LockerMapScreen.tsx, 14.4KB)

### 완료된 작업
**✅ P0 완료!** (2026-02-14 19:30)
- 배지 컬렉션 화면 (BadgeCollectionScreen.tsx, 20KB)
- 배지 획득 팝업 (BadgeEarnedPopup.tsx, 7.3KB)
- 일회성 모드 활성화 화면 (OnetimeModeScreen.tsx, 15KB)
- 모드 전환 토글 (ModeToggleSwitch.tsx, 7.7KB)
- 환승 정보 UI (TransferInfoCard.tsx, 4.5KB)

**✅ P1-1 완료!** (2026-02-14 19:55)
- 길러 승급 신청 화면 (GillerLevelUpgradeScreen.tsx, 17.4KB)

**✅ P1-2 완료!** (2026-02-14 20:58)
- 등급별 혜택 안내 화면 (LevelBenefitsScreen.tsx, 15.1KB)

**✅ P1-3 완료!** (2026-02-14 20:58)
- 사물함 지도 화면 (LockerMapScreen.tsx, 14.4KB)

**✅ P1-4 완료!** (2026-02-14 21:00)
- QR코드 스캔 화면 (QRCodeScannerScreen.tsx, 11.8KB)

### 완료된 작업
**✅ P1-5 완료!** (2026-02-14 21:05)
- 분쟁 신고 화면 (DisputeReportScreen.tsx, 15KB)

### 진행 중인 작업
- (없음)

### 다음 작업 (P2-1)
**사물함 선택 화면** 구현

---

## 🔔 알림 설정

**자동 크론잡:** 매시간 실행
**파일:** `cron job ID: d41b26e0-3b05-4cee-bf87-8c44f03b6b6a`
**작업:** 다음 작업 자동 추적 및 상태 업데이트

---

_마지막 업데이트: 2026-02-14 19:00_
_다음 작업: 배지 컬렉션 화면 (P0-1)_
_예상 완료일: 2026-02-28 (약 2주)_
