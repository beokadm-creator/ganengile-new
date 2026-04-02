# 가는길에 — 기능적 단절 점검 보고서

> **점검일**: 2026-04-01
> **범위**: 앱 (모바일) + 관리자 웹 전체
> **방식**: 정적 분석 (코드 기반)
> **대상**: 59 화면, 74 서비스, 17 관리자 페이지, 25 API 라우트

---

## 요약

| 심각도 | 건수 | 내용 |
|--------|------|------|
| 🔴 CRITICAL | 3 | 카카오 로그인 차단, 한글 인코딩 깨짐(8개 화면), B2B 등급 하드코딩 |
| 🟡 MEDIUM | 6 | TypeScript 컴파일 에러 (빌드 차단 가능) |
| ⚪ LOW | 1 | 고아 화면 (데드코드) |
| ✅ 정상 | — | 관리자 웹 API 연결, 네비게이션 117건, onPress, TODO/FIXME 모두 정상 |

---

## 🔴 CRITICAL — 사용자 직접 영향

### C1. 카카오 로그인 차단됨

| 항목 | 내용 |
|------|------|
| **파일** | `src/services/kakao-auth.ts:180` |
| **코드** | `throw new Error('카카오 로그인에는 Firebase Custom Token 발급 백엔드가 필요합니다. Firebase Functions 연동 후 세션 연결을 완료해주세요.')` |
| **함수** | `linkKakaoToFirebase()` 내부에서 **무조건 throw** |
| **영향** | 사용자가 카카오 소셜 로그인 시 항상 에러 발생 |
| **관련 화면** | `LoginScreen.tsx`, `NewSignUpScreen.tsx` |

### C2. 한국어 텍스트 인코딩 깨짐 (8개 화면)

사용자에게 Alert 메시지가 깨진 문자로 표시됩니다.

| 파일 | 심각도 | 비고 |
|------|--------|------|
| `src/screens/main/CreateAuctionScreen.tsx` | 전체 깨짐 | Alert 4건 모두 |
| `src/screens/main/DepositPaymentScreen.tsx` | 전체 깨짐 | Alert 3건 모두 |
| `src/screens/main/GillerLevelUpgradeScreen.tsx` | 전체 깨짐 | Alert 6건 모두 |
| `src/screens/onboarding/BasicInfoOnboarding.tsx` | 전체 깨짐 | Alert 6건 모두 |
| `src/screens/main/IdentityVerificationScreen.tsx` | 전체 깨짐 | Alert 7건 모두 |
| `src/screens/main/MatchingResultScreen.tsx` | 전체 깨짐 | Alert 5건 모두 |
| `src/screens/main/ProfileScreen.tsx` | 부분 깨짐 | 일부 Alert만 |
| `src/screens/main/CreateRequestScreen.tsx` | 부분 깨짐 | 일부 Alert만 |
| `src/navigation/B2BNavigator.tsx` | 주석만 | 기능 영향 없음 |

### C3. B2B 길러 등급 평가 하드코딩 (실데이터 미연동)

| 항목 | 내용 |
|------|------|
| **파일** | `src/services/b2b-giller-service.ts:161-164` |
| **코드** | `// TODO: users 컬렉션의 실데이터로 연결` |
| **하드코딩값** | `rating = 4.5`, `completedDeliveries = 30`, `accountAgeMonths = 6` |
| **영향** | B2B 길러 등급(Platinum/Gold/Silver) 평가가 **실제 데이터가 아닌 고정값**으로 동작 |

---

## 🟡 MEDIUM — TypeScript 컴파일 에러 (빌드 차단 가능)

