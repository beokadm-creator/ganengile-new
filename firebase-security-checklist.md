# Firebase Security Checklist

## 📅 검토일자
2026-02-13

## 🔥 보안 점검 항목

### 1. Firestore Security Rules

#### ✅ 검증 완료 항목
- [ ] 컬렉션 수준 권한 확인
- [ ] 문서 수준 권한 확인
- [ ] 필드 수준 권한 확인
- [ ] 인증 상태 검증 (request.auth)
- [ ] 데이터 소유권 검증 (request.resource.data.userId === request.auth.uid)

#### 📝 컬렉션별 권한 정의

**Config Collections (읽기 전용)**
```
// P1: 읽기 허용, 쓰기 금지
match /config_stations {
  allow read: if request.auth != null;
  deny write: if true;
}

// P2: 읽기 허용, 쓰기 금지
match /config_travel_times {
  allow read: if request.auth != null;
  deny write: if true;
}

// P3: 읽기 허용, 쓰기 금지
match /config_express_trains {
  allow read: if request.auth != null;
  deny write: if true;
}

// P4: 읽기 허용, 쓰기 금지
match /config_congestion {
  allow read: if request.auth != null;
  deny write: if true;
}

// P5: 읽기 허용, 쓰기 금지
match /config_algorithm_params {
  allow read: if request.auth != null;
  deny write: if true;
}
```

**User Collections**
```
// U1: 사용자는 자신의 데이터만 읽기/쓰기 가능
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if request.auth.uid == userId;
}

// U2: 모든 인증된 사용자는 읽기 가능
match /users/{userId} {
  allow read: if request.auth != null;
}

// U3: 프로필 정보는 인증된 사용자에게만 공개
match /users/{userId}/profile {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId;
}

// U4: gillerInfo는 기일러만 수정 가능
match /users/{userId}/gillerInfo {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId && 
              request.resource.data.role == 'giller';
}

// U5: gllerInfo는 모두가 읽을 수 있지만, 기러는 제외
match /users/{userId}/gllerInfo {
  allow read: if request.auth != null && 
              (request.resource.data.role == 'giller' ||
               request.resource.data.role == 'admin');
}
```

**Route Collections**
```
// R1: 사용자는 자신의 동선만 관리
match /routes/{routeId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == resource.data.userId;
  allow delete: if request.auth.uid == resource.data.userId;
}

// R2: 활성 동선만 조회 가능
match /routes/{routeId} {
  allow read: if request.auth != null && 
              resource.data.isActive == true;
}
```

**Request Collections**
```
// Q1: 요청자는 자신의 요청만 관리
match /requests/{requestId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == resource.data.requesterId;
  allow delete: if request.auth.uid == resource.data.requesterId;
}

// Q2: 기일러는 매칭된 요청만 읽을 수 있음
match /requests/{requestId} {
  allow read: if request.auth != null && 
              resource.data.status == 'matched' && 
              (request.auth.uid == resource.data.requesterId ||
               request.auth.uid in resource.data.matchedGillers);
}
```

**Match Collections**
```
// M1: 매칭 정보는 관련 사용자만 접근
match /matches/{matchId} {
  allow read: if request.auth != null && 
              (request.auth.uid == resource.data.requesterId ||
               request.auth.uid == resource.data.gillerId);
  allow write: if request.auth.uid in [resource.data.requesterId, resource.data.gillerId];
  allow delete: if request.auth.uid == resource.data.requesterId;
}
```

**Delivery Collections**
```
// D1: 기일러는 자신의 배송만 관리
match /deliveries/{deliveryId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == resource.data.gillerId;
}

// D2: 요청자는 자신의 배송만 조회
match /deliveries/{deliveryId} {
  allow read: if request.auth != null && 
              request.auth.uid == resource.data.requesterId;
}
```

**Rating Collections**
```
// R1: 평점은 생성 후 수정 불가
match /ratings/{ratingId} {
  allow read: if request.auth != null && 
              (request.auth.uid == resource.data.fromUserId ||
               request.auth.uid == resource.data.toUserId);
  allow create: if request.auth != null;
  allow write: if false; // 평점은 수정 불가
}
```

---

### 2. 인증/인가 로직 검증

#### ✅ 구현 완료
- [x] Firebase Authentication (Email/Password)
- [x] 로그아웃 시 토큰 무효화
- [x] 인증 상태 리스너 (onAuthStateChanged)
- [x] 이메일 인증 (sendEmailVerification)
- [x] 비밀번호 재설정 (sendPasswordReset)
- [x] 신원 확인 (identity verification)

#### 🔍 점검 항목
- [ ] 이메일 인증 필수 적용 여부
- [ ] 비밀번호 최소 길이 (6자)
- [ ] 비밀번호 복잡도 요구 (영문+숫자+특수문자)
- [ ] 로그인 실패 시 계정 잠금 기능 (5회 실패 시 5분 잠금)
- [ ] 세션 타임아웃 설정 (자동 로그아웃)
- [ ] 신원 확인 완료 후 배송 기능 활성화

---

### 3. 민감 데이터 암호화

#### 🔐 암호화 필요 데이터
- [x] 사용자 이메일 (Firestore에 저장 시)
- [x] 사용자 전화번호
- [x] 결제 정보 (카드 번호, 계좌번호)
- [x] 신분증 정보 (이름, 생년월일, 번호)
- [x] 주소 정보
- [x] 채팅 메시지 (민감 내용)

