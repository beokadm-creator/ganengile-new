## State Management Analysis - Zustand + React Context (ganengile-new)
Date: 2026-04-20

### Key findings
- Zustand store present: /Users/aaron/Developer/personal/ganengile-new/src/screens/main/create-request/store/useCreateRequestStore.ts
  - Uses zustand 'create' pattern to hold a large CreateRequestState (lines show import and store creation).
  - The store is quite large, with many fields for steps, draft, and AI quotes. Potential risk: broad re-renders if selectors are not used.
  - Notable: setActiveStep includes transitionLockUntil and LayoutAnimation for web/android, showing careful UI transitions (lines ~17-21 and 189-206).
- React Contexts used for core app state: AuthContext, ThemeContext, RouteContext, UserContext
  - AuthContext.tsx uses onAuthStateChanged and unsubscribes on cleanup (lines 25-32 and 39-41).
  - ThemeContext.tsx uses ThemeProvider with AsyncStorage persistence and animated color changes (lines 6-9, 34-39, 96-115).
  - RouteContext.tsx caches routes in AsyncStorage with TTL and versioning to manage offline-first data (lines 6-12, 30-36, 39-47, 117-135).
  - UserContext.tsx handles user state, role resolution, and persistence with AsyncStorage and Firestore interactions (lines 12-21, 96-103, 177-188, 312-329).
- Derived/computed state patterns
  - Theme: colorScheme derives isDark and colors from stored scheme (ThemeContext.tsx lines 72-79).
  - User: currentRole derived from user data and persisted role (UserContext.tsx lines 34-41, 177-189).
- Potential anti-patterns or risks
  - Large store in useCreateRequestStore.ts could cause over-rendering if consumers don’t use selectors; consider splitting into smaller slices or memoized selectors (store at /src/screens/main/create-request/store/useCreateRequestStore.ts).
  - Console logging inside zustand actions (lines 189) could leak into production; consider removing or gating with __DEV__.
  - useCreateRequestStore hydrates from drafts with many fields; ensure type safety across hydrateFromDraft/hydrateFromPrefill (lines 259-344).
- Memory leak considerations
  - Subscriptions in AuthContext and Firestore reads are cleaned up; Route/User contexts implement careful asynchronous flows with caching and guards; memoryLeakPrevention utilities are present in project (src/utils/memory-leak-prevention.tsx) for safer patterns.

### Recommendations (high level)
- Consider breaking down useCreateRequestStore into smaller slices with selective selectors to minimize re-render, e.g., separate item info, address, and shipping details into dedicated stores or slices.
- Audit console.log statements in production paths; remove or guard behind DEV flag.
