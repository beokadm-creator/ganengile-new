# 가는길에 (GaneunGile)

> 서울 지하철 이용자가 출퇴근길에 배송을 수행하고 수익을 창출하는 크라우드 배송 플랫폼

---

## 📱 프로젝트 개요

지하철 출퇴근 동선을 활용한 크라우드 배송 서비스입니다.
**길러(Giller)** 는 자신의 이동 경로에 맞는 배송 요청을 수락해 수익을 얻고,
**글러(Gller)** 는 지하철 구간 내 빠르고 저렴한 배송을 의뢰합니다.

### 핵심 가치
- **기존 동선 활용:** 출퇴근길에 배송하며 추가 수익 창출
- **시간 효율성:** 지하철 이동 시간을 활용
- **유연한 참여:** 원하는 시간에만 참여, 강제성 없음

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React Native, Expo SDK 54, TypeScript |
| Navigation | React Navigation 7 (Stack + Bottom Tabs) |
| Backend | Firebase Firestore, Firebase Auth, Firebase Functions (Node.js 20) |
| Hosting | Firebase Hosting (웹 빌드) |
| Build | EAS Build (iOS / Android) |
| CI/CD | GitHub Actions |
| Region | `asia-northeast3` (서울) |

---

## 📂 프로젝트 구조

```
ganengile-new/
├── App.tsx                          # 앱 진입점
├── app.json / eas.json              # Expo / EAS 설정
├── firebase.json / .firebaserc      # Firebase 설정 (project: ganengile)
│
├── src/
│   ├── navigation/                  # 네비게이터
│   │   ├── AppNavigator.tsx         # 루트: Auth → Onboarding → Main
│   │   ├── AuthNavigator.tsx        # Landing, Login, SignUp
│   │   ├── OnboardingNavigator.tsx  # 역할 선택, 길러 온보딩
│   │   └── MainNavigator.tsx        # Tab + Stack (전체 화면)
│   │
│   ├── screens/
│   │   ├── auth/                    # Landing, Login, SignUp
│   │   ├── onboarding/              # RoleSelection, GillerOnboarding
│   │   ├── main/                    # 앱 핵심 화면 전체
│   │   ├── b2b/                     # B2B 기업 전용 화면
│   │   └── giller/                  # 길러 전용 (락커 관련)
│   │
│   ├── services/                    # 비즈니스 로직
│   │   ├── pricing-service.ts       # Phase 1 요금 계산
│   │   ├── matching-service.ts      # 매칭 알고리즘 + Firestore
│   │   ├── request-service.ts       # 배송 요청 CRUD
│   │   ├── delivery-service.ts      # 배송 진행 (픽업~완료)
│   │   ├── user-service.ts          # 사용자 정보
│   │   ├── rating-service.ts        # 평가 시스템
│   │   ├── chat-service.ts          # 채팅
│   │   ├── notification-service.ts  # FCM 푸시 알림
│   │   ├── SettlementService.ts     # 정산
│   │   ├── b2b-*.ts                 # B2B 서비스 모듈
│   │   └── config-service.ts        # Firestore Config 조회
│   │
│   ├── types/                       # TypeScript 타입 정의
│   ├── contexts/                    # React Context (Auth, User, Theme)
│   ├── components/                  # 공통 UI 컴포넌트
│   ├── theme/                       # 디자인 토큰 (colors, spacing, typography)
│   └── utils/                       # 유틸리티 함수
│
├── functions/                       # Firebase Cloud Functions
│   └── src/
│       ├── index.ts                 # FCM, 자동매칭, 요금계산, 채팅
│       └── scheduled/
│           ├── settlement-scheduler.ts   # 매월 5일 길러 정산
│           └── tax-invoice-scheduler.ts  # 세금계산서 발행
│
├── data/                            # 지하철 정적 데이터
│   ├── subway-stations.ts           # 역 목록
│   ├── travel-times.ts              # 구간 소요시간
│   └── matching-engine.ts           # 매칭 엔진 코어
│
└── .github/workflows/
    ├── deploy-firebase.yml          # Firebase 배포 (수동 트리거)
    └── eas-build.yml                # EAS 빌드 (main/develop push)
```

