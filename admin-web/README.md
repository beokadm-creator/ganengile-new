# 관리자 웹

`admin-web`은 가는길에의 운영 관제 화면입니다. 인증, 길러 승급 심사, 분쟁, 보증금, 정산, AI 설정과 beta1 운영 상태를 관리합니다.

## 실행

```bash
npm install
npm run dev
```

기본 개발 주소는 `http://localhost:3000`입니다.

## 주요 화면

- 대시보드: `admin-web/app/(admin)/dashboard/page.tsx`
- 분쟁: `admin-web/app/(admin)/disputes/page.tsx`
- 보증금: `admin-web/app/(admin)/deposits/page.tsx`
- 정산: `admin-web/app/(admin)/settlements/page.tsx`
- 길러 승급 심사: `admin-web/app/(admin)/gillers/applications/page.tsx`
- AI 관제: `admin-web/app/(admin)/beta1/ai-review/page.tsx`
- 연동 설정: `admin-web/app/(admin)/integrations/`

## 지도

운영 화면은 최근 요청 구간, 분쟁 구간, 보증금/정산 연결 요청을 Naver 정적지도 프리뷰로 확인합니다. Functions의 `naverStaticMapProxy`가 배포되어 있어야 이미지가 정상적으로 표시됩니다.

## 배포 전 확인

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION`
- 관리자 앱 호스팅 설정
- Functions 배포 상태
- 지도 프록시 응답 상태

배포 전 전체 순서는 [C:\Users\whhol\Documents\trae_projects\ganengile\docs\deployment-preflight.md](C:\Users\whhol\Documents\trae_projects\ganengile\docs\deployment-preflight.md)를 따릅니다.