| # | 파일:라인 | 에러 내용 |
|---|-----------|-----------|
| M1 | `b2b-giller-service.ts:122` | `calculateNextEvaluation` is private — 외부에서 호출 중 |
| M2 | `B2BRequestScreen.tsx:78,84` | `latitude` does not exist in type `Location` |
| M3 | `NewSignUpScreen.tsx:225` | `user` does not exist on type `User` |
| M4 | `NewSignUpScreen.tsx:322` | `string` is not assignable to type `DimensionValue` (width) |
| M5 | `LoginScreen.tsx:39` | useEffect dependency 누락 (`loadSavedEmail`) — React Hook 경고 |
| M6 | `B2BDashboardScreen.tsx:64` | useEffect dependency 누락 (`loadDashboardData`) — React Hook 경고 |

> **비고**: Expo는 TS 에러가 있어도 런타임에 실행 가능한 경우가 있으나, 타입 안전성이 보장되지 않아 예기치 않은 런타임 에러의 원인이 될 수 있습니다.

---

## ⚪ LOW — 기능 영향 없음

### L1. 고아 화면 (네비게이터 미등록)

| 파일 | 상태 |
|------|------|
| `src/screens/onetime/OnetimeModeScreen.tsx` | `main/OnetimeModeScreen.tsx`가 MainNavigator에 등록. 이 버전은 데드코드 |
| `src/screens/onboarding/IdentityVerification.tsx` | `export { default } from '../main/IdentityVerificationScreen'` 리익스포트만 |
| `src/screens/onboarding/GillerApplicationOnboarding.tsx` | `export { default } from '../main/GillerApplyScreen'` 리익스포트만 |

---

## ✅ 확인 완료 (문제 없음)

### 관리자 웹 API 연결 — 전체 정상
17페이지 모두 `useEffect` + `fetch()`로 API를 호출하며, 25개 API 라우트와 일치합니다.

| 페이지 | API 경로 | 상태 |
|--------|----------|------|
| dashboard | `/api/admin/dashboard`, `/beta1-infrastructure`, `/beta1-ai-review` | ✅ |
| disputes | `/api/admin/disputes` | ✅ |
| deposits | `/api/admin/deposits` | ✅ |
| settlements | `/api/admin/settlements` | ✅ |
| gillers/applications | `/api/admin/gillers` | ✅ |
| deliveries | `/api/admin/deliveries` | ✅ |
| lockers | `/api/admin/lockers`, `/non-subway-lockers` | ✅ |
| verifications | `/api/admin/verifications` | ✅ |
| users | `/api/admin/users` | ✅ |
| points/balances | `/api/admin/points` | ✅ |
| points/withdrawals | `/api/admin/withdrawals` | ✅ |
| integrations/* | `/api/admin/integrations/{payment,bank,identity,ai}` | ✅ |
| beta1/ai-review | `/api/admin/beta1-ai-review` | ✅ |

### 네비게이션 연결 — 전체 유효
117개 `navigation.navigate/push/replace/reset` 호출을 모두 검증하여, 대상 스크린이 해당 네비게이터에 정상 등록됨을 확인했습니다.

- **MainNavigator**: 37개 스크린 (Tab 6개 + Stack 31개)
- **B2BNavigator**: 9개 스크린
- **AuthNavigator**: 3개 스크린 (Landing, NewSignUp, Login)

### 빈 onPress 핸들러 — 0건
`onPress={() => {}}` 패턴이 단 1건도 없습니다.

### 화면 파일 내 TODO/FIXME — 0건
화면 TSX 파일에 TODO, FIXME, HACK 등의 주석이 없습니다.

---

## 제외 항목 (런타임 검증 필요)

아래 항목은 정적 분석으로 확인할 수 없어, 실제 실행 환경에서 검증이 필요합니다.

- [ ] 카카오 로그인 실제 에러 메시지 (LoginScreen → 카카오 버튼 클릭)
- [ ] 인코딩 깨짐 화면 실제 렌더링 (Playwright 스크린샷)
- [ ] B2B 길러 등급 평가 실제 동작 (Firestore 데이터와 비교)
- [ ] 관리자 웹 각 페이지 API 응답 정상 여부
- [ ] 앱 핵심 플로우: 요청 생성 → 매칭 → 배송 → 완료 → 평가
