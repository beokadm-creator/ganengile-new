# Plan 2: 웹 어드민 개선 로드맵

## TL;DR

> **Quick Summary**: 1-2개월 동안 B2C 집중으로 누락된 12개 카테고리의 어드민 기능을 체계적으로 구현합니다. TDD 방식으로 개발하며, 요청/매칭/채팅/알림/배지/경로/정산/시스템/보고서 기능을 우선순위에 따라 구현합니다.
>
> **Deliverables**:
> - 요청 관리 페이지 + API
> - 매칭 관리 페이지 + API
> - 채팅 관리 페이지 + API
> - 알림 관리 페이지 + API
> - 배지 관리 페이지 + API
> - 경로 관리 페이지 + API
> - 정산 관리 페이지 + API
> - 시스템 관리 페이지 + API
> - 보고서/분석 대시보드
> - B2B 관리 페이지 + API (낮은 우선순위)
> - 경매 관리 페이지 + API (낮은 우선순위)
> - 락커 관리 페이지 + API (낮은 우선순위)
>
> **Estimated Effort**: Large (1-2 months)
> **Parallel Execution**: YES - 6 waves
> **Critical Path**: Foundation → Core Features → Analytics → B2B/Auction/Locker

---

## Context

### Original Request
사용자가 웹 어드민의 단절된 기능과 부족한 영역을 분석하고, 개선 계획과 특정 기능 구현을 포함한 우선순위 선정 요청

### Interview Summary
**Key Discussions**:
- 현재 구현: 8개 어드민 페이지 (Dashboard, Users, Deliveries, Disputes, Gillers/Applications, Points/Balances, Points/Withdrawals, Deposits)
- 누락된 기능: 12개 카테고리 (Requests, Matches, Chats, Notifications, Badges, B2B, Routes, Auctions, Lockers, Settlements, System, Reports)
- 개발 기간: 1-2개월
- 비즈니스 집중: B2C (길러/이용자 서비스 품질)
- 테스트 전략: TDD

**Research Findings**:
- 현재 Deliveries 페이지는 조회만 가능하고 요청 관리가 없음
- 매칭/채팅/알림 기능이 완전히 누락됨
- 배지 시스템은 앱에 있지만 어드민 관리가 없음
- B2B, 경매, 락커는 낮은 우선순위

### Metis Review
Metis 응답 타임아웃으로 진행 없음. 제 분석으로 진행

---

## Work Objectives

### Core Objective
1-2개월 기간 동안 B2C 집중으로 누락된 어드민 기능을 체계적으로 구현, 운영 효율성을 높이고 서비스 품질을 개선

### Concrete Deliverables
- **Phase 1 (Week 1-2)**: 핵심 기반 (요청, 매칭)
- **Phase 2 (Week 3-5)**: 커뮤니케이션/시스템 (채팅, 알림, 시스템)
- **Phase 3 (Week 6-7)**: 성과/보상 (배지, 정산, 경로)
- **Phase 4 (Week 8)**: 분석/확장 (보고서, B2B, 경매, 락커)

### Definition of Done
- [ ] 각 페이지: UI + API 완성 + 테스트 통과
- [ ] 각 기능: CRUD 동작 확인
- [ ] 대시보드: 실시간 데이터 반영
- [ ] 권한: 어드민 인증 적용
- [ ] 문서: README/사용 가이드

### Must Have
- B2C 관련 기능 100% 구현
- TDD 방식 준수
- 일관된 UI/UX 패턴 적용
- 실시간 데이터 연동 (Firestore)

### Must NOT Have (Guardrails)
- AI slop: 과도한 주석, 의미 없는 추상화, 제네릭 네이밍 (data/result/item/temp)
- 불필요한 기능: 요구되지 않은 기능 추가 금지
- 하드코딩: 환경설정/플래그 외 하드코딩 금지
- 취약점: 인증/인가 우회 금지

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Next.js test infrastructure)
- **Automated tests**: TDD - 각 기능에 대한 테스트 먼저 작성
- **Framework**: Bun test (기존 패키지 확인 필요), 추가 필요 시 Vitest

