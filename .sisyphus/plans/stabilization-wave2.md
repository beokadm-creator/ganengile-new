# Stabilization Wave 2: T8, T6, T7, T5

## TL;DR

> **Quick Summary**: 코드 감사에서 발견된 후속 안정화 항목 4건을 순차적으로 수정합니다. (1) 매칭 자동 재시도 Firestore 쿼리 구현, (2) as any 타입 단언 26건 제거, (3) scheduler 하드코딩값 config 연동, (4) users 컬렉션 읽기 권한 제한.
> 
> **Deliverables**:
> - `matching-auto-retry.ts` — 실제 Firestore 쿼리로 미매칭 요청 자동 재시도
> - `firestore.indexes.json` — matchingStatus 복합 색인 추가
> - 9개 서비스 파일 — `as any` 제거 및 타입 가드 교체
> - `tax-invoice-scheduler.ts` — config 컬렉션에서 플랫폼 정보 로드
> - `firestore.rules` — users 읽기 권한 세분화
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: T8(matching-auto-retry) → T6(types) → T7(scheduler) → T5(rules)

---

## Context

### Original Request
코드 감사 분석 리포트에서 발견된 CRITICAL+HIGH 4건(WAVE 1) 수정 완료 후, 후속 MEDIUM 항목 4건에 대한 심층 분석 완료. 분석 결과를 바탕으로 순차적 수정 진행.

### Interview Summary
**Key Discussions**:
- WAVE 1 완료: ?? 버그 3건, .exists 23건, Firestore rules 1건, 빈 catch 13건
- 후속 분석 완료: T8(매칭 재시도), T6(as any), T7(scheduler), T5(보안규칙)
- 실행 순서: T8 > T6 > T7 > T5 (의존성 기준)

**Research Findings**:
- matching-auto-retry.ts: `matchingStatus` 필드가 이미 코드에서 사용 중(line 37, 72), Firestore 색인만 추가하면 즉시 구현 가능
- as any 26건: 7개 카테고리로 분류, `BankAccount[]` + `FeeBreakdown` 인터페이스 정의로 8건 즉시 해결 가능
- scheduler: `config_operational/platform_info` 컬렉션에 플랫폼 정보 저장 후 로드
- users 읽기 제한: 6개 서비스(chat, matching, user, rating, wallet, notification)가 users 읽기 사용 중

### Metis Review
Self-conducted gap analysis (Metis timeout in prior session).

---

## Work Objectives

### Core Objective
WAVE 1에서 발견된 후속 안정화 항목 4건을 순차적으로 수정하여 코드베이스 품질과 보안을 강화.

### Concrete Deliverables
- matching-auto-retry.ts의 startMatchingStatusMonitor가 실제 Firestore 쿼리를 실행
- as any 26건을 적절한 타입 가드/인터페이스로 교체
- tax-invoice-scheduler.ts가 하드코딩 대신 config에서 플랫폼 정보 로드
- users 컬렉션 읽기 권한을 isOwner + isMatchedGiller로 제한

### Definition of Done
- [ ] matching-auto-retry.ts가 미매칭 요청을 Firestore에서 실제로 조회
- [ ] src/services/에 as any 잔여 0건 (테스트 제외)
- [ ] tax-invoice-scheduler.ts의 사업자번호가 config에서 로드
- [ ] users 컬렉션 읽기가 owner + matched parties로 제한

### Must Have
- 기존 기능 동작 보존 (회귀 없음)
- Firestore 색인 추가로 쿼리 성능 보장

### Must NOT Have (Guardrails)
- Firestore 컬렉션 스키마 변경 (필드 추가는 OK)
- 네비게이션/라우팅 변경
- 새 npm 패키지 추가
- UI 컴포넌트 변경
- 테스트 파일 수정

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (jest.config.js)
- **Automated tests**: None for this wave
- **Framework**: jest (기존)

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Service logic**: Bash (node REPL) — import, call, verify
- **Firestore rules**: Read rules file, verify syntax
- **Type safety**: Bash (`npx tsc --noEmit` on changed files)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - T8 matching-auto-retry):
├── Task 1: Implement Firestore query in matching-auto-retry.ts [unspecified-high]
└── Task 2: Add Firestore composite index for matchingStatus [quick]

