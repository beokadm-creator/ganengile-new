# 프로덕션 배포 체크리스트

**프로젝트:** 가는길에 (ganengile-new)
**배포일자:** 2026-02-13
**담당자:** OpenClaw DevOps Assistant

---

## 📋 사전 배포 준비 (Pre-Deployment)

### 1. 환경 설정 (Environment Setup)

#### .env.production 설정
- [ ] `.env.production` 파일 생성
- [ ] Firebase 프로덕션 프로젝트 ID 설정
  ```
  FIREBASE_PROJECT_ID=ganengile-production
  FIREBASE_API_KEY=AIzSyCr**** (Production Key)
  ```
- [ ] .gitignore에 .env.production 추가 확인
- [ ] 환경 변수 암호화 필요 목록 확인
  - [ ] `ENCRYPTION_KEY` (민감 데이터 암호화)
  - [ ] `EXPO_PUBLIC_SENTRY_DSN` (Sentry DSN)

#### Firebase 프로덕션 설정
- [ ] Firebase Console 접속
- [ ] Firestore Database 인덱스 확인
  - [ ] `routes` 컬렉션: `isActive, userId` 복합 인덱스
  - [ ] `requests` 컬렉션: `requesterId, createdAt` 복합 인덱스
  - [ ] `matches` 컬렉션: `requestId, status` 복합 인덱스
  - [ ] `deliveries` 컬렉션: `gillerId, status` 복합 인덱스
- [ ] Firestore Security Rules 배포
  ```bash
  firebase deploy --only firestore:rules --project ganengile-new
  ```
- [ ] Cloud Functions 함수 배포
  ```bash
  firebase deploy --only functions --project ganengile-new
  ```

---

## 🔍 빌드 최적화 (Build Optimization)

### 2. 코드 최적화 확인
- [ ] Tree shaking 활성화 확인
  - [ ] 사용하지 않는 import 제거
  - [ ] 사이드 이펙트 확인 (없으면 좋음)
- [ ] ProGuard/R8 축소 활성화 (Android)
- [ ] Bitcode 최적화 활성화 (iOS)
- [ ] 번들 사이즈 확인
  - [ ] Initial Bundle < 200KB (우수)
  - [ ] Total Bundle < 2MB (양호)
  - [ ] Asset Compression (gzip/brotli)

### 3. 번들 분석
- [ ] `npx react-native-bundle-visualizer` 실행
- [ ] 큰 라이브러리 확인 (>100KB)
  - [ ] firebase: ~250KB
  - [ ] expo: ~800KB
  - [ ] react-navigation: ~150KB
- [ ] 코드 스플리팅 고려

### 4. 리소스 최적화
- [ ] 이미지 압축 및 WebP 변환
- [ ] 폰트 서브셋팅 (한글, 영문만)
- [ ] 메타데이터 최적화
  ```json
  {
    "expo": {
      "packagerOpts": {
        "assetExts": ["webp", "png"]
      }
    }
  }
  ```

---

## 🚀 빌드 및 배포 (Build & Deploy)

### 5. iOS 배포
- [ ] TestFlight 빌드 생성
  ```bash
  eas build --platform ios --profile production
  ```
- [ ] 빌드 검증
  - [ ] 앱스토어 연결 테스트
  - [ ] 푸시 알림 테스트
  - [ ] 심사 승인 대기
- [ ] App Store 제출
  - [ ] 스크린샷 준비 (각 크기)
  - [ ] App Store Connect 메타데이터 입력
  - [ ] 개발자 계정 정보 확인

### 6. Android 배포
- [ ] Play Store 빌드 생성
  ```bash
  eas build --platform android --profile production
  ```
- [ ] 번들 사이즈 확인 (<100MB 권장)
- [ ] APK 서명 확인
  ```bash
  jarsigner -verify -verbose -certs my-app.apk
  ```