### QA Policy
Every task MUST include agent-executed QA scenarios:
- **Pages**: Playwright - Navigate, CRUD, assert DOM, screenshots
- **API**: Bash (curl) - REST operations, assert response
- **Real-time**: Bash - Firestore listener 확인

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — Foundation):
├── Task 1: Request Management Page + API [deep]
├── Task 2: Match Management Page + API [deep]
└── Task 3: Shared Components (Filters, Tables) [unspecified-high]

Wave 2 (After Wave 1 — Communication):
├── Task 4: Chat Management Page + API [unspecified-high]
└── Task 5: Notification Management Page + API [unspecified-high]

Wave 3 (After Wave 2 — System):
├── Task 6: System Management Page + API [unspecified-high]
└── Task 7: Admin Account Management [deep]

Wave 4 (After Wave 3 — Performance):
├── Task 8: Badge Management Page + API [unspecified-high]
├── Task 9: Settlement Management Page + API [deep]
└── Task 10: Route Management Page + API [unspecified-high]

Wave 5 (After Wave 4 — Analytics):
└── Task 11: Analytics Dashboard + Reports [visual-engineering]

Wave 6 (After Wave 5 — Extensions):
├── Task 12: B2B Management Page + API [unspecified-high]
├── Task 13: Auction Management Page + API [unspecified-high]
└── Task 14: Locker Management Page + API [unspecified-high]

Wave FINAL (After ALL tasks — Integration):
├── Task F1: Cross-page Navigation Flow [deep]
├── Task F2: Permission/Access Control Audit [deep]
├── Task F3: Real-time Data Sync Check [unspecified-high]
└── Task F4: Load Test (10 concurrent admins) [unspecified-high]