#### 암호화 구현 예시
```typescript
import * as Crypto from 'expo-crypto';

// AES-256 암호화
export async function encryptSensitiveData(data: string, key: string): Promise<string> {
  const encoded = Crypto.CryptoJS.AES.encrypt(data, key).toString();
  return encoded;
}

export async function decryptSensitiveData(encryptedData: string, key: string): Promise<string> {
  const decoded = Crypto.CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
  return decoded;
}
```

#### 암호화 키 관리
- [ ] Firebase Functions 환경 변수 사용 (Encryption Key)
- [ ] 키 로테이션 서비스에 저장 금지
- [ ] 키 교체 주기 (권장: 90일)
- [ ] 키 버전 관리 (Key rotation)

---

### 4. API 키 보안

#### 🔑 API 키 관리 원칙
- [x] .env 파일 사용 (Git 제외)
- [x] Firebase 서비스 계정 키 비공개
- [x] Expo 토큰 관리 (app.json)
- [ ] API 키 클라이언트에 노출 금지
- [ ] 키 만료 및 자동 갱신

#### .env.example 제공
```bash
# Firebase
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket

# Expo
EXPO_PUBLIC_EXPO_CLIENT_ID=your_client_id
EXPO_PUBLIC_EXPO_CLIENT_SECRET=your_secret

# 공공데이터포털 (서울 열린데이터광장)
DATA_GOV_KR_SERVICE_KEY=your_service_key
```

---

### 5. SQL Injection 방지 (NoSQL 인젝션)

#### ⚠️ NoSQL 취약점 예시
```typescript
// ❌ VULNERABLE: 사용자 입력을 직접 쿼리에 전달
const unsafeQuery = query(
  collection(db, 'users'),
  where('name', '==', userInput) // SQL Injection 가능!
);

// ✅ SAFE: 파라미터화된 쿼리 사용
const safeQuery = query(
  collection(db, 'users'),
  where('name', '==', sanitizedInput) // 입력 검증 후 사용
);
```

#### 방어 전략
- [x] 입력 검증 (화이트리스트, 길이 제한)
- [x] 파라미터화된 쿼리 사용
- [ ] NoSQL 인젝션 방지 라이브러리 사용 (권장)
- [ ] Firestore 쿼리 빌더 사용

---

### 6. XSS (Cross-Site Scripting) 방지

#### 🛡️ XSS 취약점 예시
```typescript
// ❌ VULNERABLE: 사용자 입력을 직접 렌더링
<Text>{userInput}</Text> // 스크립트 실행 가능!

// ✅ SAFE: 이스케이프 처리
<Text>{escapeHtml(userInput)}</Text>

// 이스케이프 함수
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

#### 방어 전략
- [x] React Native Text 컴포넌트 자동 이스케이프
- [x] dangerouslySetInnerHTML 사용 금지
- [x] 사용자 입력 검증 (특수문자 필터링)
- [ ] URL 링크 검증 (허용된 도메인만)

---

### 7. 보안 취약점 스캔

#### 🔍 도구
- [ ] Firebase Security Rules Analyzer
- [ ] Expo Doctor 사용
- [ ] npm audit 실행
- [ ] Snyk 사용 (권장)
- [ ] OWASP Dependency-Check

#### 스캔 주기
- [ ] 개발 초기: 전체 스캔
- [ ] 배포 전: 보안 점검
- [ ] 정기: 월 1회
- [ ] 취약점 발견 시: 즉시 수정

---

## 📋 최종 체크리스트

### 배포 전 필수 항목
- [ ] 모든 보안 규칙 구현 완료
- [ ] 취약점 스캔 완료 (Critical 이상 없음)
- [ ] 민감 데이터 암호화 적용
- [ ] API 키 환경 변수로 분리
- [ ] Firestore Rules 배포 완료
- [ ] 보안 테스트 통과 (단위/통합/E2E)

---

## 🎯 우선순위

### P0 - Critical (즉시 조치)
- [ ] 인증 우회 취약점
- [ ] 데이터 누출 취약점
- [ ] 권한 상승 취약점

### P1 - High (24시간 내 조치)
- [ ] SQL Injection 취약점
- [ ] XSS 취약점
- [ ] 민감 데이터 평문 저장

### P2 - Medium (1주 내 조치)
- [ ] 보안 헤더 미흐름
- [ ] 로깅 및 감시 부족
- [ ] 세션 관리 개선

---

## 📞 보안 사고 대응 절차

### 1. 사고 발견 (0-24시간)
- 즉시 서비스 중지
- 영향 범위 파악
- 긴급 보고: 사용자, 관리자, 규제기관

### 2. 사고 조사 (24-48시간)
- 원인 규명
- 일시적 조치 완료
- 상세 분석 보고서

### 3. 영구적 조치 (7일 이내)
- 근본적 해결
- 프로세스 개선
- 재발 방지 대책 수립

### 4. 사후 관리 (이후 지속)
- 정기 보안 점검
- 직원 교육
- 보안 업데이트 반영

---

## 📚 참고 자료

### Firebase 공식 문서
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [Authentication Best Practices](https://firebase.google.com/docs/auth/best-practices)
- [Security Rules Testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

### React Native 보안
- [Security Best Practices](https://reactnative.dev/docs/security)
- [Expo Security](https://docs.expo.dev/versions/latest/guides/security/)

### OWASP Top 10
- [OWASP Top 10 Web Application Security Risks](https://owasp.org/www-project-top-ten)
