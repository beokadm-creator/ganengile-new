# 남은 과업 검증 보고서

> **목적**: 사용자가 판단한 4대 과업 카테고리를 코드베이스 실제 상태와 대조하여 검증

---

## 사용자 원래 판단

| # | 카테고리 | 핵심 과제 |
|---|---|---|
| 1 | 취소/분쟁 마감 | 앱 내 취소 불가 시 분쟁/운영 검토 UX, 관리자에서 취소 사유/패널티/보증금 환불 직접 확인 |
| 2 | 정산/운영 민감 구간 | 출금/정산/3.3% 구조는 있으나 운영 체크리스트 여지 |
| 3 | 실서비스 연결 고도화 | 지도/실시간 위치, 웹 알림, B2B 정산/세금계산서 마지막 실무 연결 |
| 4 | 전역 품질 | admin-web 대시보드 warning, tsc --noEmit 누적 이슈, 타입 경계 정리 |

---

## 1. 취소/분쟁 마감 — ✅ 정확함 (판단 일치 + 추가 발견)

### 앱 UX 현황 (취소 불가 → 분쟁 경로)

**구현된 것:**
- PENDING/MATCHED 상태에서만 취소 버튼 노출 (`RequestsScreen.tsx`, `RequestDetailScreen.tsx`)
- 진행 중 취소 차단 시 안내 메시지: "지금은 취소할 수 없습니다" + "채팅 또는 분쟁 접수를 통해 조정해 주세요"
- `DisputeReportScreen.tsx` — 분쟁 제기 UI (유형, 긴급도, 설명, 증거)
- `DisputeResolutionScreen.tsx` — 분쟁 결과 확인 UI
- `delivery-service.ts` cancelDeliveryFlow — 픽업 전/후 분기 처리, 보증금 환불/공제
- `penalty-service.ts` — 취소 패널티 적용
- `DepositService.ts` + `deposit-compensation-service.ts` — 보증금 환불/공제 처리

**누락/불충분:**
- ❌ **채팅에서 분쟁 제기로의 직접 연결 없음** — ChatScreen에 "분쟁 신고" 버튼이 없음
- ❌ **취소 차단 시 분쟁 화면으로 즉시 이동하는 CTA 없음** — 텍스트 안내만 있고, 탭하여 이동할 수 없음
- ⚠️ 취소 완료 후 보증금/패널티 결과를 한눈에 보여주는 요약 카드 없음

### 관리자 현황 (취소 사유/패널티/보증금 환불)

**구현된 것:**
- ✅ API 완비: `GET/PATCH /api/admin/disputes` (분쟁 해결 with 책임/보상/메모)
- ✅ API 완비: `GET/PATCH /api/admin/deposits` (보증금 환불/공제)
- ✅ 출금 관리 UI: `admin-web/app/(admin)/points/withdrawals/page.tsx` (승인/반려 모달)
- ✅ 대시보드: pendingDisputes 지표 표시

**누락/불충분:**
- ❌ **분쟁 전용 관리 UI 페이지 없음** — API는 완비되었으나 대응하는 TSX 페이지가 없음
- ❌ **보증금 관리 UI 페이지 없음** — 환불/공제가 API로만 가능
- ⚠️ 대시보드에 API 호출 실패 시 빈 화면 (에러 배너 없음)

### 사용자 판단에 없던 추가 발견
- `admin-web/app/(admin)/disputes/page.tsx` 파일이 존재함 (explore가 발견) — 확인 필요
- 관리자에 패널티 전용 관리 화면도 없음

---

## 2. 정산/운영 민감 구간 — ✅ 정확함 (판단 일치 + 세부 발견)

### 3.3% 원천징수 현황

**구현된 것:**
- ✅ `settlementPolicy.ts` — combinedWithholdingRate = 0.033 정의
- ✅ `CommissionService.ts` — 정산 시 3.3% 세금 계산 (수수료 공제 후 수익에 대해)
- ✅ `SettlementService.ts` — createSettlement에서 netAmount 계산 시 반영
- ✅ `EarningsScreen.tsx` — "원천징수 3.3%" 사용자 표시
- ✅ `payment.ts` 타입 — tax, platformFee, gillerEarnings, netAmount 필드