Critical Path: Task 1 → Task 4 → Task 6 → Task 9 → Task 11 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 3 (Waves 1, 4)
```

### Dependency Matrix

- **1-3**: — — 4-10, 3
- **4**: 1 — 6, 2
- **5**: 1 — 6, 2
- **6**: 4, 5 — 7, 2
- **7**: 6 — 8-10, 2
- **8**: 7 — 11, 2
- **9**: 1, 7 — 11, 2
- **10**: 1, 7 — 11, 2
- **11**: 8, 9, 10 — 12-14, 3
- **12-14**: 11 — F1-F4, 3
- **F1-F4**: 12-14 — —, 4

### Agent Dispatch Summary

- **1**: **3** — T1 → `deep`, T2 → `deep`, T3 → `unspecified-high`
- **2**: **2** — T4 → `unspecified-high`, T5 → `unspecified-high`
- **3**: **2** — T6 → `unspecified-high`, T7 → `deep`
- **4**: **3** — T8 → `unspecified-high`, T9 → `deep`, T10 → `unspecified-high`
- **5**: **1** — T11 → `visual-engineering`
- **6**: **3** — T12 → `unspecified-high`, T13 → `unspecified-high`, T14 → `unspecified-high`
- **FINAL**: **4** — F1 → `deep`, F2 → `deep`, F3 → `unspecified-high`, F4 → `unspecified-high`

---

## TODOs

### Wave 1: Foundation (Week 1-2)

- [ ] 1. Request Management Page + API

  **What to do**:
  - 배송 요청 목록/상세 페이지 구현
  - 요청 취소/수정 기능
  - 필터/검색 (상태, 날짜, 사용자)
  - 요청 통계 (일별/주별)
  - API 엔드포인트 (GET, POST, PATCH, DELETE)
  - TDD: 테스트 먼저 작성 후 구현

  **Must NOT do**:
  - Deliveries 페이지와 기능 중복 금지
  - 불필요한 필드 추가 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 복잡한 비즈니스 로직 (요청 상태, 필터, 통계)
  - **Skills**: []
    - No specific skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2, 3)
  - **Blocks**: Task 4, 9
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/deliveries/page.tsx` - 유사한 테이블 구조
  - `src/services/request-service.ts` - 요청 서비스 로직

  **API/Type References**:
  - `src/types/request.ts` - 요청 타입 정의

  **External References**:
  - Firestore docs: Query with filters

  **Acceptance Criteria**:
  - [ ] Test file: admin-web/app/api/admin/requests.test.ts created
  - [ ] bun test admin-web/app/api/admin/requests.test.ts → PASS
  - [ ] API route: admin-web/app/api/admin/requests/route.ts created
  - [ ] Page: admin-web/app/(admin)/requests/page.tsx created
  - [ ] List view shows all requests
  - [ ] Detail view shows request details
  - [ ] Cancel button works
  - [ ] Filter by status works
  - [ ] Search by user works

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Request list loads and displays data
    Tool: Playwright
    Preconditions: Firestore has requests data
    Steps:
      1. Navigate to /admin/requests
      2. Wait for data load
      3. Assert table shows requests
      4. Assert status filters exist
      5. Assert search input exists
    Expected Result: Requests displayed, filters available
    Failure Indicators: Empty table, missing filters
    Evidence: .sisyphus/evidence/task-1-request-list.png

  Scenario: Request detail shows complete information
    Tool: Playwright
    Preconditions: On request list
    Steps:
      1. Click on a request ID
      2. Navigate to detail page
      3. Assert all request fields displayed
      4. Assert actions (cancel/edit) available
    Expected Result: Detail page shows complete info
    Failure Indicators: Missing fields, no actions
    Evidence: .sisyphus/evidence/task-1-request-detail.png

  Scenario: Cancel request updates status
    Tool: Playwright + Bash (curl verify)
    Preconditions: On request detail
    Steps:
      1. Click "Cancel Request" button
      2. Confirm in modal
      3. Wait for API call
      4. Verify Firestore status = 'cancelled'
    Expected Result: Status updated, modal closes
    Failure Indicators: No status change, API error
    Evidence: .sisyphus/evidence/task-1-request-cancel.log
  ```

  **Evidence to Capture**:
  - [ ] Task 1 list screenshot
  - [ ] Task 1 detail screenshot
  - [ ] Task 1 cancel log

  **Commit**: YES (per feature)
  - Message: `feat(admin): Request management page + API`
  - Files: admin-web/app/(admin)/requests/page.tsx, admin-web/app/api/admin/requests/route.ts
  - Pre-commit: bun test

---

- [ ] 2. Match Management Page + API

  **What to do**:
  - 매칭 현황 페이지 구현
  - 매칭 취소/수동 매칭 기능
  - 매칭 알고리즘 파라미터 조정
  - 매칭 실패 재시도
  - API 엔드포인트 (GET, POST, PATCH)
  - TDD 적용

  **Must NOT do**:
  - 자동 매칭 Cloud Function 로직 변경 금지 (파라미터만 조정)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 매칭 알고리즘 파라미터, 실패 처리 복잡

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/deliveries/page.tsx` - 유사한 테이블 구조
  - `src/services/matching-service.ts` - 매칭 서비스 로직

  **API/Type References**:
  - `src/types/match.ts` - 매칭 타입 정의

  **Acceptance Criteria**:
  - [ ] Test file created and passes
  - [ ] API route created
  - [ ] Page created
  - [ ] List view shows active matches
  - [ ] Manual match button works
  - [ ] Algorithm parameters editable

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Match list shows active matches
    Tool: Playwright
    Preconditions: Firestore has matches
    Steps:
      1. Navigate to /admin/matches
      2. Assert table shows matches
      3. Assert match status displayed
    Expected Result: Matches listed correctly
    Failure Indicators: Empty table, wrong data
    Evidence: .sisyphus/evidence/task-2-match-list.png

  Scenario: Manual match triggers matching logic
    Tool: Playwright
    Preconditions: On match list
    Steps:
      1. Click "Manual Match" button
      2. Select request and giller
      3. Submit
      4. Verify match created
    Expected Result: Match created successfully
    Failure Indicators: API error, no match created
    Evidence: .sisyphus/evidence/task-2-manual-match.log
  ```

  **Evidence to Capture**:
  - [ ] Match list screenshot
  - [ ] Manual match log

  **Commit**: YES
  - Message: `feat(admin): Match management page + API`
  - Files: admin-web/app/(admin)/matches/page.tsx, admin-web/app/api/admin/matches/route.ts
  - Pre-commit: bun test

---

- [ ] 3. Shared Components (Filters, Tables)

  **What to do**:
  - 재사용 가능한 필터 컴포넌트 구현
  - 재사용 가능한 테이블 컴포넌트 구현
  - 일관된 스타일/인터랙션
  - 컴포넌트 문서화

  **Must NOT do**:
  - 기존 컴포넌트와 충돌 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: UI 컴포넌트 개발

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1, 2)
  - **Blocks**: Tasks 4-14 (all use components)
  - **Blocked By**: None (can start immediately)

  **References**:
  **Pattern References**:
  - `admin-web/components/Sidebar.tsx` - 컴포넌트 구조
  - `admin-web/lib/format.ts` - 유틸리티

  **Acceptance Criteria**:
  - [ ] Filter component: admin-web/components/FilterSelect.tsx
  - [ ] Table component: admin-web/components/DataTable.tsx
  - [ ] Components exported
  - [ ] Props documented

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: FilterSelect component works
    Tool: Playwright
    Preconditions: Component imported in test page
    Steps:
      1. Render FilterSelect with options
      2. Click dropdown
      3. Select option
      4. Assert onChange called
    Expected Result: Filter works, value updates
    Failure Indicators: No interaction, wrong value
    Evidence: .sisyphus/evidence/task-3-filter-test.png

  Scenario: DataTable renders correctly
    Tool: Playwright
    Preconditions: Component imported
    Steps:
      1. Render DataTable with data
      2. Assert rows displayed
      3. Assert columns match props
      4. Click sort header
      5. Assert order changes
    Expected Result: Table renders and sorts
    Failure Indicators: Missing data, sort broken
    Evidence: .sisyphus/evidence/task-3-table-test.png
  ```

  **Evidence to Capture**:
  - [ ] Filter test screenshot
  - [ ] Table test screenshot

  **Commit**: YES
  - Message: `feat(admin): Shared components (FilterSelect, DataTable)`
  - Files: admin-web/components/FilterSelect.tsx, admin-web/components/DataTable.tsx
  - Pre-commit: bun test

