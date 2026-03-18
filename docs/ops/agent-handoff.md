# 에이전트 인수인계 기준

## 시작 순서

다른 에이전트가 이 프로젝트를 이어받을 때는 아래 순서로 문서를 확인합니다.

1. [docs/README.md](/Users/aaron/ganengile-new/docs/README.md)
2. 현재 작업과 직접 관련된 `docs/core/*` 또는 `docs/flows/*`
3. 배포나 환경변수가 걸린 작업이면 `docs/ops/deployment-and-env.md`
4. 역/운임/사물함 데이터 작업이면 `docs/data/station-and-fare-data.md`

## 코드 우선 원칙

- 문서는 코드 설명서이지, 코드보다 우선하지 않습니다.
- 문서와 코드가 다르면 코드 기준으로 문서를 즉시 수정합니다.
- 작업 중 발견한 정책 변경은 대응 문서 한 곳에만 반영하고, 중복 문서를 만들지 않습니다.

## 자주 보는 코드 경로

- 앱 네비게이션: `/Users/aaron/ganengile-new/src/navigation`
- 요청 생성/가격: `/Users/aaron/ganengile-new/src/screens/main/CreateRequestScreen.tsx`
- 매칭/수락/배송: `/Users/aaron/ganengile-new/src/services/matching-service.ts`, `/Users/aaron/ganengile-new/src/services/delivery-service.ts`
- 운임/정합성: `/Users/aaron/ganengile-new/src/services/fare-service.ts`, `/Users/aaron/ganengile-new/scripts`
- 관리자 웹: `/Users/aaron/ganengile-new/admin-web/app/(admin)`

## 문서 수정 규칙

- 기능 수정 시 해당 문서도 같은 커밋에 포함합니다.
- 설명이 끝난 이슈성 문서는 새 파일로 남기지 않습니다.
- 새 에이전트가 바로 이해할 수 있게 문서에는 코드 경로를 절대경로로 남깁니다.
