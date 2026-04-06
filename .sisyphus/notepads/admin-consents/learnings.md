# Admin Consents - Learnings

## 2026-04-06: Design Patterns Extracted

### Confirmed Design Tokens (from dashboard + disputes pages)
- Page bg: `bg-stone-50` (both dashboard and disputes use this)
- Cards: `rounded-[24px] bg-white p-5 shadow-sm` (stats) / `p-6 shadow-sm` (content)
- Dark header: `rounded-[28px] bg-[#0f172a] px-7 py-8 text-white shadow-sm`
- White header: `rounded-[28px] bg-white p-6 shadow-sm`
- Empty/loading: `rounded-[24px] bg-white p-16 text-center text-sm text-slate-400 shadow-sm`
- Table wrapper: `overflow-x-auto rounded-[24px] border border-slate-100 bg-white shadow-sm`
- Modal overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4`
- Modal content: `w-full max-w-3xl rounded-[24px] bg-white p-6 shadow-2xl`
- Section labels: `text-xs font-semibold uppercase tracking-[0.2em] text-slate-400`
- Section titles: `mt-2 text-xl font-bold text-slate-900` or `text-2xl font-bold`
- Badges: `inline-flex rounded-full bg-{color}-100 px-2 py-1 text-xs font-semibold text-{color}-700`

### shadcn/ui Components Available
- `Badge` from `@/components/ui/badge` - variants: default, secondary, destructive, outline, ghost, link
- `Button` from `@/components/ui/button` - variants: default, outline, secondary, ghost, destructive, link; sizes: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg
- NOTE: Badge uses `@base-ui/react` merge-props and use-render - check compatibility
- NOTE: Button uses `@base-ui/react/button` - check compatibility with onClick handlers

### API Endpoints
- `GET /api/admin/consents` → `{ items: ConsentTemplateItem[] }`
- `POST /api/admin/consents` → body: ConsentFormData → `{ ok: true, id: string }`
- `PATCH /api/admin/consents/[id]` → body: Partial<ConsentFormData> → `{ ok: true }`
- `DELETE /api/admin/consents/[id]` → `{ ok: true }`
- `GET /api/admin/consents/[id]/versions` → `{ items: ConsentVersionItem[] }`

### Types (from admin-web/lib/consent-types.ts)
- ConsentKey enum (9 keys)
- ConsentCategory enum (REQUIRED, OPTIONAL)
- CONSENT_KEY_LABELS
- CONSENT_LEGAL_BASIS
- ConsentTemplateItem, ConsentVersionItem, ConsentFormData interfaces

### Formatting
- Use `formatDate` from `@/lib/format` for all date display
- formatDate handles Firestore Timestamp, ISO string, Date objects
