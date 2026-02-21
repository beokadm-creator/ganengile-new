# 웹 개발 서버 실행 오류 보고

## 문제 상황

### 시작한 명령어
```bash
npx expo start --web
```

### 발생한 오류들

**오류 1: Import 경로 오류**
```
Unable to resolve "../../styles"
```
- ✅ 해결함: `../../theme`으로 수정

**오류 2: AuthContext 누락**
```
Unable to resolve "../../contexts/AuthContext"
```
- ❌ 해결 필요: AuthContext 파일이 존재하지 않음

---

## 원인 분석

1. **Import 경로 불일치**
   - 여러 파일에서 잘못된 import 경로 사용
   - 프로젝트 구조 변경으로 인한 경로 오류

2. **파일 누락**
   - AuthContext.tsx 파일이 존재하지 않음
   - UserContext.tsx는 있지만 AuthContext 없음

---

## 현재 상태

- ❌ 웹 개발 서버 실행 실패
- ⚠️  여러 import 경로 오류
- ⏱️  수정에 시간이 더 소요됨

---

## 해결 방법

### Option 1: Import 경로 일괄 수정 (시간 소요)
- 모든 파일의 import 경로 확인
- 누락된 파일 생성 또는 경로 수정
- 예상 시간: 30분-1시간

### Option 2: 기존 웹 배포 유지
- https://ganengile.web.app (이전 버전)
- Firestore Rules만 최신 버전 적용됨
- 당장 테스트 가능

### Option 3: 모바일 앱으로 테스트
- iOS/Android 시뮬레이터 실행
- 웹보다 안정적

---

## 추천

**단기 테스트:** Option 2 또는 3
**장기 수정:** 나중에 import 경로 일괄 정리

어떻게 진행할까요?
