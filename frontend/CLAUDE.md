# Frontend — Next.js Conventions

See the root `CLAUDE.md` for project-wide rules (Arabic/RTL, `national_id` auth, roles).
For setup and run commands, see `frontend/README.md`.

## Stack

- Next.js **16.2.2** (App Router), React **19.2.4**.
- TypeScript **strict**. Path alias `@/*` → `./src/*`.
- Tailwind CSS **v4** via `@tailwindcss/postcss` (no `tailwind.config.js`; theme is inline `@theme` in `src/app/globals.css`).
- State: **React Context only** (`AuthContext`, `ToastContext`, `NotificationsContext`). **No** Redux / Zustand / React Query / SWR.
- Data layer: **offline-first**. Dexie **4.4.2** (encrypted IndexedDB) + custom dispatcher. See "Offline-first data layer" below.
- Forms: plain React (`useState` + `onChange`). Validation: `src/lib/validators.ts` (discriminated-union helpers, Arabic error messages).
- Styling helpers: `class-variance-authority` (variants), `clsx` + `tailwind-merge` composed into `cn()` (`src/lib/utils.ts`).
- Icons: `lucide-react`.
- Crypto: `bcryptjs` (login UX hash) + Web Crypto API (AES-256 / PBKDF2 for the local DB).
- E2E: Playwright (`frontend/e2e/`). No unit tests currently.
- i18n: none — Arabic strings are hard-coded.

## Directory layout

```
src/
├── app/
│   ├── (dashboard)/                Authenticated pages (route group)
│   │   ├── layout.tsx              ProtectedRoute → LayoutWrapper → ErrorBoundary
│   │   ├── error.tsx               Dashboard error boundary fallback
│   │   ├── page.tsx                Role-split landing
│   │   ├── students/, students-db/, teachers/, courses/, plans/,
│   │   ├── attendance/, reports/, notifications/, leaderboard/,
│   │   ├── student/                Student self-portal (achievements, tasks…)
│   │   └── modals/                 Modal playground/debug page
│   ├── login/                      Unauthenticated pages
│   │   ├── page.tsx                national_id + password
│   │   ├── error.tsx               Login-specific error boundary
│   │   ├── verify-otp/, forgot-password/, reset-password/
│   ├── layout.tsx                  Root: dir="rtl" lang="ar", SW registrar, UpdateNotifier, font
│   └── globals.css                 Tailwind @theme, design tokens, RTL utilities
├── components/
│   ├── ui/                         Primitives: Button, Card, Input, Modal, ConfirmDialog, OTPInput, …
│   ├── auth/                       ProtectedRoute, RoleGate
│   ├── layout/                     LayoutWrapper (sidebar, header, mobile drawer)
│   ├── students/, teachers/, plans/, notifications/, modals/, offline/
│   ├── ServiceWorkerRegistrar.tsx  Manual SW registration
│   ├── UpdateNotifier.tsx          Detects new SW, prompts refresh
│   └── ErrorBoundary.tsx           React error boundary
├── contexts/                       AuthContext, ToastContext, NotificationsContext
├── hooks/
│   ├── queries.ts                  Read dispatcher: QueryKey → repo function (+ depends array)
│   ├── mutations.ts                Write dispatcher: (resource, action) → local upsert + outbox
│   ├── useApi.ts                   useQuery<T>(key, params)
│   ├── useMutation.ts              useMutation(resource, action)
│   └── useDebounce.ts
├── lib/
│   ├── api.ts                      HTTP client — for sync/auth/file-downloads ONLY, not pages
│   ├── validators.ts               Pure validators (requiredString, isoDate, verseRange, …)
│   ├── utils.ts                    cn() helper
│   ├── db/
│   │   ├── schema.ts               Dexie schema (encrypted IndexedDB tables + indexes)
│   │   ├── events.ts               onChange / emitChange per ResourceName
│   │   └── repos/                  Per-table CRUD + aggregates.ts (computed views)
│   └── sync/                       outbox, push, pull, runner
└── types/api.ts                    Shared aggregate/API types
```

Public assets in `frontend/public/`: `sw.js` (service worker), `manifest.json` (PWA), icons.

## Mandatory patterns