---

## ✨ 구현된 기능

### 인증 / 사용자
- Firebase Auth (이메일/비밀번호)
- 카카오 로그인 (`kakao-auth.ts`)
- Google 로그인 (`google-auth.ts`)
- 역할 시스템: `giller` (배송자) / `gller` (의뢰자) / `both`
- 길러 등급: `regular` → `professional` → `master`
- 온보딩 플로우 (역할 선택 → 길러 신원 인증)

### 배송 요청 생성 (5단계 스텝)
1. 역 선택 (픽업역 / 배송역)
2. 패키지 정보 (크기, 무게, 긴급도) + 요금 미리보기
3. 수신자 정보 + 시간 설정
4. 전체 요약 확인 + 제출
5. 추가 정보 (만날 장소, 보관 위치, 특이사항)

### Phase 1 요금 계산 (`pricing-service.ts`)
| 항목 | 내용 |
|------|------|
| 기본료 | 3,500원 |
| 거리료 | 역 개수 기반 600~2,400원 |
| 서비스 수수료 | 15% |
| 부가세 | 10% |
| 최소/최대 | 3,000원 / 8,000원 |
| 길러 정산 | 85% (platformFee 15%) |
| stationCount 산출 | Firestore → GPS Haversine → 기본값 5 |

### 매칭 시스템
- 자동 매칭 (Cloud Function: `onRequestCreated`)
- 경로 기반 매칭 점수 계산 (`calculateRouteMatchScore`)
- 배지 보너스 반영 (`calculateBadgeBonus`)
- 매칭 수락 / 거절 / 완료

### 배송 진행
- 픽업 인증 (QR 코드)
- 실시간 위치 추적 (`RealtimeSubwayService`)
- 락커 연동 (픽업/드롭오프)
- 배송 완료 처리

### 채팅
- 배송 건별 채팅방 생성
- 실시간 메시지 (Firestore onSnapshot)

### 정산 / 수익
- 길러 수익 내역 (`EarningsScreen`)
- 포인트 시스템 (`PointService`)
- 포인트 출금 (`PointWithdrawScreen`)
- 월간 자동 정산 스케줄러 (매월 5일)

### 배지 / 레벨
- 배지 수집 시스템 (`BadgeService`)
- 길러 레벨 승급 (`GillerLevelUpgradeScreen`)
- 배지 획득 팝업 (`BadgeEarnedPopup`)

### B2B (기업 전용)
- B2B 기업 온보딩 / 계약 (`business-contract-service.ts`)
- B2B 길러 등급: `silver` / `gold` / `platinum`
- 월간 배송 집계 + 세금계산서 발행
- B2B 대시보드 / 정산 화면

### 기타
- 다크모드 / 테마 시스템
- 오프라인 감지 (`OfflineIndicator`)
- 네트워크 에러 재시도 (`retry-with-backoff.ts`)
- 작성 중 임시저장 (`draft-storage.ts`)
- FCM 푸시 알림
- 분쟁 신고 / 해결 (`DisputeReportScreen`)

---

## 🔥 Firestore 컬렉션 구조

```
users/               사용자 정보 (역할, 등급, 통계)
routes/              길러 등록 동선 (출발역, 도착역, 시간대)
requests/            배송 요청 (상태, 요금, 패키지, feeBreakdown)
matches/             매칭 결과 (requestId, gillerId, status)
deliveries/          배송 진행 정보 (픽업/완료 타임스탬프)
ratings/             평가 (matchId, rating 1-5, comment)
chats/               채팅방 (requestId 연결)
notifications/       FCM 알림 이력
points/              포인트 내역
settlements/         정산 내역
b2b_contracts/       B2B 계약
b2b_requests/        B2B 배송 요청
tax_invoices/        세금계산서
config_stations/     역 정보 (Firestore Config)
config_travel_times/ 구간 소요시간
config_algorithm_params/ 매칭 파라미터
```

