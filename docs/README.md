# 문서 목차

이 문서는 가는길에 프로젝트의 최신 문서 인덱스입니다. 다른 에이전트나 개발자는 이 파일을 기준으로 필요한 기능 문서와 코드 경로를 찾으면 됩니다.

## 1. 시작점

| 영역 | 문서 | 주요 코드 경로 |
|---|---|---|
| 프로젝트 개요 | [README.md](/Users/aaron/ganengile-new/README.md) | `/Users/aaron/ganengile-new/src`, `/Users/aaron/ganengile-new/admin-web`, `/Users/aaron/ganengile-new/functions` |
| 문서 운영 규칙 | [docs/ops/documentation-rules.md](/Users/aaron/ganengile-new/docs/ops/documentation-rules.md) | `/Users/aaron/ganengile-new/docs`, `/Users/aaron/ganengile-new/docs/archive` |
| 에이전트 인수인계 | [docs/ops/agent-handoff.md](/Users/aaron/ganengile-new/docs/ops/agent-handoff.md) | `/Users/aaron/ganengile-new/docs`, `/Users/aaron/ganengile-new/src`, `/Users/aaron/ganengile-new/admin-web` |

## 2. 핵심 구조

| 기능 | 문서 | 주요 코드 경로 |
|---|---|---|
| 전체 아키텍처 | [docs/core/architecture.md](/Users/aaron/ganengile-new/docs/core/architecture.md) | `/Users/aaron/ganengile-new/src/navigation`, `/Users/aaron/ganengile-new/src/contexts`, `/Users/aaron/ganengile-new/functions/src` |
| 역할/인증/승급 | [docs/core/identity-and-roles.md](/Users/aaron/ganengile-new/docs/core/identity-and-roles.md) | `/Users/aaron/ganengile-new/src/screens/main/IdentityVerificationScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/main/GillerApplyScreen.tsx`, `/Users/aaron/ganengile-new/src/contexts/UserContext.tsx` |
| 매칭/동선 | [docs/core/matching-and-routing.md](/Users/aaron/ganengile-new/docs/core/matching-and-routing.md) | `/Users/aaron/ganengile-new/src/services/matching-service.ts`, `/Users/aaron/ganengile-new/src/services/route-service.ts`, `/Users/aaron/ganengile-new/src/screens/main/AddRouteScreen.tsx` |
| 요금/운임/정산 | [docs/core/pricing-and-fares.md](/Users/aaron/ganengile-new/docs/core/pricing-and-fares.md) | `/Users/aaron/ganengile-new/src/services/pricing-service.ts`, `/Users/aaron/ganengile-new/src/services/fare-service.ts`, `/Users/aaron/ganengile-new/src/services/payment-service.ts` |
| 사물함/전달 방식 | [docs/core/lockers-and-handover.md](/Users/aaron/ganengile-new/docs/core/lockers-and-handover.md) | `/Users/aaron/ganengile-new/src/services/locker-service.ts`, `/Users/aaron/ganengile-new/src/screens/main/LockerMapScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/giller` |

## 3. 앱 동선

| 사용자 동선 | 문서 | 주요 화면 경로 |
|---|---|---|
| 요청자 앱 흐름 | [docs/flows/requester-app.md](/Users/aaron/ganengile-new/docs/flows/requester-app.md) | `/Users/aaron/ganengile-new/src/screens/main/CreateRequestScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/main/RequestDetailScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/main/DeliveryTrackingScreen.tsx` |
| 길러 앱 흐름 | [docs/flows/giller-app.md](/Users/aaron/ganengile-new/docs/flows/giller-app.md) | `/Users/aaron/ganengile-new/src/screens/main/GillerRequestsScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/main/ChatScreen.tsx`, `/Users/aaron/ganengile-new/src/screens/main/RouteManagementScreen.tsx` |

## 4. 관리자

| 관리자 기능 | 문서 | 주요 코드 경로 |
|---|---|---|
| 관리자 웹 구조와 운영 포인트 | [docs/admin/admin-web.md](/Users/aaron/ganengile-new/docs/admin/admin-web.md) | `/Users/aaron/ganengile-new/admin-web/app/(admin)`, `/Users/aaron/ganengile-new/admin-web/app/api` |
| 관리자 웹 실행 | [admin-web/README.md](/Users/aaron/ganengile-new/admin-web/README.md) | `/Users/aaron/ganengile-new/admin-web` |

## 5. 운영

| 운영 문서 | 문서 | 주요 경로 |
|---|---|---|
| 배포/환경변수 | [docs/ops/deployment-and-env.md](/Users/aaron/ganengile-new/docs/ops/deployment-and-env.md) | `/Users/aaron/ganengile-new/firebase.json`, `/Users/aaron/ganengile-new/app.json`, `/Users/aaron/ganengile-new/scripts` |
| 스모크 테스트 | [docs/ops/smoke-test.md](/Users/aaron/ganengile-new/docs/ops/smoke-test.md) | `/Users/aaron/ganengile-new/src/screens/main`, `/Users/aaron/ganengile-new/admin-web/app/(admin)` |
| 성능 최적화 메모 | [src/services/performance/image-optimization.md](/Users/aaron/ganengile-new/src/services/performance/image-optimization.md) | `/Users/aaron/ganengile-new/src/services/performance` |
| 번들 최적화 메모 | [src/services/performance/bundle-optimization.md](/Users/aaron/ganengile-new/src/services/performance/bundle-optimization.md) | `/Users/aaron/ganengile-new/src/services/performance` |

## 6. 데이터와 외부 연동

| 데이터/연동 | 문서 | 주요 코드 경로 |
|---|---|---|
| 역/운임/사물함 데이터 관리 | [docs/data/station-and-fare-data.md](/Users/aaron/ganengile-new/docs/data/station-and-fare-data.md) | `/Users/aaron/ganengile-new/scripts/update-station-mapping-from-seoul-json.ts`, `/Users/aaron/ganengile-new/scripts/seed-fares-from-api.ts`, `/Users/aaron/ganengile-new/data` |
| 데이터 폴더 설명 | [data/README.md](/Users/aaron/ganengile-new/data/README.md) | `/Users/aaron/ganengile-new/data` |
| 정적 역 데이터 참고 | [data/stations-seoul.md](/Users/aaron/ganengile-new/data/stations-seoul.md) | `/Users/aaron/ganengile-new/data/stations-seoul.md` |

## 7. 문서 갱신 규칙

- `src/screens` 동선이 바뀌면 `docs/flows` 문서를 먼저 갱신합니다.
- `src/services` 로직이 바뀌면 대응되는 `docs/core` 문서를 갱신합니다.
- Firebase 설정, 배포, 환경변수가 바뀌면 `docs/ops/deployment-and-env.md`를 갱신합니다.
- 임시 보고서는 루트에 만들지 않습니다. 정말 필요한 경우에도 별도 협의 후 추가합니다.