Wave 2 (After Wave 1 - T6 type safety):
├── Task 3: Define BankAccount + FeeBreakdown interfaces [quick]
├── Task 4: Replace as any in SettlementService.ts (3건) [unspecified-high]
├── Task 5: Replace as any in request-service.ts (5건) [unspecified-high]
├── Task 6: Replace as any in fare-service.ts + delivery-service.ts (7건) [unspecified-high]
├── Task 7: Replace as any in BadgeService.ts (4건) [unspecified-high]
└── Task 8: Replace as any in remaining files (7건) [unspecified-high]

Wave 3 (After Wave 2 - T7 + T5):
├── Task 9: Create platform_info config loader [quick]
├── Task 10: Update tax-invoice-scheduler to use config [unspecified-high]
└── Task 11: Update Firestore rules users read restriction [deep]

Wave FINAL:
├── Task F1: Plan compliance audit [oracle]
├── Task F2: Code quality review [unspecified-high]
├── Task F3: Real manual QA [unspecified-high]
└── Task F4: Scope fidelity check [deep]

Critical Path: T1 → T3 → T9 → T11 → F1-F4
Parallel Speedup: ~65%
Max Concurrent: 5 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | - | 2, F1-F4 |
| 2 | 1 | F1-F4 |
| 3 | - | 4, 5, 6, 7, 8 |
| 4 | 3 | F1-F4 |
| 5 | 3 | F1-F4 |
| 6 | 3 | F1-F4 |
| 7 | 3 | F1-F4 |
| 8 | 3 | F1-F4 |
| 9 | - | 10 |
| 10 | 9 | F1-F4 |
| 11 | - | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **2** — T1 → `unspecified-high`, T2 → `quick`
- **Wave 2**: **6** — T3 → `quick`, T4-T8 → `unspecified-high`
- **Wave 3**: **3** — T9 → `quick`, T10 → `unspecified-high`, T11 → `deep`
- **FINAL**: **4** — F1 → `oracle`, F2-F4 → `unspecified-high`/`deep`

---

## TODOs

- [ ] 1. Implement Firestore query in `matching-auto-retry.ts`

  **What to do**:
  - Add imports: `collection, query, where, getDocs, Timestamp` from `firebase/firestore`
  - Replace the `setInterval` callback in `startMatchingStatusMonitor` (lines 133-143) with actual Firestore query:
    ```typescript
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000));
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      where('matchingStatus', '==', 'no-match'),
      where('createdAt', '<=', cutoff)
    );
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      const elapsed = Date.now() - (docSnap.data().createdAt?.toDate()?.getTime() ?? 0);
      if (elapsed > 30000) {
        console.warn(`[matching-monitor] Retrying request: ${docSnap.id}`);
        await retryMatchingWithBackoff(docSnap.id);
      }
    }
    ```
  - Change `setInterval` to `setInterval(async () => { ... }, intervalMs)` — add async
  - Add error handling around the query

  **Must NOT do**:
  - Do NOT change the retryMatchingWithBackoff function
  - Do NOT change the scheduleAutoRetry function
  - Do NOT change the manualRetry function

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:
  - `src/services/matching-auto-retry.ts:133-143` — Current empty setInterval callback to replace
  - `src/services/matching-auto-retry.ts:6` — Current imports (add collection, query, where, getDocs, Timestamp)
  - `src/services/matching-auto-retry.ts:29` — `findMatchesForRequest(requestId, 3)` — already imported and used
  - `src/services/matching-auto-retry.ts:36-40` — `updateDoc(doc(db, 'requests', requestId), ...)` — pattern for Firestore writes
  - `src/services/matching-auto-retry.ts:37` — `'matchingStatus': 'matched'` — field already used
  - `src/services/matching-auto-retry.ts:72` — `'matchingStatus': 'no-match'` — field already used

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: No as any remains in matching-auto-retry.ts
    Tool: Bash (grep)
    Steps:
      1. grep -c "as any" src/services/matching-auto-retry.ts
      2. Assert count is 0
    Expected Result: Zero as any occurrences
    Evidence: .sisyphus/evidence/task-1-no-as-any.txt

  Scenario: Firestore imports are present
    Tool: Bash (grep)
    Steps:
      1. grep "collection, query, where, getDocs" src/services/matching-auto-retry.ts
      2. Assert match found
    Expected Result: All Firestore query imports present
    Evidence: .sisyphus/evidence/task-1-imports.txt
  ```

  **Commit**: YES
  - Message: `feat(matching): implement Firestore query for unmatched request auto-retry`
  - Files: `src/services/matching-auto-retry.ts`
  - Pre-commit: grep -c "as any" src/services/matching-auto-retry.ts

- [ ] 2. Add Firestore composite index for matchingStatus

  **What to do**:
  - Add a new index entry to `firestore.indexes.json`:
    ```json
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        {"fieldPath": "status", "order": "ASCENDING"},
        {"fieldPath": "matchingStatus", "order": "ASCENDING"},
        {"fieldPath": "createdAt", "order": "ASCENDING"}
      ]
    }
    ```
  - Insert it in the "indexes" array, after the existing requests indexes (after line 28)

  **Must NOT do**:
  - Do NOT remove or modify existing indexes
  - Do NOT change any other field in the file

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:
  - `firestore.indexes.json` — Full file, existing indexes as pattern reference
  - `firestore.indexes.json:2-28` — Existing requests indexes to follow pattern

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: New index entry exists in firestore.indexes.json
    Tool: Bash (grep)
    Steps:
      1. grep "matchingStatus" firestore.indexes.json
      2. Assert match found
    Expected Result: matchingStatus field index present
    Evidence: .sisyphus/evidence/task-2-index.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(matching): add Firestore index for matchingStatus query`
  - Files: `firestore.indexes.json`

