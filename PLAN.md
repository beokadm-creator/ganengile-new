# 가는길에 - 1차 개발 기획안

## 프로젝트 개요
**서비스:** 지하철 크라우드 배송 플랫폼
**타겟:** 서울 지하철 1~9호선 이용자
**기술 스택:**
- React Native + Expo SDK 54
- TypeScript
- Firebase (Firestore, Auth)
- React Navigation (Stack + Tab)
- Toss Payments (나중에)

---

## 1차 개발 목표: 기본 구조 구축

### 사용자 타입
- **글러 (Gler):** 배송 요청자 (물건을 보내고 싶은 사람)
- **길러 (Giller):** 배송 대행자 (지하철 이용자, 돈 받고 배송)

---

## 네비게이션 구조

```
AppNavigator
  ├─ AuthNavigator (비인증 상태)
  │   ├─ LandingScreen (앱 소개 + 지하철 맵)
  │   ├─ SignUpScreen (이메일 가입)
  │   └─ LoginScreen (이메일 로그인)
  │
  └─ MainNavigator (인증 완료)
      └─ HomeTabNavigator
          ├─ HomeTab (메인 - 내 동선/요청 관리)
          ├─ AddRouteTab (동선 등록)
          ├─ RequestsTab (배송 요청 목록)
          └─ ProfileTab (프로필/설정)
```

---

## 화면 명세

### 1. LandingScreen (비인증)
**목적:** 앱 소개 및 가입 유도

**핵심 요소:**
- 앱 소개 문구
  - "출퇴근길에 수익을 창출하세요"
  - "지금 000명의 길러가 활동 중입니다"
- 서울 지하철 노선도 (시각적)
- CTA 버튼: "지금 시작하기"

**기능:**
- Firebase Auth 상태 확인 → 이미 로그인 시 MainNavigator로

### 2. SignUpScreen (비인증)
**목적:** 이메일로 가입

**입력 필드:**
- 이메일
- 비밀번호
- 비밀번호 확인
- 이름 (별명)

**기능:**
- Firebase Auth `createUserWithEmailAndPassword`
- 가입 완료 후 MainNavigator로 이동
- 밸리데이션 (이메일 형식, 비밀번호 길이)

### 3. LoginScreen (비인증)
**목적:** 기존 사용자 로그인

**입력 필드:**
- 이메일
- 비밀번호

**기능:**
- Firebase Auth `signInWithEmailAndPassword`
- 로그인 완료 후 MainNavigator로 이동
- "비밀번호 찾기" (TODO)
- "계정이 없으신가요?" → SignUpScreen

### 4. HomeScreen (인증 - 메인)
**목적:** 사용자 메인 대시보드

**기능 (길러 모드):**
- 내 동선 목록 표시 (Firestore에서 가져오기)
- 오늘의 활동 요약
- 빠른 동선 추가 버튼

**기능 (글러 모드):**
- 내 배송 요청 현황
- 새 배송 요청 버튼

### 5. AddRouteScreen (인증)
**목적:** 동선(출퇴근 경로) 등록

**입력 필드:**
- 출발역 (지하철역 선택)
- 도착역 (지하철역 선택)
- 출발 시간 (HH:mm)
- 요일 선택 (월/화/수/목/금/토/일)

**기능:**
- Firestore `routes` collection에 저장
- 유효성 검사 (출발역 ≠ 도착역)
- 저장 후 HomeScreen으로 복귀

### 6. RequestsScreen (인증)
**목적:** 배송 요청 목록 (placeholder)

**초기 기능:**
- "준비 중입니다" 메시지
- 향후 매칭 시스템 구현 예정

### 7. ProfileScreen (인증)
**목적:** 사용자 프로필 및 설정

**초기 기능:**
- 사용자 정보 표시 (이름, 이메일)
- 로그아웃 버튼
- 향후: 평점, 수익 관리

---

## Firebase Collections

### users
```typescript
{
  uid: string;           // Firebase Auth UID
  email: string;
  name: string;
  role: 'gler' | 'giller';  // 글러/길러 (초기에는 both 가능)
  createdAt: admin.firestore.Timestamp;
}
```

### routes
```typescript
{
  routeId: string;
  userId: string;        // users.uid
  startStation: {
    name: string;        // "서울역"
    line: string;        // "1호선"
    code?: string;       // "150"
  };
  endStation: {
    name: string;
    line: string;
    code?: string;
  };
  departureTime: string; // "08:30"
  daysOfWeek: number[];  // [1,2,3,4,5] = 월~금
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
}
```

### requests (나중에)
```typescript
{
  requestId: string;
  requesterId: string;  // users.uid (글러)
  courierId?: string;   // users.uid (길러, 매칭 후)
  status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
  // ...나머지 필드는 Phase 2에서
}
```

---

## 기술 요구사항

### 네비게이션
- React Navigation v7
- Stack Navigator (Auth, Main)
- Tab Navigator (Home, AddRoute, Requests, Profile)
- Firebase Auth 상태에 따른 자동 전환

### Firebase
- Auth: Email/Password
- Firestore: users, routes collections
- 보안 규칙: 사용자만 자신 데이터 접근

### TypeScript
- Strict mode
- 타입 정의 (`types/` 디렉토리)
- 화면 Props 인터페이스

---

## 구현 순서

### Step 1: 프로젝트 구조 설정
- [ ] `screens/`, `components/`, `services/`, `types/` 디렉토리 생성
- [ ] 타입 정의 (`types/user.ts`, `types/route.ts`, etc.)
- [ ] Firebase 서비스 초기화 (`services/firebase.ts`)

### Step 2: 네비게이션 구현
- [ ] AppNavigator (최상위)
- [ ] AuthNavigator (Landing → Signup/Login)
- [ ] MainNavigator (Tab Navigator)
- [ ] Firebase Auth 상태 리스너 연동

### Step 3: Auth 화면 구현
- [ ] LandingScreen (기본 UI)
- [ ] SignUpScreen (Firebase Auth 연동)
- [ ] LoginScreen (Firebase Auth 연동)

### Step 4: 메인 화면 구현
- [ ] HomeScreen (placeholder + 기본 레이아웃)
- [ ] AddRouteScreen (폼 UI + Firestore 저장)
- [ ] RequestsScreen (placeholder)
- [ ] ProfileScreen (placeholder)

### Step 5: 데이터 연동
- [ ] Firestore CRUD 구현
- [ ] 동선 저장/조회 기능
- [ ] 사용자 정보 표시

---

## 향후 확장 (Phase 2+)
- 배송 요청 생성 (보증금 시스템)
- 경로 매칭 알고리즘
- Toss Payments 연동
- 분실/파손 신고 시스템
- AI 기반 중고가액 조회
- 지하철역 데이터 연동 (공공 API)

---

_기획일: 2026년 2월 4일_
_기획자: OpenClaw (AI DevOps Assistant)_
_협업: opencode (구현) + 제미나이 (UI/UX)_
