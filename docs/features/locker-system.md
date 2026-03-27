# 사물함 시스템 (Locker System)

## 개요
지하철역 사물함을 활용한 24시간 배송 가능 시스템입니다.

## 주요 화면
- 사물함 지도: `src/screens/main/LockerMapScreen.tsx`
- 사물함 선택: `src/screens/main/LockerSelectionScreen.tsx`
- 사물함 수령 (길러 보관): `src/screens/giller/GillerDropoffAtLockerScreen.tsx`
- 사물함 수거 (길러): `src/screens/giller/GillerPickupAtLockerScreen.tsx`
- 사물함 수령 (이용자): `src/screens/requester/GillerPickupFromLockerScreen.tsx`
- 사물함 해제: `src/screens/main/UnlockLockerScreen.tsx`
- QR 스캔: `src/screens/main/QRCodeScannerScreen.tsx`

## 서비스
- 사물함 관리: `src/services/locker-service.ts`
- QR 코드: `src/services/qrcode-service.ts`
- 픽업 인증: `src/services/pickup-verification-service.ts`

## 흐름
1. 길러가 사물함에 물품 보관
2. 이용자에게 QR코드 전송
3. 이용자가 QR 스캔으로 사물함 해제
4. 물품 수령 및 인증

## 사물함 종류
- 공용 사물함 (public)
- 전용 사물함 (private)
