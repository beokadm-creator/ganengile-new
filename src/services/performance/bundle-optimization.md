# Bundle Optimization Notes

`precedence`: 45  
`required-for`: bundle-optimization, performance-review  
`optional-for`: frontend-refactor  
`memory-type`: note  
`token-estimate`: 180

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 이 문서는 성능 팁 메모이며 제품 계약 문서가 아니다.
- 번들 최적화는 라우트/기능 단위 분리와 무거운 의존성 지연 로딩이 핵심이다.

## [STATIC] Notes
- 초기 진입에 필요 없는 화면과 기능은 늦게 로드한다.
- 큰 서드파티 라이브러리는 사용 시점까지 지연한다.
- 실제 적용 전에는 현재 빌드 체인과 React Native/웹 호환성을 확인한다.

## [DYNAMIC] Caution
- 예시 코드는 개념 설명용이며 그대로 복사 적용하지 않는다.

## Changelog
- 2026-04-02: 코드 조각 중심 문서를 요약형 성능 노트로 정리.