- [ ] Google Play Console 업로드
  - [ ] 내부 테스트 트랙 설정
  - [ ] 스크린샷 준비
  - [ ] 제품 설명 작성
  - [ ] 개인정보 처리 정책 확인

### 7. 웹 배포 (선택 사항)
- [ ] Firebase Hosting 배포
  ```bash
  firebase deploy --only hosting --project ganengile-new
  ```
- [ ] PWA 설정 확인
  - [ ] Service Worker 등록
  - [ ] 오프라인 지원 확인
  - [ ] Manifest.json 메타데이터

---

## 📊 모니터링 설정 (Monitoring Setup)

### 8. Error Tracking
- [ ] Sentry 설정 확인
  ```typescript
  import * as Sentry from '@sentry/react-native';
  
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 1.0,
  });
  ```
- [ ] 소스맵 업로드
- [ ] 알림 설정 (Sentry 단계)
  - [ ] Performance Monitoring 활성화
  - [ ] Session Replay 활성화

### 9. Analytics 설정
- [ ] Firebase Analytics 활성화
  ```typescript
  import analytics from '@react-native-firebase/analytics';
  
  // 로그 이벤트
  analytics().logEvent('app_open', {
    screen: 'home',
    user_type: 'gller',
  });
  ```
- [ ] 사용자 속성 설정
  - [ ] 기본 속성 (사용자 유형, 지역)
  - [ ] 맞춤형 속성 (동선, 시간대)
- [ ] 전환 이벤트 추적
  - [ ] 회원가입 완료
  - [ ] 첫 배송 완료
  - [ ] 첫 매칭 성공

### 10. Performance Monitoring
- [ ] Firebase Performance Monitoring 활성화
  ```typescript
  import perf from '@react-native-firebase/perf';
  
  perf().setPerformanceCollectionEnabled(true);
  ```
- [ ] 사용자 정의 지표 추적
  - [ ] 앱 시작 시간 (TTI)
  - [ ] 화면 전환 시간
  - [ ] API 요청 대기 시간
- [ ] 성능 알림 설정
  - [ ] TTI > 3초 경고
  - [ ] 화면 전환 > 500ms 경고

---

## 🔐 보안 점검 (Security Verification)

### 11. 배포 전 보안 체크리스트
- [ ] 코드 스캔 (OWASP Dependency-Check)
  ```bash
  npm audit --audit-level=high
  ```
- [ ] Expo Doctor 실행
  ```bash
  expo doctor
  ```
- [ ] 민감 정보 제거 확인
  - [ ] 하드코딩된 API 키 없는지 확인
  - [ ] 로그에 개인정보 없는지 확인
  - [ ] 콘솔에 디버깅 정보 없는지 확인
- [ ] Certificates & Provisioning 확인
  - [ ] iOS: 배포 인증서 유효기간 확인
  - [ ] Android: 키스토어 비밀번호 안전하게 저장

### 12. 데이터베이스 마이그레이션
- [ ] 데이터베이스 백업 (Firestore export)
  ```bash
  firebase firestore:delete --project ganengile-old
  ```
- [ ] 스키마 버전 관리
- [ ] 롤백 플랜 준비

---

## 🧪 사전 배포 테스트 (Pre-Deployment Testing)

### 13. 기능 테스트
- [ ] 단위 테스트 통과
  ```bash
  npm test -- --coverage
  ```
- [ ] 통합 테스트 통과
  ```bash
  npm test --tests/integration/
  ```
- [ ] E2E 테스트 통과
  ```bash
  detox test --configuration ios.sim.release
  detox test --configuration android.emu.release
  ```
- [ ] 테스트 커버리지 확인
  - [ ] Lines: >80%
  - [ ] Branches: >80%
  - [ ] Functions: >80%

### 14. 사용자 테스트 (UAT)
- [ ] Beta 테스터 그룹 초대 (5-10명)
- [ ] 주요 시나리오 테스트
  - [ ] 회원가입 → 로그인
  - [ ] 온보딩 → 동선 등록
  - [ ] 배송 요청 → 매칭 → 완료