- [ ] 3. Define `BankAccount` + `FeeBreakdown` + `BadgeRequirementValue` interfaces

  **What to do**:
  - In `src/types/payment.ts`, add `FeeBreakdown` interface:
    ```typescript
    export interface FeeBreakdown {
      totalFee: number;
      platformFee: number;
      gillerPayout: number;
      depositAmount?: number;
      baseFee?: number;
      distanceFee?: number;
      weightFee?: number;
      urgencyFee?: number;
    }
    ```
  - In `src/types/payment.ts`, add `BankAccount` interface (or check if it already exists):
    ```typescript
    export interface BankAccount {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      verified?: boolean;
    }
    ```
  - In `src/types/user.ts`, extend the User type to include `bankAccounts?: BankAccount[]` if not already present
  - In `src/types/user.ts`, add `BadgeRequirementValue` union type:
    ```typescript
    export type BadgeRequirementValue =
      | { type: 'weekly_deliveries'; minWeekly: number }
      | { type: 'total_deliveries'; minDeliveries: number }
      | { type: 'completed_deliveries'; completedDeliveries: number }
      | { type: 'rating'; minRating: number }
      | { type: 'streak'; minStreakDays: number }
      | Record<string, unknown>;
    ```

  **Must NOT do**:
  - Do NOT remove existing type exports
  - Do NOT change existing interface fields
  - Do NOT modify service files (that's Tasks 4-8)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (pre-requisite for Tasks 4-8)
  - **Blocks**: Tasks 4, 5, 6, 7, 8
  - **Blocked By**: None

  **References**:
  - `src/types/payment.ts` — Existing payment types, add FeeBreakdown and BankAccount here
  - `src/types/user.ts` — Existing User type, check if bankAccounts field exists
  - `src/services/SettlementService.ts:349,376,391` — How bankAccounts is accessed: `(user as any).bankAccounts`
  - `src/services/request-service.ts:806-811` — How fee is accessed: `(request as any)?.fee?.totalFee`
  - `src/services/BadgeService.ts:110,118,122,135` — How badge requirements are accessed: `(requirement.value as any).minWeekly`

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: New interfaces are exportable
    Tool: Bash
    Steps:
      1. grep "export interface FeeBreakdown" src/types/payment.ts
      2. grep "export interface BankAccount" src/types/payment.ts
      3. Assert both found
    Expected Result: Both interfaces exported
    Evidence: .sisyphus/evidence/task-3-interfaces.txt
  ```

  **Commit**: YES
  - Message: `feat(types): add FeeBreakdown, BankAccount, BadgeRequirementValue interfaces`
  - Files: `src/types/payment.ts`, `src/types/user.ts`

- [ ] 4. Replace `as any` in `SettlementService.ts` (3건)

  **What to do**:
  - Line 349: `(user as any).bankAccounts` → `(user as User & { bankAccounts?: BankAccount[] }).bankAccounts`
  - Line 376: `(user as any).bankAccounts` → same pattern
  - Line 391: `(user as any).bankAccounts` → same pattern
  - Add import for `BankAccount` type from `../types/payment`
  - Create a helper function or type guard: `function getBankAccounts(user: User): BankAccount[]`

  **Must NOT do**:
  - Do NOT change business logic
  - Do NOT modify the settlement flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 3

  **References**:
  - `src/services/SettlementService.ts:349` — `(user as any).bankAccounts ?? []`
  - `src/services/SettlementService.ts:376` — `return (user as any).bankAccounts ?? []`
  - `src/services/SettlementService.ts:391` — `const accounts = (user as any).bankAccounts ?? []`
  - `src/types/payment.ts` — BankAccount interface (created in Task 3)
  - `src/types/user.ts` — User type

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No as any in SettlementService.ts
    Tool: Bash (grep)
    Steps:
      1. grep -c "as any" src/services/SettlementService.ts
      2. Assert count is 0
    Expected Result: Zero as any
    Evidence: .sisyphus/evidence/task-4-no-as-any.txt
  ```

  **Commit**: YES
  - Message: `refactor(settlement): replace as any with typed BankAccount access`
  - Files: `src/services/SettlementService.ts`

- [ ] 5. Replace `as any` in `request-service.ts` (5건)

  **What to do**:
  - Line 89: `urgency: (urgency as any) ?? 'medium'` → add type guard for UrgencyLevel values
  - Line 116-117: `serverTimestamp() as any` → use `serverTimestamp() as Timestamp` or keep (Firebase SDK requires this cast)
  - Line 806: `(request as any)?.fee?.totalFee` → use FeeBreakdown interface
  - Line 808: `(request as any)?.feeBreakdown?.totalFee` → use FeeBreakdown interface
  - Line 811: `(request as any)?.fee` → use FeeBreakdown interface
  - Import `FeeBreakdown` from `../types/payment`
  - NOTE: `serverTimestamp() as any` on lines 116-117 is a known Firebase SDK workaround — it may need to stay as `as Timestamp` instead

  **Must NOT do**:
  - Do NOT change fee calculation logic
  - Do NOT modify the request creation flow

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 3

  **References**:
  - `src/services/request-service.ts:89` — urgency casting
  - `src/services/request-service.ts:116-117` — serverTimestamp casting
  - `src/services/request-service.ts:806-811` — fee access patterns
  - `src/types/payment.ts` — FeeBreakdown interface (created in Task 3)
  - `src/types/request.ts` — Request type, RequestStatus enum

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No as any in request-service.ts (excluding serverTimestamp)
    Tool: Bash (grep)
    Steps:
      1. grep -n "as any" src/services/request-service.ts
      2. Count should be <= 2 (serverTimestamp casts may remain)
    Expected Result: Fee-related as any removed
    Evidence: .sisyphus/evidence/task-5-no-as-any.txt
  ```

  **Commit**: YES
  - Message: `refactor(request): replace as any with typed FeeBreakdown access`
  - Files: `src/services/request-service.ts`

- [ ] 6. Replace `as any` in `fare-service.ts` + `delivery-service.ts` (7건)

  **What to do**:

  **fare-service.ts (4건)**:
  - Lines 118, 132, 163, 176: `directSnap.data() as any` / `reverseSnap.data() as any`
  - Create a `FareCacheData` interface in `src/types/` or inline:
    ```typescript
    interface FareCacheData { fare?: number; raw?: Record<string, unknown>; [key: string]: unknown; }
    ```
  - Replace: `const data = docSnap.data() as any` → `const data = docSnap.data() as FareCacheData`

  **delivery-service.ts (3건)**:
  - Line 1072: delivery object construction `as any` — review context and add proper type
  - Lines 1116, 1146: `docSnapshot.data() as any` → typed interface

  **Must NOT do**:
  - Do NOT change fare calculation or delivery logic

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 3

  **References**:
  - `src/services/fare-service.ts:118` — `const data = directSnap.data() as any`
  - `src/services/fare-service.ts:132` — `const data = reverseSnap.data() as any`
  - `src/services/fare-service.ts:163` — `const data = directSnap.data() as any`
  - `src/services/fare-service.ts:176` — `const data = reverseSnap.data() as any`
  - `src/services/delivery-service.ts:1072` — delivery construction `as any`
  - `src/services/delivery-service.ts:1116` — `const data = docSnapshot.data() as any`
  - `src/services/delivery-service.ts:1146` — `const data = docSnapshot.data() as any`

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No as any in fare-service.ts
    Tool: Bash (grep)
    Steps:
      1. grep -c "as any" src/services/fare-service.ts
      2. Assert count is 0
    Expected Result: Zero as any
    Evidence: .sisyphus/evidence/task-6-fare-no-as-any.txt

  Scenario: No as any in delivery-service.ts
    Tool: Bash (grep)
    Steps:
      1. grep -c "as any" src/services/delivery-service.ts
      2. Assert count is 0
    Expected Result: Zero as any
    Evidence: .sisyphus/evidence/task-6-delivery-no-as-any.txt
  ```

  **Commit**: YES
  - Message: `refactor(fare,delivery): replace as any with typed interfaces`
  - Files: `src/services/fare-service.ts`, `src/services/delivery-service.ts`

- [ ] 7. Replace `as any` in `BadgeService.ts` (4건)

  **What to do**:
  - Line 110: `(requirement.value as any).minWeekly * (requirement.value as any)` → use BadgeRequirementValue type
  - Line 118: `(requirement as any).minDeliveries` → typed access
  - Line 122: `(requirement as any).completedDeliveries` → typed access
  - Line 135: `(requirement as any).minDeliveries` → typed access
  - Import BadgeRequirementValue from `../types/user`

  **Must NOT do**:
  - Do NOT change badge checking logic
  - Do NOT modify badge data structure

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 3

  **References**:
  - `src/services/BadgeService.ts:110` — `(requirement.value as any).minWeekly * (requirement.value as any)`
  - `src/services/BadgeService.ts:118` — `(requirement as any).minDeliveries`
  - `src/services/BadgeService.ts:122` — `(requirement as any).completedDeliveries`
  - `src/services/BadgeService.ts:135` — `(requirement as any).minDeliveries`
  - `src/types/user.ts` — BadgeRequirementValue type (created in Task 3)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No as any in BadgeService.ts
    Tool: Bash (grep)
    Steps:
      1. grep -c "as any" src/services/BadgeService.ts
      2. Assert count is 0
    Expected Result: Zero as any
    Evidence: .sisyphus/evidence/task-7-no-as-any.txt
  ```

  **Commit**: YES
  - Message: `refactor(badge): replace as any with BadgeRequirementValue type`
  - Files: `src/services/BadgeService.ts`

- [ ] 8. Replace `as any` in remaining files (7건: chat, deposit, media, profile, settlement)

  **What to do**:

  **chat-service.ts (2건)**:
  - Lines 67-68: `(a.updatedAt as any)?.toDate?.()` and `(b.updatedAt as any)?.toDate?.()`
  - Replace with: helper function `toTimestamp(val): Date | null` or direct cast `as Timestamp`

  **deposit-compensation-service.ts (2건)**:
  - Line 45: `'deposit_refund' as any` → check PointCategory enum, add value if missing
  - Line 91: `'deposit_compensation' as any` → same

  **media-service.ts (1건)**:
  - Line 240: `encoding: 'base64' as any` → check FileSystem.EncodingType, use proper enum value

  **profile-service.ts (1건)**:
  - Line 286: Object construction `as any` → define proper interface

  **Remaining in settlement/deposit**:
  - Review each and add appropriate type guard

  **Must NOT do**:
  - Do NOT change business logic in any file

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: F1-F4
  - **Blocked By**: Task 3

  **References**:
  - `src/services/chat-service.ts:67-68` — Timestamp toDate casting
  - `src/services/deposit-compensation-service.ts:45,91` — PointCategory string casting
  - `src/services/media-service.ts:240` — base64 encoding type
  - `src/services/profile-service.ts:286` — profile object construction
  - `src/types/point.ts` — PointCategory enum (check for deposit_refund/deposit_compensation)

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Verify as any count reduction
    Tool: Bash (grep)
    Steps:
      1. grep -rc "as any" src/services/*.ts | grep -v ":0" | grep -v test
      2. Count remaining occurrences
    Expected Result: Significantly reduced from 26
    Evidence: .sisyphus/evidence/task-8-as-any-count.txt
  ```

  **Commit**: YES
  - Message: `refactor: replace remaining as any with typed access across services`
  - Files: `src/services/chat-service.ts`, `src/services/deposit-compensation-service.ts`, `src/services/media-service.ts`, `src/services/profile-service.ts`

- [ ] 9. Create `platform_info` config loader for scheduler

  **What to do**:
  - In `functions/src/services/config-loader.ts` (create new file or add to existing):
    ```typescript
    import * as admin from 'firebase-admin';
    const db = admin.firestore();

    export interface PlatformInfo {
      name: string;
      registrationNumber: string;
      ceo: string;
      address: string;
      contact: string;
    }

    export async function getPlatformInfo(): Promise<PlatformInfo> {
      const snap = await db.doc('config_operational/platform_info').get();
      if (!snap.exists) {
        return {
          name: '가는길에',
          registrationNumber: '',
          ceo: '',
          address: '',
          contact: '',
        };
      }
      return snap.data() as PlatformInfo;
    }
    ```
  - Alternatively, if there's already a config pattern in functions/src/, follow that pattern

  **Must NOT do**:
  - Do NOT modify the scheduler files yet (that's Task 10)
  - Do NOT create new Firestore collections (use existing config_operational)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11)
  - **Blocks**: Task 10
  - **Blocked By**: None

  **References**:
  - `functions/src/scheduled/tax-invoice-scheduler.ts:99-104` — Current hardcoded values to replace
  - `functions/src/` — Check for existing config loader patterns

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: Config loader file exists and exports correctly
    Tool: Bash (grep)
    Steps:
      1. grep "export async function getPlatformInfo" functions/src/ -r
      2. Assert found
    Expected Result: Function exported
    Evidence: .sisyphus/evidence/task-9-config-loader.txt
  ```

  **Commit**: YES
  - Message: `feat(config): add platform_info config loader for schedulers`
  - Files: `functions/src/services/config-loader.ts` (or appropriate location)

- [ ] 10. Update `tax-invoice-scheduler.ts` to use config loader

  **What to do**:
  - Import `getPlatformInfo` from the config loader (Task 9)
  - Replace hardcoded issuer block (lines 99-104):
    ```typescript
    // Before:
    issuer: {
      name: '가는길에',
      registrationNumber: '123-45-67890', // TODO
      ceo: '김OO',
      address: '서울특별시 OO구 OO로 123',
      contact: '02-1234-5678',
    },
    // After:
    const platformInfo = await getPlatformInfo();
    issuer: {
      name: platformInfo.name,
      registrationNumber: platformInfo.registrationNumber,
      ceo: platformInfo.ceo,
      address: platformInfo.address,
      contact: platformInfo.contact,
    },
    ```
  - Keep settlement-scheduler TODOs as-is (they need external API integration, out of scope)

  **Must NOT do**:
  - Do NOT implement `executeTransfer` or `sendSettlementNotification` (external API needed)
  - Do NOT change the settlement scheduler beyond removing hardcoded registration number

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Task 9

  **References**:
  - `functions/src/scheduled/tax-invoice-scheduler.ts:99-104` — Hardcoded issuer to replace
  - `functions/src/services/config-loader.ts` — Config loader created in Task 9

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No hardcoded registration number
    Tool: Bash (grep)
    Steps:
      1. grep "123-45-67890" functions/src/scheduled/tax-invoice-scheduler.ts
      2. Assert no match
    Expected Result: Hardcoded value removed
    Evidence: .sisyphus/evidence/task-10-no-hardcode.txt
  ```

  **Commit**: YES
  - Message: `fix(scheduler): load platform info from config instead of hardcoded values`
  - Files: `functions/src/scheduled/tax-invoice-scheduler.ts`

- [ ] 11. Update Firestore rules — users collection read restriction

  **What to do**:
  - Replace current rule at line 96-97:
    ```
    // Before:
    // 임시: 인증된 모든 사용자에게 읽기 허용
    allow read: if isAuthenticated();

    // After:
    // 본인, 관리자, 또는 매칭/채팅 관계자만 읽기 허용
    allow get: if isAuthenticated()
              && (isOwner(userId)
                  || isOwner(resource.data.matchedGillerId)
                  || hasActiveChatWith(userId));
    allow list: if false; // 목록 조회 금지
    ```
  - **IMPORTANT**: This requires careful testing. The following services read users:
    - `chat-service.ts` → reads user for chat participant name display
    - `matching-service.ts` → reads user for giller stats display
    - `user-service.ts` → reads user for own profile
    - `rating-service.ts` → reads user for rater info
    - `beta1-wallet-service.ts` → reads user for wallet
    - `matching-notification.ts` → reads user for notification
  - Consider using `allow get` (single doc) instead of `allow read` (list + get)
  - If `hasActiveChatWith` helper is too complex, keep `allow get: if isAuthenticated()` as a safer middle ground (prevents list queries but allows individual doc reads)

  **Recommended approach (safe middle ground)**:
    ```
    allow get: if isAuthenticated();
    allow list: if false;
    ```
    This allows individual doc reads (which all services use via `getDoc`) but prevents collection queries that could leak all user data.

  **Must NOT do**:
  - Do NOT break existing service functionality
  - Do NOT change the profile subcollection rules

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: None

  **References**:
  - `firestore.rules:95-97` — Current temporary rule
  - `firestore.rules:374-396` — requests collection rules (pattern for matchedGillerId check)
  - `src/services/chat-service.ts:377-378` — getUserById for chat participants
  - `src/services/matching-service.ts:391,432,542` — getUserById for giller stats
  - `src/services/user-service.ts:215` — getUserById for own profile

  **Acceptance Criteria**:

  **QA Scenarios:**

  ```
  Scenario: No temporary comment in users rules
    Tool: Bash (grep)
    Steps:
      1. grep "임시" firestore.rules
      2. Assert no match (or count reduced)
    Expected Result: Temporary marker removed
    Evidence: .sisyphus/evidence/task-11-rules-updated.txt
  ```

  **Commit**: YES
  - Message: `fix(rules): restrict users collection list access, keep get access`
  - Files: `firestore.rules`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all changed files for: `as any` (should be reduced from 26), empty catches, console.log in prod, unused imports. Run `npx tsc --noEmit` if possible.
  Output: `Files [N changed] | as any [before: 26, after: N] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Verify matching-auto-retry imports are correct. Verify firestore.indexes.json is valid JSON. Verify firestore.rules syntax. Check no service imports are broken.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — no missing, no creep. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(matching): implement auto-retry Firestore query and composite index` — matching-auto-retry.ts, firestore.indexes.json
- **Wave 2**: `refactor(types): replace as any with typed interfaces across services` — types/*.ts, services/*.ts
- **Wave 3**: `fix(scheduler,rules): load config from Firestore and restrict users read` — functions/src/, firestore.rules
- **Final**: Sign-off after F1-F4 pass

---

## Success Criteria

### Verification Commands
```bash
grep -c "as any" src/services/*.ts | grep -v ":0" | grep -v test   # Expected: significantly reduced
grep "matchingStatus" firestore.indexes.json                        # Expected: present
grep "123-45-67890" functions/src/scheduled/tax-invoice-scheduler.ts  # Expected: no match
grep "임시" firestore.rules                                         # Expected: no match
```

### Final Checklist
- [ ] matching-auto-retry.ts has actual Firestore query
- [ ] as any count reduced from 26 to near 0
- [ ] tax-invoice-scheduler loads from config
- [ ] users read restricted (get only, no list)
- [ ] All "Must NOT Have" absent
- [ ] All evidence files exist
