# 사물함과 전달 방식

## 전달 방식

현재 전달 방식은 아래를 기준으로 설계합니다.

- 직접 전달
- 사물함 보관 후 수령
- 사물함 픽업 후 전달
- 비지하철 보관 거점

관련 코드:

- `src/services/locker-service.ts`
- `src/screens/main/LockerMapScreen.tsx`
- `src/components/delivery/LockerLocator.tsx`
- `src/screens/giller/GillerDropoffAtLockerScreen.tsx`
- `src/screens/giller/GillerPickupAtLockerScreen.tsx`
- `src/screens/requester/GillerPickupFromLockerScreen.tsx`

## 외부 데이터

사물함 정보는 KRIC API와 내부 Firestore 데이터를 함께 사용합니다.

- KRIC 역사별 물품보관함 현황
- 내부 `lockers`
- 내부 `non_subway_lockers`

현재 UI에서 표시해야 하는 최소 정보:

- 역명
- 호선
- 층
- 상세 위치
- 요금
- 문의 전화번호

## 상태 흐름

- `accepted`
- `in_transit`
- `at_locker`
- `delivered`
- `completed`

사물함 전달은 `at_locker` 상태를 명확히 사용하고, 사용자 승인 이후 `completed`로 마감합니다.

## 재발 방지 규칙

- 사물함 위치는 `층/구역` 없이 단순 역명만 보여주지 않습니다.
- 요금은 가능한 원천 API 값을 사용합니다.
- 비지하철 보관함은 지하철 보관함과 분리해 표시합니다.