- [ ] 결제 플로우 테스트
- [ ] 푸시 알림 테스트
- [ ] 오프라인 모드 테스트
- [ ] 배터리 소모 확인

---

## 🚢 배포 실행 (Deployment Execution)

### 15. 배포 단계
1. [ ] **백업 생성**
   ```bash
   firebase firestore:export --project ganengile-new > backup-$(date +%Y%m%d).json
   ```

2. [ ] **사전 빌드**
   ```bash
   npm run build:ios
   npm run build:android
   ```

3. [ ] **릴리즈 빌드**
   ```bash
   eas build --platform ios --profile production
   eas build --platform android --profile production
   ```

4. [ ] **사전 배포 테스트**
   - [ ] Internal TestTrackers 배포
   - [ ] 주요 버그 확인

5. [ ] **스테이징 배포 (Staged Rollout)**
   - [ ] 10% 배포 (1시간 후)
   - [ ] 50% 배포 (3시간 후)
   - [ ] 100% 배포 (6시간 후)

6. [ ] **모니터링 대시보드 확인**
   - [ ] 에러율: <1%
   - [ ] 크래시율: <0.1%
   - [ ] API 응답시간: <500ms
   - [ ] 배터리 소모: <5%/시간

---

## 🔄 롤백 계획 (Rollback Plan)

### 16. 롤백 시나리오
**롤백 조건:**
- 크래시율 > 5%
- API 오류율 > 10%
- 사용자 보고 치명적 버그

**롤백 절차:**
1. 즉시 롤백 실행
   ```bash
   # Firebase에서 이전 버전으로 롤백
   firebase deploy --only functions --project ganengile-old
   ```
2. Firebase Security Rules 이전 버전으로 복원
3. App Store/Play Store에 이전 버전 배포
4. 사용자에게 롤백 안내 (In-App Message)

**롤백 후 조치:**
- 원인 분석 (Sentry/Analytics)
- 핫픽스 배포 (Critical bug만)
- 정기 릴리즈 업데이트 예정 공지

---

## ✅ 배포 완료 체크리스트 (Post-Deployment)

### 17. 배포 후 확인 항목
- [ ] 앱스토어/플레이스토어 승인 확인
- [ ] 다운로드 가능 확인
- [ ] 푸시 알림 동작 확인
- [ ] 결제 기능 동작 확인
- [ ] 사용자 매트릭스 추적 시작
- [ ] 소셜 미디어 모니터링 시작
- [ ] 다음 배포 계획 수립

---

## 📝 배포 기록 (Deployment Log)

**배포 버전:** v1.0.0
**배포 일시:** 2026-02-13
**빌드 번호:** 1
**배포 담당자:** OpenClaw DevOps Assistant

**변경 사항:**
- [ ] 신규 기능:
  - P1: 디자인 시스템
  - P1: 온보딩 플로우
  - P1: 동선 등록
  - P1: 매칭 시스템
  - P1: 배송 플로우
  - P1: 커뮤니케이션 (채팅, 푸시)
- [ ] 버그 수정:
  - P4: 보안 취약점 수정
  - P4: 성능 최적화
- [ ] 개선 사항:
  - P4: 테스트 커버리지 80% 달성
  - P4: 모니터링 시스템 구축

**알려진 이슈:**
- 없음

---

## 👥 승인 및 검토 (Approval & Review)

### 최종 배포 승인
- [ ] 개발팀장 승인
- [ ] DevOps 엔지니어 승인
- [ ] QA 리더 승인
- [ ] 프로젝트 책임자 승인

### 배포 완료 시간
- 시작: 2026-02-13 10:00
- 완료: 예정
- 소요 시간: 3시간

---

**체크리스트 완료도:** 0/107 (0%)
