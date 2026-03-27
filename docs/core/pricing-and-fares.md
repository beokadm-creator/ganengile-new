# 요금, 운임, 정산

## 현재 원칙

요금은 `기본요금 + 거리 + 무게 + 크기 + 긴급도 + 지하철 운임 + 서비스 수수료 + VAT` 구조를 사용합니다. 다만 사용자에게 보이는 금액은 반드시 검증된 운임 캐시를 기반으로 계산해야 하며, `운임 0원 fallback`은 허용하지 않습니다.

관련 코드:

- `src/services/pricing-service.ts`
- `src/services/fare-service.ts`
- `src/screens/main/CreateRequestScreen.tsx`
- `src/services/payment-service.ts`

## 운임 정책

- 운임 조회의 기준 데이터는 `config_fares`
- 앱 요청 생성 시 기본 동작은 `cache-only`
- 캐시가 없으면 요청 생성 차단
- 주기 배치로 실사용 구간 운임을 선적재

## 정산 정책

- 사용자 요청 화면에는 길러 수령액과 플랫폼 수수료를 노출하지 않습니다.
- 정산 세부값은 길러 화면과 관리자 화면에서만 확인합니다.
- VAT, 플랫폼 수수료, 길러 정산액은 같은 수식을 공유해야 합니다.

## 운영 스크립트

- 역 매핑 보정: `scripts/update-station-mapping-from-seoul-json.ts`
- 문서 내 역 ID 정규화: `scripts/normalize-station-ids-in-documents.ts`
- 운임 캐시 시드: `scripts/seed-fares-from-api.ts`

## 재발 방지 규칙

- `publicFare <= 0` 인 요청은 생성하지 않습니다.
- 운임 캐시를 만들기 전에는 실시간 응답을 UI 가격의 소스 오브 트루스로 쓰지 않습니다.
- 역 코드 누락 리포트와 운임 캐시 누락 리포트를 함께 점검합니다.
