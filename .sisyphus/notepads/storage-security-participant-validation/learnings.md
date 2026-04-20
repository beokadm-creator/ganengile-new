# Firebase Storage Rules - Image Validation Addition

## Date: 2026-04-20

## Changes Made

### 1. Added Missing `isValidImage()` Validation
- **chat-photos/**: Added `isValidImage()` check to write rule (line 72)
  - Before: `allow write: if request.auth != null;`
  - After: `allow write: if request.auth != null && isValidImage();`
- **locker-photos/**: Added `isValidImage()` check to write rule (line 81)
  - Before: `allow write: if request.auth != null;`
  - After: `allow write: if request.auth != null && isValidImage();`

### 2. Added Participant Validation Documentation
- **pickup-photos/**: Added NOTE comment about app-layer participant validation (line 34)
- **delivery-photos/**: Added NOTE comment about app-layer participant validation (line 41)

## Technical Context

### Why Not Firestore Lookups in Storage Rules?
Firebase Storage Security Rules have limited cross-service capabilities compared to Firestore Security Rules. While Firestore rules can use `get()` and `exists()` to query other collections, Storage Rules cannot reliably query Firestore to check participant relationships. This is a fundamental limitation of the Storage Rules engine.

### Best Practice Pattern
```
// NOTE: 참여자 검증은 애플리케이션 레이어에서 수행 필요 (Cloud Storage 규칙에서 Firestore 교차 조회 불가)
match /{path}/{resourceId}/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && isValidImage();
}
```

### Defense in Depth Approach
1. **Storage Rules**: Enforce content type and size limits via `isValidImage()`
2. **Application Layer**: Enforce participant validation before upload
3. **Cloud Functions**: Validate participant relationships server-side (if needed)

## Validation Function
```javascript
function isValidImage() {
  return request.resource.contentType.matches('image/.*')
         && request.resource.size < 10 * 1024 * 1024; // 10MB limit
}
```

## Files Modified
- `storage.rules`: 3 edits (2 documentation comments, 2 validation additions)

## Verification
All photo upload paths now require:
- Authentication (`request.auth != null`)
- Valid image content type (`image/*`)
- Size limit enforcement (< 10MB)
