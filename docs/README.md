# 문서 목차

이 문서는 가는길에 프로젝트의 최신 문서 인덱스입니다. 다른 에이전트나 개발자는 이 파일을 기준으로 필요한 기능 문서와 코드 경로를 찾으면 됩니다.

## 1. 시작점

| 영역 | 문서 | 주요 코드 경로 |
|---|---|---|
| 프로젝트 개요 | [README.md](../README.md) | `src/`, `admin-web/`, `functions/` |
| 문서 운영 규칙 | [docs/ops/documentation-rules.md](docs/ops/documentation-rules.md) | `docs/`, `docs/archive/` |
| 에이전트 인수인계 | [docs/ops/agent-handoff.md](docs/ops/agent-handoff.md) | `docs/`, `src/`, `admin-web/` |

## 2. 핵심 구조

| 기능 | 문서 | 주요 코드 경로 |
|---|---|---|
| 전체 아키텍처 | [docs/core/architecture.md](docs/core/architecture.md) | `src/navigation/`, `src/contexts/`, `functions/src/` |
| 역할/인증/승급 | [docs/core/identity-and-roles.md](docs/core/identity-and-roles.md) | `src/screens/main/IdentityVerificationScreen.tsx`, `src/screens/main/GillerApplyScreen.tsx`, `src/contexts/UserContext.tsx` |
| 매칭/동선 | [docs/core/matching-and-routing.md](docs/core/matching-and-routing.md) | `src/services/matching-service.ts`, `src/services/route-service.ts`, `src/screens/main/AddRouteScreen.tsx` |
| 요금/운임/정산 | [docs/core/pricing-and-fares.md](docs/core/pricing-and-fares.md) | `src/services/pricing-service.ts`, `src/services/fare-service.ts`, `src/services/payment-service.ts` |
| 사물함/전달 방식 | [docs/core/lockers-and-handover.md](docs/core/lockers-and-handover.md) | `src/services/locker-service.ts`, `src/screens/main/LockerMapScreen.tsx`, `src/screens/giller/` |
| 레거시 기업고객 흐름 | [docs/features/b2b-service.md](docs/features/b2b-service.md) | `src/screens/enterprise-legacy/`, `src/services/enterprise-legacy-*` |
| 보증금/패널티 | [docs/features/deposit-and-penalty.md](docs/features/deposit-and-penalty.md) | `src/services/DepositService.ts`, `src/services/penalty-service.ts` |

## 3. 앱 동선

| 사용자 동선 | 문서 | 주요 화면 경로 |
|---|---|---|
| 요청자 앱 흐름 | [docs/flows/requester-app.md](docs/flows/requester-app.md) | `src/screens/main/CreateRequestScreen.tsx`, `src/screens/main/RequestDetailScreen.tsx`, `src/screens/main/DeliveryTrackingScreen.tsx` |
| 길러 앱 흐름 | [docs/flows/giller-app.md](docs/flows/giller-app.md) | `src/screens/main/GillerRequestsScreen.tsx`, `src/screens/main/ChatScreen.tsx`, `src/screens/main/RouteManagementScreen.tsx` |

## 4. 기능

| 사용자 동선 | 문서 | 주요 화면 경로 |
|---|---|---|
| 게이미피케이션 | [docs/features/gamification.md](docs/features/gamification.md) | `src/screens/main/BadgeCollectionScreen.tsx`, `src/screens/main/PointHistoryScreen.tsx` |
| 사물함 시스템 | [docs/features/locker-system.md](docs/features/locker-system.md) | `src/screens/main/LockerMapScreen.tsx`, `src/screens/main/LockerSelectionScreen.tsx` |
| 실시간 추적 | [docs/features/realtime-tracking.md](docs/features/realtime-tracking.md) | `src/screens/main/RealtimeTrackingScreen.tsx` |
| 원타임 매칭 | [docs/features/onetime-matching.md](docs/features/onetime-matching.md) | `src/screens/main/OnetimeModeScreen.tsx` |
| 경매 시스템 | [docs/features/auction-system.md](docs/features/auction-system.md) | `src/screens/main/CreateAuctionScreen.tsx` |

## 5. 관리자

| 관리자 기능 | 문서 | 주요 코드 경로 |
|---|---|---|
| 관리자 웹 구조와 운영 포인트 | [docs/admin/admin-web.md](docs/admin/admin-web.md) | `admin-web/app/(admin)/`, `admin-web/app/api/` |
| 관리자 웹 실행 | [admin-web/README.md](../admin-web/README.md) | `admin-web/` |

## 6. 운영

| 운영 문서 | 문서 | 주요 경로 |
|---|---|---|
| 배포/환경변수 | [docs/ops/deployment-and-env.md](docs/ops/deployment-and-env.md) | `firebase.json`, `app.json`, `scripts/` |
| 스모크 테스트 | [docs/ops/smoke-test.md](docs/ops/smoke-test.md) | `src/screens/main/`, `admin-web/app/(admin)/` |
| 성능 최적화 메모 | [src/services/performance/image-optimization.md](../src/services/performance/image-optimization.md) | `src/services/performance/` |
| 번들 최적화 메모 | [src/services/performance/bundle-optimization.md](../src/services/performance/bundle-optimization.md) | `src/services/performance/` |

## 7. 데이터와 외부 연동

| 데이터/연동 | 문서 | 주요 코드 경로 |
|---|---|---|
| 역/운임/사물함 데이터 관리 | [docs/data/station-and-fare-data.md](docs/data/station-and-fare-data.md) | `scripts/update-station-mapping-from-seoul-json.ts`, `scripts/seed-fares-from-api.ts`, `data/` |
| 데이터 폴더 설명 | [data/README.md](../data/README.md) | `data/` |
| 정적 역 데이터 참고 | [data/stations-seoul.md](../data/stations-seoul.md) | `data/stations-seoul.md` |

## 8. 문서 갱신 규칙

- `src/screens` 동선이 바뀌면 `docs/flows` 문서를 먼저 갱신합니다.
- `src/services` 로직이 바뀌면 대응되는 `docs/core` 문서를 갱신합니다.
- Firebase 설정, 배포, 환경변수가 바뀌면 `docs/ops/deployment-and-env.md`를 갱신합니다.
- 임시 보고서는 루트에 만들지 않습니다. 정말 필요한 경우에도 별도 협의 후 추가합니다.