---

### Wave 2: Communication (Week 3)

- [ ] 4. Chat Management Page + API

  **What to do**:
  - 채팅방 목록 페이지 구현
  - 채팅 내용 모니터링 (규제 준수)
  - 문제 채팅 신고 처리
  - API 엔드포인트

  **Must NOT do**:
  - 메시지 저장/전송 금지 (조회만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 채팅 로그 조회, 필터링

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (requests linked to chats)

  **References**:
  **Pattern References**:
  - `src/services/chat-service.ts` - 채팅 서비스

  **Acceptance Criteria**:
  - [ ] Page shows chat rooms
  - [ ] Chat messages viewable
  - [ ] Search by user/keyword
  - [ ] Report handling button

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Chat list shows active rooms
    Tool: Playwright
    Preconditions: Firestore has chats
    Steps:
      1. Navigate to /admin/chats
      2. Assert chat rooms listed
      3. Assert message count shown
    Expected Result: Chats displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-4-chat-list.png

  Scenario: Chat messages viewable
    Tool: Playwright
    Preconditions: On chat list
    Steps:
      1. Click on chat room
      2. Navigate to messages view
      3. Assert messages displayed
      4. Assert timestamps correct
    Expected Result: Messages shown
    Failure Indicators: No messages
    Evidence: .sisyphus/evidence/task-4-messages.png
  ```

  **Evidence to Capture**:
  - [ ] Chat list screenshot
  - [ ] Messages view screenshot

  **Commit**: YES
  - Message: `feat(admin): Chat management page + API`
  - Files: admin-web/app/(admin)/chats/page.tsx, admin-web/app/api/admin/chats/route.ts

---

- [ ] 5. Notification Management Page + API

  **What to do**:
  - FCM 푸시 알림 전송 (전체/개별)
  - 알림 템플릿 관리
  - 알림 전송 이력
  - API 엔드포인트

  **Must NOT do**:
  - 스팸 전송 금지 (수량 제한)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 알림 전송 UI, 템플릿 관리

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (users linked to notifications)

  **References**:
  **Pattern References**:
  - `src/services/notification-service.ts` - 알림 서비스

  **Acceptance Criteria**:
  - [ ] Send notification form works
  - [ ] Target selection (all/individual)
  - [ ] Template selection
  - [ ] History shows sent notifications

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Send notification to all users
    Tool: Playwright
    Preconditions: On notification page
    Steps:
      1. Fill title and message
      2. Select "All Users" target
      3. Click send
      4. Assert confirmation shown
    Expected Result: Notification queued
    Failure Indicators: Send button disabled
    Evidence: .sisyphus/evidence/task-5-send-notif.png
  ```

  **Evidence to Capture**:
  - [ ] Send notification screenshot

  **Commit**: YES
  - Message: `feat(admin): Notification management page + API`
  - Files: admin-web/app/(admin)/notifications/page.tsx, admin-web/app/api/admin/notifications/route.ts

---

### Wave 3: System (Week 4)

- [ ] 6. System Management Page + API

  **What to do**:
  - 어드민 계정 관리 (현재 단일 토큰만)
  - 관리자 권한/역할 관리
  - 시스템 로그/이벤트 모니터링
  - 환경설정/플래그 관리
  - 유지보수 모드 (점검 표시)

  **Must NOT do**:
  - 기존 관리자 권한 우회 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 권한 관리, 로그 조회

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 8-10
  - **Blocked By**: Task 4, 5 (chats/notifications need logging)

  **References**:
  **Pattern References**:
  - `admin-web/lib/auth.ts` - 인증 로직
  - `admin-web/app/api/login/route.ts` - 로그인 API

  **Acceptance Criteria**:
  - [ ] Admin accounts list
  - [ ] Add/remove admin accounts
  - [ ] Role assignment
  - [ ] System logs view
  - [ ] Maintenance mode toggle

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Admin accounts list displays
    Tool: Playwright
    Preconditions: Logged in as admin
    Steps:
      1. Navigate to /admin/system
      2. Assert admin accounts shown
      3. Assert roles displayed
    Expected Result: Accounts listed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-6-admin-list.png

  Scenario: Maintenance mode toggles
    Tool: Playwright
    Preconditions: On system page
    Steps:
      1. Click maintenance toggle
      2. Confirm in modal
      3. Assert status updated
    Expected Result: Mode toggled
    Failure Indicators: Toggle not working
    Evidence: .sisyphus/evidence/task-6-maintenance.png
  ```

  **Evidence to Capture**:
  - [ ] Admin list screenshot
  - [ ] Maintenance mode screenshot

  **Commit**: YES
  - Message: `feat(admin): System management page + API`
  - Files: admin-web/app/(admin)/system/page.tsx, admin-web/app/api/admin/system/route.ts

---

- [ ] 7. Admin Account Management

  **What to do**:
  - 관리자 인증/인가 강화
  - 다중 관리자 지원
  - 역할 기반 접근 제어 (RBAC)

  **Must NOT do**:
  - 단일 토큰 인증 유지 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 보안, 권한 관리 복잡

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: Task 8-10
  - **Blocked By**: Task 6 (system management needs accounts)

  **References**:
  **Pattern References**:
  - `src/services/auth-service.ts` - 인증 서비스

  **Acceptance Criteria**:
  - [ ] RBAC implemented
  - [ ] Admin roles (super, editor, viewer)
  - [ ] Permission checks on all API routes

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: RBAC blocks unauthorized access
    Tool: Bash (curl)
    Preconditions: Two admin accounts (viewer, super)
    Steps:
      1. Login as viewer
      2. Attempt PATCH /api/admin/system
      3. Assert 403 Forbidden
      4. Login as super
      5. Attempt PATCH /api/admin/system
      6. Assert 200 OK
    Expected Result: Permissions enforced
    Failure Indicators: Viewer can edit
    Evidence: .sisyphus/evidence/task-7-rbac-test.log
  ```

  **Evidence to Capture**:
  - [ ] RBAC test log

  **Commit**: YES
  - Message: `feat(admin): Admin account management + RBAC`
  - Files: admin-web/lib/auth.ts, admin-web/lib/rbac.ts, firestore.rules

---

### Wave 4: Performance (Week 5-7)

- [ ] 8. Badge Management Page + API

  **What to do**:
  - 배지 생성/수정/삭제
  - 배지 획득 현황
  - 배지 수동 지급
  - API 엔드포인트

  **Must NOT do**:
  - 앱 배지 획득 로직 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 배지 CRUD, 획득 현황

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 9, 10)
  - **Blocks**: Task 11
  - **Blocked By**: Task 7 (admin auth needed)

  **References**:
  **Pattern References**:
  - `src/services/badge-service.ts` - 배지 서비스

  **Acceptance Criteria**:
  - [ ] Badge list shows all badges
  - [ ] Create badge form works
  - [ ] Badge earning stats shown
  - [ ] Manual grant button works

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Badge list displays
    Tool: Playwright
    Preconditions: Firestore has badges
    Steps:
      1. Navigate to /admin/badges
      2. Assert badges listed
      3. Assert categories shown
    Expected Result: Badges displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-8-badge-list.png

  Scenario: Manual grant works
    Tool: Playwright
    Preconditions: On badge detail
    Steps:
      1. Select user UID
      2. Click "Grant Badge"
      3. Confirm
      4. Verify user has badge
    Expected Result: Badge granted
    Failure Indicators: No badge added
    Evidence: .sisyphus/evidence/task-8-grant-badge.log
  ```

  **Evidence to Capture**:
  - [ ] Badge list screenshot
  - [ ] Grant badge log

  **Commit**: YES
  - Message: `feat(admin): Badge management page + API`
  - Files: admin-web/app/(admin)/badges/page.tsx, admin-web/app/api/admin/badges/route.ts

---

- [ ] 9. Settlement Management Page + API

  **What to do**:
  - 월간 정산 내역
  - 길러별 수익 상세
  - 정산 오류 처리
  - 세금계산서 발행 관리
  - API 엔드포인트

  **Must NOT do**:
  - 실제 정산 금액 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 정산 로직, 세금계산서 복잡

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 8, 10)
  - **Blocks**: Task 11
  - **Blocked By**: Task 1, 7 (requests + admin auth needed)

  **References**:
  **Pattern References**:
  - `src/services/SettlementService.ts` - 정산 서비스

  **Acceptance Criteria**:
  - [ ] Monthly settlement list
  - [ ] Giller earnings detail
  - [ ] Error handling UI
  - [ ] Tax invoice management

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Monthly settlement shows
    Tool: Playwright
    Preconditions: Firestore has settlements
    Steps:
      1. Navigate to /admin/settlements
      2. Select month
      3. Assert settlements listed
    Expected Result: Settlements displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-9-settlement-list.png

  Scenario: Tax invoice can be generated
    Tool: Playwright
    Preconditions: On settlement detail
    Steps:
      1. Click "Generate Invoice"
      2. Confirm
      3. Assert invoice created
    Expected Result: Invoice generated
    Failure Indicators: No invoice
    Evidence: .sisyphus/evidence/task-9-invoice.log
  ```

  **Evidence to Capture**:
  - [ ] Settlement list screenshot
  - [ ] Invoice generation log

  **Commit**: YES
  - Message: `feat(admin): Settlement management page + API`
  - Files: admin-web/app/(admin)/settlements/page.tsx, admin-web/app/api/admin/settlements/route.ts

