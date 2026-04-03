# Data Shared Context

`precedence`: 84  
`required-for`: reference-data, station-data  
`optional-for`: pricing, map, research  
`memory-type`: reference  
`token-estimate`: 150

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- Markdown 데이터는 참고용이며 시스템의 소스 오브 트루스가 아니다.
- 실제 운영 데이터는 Firestore 또는 별도 적재 파이프라인에서 검증한다.
- 대용량 표는 요약만 남기고 원본 출처를 적는다.

## [STATIC] Rules
- 참고 문서는 샘플, 범위, 출처만 유지한다.
- 실제 값 변경이 필요하면 데이터 적재 경로도 함께 수정한다.

## [DYNAMIC] Current Scope
- 서울 지하철 정적 참고와 데이터 디렉터리 안내만 유지한다.

## Changelog
- 2026-04-02: 데이터 참고 문서 공통 규칙 분리.