### `requests.feeBreakdown` 스키마
```typescript
feeBreakdown: {
  baseFee: number;
  distanceFee: number;
  sizeFee: number;
  weightFee: number;
  urgencySurcharge: number;
  manualAdjustment: number;
  serviceFee: number;
  vat: number;
  totalFee: number;
  breakdown: {
    gillerFee: number;    // totalFee × 85%
    platformFee: number;  // totalFee × 15%
  };
}
```

---

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 (Expo Go)
npm start

# 웹 브라우저
npm run web

# iOS 시뮬레이터
npm run ios

# 안드로이드 에뮬레이터
npm run android

# Firestore Config 초기화 (최초 1회)
npm run init-config
```

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 필수 항목:
```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=ganengile
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_CLIENT_ID=        # Google 로그인 (선택)
```

---

## 🤖 GitHub Actions (CI/CD)

### Firebase 배포 (`deploy-firebase.yml`)
- **트리거:** 수동 (`workflow_dispatch`)
- **옵션:** Target (`firestore` / `hosting` / `functions` / `all`), Environment (`production` / `staging`)
- **Node.js:** 20 (Firebase Functions 런타임과 일치)

### EAS 빌드 (`eas-build.yml`)
- **트리거:** `main` / `develop` push, `v*` 태그, 수동
- **옵션:** Platform (`all` / `ios` / `android`), Profile (`production` / `preview`)
- **Node.js:** 20

### 필수 GitHub Secrets
```
FIREBASE_SERVICE_ACCOUNT   # Firebase 서비스 계정 JSON
EXPO_TOKEN                 # Expo 계정 토큰
```

---

## ⚙️ Firestore Config 초기화

앱 최초 배포 시 Firestore에 지하철 데이터를 초기화합니다.

```bash
npm run init-config
```

초기화 대상:
- `config_stations` — 역 정보
- `config_travel_times` — 구간 소요시간
- `config_express_trains` — 급행 열차
- `config_congestion` — 혼잡도
- `config_algorithm_params` — 매칭 알고리즘 파라미터

> Firebase Console에서 실시간 수정 가능 → 재배포 없이 요금/알고리즘 파라미터 튜닝

---

## 🧪 테스트

```bash
npm test                 # 전체 테스트
npm run test:watch       # Watch 모드
npm run test:coverage    # 커버리지 리포트
npm run lint             # ESLint 검사
npm run lint:fix         # 자동 수정
```

테스트 위치: `tests/`, `__tests__/`, `src/**/*.test.ts`

---

## 📋 개발 현황

### 완료
- [x] Firebase 인증 (이메일, Google, 카카오)
- [x] 역할 시스템 (길러 / 글러 / 둘 다)
- [x] 배송 요청 생성 5단계 플로우
- [x] Phase 1 요금 계산 (거리 기반, gillerFee/platformFee)
- [x] 자동 매칭 Cloud Function
- [x] 배송 진행 플로우 (픽업 인증 → 완료)
- [x] 채팅 (실시간)
- [x] FCM 푸시 알림
- [x] 평가 시스템
- [x] 수익 / 포인트 관리
- [x] 배지 / 레벨 시스템
- [x] B2B 기업 전용 기능
- [x] 월간 정산 자동화 (Cloud Function)
- [x] 세금계산서 발행
- [x] GitHub Actions Node.js v20 동기화

### 진행 중
- [ ] EAS Build EXPO_TOKEN 인증 이슈 해결
- [ ] 실시간 지하철 도착 정보 연동 (공공데이터포털 API)

---

## 🔗 링크

- **Firebase Console:** https://console.firebase.google.com/project/ganengile
- **Expo Dashboard:** https://expo.dev
- **GitHub Repository:** https://github.com/beokadm-creator/ganengile-new

---

_프로젝트 시작: 2026년 2월_
_최종 업데이트: 2026년 3월_
