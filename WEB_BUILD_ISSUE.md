# 웹빌드 문제 해결 보고

## 문제 상황

### 1. Expo Export 실패
```bash
npx expo export:web # Webpack only
npx expo export # Completed but dist/ is empty
```

### 2. 원인
- **Expo SDK 54** 사용 중
- 웹 빌드를 위해서는 **EAS Build** 필요
- 로컬 expo export는 지원되지만 별도 설정 필요

---

## 해결 방법

### 옵션 1: EAS Build (권장)

장점:
- ✅ 프로덕션용 최적화된 빌드
- ✅ Firebase Hosting에 바로 배포 가능
- ✅ Expo 관리형 빌드

단점:
- ⏱️ 빌드 시간 10-15분 소요
- 💰 EAS 무료 플랜 사용 (월 15회)

```bash
# 1. EAS Build 설정
eas build:configure

# 2. 웹 빌드
eas build --platform web --profile production

# 3. 배포
firebase deploy --only hosting
```

### 옵션 2: 로컬 개발 서버

장점:
- ✅ 즉시 실행 가능
- ✅ 실시간 반영
- ✅ 테스트용으로 적합

단점:
- ❌ 프로덕션용 아님
- ❌ 서버 항상 실행 필요

```bash
cd /Users/aaron/ganengile-new
expo start --web
```

### 옵션 3: 기존 dist-web 배포 (임시)

장점:
- ✅ 즉시 배포 가능
- ✅ 이전 빌드 활용

단점:
- ⚠️  최신 코드 아님 (2월 10일 버전)
- ⚠️  Firestore 수정사항 미포함

```bash
# firebase.json의 public 경로 수정
"public": "dist-web"

# 배포
firebase deploy --only hosting
```

---

## 현재 상태

- ✅ Firestore Rules: 최신 버전 배포됨
- ⚠️  웹앱: 빌드 필요
- 🔗 https://ganengile.web.app (이전 버전)

---

## 추천

**단기: 옵션 2 (개발 서버)**
- 당장 테스트하고 싶다면

**장기: 옵션 1 (EAS Build)**
- 프로덕션 배포를 원한다면

어떤 옵션을 선택하시겠습니까?
