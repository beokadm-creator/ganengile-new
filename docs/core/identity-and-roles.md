# 역할, 인증, 승급

## 역할 모델

현재 서비스는 아래 역할을 기준으로 동작합니다.

- `gller`: 배송 요청자
- `giller`: 배송 수행자
- `both`: 두 역할 모두 사용 가능

역할 상태는 사용자 문서와 컨텍스트에서 함께 관리합니다.

주요 코드 경로:

- `/Users/aaron/ganengile-new/src/contexts/UserContext.tsx`
- `/Users/aaron/ganengile-new/src/screens/onboarding/RoleSelectionScreen.tsx`
- `/Users/aaron/ganengile-new/src/screens/main/ProfileScreen.tsx`

## 길러 신청 흐름

길러 기능은 승인 없이 바로 열리지 않습니다. 사용자는 먼저 길러 신청을 진행하고, 인증과 정산 계좌 입력을 마쳐야 합니다.

주요 화면:

- `/Users/aaron/ganengile-new/src/screens/main/GillerApplyScreen.tsx`
- `/Users/aaron/ganengile-new/src/screens/main/IdentityVerificationScreen.tsx`
- `/Users/aaron/ganengile-new/src/screens/onboarding/GillerApplicationOnboarding.tsx`

## 인증 정책

현재 기준 문서 정책은 다음과 같습니다.

- 신분증 이미지 업로드를 기본 수단으로 두지 않습니다.
- PASS / 카카오 본인인증 기반 구조를 우선합니다.
- 테스트 모드 여부는 기능 플래그로 제어합니다.

관련 경로:

- `/Users/aaron/ganengile-new/src/config/feature-flags.ts`
- `/Users/aaron/ganengile-new/src/screens/main/IdentityVerificationScreen.tsx`

## 관리자 반영

길러 신청과 인증 상태는 관리자 웹 `verifications` 영역에서 확인하고 처리합니다.

관련 경로:

- `/Users/aaron/ganengile-new/admin-web/app/(admin)/verifications/page.tsx`
- `/Users/aaron/ganengile-new/admin-web/app/api/admin/gillers`

## 재발 방지 규칙

- 길러 승인 상태 문구는 사용자 앱과 관리자 웹에서 동일하게 사용합니다.
- 인증 완료 사용자는 같은 단계에서 다시 인증 버튼이 뜨지 않도록 유지합니다.
- 길러 승인 후에는 프로필의 계좌정보와 역할 상태가 즉시 일치해야 합니다.
