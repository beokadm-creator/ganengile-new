# Learnings - Secure Toss Client Secret

## 2026-04-20

### Firestore Security Rules
- Firestore security rules do **not** support field-level read restrictions
- When you need to protect sensitive fields (like `secretKey`), you must:
  1. Store them in a separate protected collection (e.g., `admin_settings`)
  2. Set both `allow read: if false` and `allow write: if false` for that collection
  3. Access only via server-side Admin SDK (Cloud Functions)
- Added comprehensive comments to `firestore.rules` explaining this limitation

### TypeScript Interface Safety
- Added explicit warning comment to `PaymentIntegrationConfig` interface
- The comment is tri-directional: warns developers, explains the architectural constraint, and states security implications
- This prevents accidental addition of `secretKey` field to the client-side interface

### TossPaymentService Hardening
- Removed all 4 `(config as any).secretKey` unsafe accesses
- Replaced with explicit error throws that:
  1. Explain why access is blocked (security)
  2. Guide developers to the correct solution (Cloud Functions)
  3. Suggest using test mode for development
- Test mode mocks remain intact for development workflow
- Live API calls will now fail gracefully with clear error messages

### Error Message Pattern
All four methods use consistent error messaging:
- "Toss Payments 라이브 [operation]는 서버를 통해서만 처리할 수 있습니다. 현재 테스트 모드를 사용하세요."
- This pattern:
  - Clearly states what's blocked (live operations)
  - Explains the solution (server-side only)
  - Provides immediate workaround (use test mode)

### Security-First Comments
When adding security-critical comments, follow this pattern:
```typescript
// 보안: [why this restriction exists]
// [architectural guidance]
throw new Error('[clear action]을 서버를 통해서만 처리할 수 있습니다. [workaround]');
```

### File Encoding
- All changes passed `npm run check:encoding` (465 files)
- No encoding issues detected
