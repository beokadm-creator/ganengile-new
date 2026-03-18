# 관리자 웹

가는길에 관리자 웹은 Next.js App Router 기반 운영 도구입니다. 인증, 배송 모니터링, 정산, 사물함, 승급/인증 승인 화면을 제공합니다.

## 실행

```bash
npm install
npm run dev
```

기본 개발 주소는 `http://localhost:3000` 입니다.

## 주요 경로

- 대시보드: `/Users/aaron/ganengile-new/admin-web/app/(admin)/dashboard/page.tsx`
- 배송: `/Users/aaron/ganengile-new/admin-web/app/(admin)/deliveries/page.tsx`
- 정산: `/Users/aaron/ganengile-new/admin-web/app/(admin)/settlements/page.tsx`
- 사물함: `/Users/aaron/ganengile-new/admin-web/app/(admin)/lockers/page.tsx`
- 승급/인증: `/Users/aaron/ganengile-new/admin-web/app/(admin)/verifications/page.tsx`

전체 설명은 [docs/admin/admin-web.md](/Users/aaron/ganengile-new/docs/admin/admin-web.md)를 봅니다.
