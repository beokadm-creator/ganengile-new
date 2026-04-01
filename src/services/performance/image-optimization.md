# Image Optimization Notes

`precedence`: 45  
`required-for`: image-optimization, performance-review  
`optional-for`: frontend-refactor  
`memory-type`: note  
`token-estimate`: 180

@include docs/_shared/ai-doc-governance.md

## Essential (Post-Compact)
- 이미지 최적화는 크기 분리, 압축, 지연 로딩, 캐시 전략이 핵심이다.
- 이 문서는 참고 노트이며 구현 전 현재 앱 스택과 호환성을 확인해야 한다.

## [STATIC] Notes
- 썸네일과 원본 크기를 분리한다.
- 사진은 적절한 압축 포맷과 품질 기준을 둔다.
- 플레이스홀더와 지연 로딩으로 초기 체감 성능을 개선한다.
- 캐시 라이브러리 도입은 플랫폼 호환성과 유지비를 검토한 뒤 결정한다.

## [DYNAMIC] Caution
- 예시 구현보다 현재 코드베이스 규칙과 실제 측정 결과를 우선한다.

## Changelog
- 2026-04-02: 코드 예시 문서를 요약형 참고 노트로 재작성.