---

- [ ] 10. Route Management Page + API

  **What to do**:
  - 길러 경로 등록/수정
  - 경로 통계 (인기 노선)
  - 노선별 배송 현황
  - API 엔드포인트

  **Must NOT do**:
  - 실제 지하철 데이터 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 경로 CRUD, 통계

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 8, 9)
  - **Blocks**: Task 11
  - **Blocked By**: Task 1, 7 (requests + admin auth needed)

  **References**:
  **Pattern References**:
  - `src/screens/main/EditRouteScreen.tsx` - 경로 편집 화면
  - `data/subway-stations.ts` - 지하철 데이터

  **Acceptance Criteria**:
  - [ ] Route list shows giller routes
  - [ ] Edit route form works
  - [ ] Popular routes statistics
  - [ ] Route delivery count

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Route list displays
    Tool: Playwright
    Preconditions: Firestore has routes
    Steps:
      1. Navigate to /admin/routes
      2. Assert routes listed
      3. Assert delivery counts shown
    Expected Result: Routes displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-10-route-list.png

  Scenario: Popular routes statistics show
    Tool: Playwright
    Preconditions: On routes page
    Steps:
      1. Click "Statistics" tab
      2. Assert chart displays
      3. Assert top routes listed
    Expected Result: Statistics shown
    Failure Indicators: No chart/data
    Evidence: .sisyphus/evidence/task-10-route-stats.png
  ```

  **Evidence to Capture**:
  - [ ] Route list screenshot
  - [ ] Statistics screenshot

  **Commit**: YES
  - Message: `feat(admin): Route management page + API`
  - Files: admin-web/app/(admin)/routes/page.tsx, admin-web/app/api/admin/routes/route.ts

---

### Wave 5: Analytics (Week 7)

- [ ] 11. Analytics Dashboard + Reports

  **What to do**:
  - 통계 대시보드 차트
  - 사용자/길러 성장 추이
  - 매출/수익 분석
  - 월간/주간 리포트 다운로드

  **Must NOT do**:
  - 과도한 애니메이션 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 차트, 대시보드 UI

  **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for this task (component rendering)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 5)
  - **Blocks**: Task 12-14
  - **Blocked By**: Task 8, 9, 10 (badges, settlements, routes data)

  **References**:
  **Pattern References**:
  - `admin-web/app/(admin)/dashboard/page.tsx` - 기존 대시보드

  **Acceptance Criteria**:
  - [ ] User growth chart
  - [ ] Revenue chart
  - [ ] Delivery statistics
  - [ ] Report download (CSV/PDF)

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Analytics dashboard shows charts
    Tool: Playwright
    Preconditions: Data exists
    Steps:
      1. Navigate to /admin/analytics
      2. Assert user growth chart renders
      3. Assert revenue chart renders
      4. Assert delivery stats shown
    Expected Result: All charts display
    Failure Indicators: Missing charts
    Evidence: .sisyphus/evidence/task-11-dashboard.png

  Scenario: Report download works
    Tool: Playwright
    Preconditions: On analytics page
    Steps:
      1. Select date range
      2. Click "Download CSV"
      3. Assert file downloaded
      4. Open CSV, assert data present
    Expected Result: CSV downloaded with data
    Failure Indicators: No download, empty file
    Evidence: .sisyphus/evidence/task-11-report.csv
  ```

  **Evidence to Capture**:
  - [ ] Dashboard screenshot
  - [ ] CSV report file

  **Commit**: YES
  - Message: `feat(admin): Analytics dashboard + reports`
  - Files: admin-web/app/(admin)/analytics/page.tsx, admin-web/components/Charts.tsx

