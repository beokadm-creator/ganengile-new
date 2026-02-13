# 배포 가이드 (Deployment Guide)

## 📋 목차

- [배포 전 체크리스트](#배포-전-체크리스트)
- [Firebase 배포](#firebase-배포)
- [App Store 배포](#app-store-배포)
- [Play Store 배포](#play-store-배포)
- [배포 후 작업](#배포-후-작업)

---

## 배포 전 체크리스트

### ✅ 코드 검토

- [ ] **코드 리뷰 완료**
  - 모든 PR merge 완료
  - Main 브랜치와 동기화

- [ ] **테스트 통과**
  - 단위 테스트: 100% (최소 87%)
  - 통합 테스트: 통과
  - E2E 테스트: 주요 시나리오 통과

- [ ] **Lint 통과**
  ```bash
  npm run lint
  ```

- [ ] **TypeScript 에러 없음**
  ```bash
  npx tsc --noEmit
  ```

### ✅ 환경 설정

- [ ] **Environment 변수 설정**
  ```bash
  # .env 파일
  FIREBASE_API_KEY=
  FIREBASE_AUTH_DOMAIN=
  FIREBASE_PROJECT_ID=
  FIREBASE_STORAGE_BUCKET=
  FIREBASE_MESSAGING_SENDER_ID=
  FIREBASE_APP_ID=
  
  SEOUL_SUBWAY_API_KEY=
  KOREA_RAIL_API_KEY=
  INCHEN_SUBWAY_API_KEY=
  ```

- [ ] **Firebase 프로젝트 설정**
  - Firestore: 활성화됨
  - Auth: Email/Password 활성화됨
  - Hosting: 활성화됨
  - Storage: 활성화됨 (선택사항)

- [ ] **Security Rules 배포**
  ```bash
  firebase deploy --only firestore:rules
  ```

### ✅ 리소스 준비

- [ ] **앱 아이콘** (1024x1024 PNG)
- [ ] **스플래시 화면** (각 크기별)
  - iOS: 1125x2436 (iPhone X), 750x1334 (iPhone 8), 등
  - Android: 1920x1080 (xxxhdpi), 1280x720 (xxhdpi), 등
- [ ] **스토어 설명** (한국어, 영어)
- [ ] **스크린샷** (최소 5장)
- [ ] **개발자 계정**
  - Apple Developer: 유료 계정 ($99/년)
  - Google Play: 원클 계정 ($25/1회)

---

## Firebase 배포

### 1. Firebase 프로젝트 설정

```bash
# Firebase 프로젝트 초기화
firebase init

# 1. Existing project 선택
# 2. ganengile 프로젝트 선택
# 3. Hosting 활성화 (public: build/web)
# 4. Functions 활성화 (functions 폴더)

# Firestore Rules 배포
firebase deploy --only firestore:rules

# Storage Rules 배포 (선택사항)
firebase deploy --only storage:rules
```

### 2. 웹 배포

```bash
# 프로덕션 빌드
npm run build

# 웹 배포
firebase deploy --only hosting

# 또는
npm run deploy
```

**배포 완료 후:**
- URL: https://ganengile.web.app
- Firebase Console 확인

### 3. Functions 배포

```bash
# Functions 빌드
cd functions
npm run build

# Functions 배포
firebase deploy --only functions

# 배포 로그 확인
firebase functions:log
```

### 4. Config Collections 초기화

```bash
# Config 데이터 초기화
npm run init-config

# Config 데이터 확인
npm run verify-config
```

---

## App Store 배포

### 1. 앱 빌드

#### iOS (Expo)

```bash
# EAS Build 설정
npm install -g eas-cli
eas build --platform ios

# 또는 로컬 빌드
eas build --platform ios --local
```

**빌드 완료 후:**
- `.ipa` 파일 다운로드
- Transport Desktop 실행

#### Android (Expo)

```bash
# EAS Build
eas build --platform android

# .aab 파일 다운로드 (Google Play용)
```

### 2. App Store Connect 설정

**단계:**

1. **앱 등록**
   - App Store Connect 접속
   - "내 앱" → "+" 버튼
   - 새 앱 정보 입력

2. **앱 정보 입력**
   - **앱 이름**: 가는길에
   - **번들 아이디**: com.ganengile.app
   - **SKU**: ganengile-ios
   - **유저**: Business (비즈니스)

3. **가격 및 유효기간**
   - **가격**: 무료
   - **유효기간**: 무제한

4. **앱 심사 정보**
   - **카테고리**: 쇼핑, 비즈니스
   - **서브 카테고리 1**: 비즈니스
   - **서브 카테고리 2**: 유틸리티

5. **심사용 정보**
   - **등록 분류**: 📂 사업용 유틸리티
   - **무료/유료**: 무료
   - **수출 규정**: NO
   - **IDFA**: NO

6. **버전 릴리스**
   - 초기 버전: 1.0.0
   - 심사용 스크린샷, 데모 동영상 첨부

### 3. TestFlight 배포

**Transport Desktop:**
1. "Validate App" 클릭
2. 버전 정보 확인
3. "Distribute App" 클릭
4. TestFlight 내부 테스터 선택
5. "Export" 클릭

**심사 대기:**
- 보통 1-2일 소요
- 상태: "In Review" → "Approved for TestFlight"

### 4. 프로덕션 배포

**TestFlight 내부 테스트:**
- [ ] 기능 테스트 완료
- [ ] 버그 없음 확인
- [ ] 배포 준비 완료

**App Store 제출:**
1. TestFlight에서 "App Store 배포" 클릭
2. 버전 릴리스 작성 (한국어, 영어)
3. 승토샷 업데이트 (최소 5장)
4. "제출 검토" 클릭
5. 심사 대기 (보통 1-3일)

---

## Play Store 배포

### 1. Google Play Console 설정

**단계:**

1. **앱 만들기**
   - Google Play Console 접속
   - "모든 앱" → "앱 만들기"
   - 앱 정보 입력

2. **앱 정보**
   - **앱 이름**: 가는길에
   - **번들 아이디**: com.ganengile.app
   - **무료/유료**: 무료

3. **콘텐츠 등록**
   - **카테고리**: 쇼핑
   - **등급 분류**: 모든 연령대

4. **스토어 등록정보**
   - 짧은 설명 (80자)
   - 긴 설명 (4000자)
   - 스크린샷 (최소 2장, 320px 이상)

### 2. 앱 서명

```bash
# Android keystore 생성 (최초 1회만)
keytool -genkey -v -keystore ganengile-release.keystore \
  -alias ganengile-key -keyalg RSA -keysize 2048 -validity 10000
```

### 3. APK/AAB 업로드

**Google Play Console:**
1. "릴리스 관리" → "새 프로덕션 릴리스"
2. **앱 번들 서명 및 업로드**
   - `.aab` 파일 업로드
   - 버전 정보 입력 (1.0.0)

### 4. 콘텐츠 등급

**등급 설문조사:**
- [ ] 폭력/혐오 성인용 콘텐츠
- [ ] 광고 포함 여부
- [ ] 자녀용 여부
- [ ] 미국 현지법 준수 여부

### 5. 심사 요청

**심사 전 체크리스트:**
- [ ] API 테스트 완료
- [ ] 정책 준수 확인
- [ ] 64비트 아키텍처 지원
- [ ] 태블릿 지원 확인
- [ ] Android 5.0 (API 21) 이상

**심사 대기:**
- 보통 1-3일 소요
- 상태: "검토 중" → "게시 시작" → "게시됨"

---

## 배포 후 작업

### ✅ 첫 24시간

**모니터링:**
- [ ] Crashlytics 대시보드 확인
- [ ] 에러 로그 확인 (Firebase Console)
- [ ] 사용자 피드백 수집
- [ ] 앱 스토어 리뷰 확인

**긴급 대응:**
- [ ] 치명적 버그 발견 시 핫픽스 (1-2일)
- [ ] 일반 버그는 다음 릴리스 (1주)

### ✅ 첫 주일

**주간 보고:**
- [ ] DAU (일일 활성 사용자)
- [ ] MAU (월간 활성 사용자)
- [ ] 리텐션 비율
- [ ] 충전률
- [ ] 평균 매칭 시간
- [ ] 배송 완료율

**개선 사항:**
- [ ] 사용자 피드백 반영
- [ ] 버그 수정 배포
- [ ] UI/UX 개선
- [ ] 성능 최적화

### ✅ 첫 달

**월간 보고:**
- [ ] 총 사용자 수
- [ ] 총 배송 건수
- [ ] 평균 리뷰 점수
- [ ] 총 수익
- [ ] 주요 문제 사항

---

## 🚨 배포 롤백 계획

### 롤백 시나리오

| 시나리오 | 조치 | 시간 |
|---------|------|------|
| 치명적 버그 | 핫픽스 배포 | 1-2일 |
| 일반 버그 | 다음 릴리스 | 1주 |
| UI/UX 문제 | 다음 릴리스 | 2주 |
| 개선 사항 | 로드맵 | 다음 버전 |

### 롤백 절차

1. **Firebase 롤백**
   ```bash
   firebase deploy --only hosting:2024-12-31
   ```

2. **App Store 업데이트**
   - 새 버전 배포
   - "긴급 업데이트" 체크
   - 심사 우선 요청 (지원센터)

3. **Play Store 업데이트**
   - 새 버전 배포
   - 단계적 롤아웃 (10% → 50% → 100%)

---

## 📞 지원 센터 연락처

### Firebase 지원
- **문서**: https://firebase.google.com/docs
- **커뮤니티**: https://firebase.community

### Apple 지원
- **문서**: https://developer.apple.com/documentation
- **지원센터**: https://developer.apple.com/support
- **전화**: 080-330-0300 (한국)

### Google 지원
- **문서**: https://developer.android.com/docs
- **지원센터**: https://support.google.com/p/contact/play-console

---

## 📅 릴리스 일정

### 버전 1.0.0 (현재)
- **개발 완료**: 2026-02-13
- **배포**: 2026-02-13
- **배포 완료**: 예정 2026-02-16

### 버전 1.0.1 (버그 수정)
- **배포**: 예정 2026-02-20
- **내용**: 초기 버그 수정

### 버전 1.1.0 (마이너 업데이트)
- **배포**: 예정 2026-03-01
- **내용**: UI/UX 개선, 성능 최적화

### 버전 1.2.0 (메이저 업데이트)
- **배포**: 예정 2026-04-01
- **내용**: 새로운 기능 추가

---

_마지막 업데이트: 2026-02-13_
