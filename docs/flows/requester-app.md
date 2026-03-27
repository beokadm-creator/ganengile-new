# 요청자 앱 흐름

## 주요 화면 경로

- 홈: `src/screens/main/HomeScreen.tsx`
- 요청 생성: `src/screens/main/CreateRequestScreen.tsx`
- 요청 완료: `src/screens/main/RequestConfirmationScreen.tsx`
- 요청 상세: `src/screens/main/RequestDetailScreen.tsx`
- 배송 추적: `src/screens/main/DeliveryTrackingScreen.tsx`
- 채팅: `src/screens/main/ChatScreen.tsx`
- 사물함 선택: `src/screens/main/LockerSelectionScreen.tsx`
- 사물함 수령: `src/screens/main/UnlockLockerScreen.tsx`
- 분쟁 해결: `src/screens/main/DisputeResolutionScreen.tsx`
- 길러 수령 (사물함): `src/screens/requester/GillerPickupFromLockerScreen.tsx`

## 정상 흐름

1. 픽업 역과 배송 역 선택
2. 무게, 크기, 설명 입력
3. 수신자 정보 입력
4. 가격 확인
5. 추가 정보 입력 후 요청 생성
6. 채팅과 배송 추적에서 진행상태 확인
7. 직접 수령 또는 **사물함 수령 후 승인**
8. **분쟁 발생 시 분쟁 해결 화면에서 진행**

## 요청 생성 시 필수 조건

- 픽업/배송 역이 서로 달라야 함
- 운임 캐시가 존재해야 함
- 무게가 0보다 커야 함
- 수신자 정보가 유효해야 함

## 사용자 UI에서 숨겨야 할 정보

- 길러 수령액
- 플랫폼 수수료 세부액

## 재발 방지 규칙

- 가격 영역에 `0`이 단독으로 노출되지 않도록 확인합니다.
- 운임 미확인 상태에서는 제출 버튼을 비활성화합니다.
- 추가 정보 단계로 실제 진입할 수 있어야 하며, 스텝 UI와 버튼 문구가 일치해야 합니다.