---

### Wave 6: Extensions (Week 8)

- [ ] 12. B2B Management Page + API

  **What to do**:
  - 기업 계약 관리
  - B2B 배송 요청 관리
  - B2B 길러 관리
  - 세금계산서 발행 이력
  - API 엔드포인트

  **Must NOT do**:
  - B2C 기능에 영향 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: B2B CRUD

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 13, 14)
  - **Blocks**: Task F1-F4
  - **Blocked By**: Task 11 (analytics needs B2B data)

  **References**:
  **Pattern References**:
  - `src/services/business-contract-service.ts` - B2B 서비스

  **Acceptance Criteria**:
  - [ ] Company contracts list
  - [ ] B2B requests management
  - [ ] B2B gillers list
  - [ ] Tax invoices for B2B

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: B2B contracts listed
    Tool: Playwright
    Preconditions: Firestore has contracts
    Steps:
      1. Navigate to /admin/b2b
      2. Assert contracts shown
      3. Assert status displayed
    Expected Result: Contracts displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-12-b2b-list.png
  ```

  **Evidence to Capture**:
  - [ ] B2B list screenshot

  **Commit**: YES
  - Message: `feat(admin): B2B management page + API`
  - Files: admin-web/app/(admin)/b2b/page.tsx, admin-web/app/api/admin/b2b/route.ts

---

- [ ] 13. Auction Management Page + API

  **What to do**:
  - 경매 요청 관리
  - 입찰 현황 모니터링
  - 낙찰 관리
  - API 엔드포인트

  **Must NOT do**:
  - 자동 낙찰 로직 변경 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 경매 CRUD, 입찰 현황

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 12, 14)
  - **Blocks**: Task F1-F4
  - **Blocked By**: Task 1, 11 (requests + analytics)

  **References**:
  **Pattern References**:
  - `src/services/auction-service.ts` - 경매 서비스

  **Acceptance Criteria**:
  - [ ] Auction requests list
  - [ ] Bids shown per auction
  - [ ] Manual auction close

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Auction list shows
    Tool: Playwright
    Preconditions: Firestore has auctions
    Steps:
      1. Navigate to /admin/auctions
      2. Assert auctions listed
      3. Assert bid counts shown
    Expected Result: Auctions displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-13-auction-list.png
  ```

  **Evidence to Capture**:
  - [ ] Auction list screenshot

  **Commit**: YES
  - Message: `feat(admin): Auction management page + API`
  - Files: admin-web/app/(admin)/auctions/page.tsx, admin-web/app/api/admin/auctions/route.ts

