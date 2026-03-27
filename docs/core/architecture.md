# 전체 아키텍처

## 서비스 구성

가는길에는 하나의 사용자 앱 안에서 `요청자 모드`와 `길러 모드`를 전환하는 구조입니다. 관리자 기능은 별도의 Next.js 앱으로 분리되어 있으며, 데이터는 모두 Firebase를 중심으로 공유합니다.

- 앱: Expo + React Native Web
- 관리자 웹: Next.js App Router
- 백엔드: Firebase Auth, Firestore, Functions, Hosting, App Hosting

## 코드 기준 경로

- 네비게이션: `src/navigation/`
- 화면: `src/screens/`
- 비즈니스 로직: `src/services/`
- 타입 정의: `src/types/`
- 관리자 웹: `admin-web/app/`
- Cloud Functions: `functions/src/`

## 앱 구조

앱 진입 후의 화면 흐름은 아래 순서를 따릅니다.

1. 인증: `auth/*`
2. 온보딩: `onboarding/*`
3. 메인: `MainNavigator.tsx`
4. 메인 탭: `Home`, `Requests`, `GillerRequests`, `ChatList`, `RouteManagement`, `Profile`

핵심 스택 등록 파일:

- [MainNavigator.tsx](../../src/navigation/MainNavigator.tsx)
- [AppNavigator.tsx](../../src/navigation/AppNavigator.tsx)

## 관리자 구조

관리자 웹은 `admin-web/app/(admin)` 아래에서 운영 화면을 제공합니다.

- 대시보드
- 배송 관리
- 정산
- 보증금
- 사물함
- 분쟁
- 사용자
- 승급/인증

## 문서 소스 오브 트루스

- 사용자 흐름: `docs/flows/*`
- 서비스 로직: `docs/core/*`
- 운영/배포: `docs/ops/*`
- 데이터 적재/정합성: `docs/data/*`

새 기능을 추가할 때는 새 루트 문서를 만들지 말고, 위 분류 중 하나에 넣습니다.
