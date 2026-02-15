# Google 로그인 설정 가이드

이 가이드는 "가는길에" 앱에 Google 로그인 기능을 설정하는 방법을 안내합니다.

## 1. Google Cloud Console 프로젝트 설정

### 1.1 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단에서 프로젝트 선택 또는 새 프로젝트 생성
3. 프로젝트 이름: `ganengile` (또는 원하는 이름)
4. 만들기 클릭

### 1.2 OAuth 동의 화면 구성

1. **왼쪽 메뉴** → **API 및 서비스** → **OAuth 동의 화면**
2. **사용자 유형 선택**:
   - 개발 중: **외부(External)**
   - 프로덕션: **내부(Internal)** (Google Workspace만 해당)
3. **필수 정보 입력**:
   - 앱 이름: `가는길에`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
4. **범위(Scopes) 추가**:
   - `../auth/userinfo.email`
   - `../auth/userinfo.profile`
   - `openid`
5. **테스트 사용자 추가** (개발 중):
   - 본인 Gmail 주소 추가
6. **요약 확인** → **동의 화면 저장**

### 1.3 OAuth 2.0 자격 증명 생성

1. **왼쪽 메뉴** → **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. **애플리케이션 유형 선택**:
   - **웹 애플리케이션** (Web)
   - **iOS** (Expo iOS)
   - **Android** (Expo Android)
4. **웹 클라이언트 ID 생성**:
   - 이름: `가는길에 Web Client`
   - 승인된 리디렉션 URI:
     ```
     http://localhost:8081
     http://localhost:19006
     https://*.expo.dev
     https://*.web.app
     ```
   - **만들기** 클릭
5. **iOS 클라이언트 ID 생성**:
   - 이름: `가는길에 iOS Client`
   - 번들 ID: `com.metius.ganengile` (Expo 앱 번들 ID)
   - **만들기** 클릭
6. **Android 클라이언트 ID 생성**:
   - 이름: `가는길에 Android Client`
   - 패키지 이름: `com.metius.ganengile`
   - SHA-1 인증서 지문:
     ```bash
     # Expo 개발 빌드용 (선택 사항)
     keytool -keystore ~/.android/debug.keystore -list -v
     ```
   - **만들기** 클릭

### 1.4 Client ID 및 Secret 복사

1. 생성된 OAuth 2.0 클라이언트 ID 목록에서 **웹 클라이언트** 선택
2. **클라이언트 ID** 복사 → `.env` 파일의 `EXPO_PUBLIC_GOOGLE_CLIENT_ID`에 붙여넣기
3. **클라이언트 보안 비밀번호** 복사 → `.env` 파일의 `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET`에 붙여넣기

## 2. Firebase Auth 설정

### 2.1 Google 로그인 활성화

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트: `ganengile` 선택
3. **왼쪽 메뉴** → **Authentication** → **Sign-in method**
4. **Google** 클릭 → **사용 설정**
5. **공개 이름**: `가는길에`
6. **지원 이메일**: 본인 이메일
7. **OAuth 동의 화면 도메인**:
   - `localhost`
   - `*.expo.dev`
   - `*.web.app`
8. **저장** 클릭

### 2.2 승인된 도메인 확인

Firebase Console → Authentication → Sign-in method → Google → **승인된 도메인**에 다음이 포함되어 있는지 확인:
- `localhost`
- `*.expo.dev`
- 프로덕션 도메인 (예: `ganengile.web.app`)

## 3. 프로젝트 설정

### 3.1 환경 변수 설정

`.env` 파일에 다음을 추가:

```env
# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID=123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
```

### 3.2 앱 재시작

```bash
# 개발 서버 재시작
npm start

# 캐시 클리어
expo start -c
```

## 4. 테스트

### 4.1 Web 환경 테스트

```bash
npm run web
```

1. 로그인 화면 → **Google로 계속하기** 클릭
2. Google 로그인 페이지 → 계정 선택
3. 권한 승인 → 로그인 완료 확인

### 4.2 iOS 시뮬레이터 테스트

```bash
npm run ios
```

1. **Google로 계속하기** 클릭
2. Safari 또는 Chrome으로 리디렉션
3. Google 로그인 → 앱으로 자동 복귀

### 4.3 Android 에뮬레이터 테스트

```bash
npm run android
```

1. **Google로 계속하기** 클릭
2. Google 로그인 → 앱으로 자동 복귀

## 5. 문제 해결

### 5.1 "에러 400: redirect_uri_mismatch"

**원인:** 리디렉션 URI가 OAuth 클라이언트에 등록되지 않음

**해결:**
1. Google Cloud Console → OAuth 클라이언트 ID → **승인된 리디렉션 URI** 확인
2. Expo 개발 서버 URI 추가:
   ```
   http://localhost:8081
   http://localhost:19006
   https://*.expo.dev
   ```

### 5.2 "Firebase: Error (auth/api-key-not-allowed)"

**원인:** Firebase API 키가 제한됨

**해결:**
1. Firebase Console → 프로젝트 설정 → 일반 → **API 키**
2. **앱 제한 사항** → **없음** 또는 **IP 주소** 선택
3. **API 제한 사항** → **키 제한 없음** 선택

### 5.3 카메라 권한 오류 (QR 코드 스캔)

**해결:**
- iOS: `ios/Info.plist`에 `NSCameraUsageDescription` 추가
- Android: `android/app/src/main/AndroidManifest.xml`에 `CAMERA` 권한 추가

## 6. 프로덕션 배포

### 6.1 프로덕션용 OAuth 클라이언트

1. Google Cloud Console → **새 OAuth 클라이언트 생성**
2. **승인된 리디렉션 URI**에 프로덕션 도메인 추가:
   ```
   https://ganengile.web.app
   https://your-production-domain.com
   ```

### 6.2 앱 번들 ID / 패키지 이름

- iOS: **App Store Connect**에서 생성한 번들 ID 사용
- Android: **Google Play Console**에서 생성한 패키지 이름 사용

## 7. 참고 자료

- [Expo AuthSession 문서](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Firebase Google 로그인 문서](https://firebase.google.com/docs/auth/web/google-signin)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Firebase Console](https://console.firebase.google.com/)

---

## ✅ 체크리스트

- [ ] Google Cloud Console 프로젝트 생성
- [ ] OAuth 동의 화면 구성
- [ ] OAuth 클라이언트 ID 생성 (Web, iOS, Android)
- [ ] Firebase Auth Google 로그인 활성화
- [ ] `.env` 파일에 Client ID 및 Secret 추가
- [ ] Web 환경 테스트 완료
- [ ] iOS 시뮬레이터 테스트 완료
- [ ] Android 에뮬레이터 테스트 완료
- [ ] 프로덕션 도메인 OAuth 클라이언트 생성 (선택)

---

작성일: 2026-02-15
마지막 수정: 2026-02-15
