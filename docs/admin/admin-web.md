# 관리자 웹

## 목적

관리자 웹은 운영 데이터 확인과 승인 처리에 집중합니다. 앱 화면을 대체하지 않고, 승인/모니터링/정산/사물함 관리의 운영 도구 역할을 합니다.

## 주요 페이지

- 대시보드: `admin-web/app/(admin)/dashboard/page.tsx`
- 배송: `admin-web/app/(admin)/deliveries/page.tsx`
- 정산: `admin-web/app/(admin)/settlements/page.tsx`
- 보증금: `admin-web/app/(admin)/deposits/page.tsx`
- 사물함: `admin-web/app/(admin)/lockers/page.tsx`
- 분쟁: `admin-web/app/(admin)/disputes/page.tsx`
- 사용자: `admin-web/app/(admin)/users/page.tsx`
- 인증/승급: `admin-web/app/(admin)/verifications/page.tsx`

## 관리 항목

- 길러 신청/승급 요청
- 정산 로그와 환급 로그
- `config_fares` 최신 갱신 시각 및 건수
- 사물함 목록 및 구분
- 사용자 상태와 역할

## API 경로

- 로그인: `admin-web/app/api/login/route.ts`
- 로그아웃: `admin-web/app/api/logout/route.ts`

## 재발 방지 규칙

- 앱에서 보이는 상태명과 관리자 상태명이 다르지 않아야 합니다.
- 승급 신청일, 인증 상태, 계좌 상태는 관리자에서 빠지지 않아야 합니다.
- 관리자 카드가 보여주는 지표는 Firestore 컬렉션 기준과 일치해야 합니다.
