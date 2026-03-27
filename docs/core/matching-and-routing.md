# 매칭과 동선

## 핵심 원칙

매칭은 `동선 적합성`, `시간`, `상태`, `채팅 기반 협의`를 중심으로 동작합니다. 현재 정책은 목록에서 바로 확정하지 않고, 채팅에서 협의 후 수락/취소를 진행하는 흐름을 우선합니다.

## 관련 코드

- 동선 등록/수정: `src/screens/main/AddRouteScreen.tsx`, `src/screens/main/EditRouteScreen.tsx`
- 동선 목록: `src/screens/main/RouteManagementScreen.tsx`
- 매칭 서비스: `src/services/matching-service.ts`
- 요청 서비스: `src/services/request-service.ts`
- 배송 수락/취소: `src/services/delivery-service.ts`
- 채팅: `src/screens/main/ChatScreen.tsx`, `src/services/chat-service.ts`

## 현재 매칭 흐름

1. 요청자가 배송 요청 생성
2. 요청이 매칭 가능 길러에게 노출
3. 길러는 목록에서 채팅 진입
4. 채팅 내에서 수락 또는 수락 취소
5. 수락 후 배송 문서 생성

## 즉시 매칭과 동선 매칭

- 즉시 매칭: 현재 시점에서 가능한 요청을 찾음
- 동선 매칭: 등록된 `startStation -> endStation` 동선을 기준으로 후보를 필터링

관련 화면:

- `src/screens/main/GillerRequestsScreen.tsx`
- `src/screens/main/tabs/InstantMatchingTab.tsx`
- `src/screens/main/tabs/RouteMatchingTab.tsx`

## 재발 방지 규칙

- 목록 화면에서는 수락을 최종 확정하지 않습니다.
- 수락은 반드시 채팅 맥락에서 이뤄져야 합니다.
- 요청/동선의 역 ID는 `config_stations`의 canonical id로 유지합니다.
- Firestore 인덱스가 필요한 쿼리는 문서화하고 함께 배포합니다.
