# 가는길에 전면 감사 보고서 (맵 통합 + 기능 개편 후)

> **목적**: 사용자가 판단한 4대 과업 + 추가 발견 문제를 코드베이스 실제 상태와 대조하여 종합 분석
> **기준일**: 2026-03-31

---

## 사용자 원래 4대 과업

| # | 카테고리 | 핵심 과제 |
|---|---|---|
| 1 | 운영 대시보드 타입 경계 | admin-web 타입 안전성, 공유 타입 boundary |
| 2 | 지도 확장 | Placeholder → 실제 지도 SDK 연결 |
| 3 | 실시간 위치 고도화 | mock GPS → 실제 GPS/telemetry 교체 |
| 4 | 서비스 레이어 warning 정리 | as any 제거, 타입 정리 |

---

## 탐색 결과 요약 (5개 병렬 에이전트)

| # | 탐색 영역 | 상태 | 주요 발견 |
|---|---|---|---|
| 1 | 화면 구조 + 지도 통합 | ✅ 완료 | 35+ 화면, 지도는 StaticMapPreview + LockerLocator만 존재 |
| 2 | 서비스/비즈니스 로직 레이어 | ⏳ 진행 중 | (이전 초안 참고: as any 33건 집중) |
| 3 | 관리자 웹 + 백엔드 | ✅ 완료 | 18개 UI 페이지, 20개 API, 6개 CF. docs/admin/admin-web.md 누락 |
| 4 | 문서-코드 갭 분석 | ⏳ 진행 중 | (CLAUDE.md 기준 다수 미문서화) |
| 5 | UI 연결/흐름 검사 | ✅ 완료 | 2개 끊어진 네비게이션, 프로덕션 console.log |

---

## 📱 화면 구조 (Task 1 결과)

### 네비게이션 계층
- `AppNavigator.tsx` → 루트 (Auth → Onboarding → Main/B2B)
- `MainNavigator.tsx` → 메인 탭+스택 (35+ 화면 등록)
- `B2BNavigator.tsx` → B2B 전용 네비게이션
- `src/types/navigation.ts` → 네비게이션 파라미터 타입 정의

### 지도 관련 파일 (현재 상태)
| 파일 | 역할 | 실제 지도 SDK |
|---|---|---|
| `src/config/map-config.ts` | 지도 설정, 프록시 URL | ❌ Naver Static Map Proxy만 |
| `src/components/maps/StaticMapPreview.tsx` | 정적 지도 렌더링 | ❌ 이미지 URL 기반 |
| `src/components/delivery/LockerLocator.tsx` | 사물함 위치 표시 | ❌ 정적 지도 활용 |
| `src/screens/main/LockerMapScreen.tsx` | 사물함 지도 화면 | ❌ Canvas/SVG 기반 |
| `src/screens/main/DeliveryTrackingScreen.tsx` | 배송 추적 | ❌ 마커 없음 |
| `src/screens/main/RealtimeTrackingScreen.tsx` | 실시간 추적 | ❌ 합성 ETA 사용 |
| `src/screens/b2b/B2BDashboardScreen.tsx` | B2B 대시보드 | ⚠️ 관리자만 프록시 사용 |

### 백엔드 지도 프록시
- `functions/src/index.ts` → `naverStaticMapProxy` (서버 사이드 프록시)
- `/naverStaticMapProxy` 엔드포인트로 Naver API 자격증명 안전 프록시
- admin-web 대시보드/분쟁 페이지에서 프록시 URL 사용

**핵심 판단**: **react-native-maps, Google Maps, Kakao Maps, Naver Maps SDK 중 어떤 것도 앱에 연결되지 않음**. admin-web는 Naver Static Map Proxy를 통한 정적 이미지만 사용.

---

## 🖥️ 관리자 웹 + 백엔드 (Task 3 결과)

### Admin Web 페이지 (18개)
| 페이지 | 경로 | 비고 |
|---|---|---|
| 로그인 | `login/page.tsx` | catch(err: any) 타입 이슈 |
| 대시보드 | `(admin)/dashboard/page.tsx` | 지도 프록시 사용 |
| 분쟁 | `(admin)/disputes/page.tsx` | ✅ 존재 (이전 초안에서 누락으로 표시됐으나 실제 존재) |
| 정산 | `(admin)/settlements/page.tsx` | |
| 보증금 | `(admin)/deposits/page.tsx` | |
| 길러 신청 | `(admin)/gillers/applications/page.tsx` | |
| 출금 | `(admin)/points/withdrawals/page.tsx` | |
| 포인트 잔액 | `(admin)/points/balances/page.tsx` | |
| 신원확인 | `(admin)/verifications/page.tsx` | |
| 사물함 | `(admin)/lockers/page.tsx` | |
| 배송 | `(admin)/deliveries/page.tsx` | |
| AI 연동 | `(admin)/integrations/ai/page.tsx` | |
| 요금 캐시 | `(admin)/integrations/fare-cache/page.tsx` | |

