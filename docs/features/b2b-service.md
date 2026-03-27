# B2B Service (기업용 배송)

## 개요
기업 고객을 위한 정기 구독 기반 배송 서비스입니다.

## 주요 화면
- 대시보드: `src/screens/b2b/B2BDashboardScreen.tsx`
- 배송 요청: `src/screens/b2b/B2BRequestScreen.tsx`
- 길러 관리: `src/screens/b2b/B2BGillerScreen.tsx`
- 기업 프로필: `src/screens/b2b/BusinessProfileScreen.tsx`
- 월간 정산: `src/screens/b2b/MonthlySettlementScreen.tsx`
- 구독 관리: `src/screens/b2b/SubscriptionTierSelectionScreen.tsx`
- 세금계산서: `src/screens/b2b/TaxInvoiceRequestScreen.tsx`
- B2B 온보딩: `src/screens/b2b/B2BOnboardingScreen.tsx`
- 매칭 결과: `src/screens/b2b/B2BMatchingResultScreen.tsx`

## 서비스
- B2B 배송: `src/services/b2b-delivery-service.ts`
- B2B 길러: `src/services/b2b-giller-service.ts`
- B2B 정산: `src/services/b2b-settlement-service.ts`
- 법인 계약: `src/services/business-contract-service.ts`

## 네비게이션
- B2B 전용 네비게이터: `src/navigation/B2BNavigator.tsx`
- 진입점: ProfileScreen → "B2B 서비스"

## 정책
- 월 배송 한도
- 정기 결제
- 세금계산서 발행
