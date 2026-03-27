# 원타임 매칭 (Onetime Mode)

## 개요
일회성 매칭 모드로, 특정 시간대에만 배송 가능 상태로 설정합니다.

## 주요 화면
- 원타임 모드: `src/screens/main/OnetimeModeScreen.tsx`

## 서비스
- 원타임 매칭: `src/services/matching/OneTimeMatchingService.ts`

## 설정
- 현재 위치 기반 활성화
- 이용 가능 시간대 선택
- 환승 허용 설정
- 최대 우회 시간 (5~15분)

## 진입점
- HomeScreen → "원타임 매칭" (길러만 표시)
