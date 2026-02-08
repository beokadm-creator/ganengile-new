# 가는길에 (GaneunGile) - 지하철 크라우드 배송 플랫폼

## 📱 프로젝트 개요

서울 지하철 1~9호선 이용자가 출퇴근길에 배송을 수행하고 수익을 창출하는 크라우드 배송 플랫폼입니다.

### 핵심 가치
- **기존 동선 활용:** 출퇴근길에 배송하며 추가 수익 창출
- **시간 효율성:** 지하철 이용 시간을 낭비 없이 활용
- **유연한 참여:** 특정 시간 고정 없이 필요할 때만 참여 가능

---

## 🛠️ 기술 스택

### Frontend
- **React Native** - 크로스 플랫폼 모바일 앱
- **Expo SDK 54** - 개발 및 배포 도구
- **TypeScript** - 타입 안전성
- **React Navigation** - 화면 네비게이션

### Backend
- **Firebase Firestore** - NoSQL 데이터베이스
- **Firebase Auth** - 사용자 인증
- **Firebase Hosting** - 웹 배포 (개발/테스트용)
- **Firebase Functions** - 서버리스 백엔드 (예정)

---

## 📂 프로젝트 구조

```
ganengile-new/
├── App.tsx              # 메인 엔트리 포인트
├── screens/             # 화면 컴포넌트
│   ├── HomeScreen.tsx   # 홈 화면 (현재 경로 목록)
│   ├── RouteScreen.tsx  # 동선 등록 화면
│   ├── RequestsScreen.tsx # 배송 요청 목록
│   └── ProfileScreen.tsx  # 프로필/설정
├── components/          # 재사용 컴포넌트
├── services/            # Firebase 연동
├── hooks/               # 커스텀 React Hooks
└── types/               # TypeScript 타입 정의
```

---

## ✨ 주요 기능

### 1단계: 핵심 인프라 ✅
- [x] Firebase 프로젝트 설정 (ganengile)
- [x] Firestore 데이터베이스 구조
- [x] Firebase Auth (Email/Password)
- [x] Config 컬렉션 초기화 (역, 경로, 요금)

### 2단계: 기본 기능 ✅
- [x] 사용자 역할 시스템 (Giller/Gller/BOTH)
- [x] 동선 등록 (CRUD, 유효성 검사)
- [x] 역할 전환 (슬라이더 UI)

### 3단계: 매칭 시스템 🚧
- [x] **요금 계산 함수** (calculateDeliveryPricing)
  - 거리 기반 요금 (3,000~8,000원)
  - 출퇴근 할증 (+20%)
  - 긴급 surcharge (0%, +20%, +50%)
  - 환승 보너스
  - 길러 등급별 보너스
- [x] **매칭 함수** (matchRequests)
- [x] **수락 함수** (acceptMatch)
- [x] **거절 함수** (rejectMatch)
- [x] **완료 함수** (completeMatch)
- [ ] 전문 길러 시스템
- [ ] 배지 시스템
- [x] 프로젝트 초기 설정 (Expo + TypeScript)
- [x] Firebase 프로젝트 생성 및 설정
- [ ] 화면 네비게이션 구조 (Stack Navigator)
- [ ] Firebase CRUD 연동 (사용자, 경로, 요청)

### 2단계: 핵심 기능
- [ ] 홈 화면 UI (현재 등록된 경로 목록)
- [ ] 동선 등록 기능 (출발역 → 도착역, 시간대)
- [ ] 배송 요청 목록 화면
- [ ] 경로 매칭 알고리즘
- [ ] 매칭 결과 화면
- [ ] 수락/거절 기능

### 3단계: 사용자 관리
- [ ] 프로필 화면
- [ ] 평가 시스템
- [ ] 수익 관리

### 4단계: 데이터 연동
- [ ] 서울 지하철역 데이터 연동
- [ ] 경로 검색 기능
- [ ] 실시간 지하철 도착 정보 (옵션)

---

## ⚙️ Config 초기화

프로덕션 환경에서는 하드코딩된 대신 **Firestore Config Collections**을 사용하여 지하철 데이터를 관리합니다.

