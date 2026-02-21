# 🔧 웹빌드 문제 해결

## 문제 상황

**Expo SDK 54**에서 웹 빌드가 복잡합니다:
1. `npx expo export` 완료되었으나 `dist/` 폴더가 비어있음
2. Firebase Hosting에 0 files 배포됨
3. 웹앱 업데이트가 안 보이는 이유

---

## 해결 방법 3가지

### 1️⃣ **EAS Build** (권장)

**장점:**
- ✅ 프로덕션용 최적화
- ✅ Firebase Hosting 바로 배포
- ✅ Expo 관리형

**단점:**
- ⏱️ 빌드 10-15분
- EAS 계정 필요

```bash
eas build:configure
eas build --platform web --profile production
firebase deploy --only hosting
```

---

### 2️⃣ **로컬 개발 서버** (즉시 사용)

**장점:**
- ✅ 바로 실행 가능
- ✅ 최신 코드 반영
- ✅ Firestore Rules 적용됨

**단점:**
- ❌ 서버 항상 켜야 함

```bash
cd /Users/aaron/ganengile-new
expo start --web
# 웹브라우저에서 http://localhost:8081 접속
```

---

### 3️⃣ **기존 빌드 재배포** (임시)

**장점:**
- ✅ 즉시 배포

**단점:**
- ⚠️  최신 코드 아님 (2월 10일 버전)
- ⚠️  Firestore 수정사항 미포함

---

## 현재 상태

- ✅ Firestore Rules: **최신 버전** 배포됨
- ⚠️  웹앱: 빌드 필요
- 🔗 URL: https://ganengile.web.app (이전 버전)

---

## 추천

1. **당장 테스트**: 옵션 2 (개발 서버)
2. **프로덕션 배포**: 옵션 1 (EAS Build)

어떻게 진행할까요?

A. EAS Build (10-15분 소요)
B. 개발 서버 실행 (즉시)
C. 기존 버전 유지