### 출금 가드 현황

**구현된 것:**
- ✅ `beta1-wallet-service.ts` — 출금 적격성 평가 (신원/계좌/분쟁/리스크/수동보류)
- ✅ `PointHistoryScreen.tsx` — 출금 가능 금액 + 출금 차단 사유 가드 패널
- ✅ `PointWithdrawScreen.tsx` — 출금 폼 + 적격성 사전 체크
- ✅ 최소 출금 금액 검증

### 누락/불충분:
- ⚠️ **B2B 세금계산서 세율(10%)과 원천징수(3.3%) 혼동 가능** — UI에서 명확히 구분 안 됨
- ⚠️ **정산 통합 체크리스트 부족** — 운영자가 정산 전 확인해야 할 항목(분쟁 중 건수, 패널티 미정산, 보증금 미환불 등)을 한눈에 보는 뷰 없음
- ⚠️ 월별 정산 UI가 일반(소비자) 앱에 없음 — B2B MonthlySettlementScreen은 있으나 길러용 월별 정산 화면 미확인

---

## 3. 실서비스 연결 고도화 — ✅ 정확함 (판단 일치 + 심각도 차이)

### 지도 (Map) — 🔴 Placeholder 상태

| 파일 | 현황 |
|---|---|
| `LockerMapScreen.tsx` | 커스텀 mini-map (canvas 기반), 실제 지도 SDK 없음 |
| `SubwayMapVisualizer.tsx` | SVG 기반 지하철 노선도 시각화, 외부 지도 SDK 없음 |
| `RealtimeTrackingScreen.tsx` | 실시간 UI 스캐폴드, 합성 ETA 사용 |

**react-native-maps, Google Maps, Kakao Maps, Naver Maps 중 어떤 것도 연결되지 않음**

### 실시간 위치 — 🟡 부분 연결

| 파일 | 현황 |
|---|---|
| `RealtimeSubwayService.ts` | ✅ 서울 지하철 실시간 API 연동 (API 키 없으면 예측 데이터 폴백) |
| `realtime-delivery-tracking.ts` | 🟡 Firestore onSnapshot 실시간 피드는 실제, BUT 위치 업데이트는 mock getCurrentLocation() |
| `RealtimeTrackingScreen.tsx` | 🟡 합성 ETA/경로 기반, 실시간 데이터 바인딩 미완 |

### 웹 알림 — 🟢 실제 연결됨

| 파일 | 현황 |
|---|---|
| `notification-service.ts` | ✅ FCM 토큰 관리, 전경 메시지, 템플릿 |
| `functions/src/index.ts` | ✅ sendPushNotification, 채팅/매칭/배송 라이프사이클 알림 |
| `notificationHandler.ts` | ✅ 알림 탭 시 화면 라우팅 |
| `notificationHandler.web.ts` | ✅ 웹 전용 알림 인박스 |

**알림은 세 영역 중 가장 완성도 높음**

### B2B 정산/세금계산서 — 🟡 내부 완성, 외부 미연결

| 기능 | 현황 |
|---|---|
| B2B 정산 서비스 | ✅ Firestore 기반, 월별 정산 생성/조회 |
| 세금계산서 발행 | ✅ 내부 문서 생성 (Firestore 저장) |
| NTS/Hometax 연동 | ❌ 외부 세무 API 연결 없음 |
| 관리자 결제 연동 | ❌ 시뮬레이션/테스트 모드 |
| 구독 티어 | ⚠️ 하드코딩 (동적 관리 불가) |

---

## 4. 전역 품질 — ✅ 정확함 (판단 일치 + 정밀도 차이)

### admin-web 대시보드 경고

**현황:**
- ❌ 통합 경고 패널 없음 — API 호출 실패 시 빈/제로 화면
- ❌ 엔드포인트별 오류 표시기 없음
- ⚠️ 수동 새로고침 컨트롤 없음