### Config Collections

```javascript
config_stations           // 역 정보 (30개 주요역)
config_travel_times       // 소요 시간 매트릭스
config_express_trains     // 급행 열차 정보
config_congestion         // 혼잡도 데이터
config_algorithm_params   // 매칭 알고리즘 파라미터
```

### 초기화 방법

```bash
# Config 데이터 초기화 (Firebase에 데이터 저장)
npm run init-config

# 상세 로그 보기
npm run init-config -- --verbose

# 기존 데이터 덮어쓰기
npm run init-config -- --force
```

### 장점
- 🔧 Firebase Console에서 실시간 파라미터 수정 가능
- 📈 A/B 테스트 가능 (v1.0 → v1.1)
- 🚀 배포 없이 알고리즘 튜닝
- 📊 지하철 API 연동 시 데이터만 교체

---

## 🔥 Firebase Collections

```javascript
users      // 사용자 정보
  - uid: string
  - email: string
  - name: string
  - phone: string
  - rating: number
  - totalEarnings: number

routes     // 동선 (출발역, 도착역, 시간)
  - userId: string
  - startStation: { name: string, line: string, lat: number, lng: number }
  - endStation: { name: string, line: string, lat: number, lng: number }
  - departureTime: string // HH:mm format
  - daysOfWeek: number[] // [1,2,3,4,5] for weekdays
  - createdAt: Timestamp

requests   // 배송 요청
  - requesterId: string
  - pickupStation: { name: string, line: string, ... }
  - deliveryStation: { name: string, line: string, ... }
  - packageInfo: { size: string, weight: string, description: string }
  - fee: number
  - deadline: Timestamp
  - status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled'

matches    // 매칭 정보
  - requestId: string
  - courierId: string
  - routeId: string
  - status: 'accepted' | 'in_progress' | 'completed'
  - createdAt: Timestamp

ratings    // 평가
  - matchId: string
  - fromUser: string
  - toUser: string
  - rating: number // 1-5
  - comment: string
```

---

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# 웹에서 개발 (推荐)
npm run web

# iOS 시뮬레이터
npm run ios

# 안드로이드 에뮬레이터
npm run android
```

---

## 🛡️ 개발 원칙

### 안전성 우선
- 모든 변경사항은 테스트 후 배포
- Firebase 보안 규칙 엄격히 적용
- 사용자 데이터 보호 최우선

### 코드 품질
- TypeScript strict mode 활용
- ESLint/Prettier로 코드 스타일 일관성
- 컴포넌트 재사용성 고려

### 협업 방식
- **opencode**: AI 개발 에이전트가 코드 작성 및 기능 구현
- **제미나이 (Gemini):** 디자인 전문가로 UI/UX 설계 담당 (opencode가 소환)
- **OpenClaw (저)**: 코드 리뷰, QA 검증, 기술적 의사결정, 배포 승인
- 모든 코드는 리뷰 후 반영
- UI/UX가 필요할 때는 opencode에게 "제미나이를 소환해라"고 지시

---

## 📅 개발 로드맵

### Week 1: 인프라 구축
- React Navigation 설정
- 4개 기본 화면 (Home, Route, Requests, Profile)
- Firebase 연동 기초
- **제미나이와 협업하여 UI/UX 설계**

### Week 2-3: 핵심 기능 구현
- 동선 등록/관리
- 배송 요청 목록
- 경로 매칭 알고리즘
- 사용자 인증
- Firestore CRUD

### Week 4: 사용자 관리
- 프로필 화면
- 평가 시스템
- 수익 관리

### Week 5: 데이터 연동
- 서울 지하철역 데이터 연동
- 경로 검색 기능
- 실시간 지하철 도착 정보

### Week 6: 폴리싱
- UI/UX 개선
- 에러 핸들링
- 테스트 및 배포

---

## 🔗 관련 링크

- **Firebase Console**: https://console.firebase.google.com/project/ganengile
- **Expo Dashboard**: https://expo.dev
- **GitHub Repository**: (예정)

---

_개발 시작일: 2026년 2월 4일_  
_마지막 수정: 2026년 2월 4일_
