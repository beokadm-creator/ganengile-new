# 역 데이터, 운임 캐시, 정합성

## 데이터 소스

- `config_stations`: 앱에서 사용하는 canonical 역 문서
- `config_fares`: 요청 생성 시 사용하는 운임 캐시
- `lockers`, `non_subway_lockers`: 사물함 데이터
- 서울교통공사 역 JSON
- 서울교통공사 운임 API
- KRIC 사물함 API

## 현재 운영 원칙

- 앱은 `config_stations`의 canonical station id만 사용합니다.
- 운임 계산은 `config_fares`가 준비된 조합만 허용합니다.
- 요청/동선 문서의 station id와 역명은 보정 스크립트로 정규화합니다.

## 운영 스크립트

- 역 추가: `/Users/aaron/ganengile-new/scripts/add-missing-stations-from-seoul-json.ts`
- 역 매핑 보정: `/Users/aaron/ganengile-new/scripts/update-station-mapping-from-seoul-json.ts`
- 역명 백필: `/Users/aaron/ganengile-new/scripts/backfill-station-names-from-seoul-json.ts`
- 요청/동선 역 ID 정규화: `/Users/aaron/ganengile-new/scripts/normalize-station-ids-in-documents.ts`
- 운임 캐시 시드: `/Users/aaron/ganengile-new/scripts/seed-fares-from-api.ts`
- 누락 리포트: `/Users/aaron/ganengile-new/scripts/report-missing-fare-mapping.ts`

## 운영 체크

- `missingStationCount`는 0이어야 합니다.
- 실사용 구간 `missingFareCache`는 0이어야 합니다.
- 새 역 데이터를 넣은 뒤에는 문서 정규화 스크립트를 다시 실행합니다.

## 재발 방지 규칙

- 역명만 맞고 station id가 다른 상태를 방치하지 않습니다.
- 운임 API를 직접 UI fallback으로 쓰지 않고 캐시로 흡수합니다.
- 정합성 스크립트를 실행했다면 결과를 이 문서 기준으로 검증합니다.