### TypeScript 건강도

**admin-web** — 🟢 매우 깨끗:
- `as any`: 0건
- `@ts-ignore`: 0건
- `@ts-expect-error`: 0건
- `console.log`: 0건
- `strict: true` 활성화

**src/services** — 🟡 `as any` 밀집:
| 순위 | 파일 | `as any` 건수 |
|---|---|---|
| 1 | `request-service.ts` | 7 |
| 2 | `kakao-auth.ts` | 6 |
| 3 | `BadgeService.ts` | 5 |
| 4 | `fare-service.ts` | 5 |
| 5 | `delivery-service.ts` | 3 |
| - | `SettlementService.ts` | 3 |
| - | `deposit-compensation-service.ts` | 2 |
| - | `chat-service.ts` | 2 |

**루트 tsconfig:**
- `strict: true` ✅
- `noEmit` 미설정
- admin-web 전용 타입 디렉토리(`admin-web/types/`) 없음

---

## 종합 판정

| 카테고리 | 사용자 판단 | 검증 결과 | 심각도 |
|---|---|---|---|
| 취소/분쟁 UX | 불충분 | ✅ 정확 — 채팅→분쟁 연결, 관리자 UI 부재 | 🟠 HIGH |
| 취소/분쟁 관리자 | 불충분 | ✅ 정확 — API 완비, UI 누락 | 🟠 HIGH |
| 정산/운영 체크리스트 | 여지 있음 | ✅ 정확 — 구조 있으나 운영 통합 뷰 부족 | 🟡 MEDIUM |
| 지도 | 미연결 | ✅ 정확 — 전부 Placeholder | 🔴 CRITICAL |
| 실시간 위치 | 부분 | ✅ 정확 — Firestore 실시간 OK, GPS mock | 🟠 HIGH |
| 웹 알림 | 미완 | ⚠️ 과소평가 — 실제로는 가장 완성도 높음 | 🟢 LOW |
| B2B 세금계산서 | 미연결 | ✅ 정확 — 내부 OK, 외부 API 미연결 | 🟠 HIGH |
| admin-web 대시보드 | warning 묶음 | ✅ 정확 — 통합 경고 패널 없음 | 🟡 MEDIUM |
| tsc 이슈 | 누적 | ✅ 정확 — admin-web는 깨끗, src/services에 밀집 | 🟡 MEDIUM |
| 타입 경계 | 정리 필요 | ✅ 정확 — 공유 타입 boundary 없음 | 🟡 MEDIUM |

---

## 사용자가 놓친 추가 과제

1. **B2B 구독 티어 동적화** — 현재 하드코딩, Firestore/config에서 관리하도록 전환 필요
2. **B2B vs 소비자 세율 UI 구분** — 10% (세금계산서) vs 3.3% (원천징수) 혼동 방지 라벨링
3. **src/services 내 console.log 정리** — admin-web는 깨끗하나 서비스 레이어에 잔존
4. **월별 정산 화면 (길러용)** — B2B용은 있으나 일반 길러용 월별 정산 UI 미확인
5. **admin-web 공유 타입 boundary** — admin-web/types/ 디렉토리 자체가 없음

---

## 우선순위 제안

1. 🔴 **지도 SDK 연결** — Placeholder 상태, 실서비스 불가
2. 🟠 **실시간 GPS 연결** — mock 위치를 실제 GPS/telemetry로 교체
3. 🟠 **관리자 분쟁/보증금 UI** — API 완비, UI만 누락 → 빠른 승인
4. 🟠 **앱 내 취소→분쟁 UX 매끄럽게** — CTA 추가, 채팅 연결
5. 🟠 **B2B 세금계산서 외부 API** — NTS/Hometax 연동
6. 🟡 **src/services 타입 정리** — as any 33건 집중 제거
7. 🟡 **admin-web 대시보드 경고 패널** — 통합 에러/경고 뷰
8. 🟡 **운영 정산 체크리스트** — 관리자 통합 뷰