### Admin API 라우트 (20개)
disputes, dashboard, gillers, withdrawals, users, settlements, integrations/payment, integrations/bank, integrations/identity, beta1-ai-review, beta1-infrastructure, integrations/ai/test, integrations/ai, fare-cache, requests/[requestId]/fee, verifications, non-subway-lockers, lockers, points

### Cloud Functions (6개 파일)
- `index.ts` (메인 + naverStaticMapProxy)
- `types.ts`
- `beta1-ai.ts`
- `scheduled/fare-cache-scheduler.ts`
- `scheduled/tax-invoice-scheduler.ts`
- `scheduled/settlement-scheduler.ts`

### 타입 경계 이슈
| 위치 | 이슈 | 심각도 |
|---|---|---|
| `admin-web/app/login/page.tsx` | `catch (err: any)` | 🟡 LOW |
| `functions/src/scheduled/fare-cache-scheduler.ts` | `FareApiItem = Record<string, any>`, 다수 payload any | 🟠 HIGH |

### 문서 누락
- ❌ `docs/admin/admin-web.md` **존재하지 않음** — CLAUDE.md에는 경로가 명시되어 있으나 파일 없음

---

## 🔗 UI 연결/흐름 검사 (Task 5 결과)

### 끊어진 네비게이션 (2건)
| 파일 | 라인 | 문제 | 해결책 |
|---|---|---|---|
| `GillerApplyScreen.tsx` | ~257 | `navigate('Profile')` — Profile은 Tab 내부 화면이므로 Stack에서 직접 접근 불가 | `navigate('Tabs', { screen: 'Profile' })`으로 변경 |
| `GillerLevelUpgradeScreen.tsx` | ~109 | 동일 문제 | 동일 변경 |

### 프로덕션 console.log (1건)
| 파일 | 라인 | 문제 |
|---|---|---|
| `payment-service.ts` | 280-296, 301-312 | 수수료/세금 계산 로그 출력 — `__DEV__` 가드 필요 |

### 네비게이션 그래프 건강도
- ✅ 고아 화면 없음 — 모든 화면이 MainNavigator/B2BNavigator에 등록됨
- ✅ 빈 onPress 핸들러 없음
- ✅ 빈 플레이스홀더 onPress 없음

---

## 🔧 서비스 레이어 (Task 2 완료)

### 전체 서비스 파일: 67개
### 대형 파일 (>500줄) — 리팩토링 우선
| 파일 | 줄수(추정) | 설명 |
|---|---|---|
| `delivery-service.ts` | ~1200 | 배송 라이프사이클 전체 오케스트레이션 |
| `config-service.ts` | ~852 | 역/운임/혼잡도/알고리즘 파라미터 중앙 허브 |
| `b2b-delivery-service.ts` | ~542 | B2B 배송 파이프라인 |
| `auction-service.ts` | ~506 | 경매 라이프사이클 |
| `penalty-service.ts` | ~361 | 패널티/경고 |
| `giller-service.ts` | ~411 | 길러 프로필/승격/자격 |

### src/services as any 밀집 파일
| 파일 | as any 건수 |
|---|---|
| request-service.ts | 7 |
| kakao-auth.ts | 6 |
| BadgeService.ts | 5 |
| fare-service.ts | 5 |
| delivery-service.ts | 3 |
| SettlementService.ts | 3 |
| deposit-compensation-service.ts | 2 |
| chat-service.ts | 2 |
| **합계** | **33건** |

### 순환 의존성
- ✅ **최소 위험** — config-service가 중앙 허브이나 다른 서비스를 역임포트하지 않음
- delivery-service가 여러 서비스를 임포트하나 역방향 의존성 없음
- 권장: 정적 분석 도구로 의존성 그래프 생성 후 최종 확인

### TODO/FIXME (서비스 레이어)
- `b2b-delivery-service.ts:37` — "TODO: API 사용" (거리 계산)
- `delivery-service.ts` — 다수 TODO 주석

### admin-web 타입 건강도
- `as any`: 0건 (login/page.tsx catch 제외)
- `@ts-ignore`: 0건
- `strict: true` ✅

---

## 📋 종합: 4대 과업 검증 + 추가 발견

### 4대 과업 검증

