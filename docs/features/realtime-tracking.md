# 실시간 배송 추적 (Real-time Tracking)

## 개요
지도 기반 실시간 배송 추적 시스템으로, 요청자와 길러가 실시간으로 배송 위치를 확인할 수 있습니다.

## 주요 화면
- 실시간 추적: `src/screens/main/RealtimeTrackingScreen.tsx`
- 배송 추적: `src/screens/main/DeliveryTrackingScreen.tsx`

## 서비스
- 위치 추적: `src/services/location-tracking-service.ts`
- 실시간 지하철: `src/services/RealtimeSubwayService.ts`

## 추적 방법
1. GPS 기반 위치 추적 (길러)
2. 지하철 역 도착 정보 연동
3. 실시간 경로 표시

## 네비게이션
- DeliveryTrackingScreen → "실시간 추적" 버튼
- in_transit, arrived 상태에서 사용 가능