- **`"use client"`** on any interactive component.

- **Offline-first data layer.** All page reads/writes go through dispatchers — pages do **not** call `src/lib/api.ts` directly.

- **RBAC**: wrap pages that require a role with `components/auth/RoleGate`. Wrap authenticated routes with `ProtectedRoute` (already done in `(dashboard)/layout.tsx`).

- **RTL**: root layout sets `dir="rtl" lang="ar"`. Use Tailwind **logical** properties — `ps-*` / `pe-*` / `ms-*` / `me-*` — **never** `pl-*` / `pr-*` / `ml-*` / `mr-*`.

- **Styling**: Tailwind utilities composed via `cn()` from `src/lib/utils.ts`. Component variants use `class-variance-authority`. See `src/components/ui/Button.tsx` for the canonical pattern. No CSS modules. Avoid inline `style={{...}}` unless the value is dynamic.

- **Strings**: user-visible text is Arabic, hard-coded. Error messages surfaced from the API are already Arabic — just show them.

- **Imports**: prefer named exports; one default export per file (typical for pages/components).

## Offline-first data layer

This is the architectural center of the frontend. The local Dexie DB is the source of truth for the UI; the network is a background optimization.

### Local DB (`src/lib/db/`)

- Dexie 4.4.2 over IndexedDB. Schema versioned in `schema.ts`.
- All sensitive columns are AES-256 encrypted with a key derived from the user's password via PBKDF2 (Web Crypto). A subset of columns is kept clear for indexing (`updated_at`, `teacher_id`, `date`, `status`).
- Tables: `students`, `teachers`, `courses`, `weekly_plans`, `daily_records`, `review_records`, `evaluations`, `notifications`, `parent_student_links`, `student_courses`, `users`, `auth`, `outbox`.

### Reads — `useQuery`

```ts
const { data, isLoading, error, refetch } = useQuery<Dashboard>("dashboard_stats", { month, year });
```

- Keys live in `src/hooks/queries.ts`. Each entry maps a `QueryKey` to a repo or aggregate function in `src/lib/db/repos/**` and declares `depends: ResourceName[]` — the change events that should trigger a refetch.
- Adding a new key = entry in `QUERIES` + (usually) a function in `src/lib/db/repos/**`. **Never** add a key without `depends`, or the hook won't refetch on mutation.

### Writes — `useMutation`

```ts
const { mutate, isPending, error } = useMutation("students", "create");
await mutate(payload);
```

- Resources/actions live in `src/hooks/mutations.ts` (`handlers` table).
- Every write does:
  1. Optimistic local upsert (via `upsert*` helper in `src/lib/db/repos/**`).
  2. `emitChange(resource)` so subscribed `useQuery`s refetch immediately.
  3. Enqueue an outbox row.
  4. Fire-and-forget `triggerPush()` — does not block the UI.

### Sync runner — `src/lib/sync/runner.ts`

- Drives the push-then-pull loop (push first so local edits land before pull overwrites them).
- Triggers: app boot, `online` event, window focus, 30 s heartbeat (while visible), service-worker `noor-sync-push` background sync.
- In-flight requests are deduplicated.

### `src/lib/api.ts` scope

Allowed callers only:

- `src/lib/sync/**` — push/pull.
- `src/contexts/AuthContext.tsx` — login / logout / `me`.
- `api.downloadBlob(...)` — file downloads (e.g. PDF reports).
- A small set of explicitly-flagged server-side fan-out endpoints (e.g. `/api/notifications/announce/`, `/api/notifications/read-all/`).

Anything else from a page or component is a regression — use the dispatcher.

## Auth

- Login: `national_id` + password → JWT (access + refresh) returned by `/api/auth/login/`.
- Tokens stored in `localStorage` (`access_token`, `refresh_token`). XSS-readable trade-off documented at the top of `src/lib/api.ts`; httpOnly migration is tracked separately.
- Multi-tab refresh sync: `_refresh_ts` timestamp prevents duplicate refresh calls when several tabs hit a 401 simultaneously (`src/lib/api.ts:52–77`).
- Final 401 (after refresh fails): tokens cleared, redirect to `/login?reason=session_expired`.
- 5xx during refresh: tokens kept; the request fails gracefully and the next online attempt retries.