---

- [ ] 14. Locker Management Page + API

  **What to do**:
  - 락커 위치/상태 관리
  - 락커 이용 현황
  - API 엔드포인트

  **Must NOT do**:
  - 실제 락커 하드웨어 통신 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 락커 CRUD, 상태 관리

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 6 (with Task 12, 13)
  - **Blocks**: Task F1-F4
  - **Blocked By**: Task 1, 11 (requests + analytics)

  **References**:
  **Pattern References**:
  - `src/screens/giller/GillerDropoffAtLockerScreen.tsx` - 락커 화면

  **Acceptance Criteria**:
  - [ ] Locker locations list
  - [ ] Locker status (available/occupied)
  - [ ] Usage statistics

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Locker list shows
    Tool: Playwright
    Preconditions: Firestore has lockers
    Steps:
      1. Navigate to /admin/lockers
      2. Assert lockers listed
      3. Assert status shown
    Expected Result: Lockers displayed
    Failure Indicators: Empty list
    Evidence: .sisyphus/evidence/task-14-locker-list.png
  ```

  **Evidence to Capture**:
  - [ ] Locker list screenshot

  **Commit**: YES
  - Message: `feat(admin): Locker management page + API`
  - Files: admin-web/app/(admin)/lockers/page.tsx, admin-web/app/api/admin/lockers/route.ts

---

## Final Verification Wave (MANDATORY — after ALL tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Cross-page Navigation Flow** — `deep`
  Verify navigation between all admin pages. Test sidebar links, breadcrumbs, back buttons. Ensure no broken links. Test user flow: Dashboard → Requests → Details → Back. Verify deep links work.
  Output: `Links [N/N working] | Flows [N tested] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Permission/Access Control Audit** — `deep`
  Verify RBAC on all pages/API routes. Test each admin role (super, editor, viewer). Attempt unauthorized access. Check API route permissions. Verify maintenance mode blocks access.
  Output: `Roles [N/N tested] | Endpoints [N/N protected] | VERDICT`

