# 가는길에

서울 지하철 기반 크라우드 배송 서비스입니다. 사용자 앱, 길러 앱 모드, 관리자 웹이 하나의 Firebase 프로젝트 위에서 동작합니다.

현재 문서의 기준 진입점은 [docs/README.md](/Users/aaron/ganengile-new/docs/README.md)입니다. 기능 설명, 운영 문서, 데이터 문서, 관리자 문서는 모두 이 목차에서 찾아가도록 정리했습니다.

## 프로젝트 구성

- 앱/웹 공용 앱: Expo + React Native Web
- 관리자 웹: Next.js App Router
- 백엔드: Firebase Auth, Firestore, Functions, Hosting, App Hosting

## 빠른 실행

```bash
npm install
npm run web
```

관리자 웹은 아래에서 실행합니다.

```bash
cd admin-web
npm install
npm run dev
```

## 문서 원칙

- 루트에는 `README.md`만 둡니다.
- 운영 중 참고할 문서는 `docs/` 아래 기능별로 유지합니다.
- 오래된 보고서성 문서는 `docs/archive/legacy/`로 이동합니다.
- 기능 변경 시 코드와 함께 해당 문서도 같이 갱신합니다.