## PWA & service worker

- `public/sw.js` — manual SW. Bump `CACHE_VERSION` (currently `v6`) when SW logic changes; old caches are evicted on activate.
- Cache strategy: cache-first for `/_next/static/*`, network-first for `/api/*`.
- `public/manifest.json` — RTL, `display: standalone`, maskable icons (192/256/384/512).
- Background sync tag: `noor-sync-push` (Chrome/Edge); on Firefox/Safari the runner falls back to the `online` event.
- `ServiceWorkerRegistrar` registers the SW on the client. `UpdateNotifier` listens for waiting SW versions and prompts the user to refresh.

## Forms & validation

- Plain React state. No form library.
- `src/lib/validators.ts` exports pure validators: `requiredString`, `positiveInt`, `nonNegativeInt`, `isoDate`, `isSaturday`, `verseRange`, etc.
- Each returns a discriminated union: `{ ok: true } | { ok: false; error: string }`. Arabic error messages.
- UX validators must match backend validation; the file header lists the corresponding backend rules.

## Styling

- Tailwind v4 inline `@theme` in `globals.css` — no `tailwind.config.js`.
- Design tokens (Figma): semantic colors (primary, secondary, danger, success, surface, border), radii (xs–xl), shadows, status palettes (attendance, results, roles, quality), typography scale (display / h1 / h2 / h3 / large / body / small / micro / tiny), motion easings.
- Font: Noto Kufi Arabic (variable, weights 400–800) loaded from Google Fonts in `app/layout.tsx`.
- Component variants via CVA. Compose classes with `cn()`. See `src/components/ui/Button.tsx` for the canonical pattern.

## Testing

- Playwright E2E under `frontend/e2e/`. Run: `npm run test:e2e`.
- No unit tests currently. Backend `TEST_CASES.md` is the authoritative acceptance matrix.

## Build & deploy

- Next config: `next.config.ts`, `output: "standalone"` (self-contained build), `/api/*` rewrites to `BACKEND_URL`.
- Vercel: `frontend/vercel.json` (`npm install --legacy-peer-deps`, `npm run build`).
- Docker: `frontend/Dockerfile` (Node 20 Alpine, dev mode for local stack).

## Anti-patterns — don't

- Add a new state / form / i18n / data-fetching library.
- Call `fetch()` or `src/lib/api.ts` directly from a page or component — use `useQuery` / `useMutation` so the read subscribes to change events and the write lands in the outbox. (Exceptions: file downloads, auth, the explicitly-flagged fan-out endpoints.)
- Use `pl-*` / `pr-*` / `ml-*` / `mr-*` — RTL breaks. Use `ps-*` / `pe-*` / `ms-*` / `me-*`.
- Hard-code English strings in UI.
- Read or write JWTs outside `src/lib/api.ts`.
- Create a new `useEffect`-based fetch hook when `useQuery` / `useMutation` exist.
- Add a query key without declaring its `depends: ResourceName[]` — the hook won't refetch on mutation otherwise.
- Bump the Dexie schema version without writing an upgrade handler.
- Modify `public/sw.js` without bumping `CACHE_VERSION`.

## Canonical example files

- API client + token lifecycle: `src/lib/api.ts`
- Auth context + multi-tab refresh: `src/contexts/AuthContext.tsx`
- Read dispatcher + hook: `src/hooks/queries.ts`, `src/hooks/useApi.ts`
- Write dispatcher + hook: `src/hooks/mutations.ts`, `src/hooks/useMutation.ts`
- Sync runner: `src/lib/sync/runner.ts`
- Encrypted Dexie schema: `src/lib/db/schema.ts`
- Component + CVA pattern: `src/components/ui/Button.tsx`
- Confirm-on-destructive-action pattern: `src/components/ui/ConfirmDialog.tsx`
- Validators pattern: `src/lib/validators.ts`
- Page pattern: `src/app/(dashboard)/courses/page.tsx`, `src/app/(dashboard)/students/page.tsx`
- Modal pattern: `src/components/modals/CourseModals.tsx`
- Role gate: `src/components/auth/RoleGate.tsx`