- [ ] F3. **Real-time Data Sync Check** — `unspecified-high`
  Verify Firestore realtime updates. Open two admin sessions. Modify data in one, verify other sees update. Test dashboard stats update in real-time.
  Output: `Sync [WORKING/FAIL] | Latency [ms] | VERDICT`

- [ ] F4. **Load Test (10 concurrent admins)** — `unspecified-high`
  Simulate 10 concurrent admin users. Perform operations on different pages. Check response times, error rates. Verify no data corruption.
  Output: `Concurrent [10] | Avg Response [ms] | Errors [N] | VERDICT`

---

## Commit Strategy

- **1-14**: YES (per feature)
  - Commit message format: `feat(admin): [Feature name] + API`
  - Pre-commit: bun test (if tests exist)

- **F1-F4**: NO (verification only)

- **Final**: `chore: Admin improvement roadmap complete (12 features, 1-2 months)`
  - Files: All modified files
  - Pre-commit: All final verification passes

---

## Success Criteria

### Verification Commands
```bash
# Type checks
cd admin-web && npx tsc --noEmit

# Lint
cd admin-web && npm run lint

# Build
cd admin-web && npm run build
```

### Final Checklist
- [ ] 12 new admin pages implemented
- [ ] 12 new API routes implemented
- [ ] Shared components (Filter, Table) created
- [ ] RBAC implemented
- [ ] All tests pass (TDD)
- [ ] All pages accessible
- [ ] Real-time sync working
- [ ] Load test passed
- [ ] Documentation updated