| # | 과업 | 사용자 판단 | 검증 결과 | 심각도 |
|---|---|---|---|---|
| 1 | 운영 대시보드 타입 경계 | 정리 필요 | ✅ 정확 — admin-web는 깨끗하나 fare-cache-scheduler에 any 밀집 | 🟠 HIGH |
| 2 | 지도 확장 | Placeholder | ✅ 정확 — SDK 전무, StaticMapPreview만 | 🔴 CRITICAL |
| 3 | 실시간 위치 고도화 | 부분 | ✅ 정확 — Firestore 실시간 OK, GPS mock | 🟠 HIGH |
| 4 | 서비스 레이어 warning 정리 | 누적 | ✅ 정확 — as any 33건 집중 | 🟡 MEDIUM |

### 추가 발견 (사용자가 언급하지 않은 문제)

| # | 발견 | 심각도 | 설명 |
|---|---|---|---|
| A | **네비게이션 끊김 2건** | 🟠 HIGH | GillerApplyScreen, GillerLevelUpgradeScreen → Profile 이동 실패 |
| A2 | **🔥 LSP 컴파일 에러 6건** | 🔴 CRITICAL | tsc --noEmit 불통과 가능 — 아래 상세 |
| B | **프로덕션 console.log** | 🟡 MEDIUM | payment-service.ts에 금융 정보 로그 |
| C | **docs/admin/admin-web.md 누락** | 🟡 MEDIUM | 관리자 웹 문서가 CLAUDE.md에 명시되어 있으나 파일 없음 |
| D | **취소→분쟁 연결 누락** | 🟠 HIGH | (이전 초안) ChatScreen에 분쟁 신고 버튼 없음, CTA 없음 |
| E | **B2B 구독 티어 하드코딩** | 🟡 MEDIUM | (이전 초안) 동적 관리 불가 |
| F | **B2B vs 소비자 세율 UI 혼동** | 🟡 MEDIUM | (이전 초안) 10% vs 3.3% 구분 불명확 |
| G | **길러용 월별 정산 화면 부재** | 🟡 MEDIUM | (이전 초안) B2B용만 존재 |

### 🔴 LSP 컴파일 에러 상세 (발견 A2)

| 파일 | 라인 | 에러 | 원인 |
|---|---|---|---|
| `LoginScreen.tsx` | 39 | This hook does not specify its dependency on loadSavedEmail | React Hook deps 누락 |
| `B2BDashboardScreen.tsx` | 64 | This hook does not specify its dependency on loadDashboardData | React Hook deps 누락 |
| `b2b-giller-service.ts` | 122 | Property 'calculateNextEvaluation' is private | private 메서드 외부 접근 |
| `B2BRequestScreen.tsx` | 78, 84 | 'latitude' does not exist in type 'Location' | Location 타입에 lat/lng 필드 없음 |
| `NewSignUpScreen.tsx` | 225 | Property 'user' does not exist on type 'User' | User 타입에 user 프로퍼티 없음 (중첩 오류) |
| `NewSignUpScreen.tsx` | 322 | Type 'string' is not assignable to type 'DimensionValue' | width에 string 할당 (숫자 필요) |

---

## 개편 영향 범위 요약

### 최근 대규모 변경 (git 기준)
- 네비게이션 구조 개편 (AppNavigator, MainNavigator, B2BNavigator)
- OnboardingNavigator 삭제 → BasicInfoOnboarding, GillerApplicationOnboarding, IdentityVerification로 분리
- B2B 화면 7개 추가/수정
- Giller/Requester 사물함 화면 추가
- 지도 컴포넌트 (StaticMapPreview, LockerLocator) 추가
- 지도 설정 (map-config.ts) 추가

---

## 📖 문서-코드 갭 분석 (Task 4 완료)

### CLAUDE.md 참조 vs 실제 존재

| CLAUDE.md 경로 | 실제 존재? | 비고 |
|---|---|---|
| `docs/core/architecture.md` | ❌ 없음 | 가장 중요한 누락 |
| `docs/core/identity-and-roles.md` | ❌ 없음 | |
| `docs/core/matching-and-routing.md` | ❌ 없음 | |
| `docs/core/pricing-and-fares.md` | ❌ 없음 | |
| `docs/core/lockers-and-handover.md` | ❌ 없음 | |
| `docs/flows/requester-app.md` | ❌ 없음 | |
| `docs/flows/giller-app.md` | ❌ 없음 | |
| `docs/admin/admin-web.md` | ❌ 없음 | 관리자 웹 문서 없음 |
| `docs/ops/deployment-and-env.md` | ⚠️ 확인 필요 | |
| `docs/ops/smoke-test.md` | ⚠️ 확인 필요 | |
| `docs/data/station-and-fare-data.md` | ⚠️ 확인 필요 | |

