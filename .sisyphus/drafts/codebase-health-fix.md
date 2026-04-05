# Draft: Codebase Health Fix Plan

## Requirements (confirmed)
- 사용자가 제공한 코드 분석 보고서의 검증을 원함
- 서비스는 "클라우드 배송"을 목표
- 배송 담당자(길러)에게 "미션"을 부여하는 시스템
- AI 엔진이 매칭/분석을 수행하며, 이 부분이 잘 돌고 있는지 확인 필요
- 발견된 버그/보안/품질 이슈를 수정하는 작업 계획 필요

## Technical Decisions
- **상태 계약 흐름**: RequestDraft → AIAnalysis → PricingQuote → Request → Delivery → DeliveryLeg → HandoverEvent
- **AI 역할**: 입력 보조, 분류, 추천, 경고 (최종 확정은 사람/정책이 담당)
- **미션 시스템**: 길러에게 배송 미션을 할당, 파트너 연동은 공급 부족 시 보완
- **매칭 엔진**: 자체 길러 우선, 조건부 AI 추천

## User Answers (인터뷰 결과)
- **작업 범위**: 전체 이슈 수정 + AI/매칭 심층 검증
- **클라우드 배송**: 물리적 클라우드 배송 서비스 (실제 배송 서비스)
- **테스트**: Agent QA만 (Playwright/curl) — 단위테스트 없음
- **긴급도**: 개발/스테이징 단계 — 체계적 수정 가능

## Research Findings

### 1. AI 엔진 아키텍처 (bg_e4a1499e 완료)
**핵심 파일들:**
- `src/services/beta1-ai-service.ts` — AI 호출 래퍼 (analyzeRequestDraft, generatePricingQuotes, planMissionExecution)
- `functions/src/beta1-ai.ts` — Cloud Functions AI 엔드포인트
- `src/services/beta1-engine-service.ts` — AI 파이프라인 오케스트레이터
- `src/services/integration-config-service.ts` — AI 설정/캐싱
- `shared/matching-engine.ts` — 코어 매칭 알고리즘 (matchGillersToRequest)
- `src/services/matching-service.ts` — 매칭 오케스트레이션
- `src/services/matching/OneTimeMatchingService.ts` — 일회성 위치기반 매칭
- `src/services/matching/TransferMatchingService.ts` — 환승 매칭
- `src/services/beta1-orchestration-service.ts` — 미션/레그 생성 담당

**데이터 흐름:**
1. RequestDraft → AI 분석 (beta1-engine-service) → AIAnalysis + PricingQuote
2. 매칭 (matching-service → shared/matching-engine) → Match 문서
3. 길러 수락 → AI 미션 계획 (planMissionExecutionWithAI) → DeliveryLeg + Mission + MissionBundle

### 2. 버그 검증 결과 (bg_3b3f478b 완료)
**모든 12개 항목 CONFIRMED:**
- package-weight.ts `??` 버그: YES (line 10, 27)
- firestore.rules line 382: YES (requesterId 바인딩 누락)
- 빈 catch 블록: YES (beta1-orchestration-service.ts line 1044)
- "임시" 보안 규칙: YES (lines 96-97)
- 하드코딩 사업자번호: YES (tax-invoice-scheduler.ts line 101)
- 암호화 키 폴백: YES (secure-local-storage.ts lines 4-5)
- env vars 폴백 없음: YES (verification-service.ts lines 299-300)
- matching-auto-retry TODO: YES (line 135, 미구현)
- transfer-service 빈 gillerRouteId: YES (line 168)
- matching-service TODO (코드는 구현됨): YES (line 618-620)
- business-contract-service TODO: YES (line 160)

**중요: .exists 카운트 불일치:**
- 원본 보고서: 13개 파일 28건 (.exists 속성)
- 탐색 결과: 66개 파일 (.exists 속성) vs 36개 파일 (.exists() 메서드)
- 원본 보고서가 과소집계했을 가능성. 단, Firestore 스냅샷에 한정하면 다를 수 있음.

### 3. 보안/품질 감사 (bg_14784543 완료 + 직접 검증)

**`as any` 카운트 (직접 grep으로 확인):**
- 총 29건 / 10개 파일 (원본 보고서 정확)
- 테스트 파일 제외: 26건 / 9개 파일
- 탐색 에이전트 검색 실패 (패턴 이슈). 직접 grep으로 재확인 완료.

**빈 catch 블록:**
- 55개 catch 구문 중 명확히 빈 것은 beta1-orchestration-service.ts line 1044 (에러 없이 candidateGillerIds = [] 만 설정)
- 다른 catch들은 logging 또는 fallback 포함

**하드코딩 시크릿:**
- secure-local-storage.ts 폴백 키 1건만 실제 하드코딩
- 나머지는 env 기반 (정상)

**console.log/warn/error:**
- 52+건 (원본 "50+" 정확)
- 대부분 catch 블록 내 정당한 로깅
- matching-auto-retry.ts placeholder 1건

**Firestore 보안 규칙 심층:**
- 비인증 공개 읽기 5건 (config_stations, config_travel_times, config_express_trains, config_congestion, config_algorithm_params)
- 과도한 인증 읽기: /users/{userId} (임시 주석)
- 임시/TODO 주석: Auctions (line 550-551), Bids (line 566-567)
- requests create에 requesterId 바인딩 누락 (line 382)

**Dead code:**
- PASS_TEST_MODE: useGillerAccess.ts에서 사용 중 (원본 보고서 "미사용"은 부정확)
- __chat_connection_test__.ts: 프로덕션에 포함, tests/ 이동 필요

## Open Questions (모두 해결)
1. ✅ AI 엔진/매칭 구조 파악 완료
2. ✅ 클라우드 배송 = 물리적 배송 서비스
3. ✅ .exists 정확한 카운트 — 원본 13개 파일/28건, 탐색은 66개 파일 (범위 차이)
4. ✅ as any 29건 확인 (원본 정확)
5. ✅ PASS_TEST_MODE 실제 사용 중 (원본 "dead code" 부정확)

## Scope Boundaries
- INCLUDE: 분석 보고서의 모든 CRITICAL/HIGH/MEDIUM/LOW 이슈 수정
- INCLUDE: AI 엔진/매칭 엔진/미션 시스템 검증 및 수정
- INCLUDE: Firestore 보안 규칙 강화
- INCLUDE: .exists → .exists() 전체 통일
- INCLUDE: as any 타입 안전 캐스팅 교체
- INCLUDE: 보안 규칙 비인증/임시 항목 정리
- EXCLUDE: 신규 기능 추가, UI 변경
