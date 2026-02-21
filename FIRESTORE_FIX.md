# 🔧 Firestore 권한 수정 완료

## 수정 내용

### 문제
- 웹앱에서 "Missing or insufficient permissions" 오류 발생
- Firestore Security Rules가 제대로 설정되지 않음

### 해결
1. ✅ Firestore Rules 완전 재작성
2. ✅ 모든 컬렉션 권한 명확화
3. ✅ 배포 완료

### 변경된 Rules

**Before:**
- `signInProvider != 'anonymous'` 체크 (지나치게 제한적)
- 하위 필드를 컬렉션으로 잘못 처리
- 충돌하는 규칙

**After:**
- `isAuthenticated()` 헬퍼 함수 사용
- 명확한 소유권 체크 (`isOwner(userId)`)
- 각 컬렉션별 정확한 권한 설정

---

## 🌐 웹앱 배포 상태

### 현재 상황
- ✅ Firestore Rules: 배포 완료
- ⚠️  웹 빌드: 필요

### 문제
- 이 프로젝트는 Expo 기반
- `npm run build` 스크립트 없음
- 웹 배포를 위한 추가 설정 필요

---

## 🚀 웹앱 빌드 방법

### 옵션 1: Expo Export (간단)

```bash
cd /Users/aaron/ganengile-new
npx expo export:web
```

생성된 `web-build/` 폴더를 Firebase Hosting에 배포:
```bash
firebase deploy --only hosting --project ganengile
```

### 옵션 2: EAS Build (권장)

```bash
cd /Users/aaron/ganengile-new
eas build --platform web
```

### 옵션 3: 현재 상태 유지

현재 Expo 개발 서버(`expo start --web`)를 사용하여 로컬에서 테스트 가능

---

## ✅ 확인 완료 항목

1. ✅ Firestore Rules 배포
2. ✅ 권한 문제 해결
3. ✅ Git 커밋 준비

---

## 📝 다음 단계

사용자 선택이 필요합니다:

**A.** 웹앱 빌드 및 재배포 (권장)
**B.** 현재 상태에서 테스트 (개발 서버)
**C.** 모바일 앞 먼저 배포

어떻게 진행할까요?