### beta1 문서로 커버된 기능 (CLAUDE.md 미문서화 목록 중)
| 기능 | 대응 문서 |
|---|---|
| 포인트 시스템 | ✅ `beta1-point-wallet-strategy.md` |
| 배지 시스템 | ✅ `beta1-gamification-strategy.md` |
| 세금계산서 | ✅ `beta1-tax-and-payout-policy.md` |
| 보증금/정산 | ✅ `beta1-payment-settlement-strategy.md` |
| 전문 길러 | ✅ `beta1-giller-supply-policy.md` |
| QR/픽업 검증 | ✅ `beta1-recipient-verification-strategy.md` |
| B2B 서비스 | ✅ `beta1-partner-dispatch-and-mission-bundling.md` |

### 여전히 미문서화된 기능
| 기능 | 코드 존재 | 문서 |
|---|---|---|
| 경매 (Auction) | ✅ | ❌ 전무 |
| 원타임 매칭 | ✅ | ❌ 전무 |
| 환승 매칭 | ✅ | ❌ 전무 |
| 평점 (Rating) | ✅ | ❌ 전무 |
| 등급 시스템 | ✅ | ❌ 전무 |
| 패널티 정책 | ✅ | ⚠️ 산발적 |
| 실시간 배송 추적 | ✅ | ⚠️ AI 오케스트레이션에 간접 언급 |
| 구독 티어/법인 계약 | ✅ | ⚠️ 파트너 문서에 부분 |

---

## 최종 종합 발견

### 🔴 CRITICAL (즉시 조치)
1. **지도 SDK 전무** — Placeholder 상태, 실서비스 불가
2. **LSP 컴파일 에러 6건** — B2BRequestScreen Location 타입, b2b-giller-service private 접근, React Hook deps 등

### 🟠 HIGH
3. **실시간 GPS mock** — Firestore 실시간 OK, GPS 위치는 합성 데이터
4. **네비게이션 끊김 2건** — GillerApplyScreen, GillerLevelUpgradeScreen → Profile
5. **취소→분쟁 연결 누락** — ChatScreen에 분쟁 신고 버튼 없음
6. **fare-cache-scheduler `Record<string, any>`** — 백엔드 핵심 데이터 파싱에 any 타입
7. **대형 서비스 파일 4건** — delivery-service(1200줄), config-service(852줄), b2b-delivery(542줄), auction(506줄)

### 🟡 MEDIUM
8. **src/services as any 33건** — 8개 파일에 집중
9. **프로덕션 console.log** — payment-service.ts 금융 정보
10. **docs/core/* 전체 누락** — architecture.md 등 5개 핵심 문서 부재
11. **docs/flows/* 전체 누락** — 요청자/길러 앱 흐름 문서 없음
12. **docs/admin/admin-web.md 누락** — 관리자 웹 문서 없음
13. **CLAUDE.md 깨진 참조** — 존재하지 않는 docs 경로 다수
14. **미문서화 기능 8개** — 경매, 원타임/환승 매칭, 평점, 등급, 패널티, 실시간 추적, 구독

### 🟢 LOW (이전 초안 기준)
15. **대시보드 에러 처리** — API 실패 시 빈 화면
16. **B2B 세율 UI 혼동** — 10% vs 3.3% 구분 불명확
17. **길러용 월별 정산 화면** — B2B용만 존재

---

## 결론

사용자가 판단한 4대 과업은 모두 **정확**합니다. 추가로:
- **즉시 수정 필요**: 끊어진 네비게이션 2건, LSP 에러 6건 (5분 컷)
- **문서 복구**: docs/core/architecture.md + docs/admin/admin-web.md만 (필수 문서만)
- **지도가 가장 큰 과제**: Naver Maps SDK 연결 (사용자 결정)
- **서비스 레이어 정리**: as any 33건 제거 (파일 분할은 나중에)

### 사용자 결정
- **지도 SDK**: Naver Maps SDK
- **실시간 위치 범위**: GPS 실제 연결 + 지도 마커 + 지하철 실시간 ETA
- **대시보드 타입 경계**: 모두 포함 (admin-web tsc + fare-cache 타입 + 공유 타입 boundary)
- **문서**: 필수 문서만 (architecture.md + admin-web.md)
- **서비스 분할**: 나중에 (이번 범위 제외)
- **퀵픽스**: 미응답 → LSP 에러 + 네비게이션 끊김은 포함 (다른 작업의 전제 조건)
