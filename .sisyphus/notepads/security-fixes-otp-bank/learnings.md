# Security Fixes - OTP Test Mode & Bank Account Encryption

## Date
2026-04-20

## Task Summary
Fixed two security vulnerabilities in `functions/src/index.ts`:
1. Changed OTP test mode default from 'true' to 'false'
2. Encrypted bank account number in registerTaxInfo function

## Key Learnings

### 1. Security Default Configuration
- **Issue**: OTP_TEST_MODE_PARAM was hardcoded to default: 'true', leaving test mode active in production
- **Fix**: Changed default to 'false' (line 84)
- **Principle**: Security-sensitive features should default to OFF, not ON
- **Pattern**: `defineString('FEATURE_NAME', { default: 'false' })` for security features

### 2. Sensitive Data Encryption Pattern
- **Issue**: Bank account numbers stored in plaintext while resident numbers were encrypted
- **Fix**: Applied same AES-256-GCM encryption pattern to bank account numbers
- **Pattern**:
  ```typescript
  // Import already exists at top of file
  import { encrypt } from './utils/crypto';

  // Encrypt sensitive fields before storage
  const encryptedBankAccountNumber = encrypt(data.bankAccountNumber);

  // Store with "Encrypted" suffix in field name
  bankAccountNumberEncrypted: encryptedBankAccountNumber,
  ```

### 3. Field Naming Convention
- Encrypted fields use `{fieldName}Encrypted` suffix
- Examples: `residentNumberEncrypted`, `bankAccountNumberEncrypted`
- Makes it explicit which fields are encrypted in the database

### 4. Code Location Context
- `functions/src/index.ts` is a 3,800+ line monolith file
- Security fixes should be minimal and surgical
- Verify imports exist before adding new encryption calls
- The `encrypt` function was already imported at line 3767

### 5. Korean Comment Cleanup
- Removed outdated Korean comment about plain-text storage convenience
- Security should never be compromised for "convenience"
- If plaintext is needed for admin viewing, implement proper decryption on read, not plaintext storage

## Verification Approach
- Read target sections before making changes
- Apply surgical edits using Edit tool
- Re-read modified sections to verify changes
- No additional imports needed when functions already imported

## Related Files
- `functions/src/index.ts` - Cloud Functions monolith (3,845 lines)
- `functions/src/utils/crypto.ts` - AES-256-GCM encryption utilities

## Future Considerations
- Consider adding decryption utility for admin viewing of encrypted fields
- Implement field-level access controls for sensitive decrypted data
- Consider adding audit logging for access to encrypted sensitive data
