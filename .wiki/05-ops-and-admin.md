# 운영/관리자/배포 (Ops & Admin)

## 1) 관리자 웹(Admin Web)
관리자 웹은 운영자가 "민감 구간"을 통제하기 위한 기능을 제공한다.

### 주요 메뉴(코드 기준)
> 경로는 `admin-web/app/(admin)/...` 기준

- 대시보드/큐/경고: `dashboard`
- 배송/요청 운영: `deliveries`, `delayed-requests`
- 파트너/디스패치: `delivery-partners`, `partner-dispatches`
- 분쟁: `disputes`
- 보증금: `deposits`
- 정산: `settlements`, `accounting`
- 포인트/출금: `points/balances`, `points/withdrawals`
- 사용자/검증/동의/심사:
  - `users`
  - `verifications`
  - `consents`
  - `gillers/applications`
- 가격 정책/오버라이드/인사이트: `pricing/policy`, `pricing/overrides`, `pricing/insights`
- 락커 운영: `lockers`
- beta1 운영: `beta1`, `beta1/ai-review`
- 연동 설정:
  - `integrations/identity` (신원)
  - `integrations/bank` (은행/출금)
  - `integrations/payment` (결제)
  - `integrations/tax` (세금)
  - `integrations/ai` (AI)
  - `integrations/fare-cache` (운임 캐시)
  - `integrations/alimtalk` (알림톡)

### 실행
- 문서: [`../admin-web/README.md`](../admin-web/README.md)

## 2) 배포(요약)
운영/배포 작업은 아래 런북을 "항상" 기준으로 한다.

- 배포 전 점검: [`../docs/deployment-preflight.md`](../docs/deployment-preflight.md)
- CI/CD 가이드: [`../docs/ops/cicd-pipeline-guide.md`](../docs/ops/cicd-pipeline-guide.md)
- 환경변수 정리: [`../docs/ops/deployment-and-env.md`](../docs/ops/deployment-and-env.md)

## 3) 환경변수/시크릿(원칙)
- `.env.example`이 템플릿(소스 오브 트루스)이며, 앱에는 `EXPO_PUBLIC_*`만 넣는다.
- 지도/주소/요금 같이 시크릿이 필요한 연동은 Functions에서 프록시/서버 시크릿으로 처리한다.

참고:
- [`../.env.example`](../.env.example)
- [`../docs/ops/deployment-and-env.md`](../docs/ops/deployment-and-env.md)

## 4) 운영 포인트(현 상태에서 보이는 것)
- 대시보드에서 "대기열/지표"를 운영할 수 있는 구조가 존재한다(출금/분쟁/심사/배송 진행/AI 검토 등).
- beta1 관련 운영 지표/리뷰 페이지가 존재한다(`beta1/ai-review`).
- 지도/연동 실패는 env 누락이 원인인 경우가 많다 → preflight 체크리스트를 먼저 확인한다.

## 5) Firestore Rules 업데이트 (2026-04)
- gillerProfile role 체크 정렬 및 권한 정비 (`9ea5b83`)
- coupons/user_coupons 컬렉션 권한 추가 — 체크아웃 권한 에러 수정 (`d5c8eb7`)
- notification settings 허용 (`10e40ef`)
- allowed docs 쿼리로 권한 에러 수정 (`4247ac7`)
- requester 매치 생성 허용 (`4521390`)
- undefined values Firestore write 방어 (`1faccaf`, `kDScU8fT`)

## 6) 보증금/환불 수정
- Admin 웹 deposit 환불 처리 이슈 수정 (`34c7800`)
- 픽업 완료 후 취소 시 보증금 전액 공제 로직 강화 (`7f46ed8`)

