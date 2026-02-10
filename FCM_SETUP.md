# FCM 설정 가이드

## VAPID Key 발급 방법

### 1. Firebase Console 접속
```
https://console.firebase.google.com/project/ganengile/project/settings/general
```

### 2. Cloud Messaging 설정 탭 이동
- 프로젝트 설정 (톱니바퀴 아이콘)
- "Cloud Messaging" 탭 클릭

### 3. 웹 푸시 인증서 생성
- "웹 구성" 섹션
- "웹 푸시 인증서" > "생성" 클릭

### 4. VAPID Key 복사
```
키 쌍: N/A
VAPID_KEY: BLaK4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

### 5. .env 파일에 추가
```bash
# .env
EXPO_PUBLIC_FIREBASE_VAPID_KEY=BLaK4xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

---

## Firebase Console 단계별 스크린샷 가이드

### Step 1: 프로젝트 선택
1. Firebase Console 접속
2. 프로젝트 "ganengile" 선택

### Step 2: 프로젝트 설정
1. 좌측 메뉴 > 톱니바퀴 아이콘 (설정)
2. "프로젝트 설정" 클릭

### Step 3: Cloud Messaging 탭
1. 상단 탭에서 "Cloud Messaging" 클릭
2. 스크롤 내려서 "웹 구성" 섹션 찾기

### Step 4: 웹 푸시 인증서 생성
1. "웹 푸시 인증서" 옆의 "생성" 버튼 클릭
2. 자동으로 VAPID Key 생성됨

### Step 5: 키 복사
1. "VAPID_KEY" 값 복사
2. .env 파일에 붙여넣기

---

## 주의사항

⚠️ **VAPID_KEY는 보안 정보입니다!**
- .gitignore에 .env 포함되어 있는지 확인
- 절대 GitHub에 커밋하지 마세요
- 팀원과 안전하게 공유하세요

---

## 검증 방법

### 1. .env 파일 확인
```bash
cat .env | grep VAPID
```

### 2. 앱에서 FCM 토큰 확인
```typescript
const token = await notificationService.getFCMToken();
console.log('FCM Token:', token);
```

### 3. Firebase Console에서 확인
```
Firestore > notificationSettings > [userId] > fcmToken
```
필드에 토큰이 저장되어 있으면 성공!

---

## 다음 단계

VAPID_KEY를 발급받은 후:
1. .env 파일에 추가
2. 앱 재시작
3. FCM 토큰이 자동으로 Firestore에 저장됨
