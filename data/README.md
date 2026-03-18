# 데이터 폴더

이 폴더는 정적 참고 데이터와 리포트를 보관합니다.

## 포함 항목

- `stations-seoul.md`: 정적 역 참고표
- `reports/`: 정합성/중복 점검 리포트

## 원칙

- 앱의 실제 소스 오브 트루스는 Firestore `config_*` 컬렉션입니다.
- 이 폴더의 문서는 참고용이며, 변경 후에는 실제 Firestore 보정 스크립트를 같이 실행해야 합니다.

관련 운영 문서는 [docs/data/station-and-fare-data.md](/Users/aaron/ganengile-new/docs/data/station-and-fare-data.md)에서 관리합니다.
