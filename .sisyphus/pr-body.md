## Summary

온보딩 시 한국 법령에 맞는 동의 항목(9개: 필수 6 + 선택 3)을 관리자에서 CRUD + 버전 관리하고, 앱에서 Firestore에서 동적으로 로드하여 사용자 동의를 버전과 함께 이력 관리하는 전체 시스템을 구현합니다.

## Changes

### Types and Service Layer
- src/types/consent.ts - ConsentKey enum (9 items), ConsentCategory, interfaces
- src/types/user.ts - consentHistory field added
- src/services/consent-service.ts - Firestore load, consent history save, fallback items

### Admin API
- admin-web/app/api/admin/consents/ - CRUD endpoints with version history archiving
- admin-web/lib/consent-types.ts - Admin-side type definitions

### Admin UI
- admin-web/app/(admin)/consents/page.tsx - Consent management page with required/optional sections, CRUD form, version history
- admin-web/components/Sidebar.tsx - Added consent management menu entry

### App Screens
- BasicInfoOnboarding.tsx - Dynamic consent loading with ConsentItemRow and version tracking
- NewSignUpScreen.tsx - Dynamic consent loading with ConsentItemRow

### Infrastructure
- firestore.rules - consentTemplates read rule for authenticated users
- scripts/seed-consent-templates.ts - Initial 9 consent items seed script
- package.json - seed:consents npm script

## Legal Basis (Korean Law)

- 서비스 이용약관: 전자상거래법 Section 26
- 개인정보 수집 및 이용: 개인정보보호법 Section 15, 22
- 개인정보처리방침: 개인정보보호법 Section 30
- 제3자 정보제공: 개인정보보호법 Section 17
- 위치정보 이용약관: 위치정보법 Section 6
- 만 14세 이상 확인: 정보통신망법 Section 44-5
- 마케팅 정보 수신 (선택): 정보통신망법 Section 50
- 광고성 정보 수신 (선택): 정보통신망법 Section 50
- 야간 광고성 정보 (선택): 정보통신망법 Section 50-2

## Post-Merge Steps
1. Firestore rules already deployed
2. Admin web auto-deploys via App Hosting on main merge
3. Create 9 consent templates via admin UI or run npm run seed:consents with .env configured

## Test Plan
- [ ] Admin consent CRUD works (create, edit, delete)
- [ ] Version changes archive previous version in history
- [ ] App onboarding loads consent templates dynamically from Firestore
- [ ] Required consent items block progression when not agreed
- [ ] Consent history saved to users collection with version tracking
