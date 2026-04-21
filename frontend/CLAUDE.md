# Frontend — Next.js Conventions

See the root `CLAUDE.md` for project-wide rules (Arabic/RTL, `national_id` auth, roles).

## Stack

- Next.js **16** (App Router), React **19**.
- TypeScript **strict**. Path alias `@/*` → `./src/*`.
- Tailwind CSS **v4** (via `@tailwindcss/postcss`).
- State: **React Context** (`AuthContext`, `ToastContext`, `NotificationsContext`). **No** Redux / Zustand / React Query.
- Forms: plain React, no form library.
- i18n: none — Arabic strings are hard-coded.
- Icons: `lucide-react`.
- E2E: Playwright (`e2e/`). No unit tests currently.

## Directory layout

```
src/
├── app/
│   ├── (dashboard)/**/page.tsx   Authenticated pages
│   ├── login/                    Unauthenticated pages
│   ├── layout.tsx                Root layout — sets dir="rtl" lang="ar"
│   └── globals.css
├── components/
│   ├── ui/                       Base: Button, Card, Input, Modal, …
│   ├── auth/RoleGate.tsx         Role-based route guard
│   ├── modals/                   Domain modals
│   └── <domain>/                 Domain-specific widgets
├── contexts/                     AuthContext, ToastContext, NotificationsContext
├── hooks/
│   ├── queries.ts                Read dispatcher: QueryKey → repo function
│   ├── mutations.ts              Write dispatcher: (resource, action) → local upsert + outbox
│   ├── useApi.ts                 useQuery<T>(key, params) hook (+ legacy useApi alias)
│   ├── useMutation.ts            useMutation(resource, action) hook
│   └── useDebounce.ts
├── lib/
│   ├── api.ts                    HTTP client — used by sync/auth/file-downloads, NOT pages
│   ├── db/
│   │   ├── schema.ts             Dexie schema (encrypted IndexedDB tables)
│   │   ├── events.ts             onChange/emitChange per ResourceName
│   │   └── repos/                Per-table CRUD + aggregates.ts (computed views)
│   ├── sync/                     outbox, push, pull, runner
│   └── utils.ts                  cn() (clsx + tailwind-merge)
└── types/api.ts                  Shared aggregate/API types (Dashboard/Student/Weekly… shapes)
```

## Mandatory patterns

- **`"use client"`** on any interactive component.
- **Offline-first data layer**: all reads and writes go through the dispatcher pattern. Pages do **not** call `src/lib/api.ts` directly.
  - **Reads**: `useQuery<T>("<key>", params)` from `@/hooks/useApi`. Keys live in `src/hooks/queries.ts` — each entry maps to a repo/aggregate function and declares which `ResourceName` change events trigger a refetch. Adding a key = entry in `QUERIES` + (usually) a function in `src/lib/db/repos/**`.
  - **Writes**: `useMutation("<resource>", "<action>")` from `@/hooks/useMutation`, then call `mutate(payload)`. Resources/actions live in `src/hooks/mutations.ts`. Every write does an optimistic local upsert, enqueues an outbox op, and fires-and-forgets `triggerPush`. Adding a resource = entry in the `handlers` table + (usually) an `upsert*` helper in `src/lib/db/repos/**`.
- **`src/lib/api.ts` scope**: only `src/lib/sync/**` (push/pull), `AuthContext` (login/logout), `api.downloadBlob(...)` for file downloads (PDFs), and explicitly-flagged server-side fan-out endpoints (e.g. `/api/notifications/announce/`, `/api/notifications/read-all/`). Anything else from a page/component is a regression — use the dispatcher.
- **RBAC**: wrap pages that require a role with `components/auth/RoleGate`.
- **RTL**: root layout sets `dir="rtl" lang="ar"`. Use Tailwind **logical** properties — `ps-*` / `pe-*` / `ms-*` / `me-*` — **never** `pl-*` / `pr-*` / `ml-*` / `mr-*`.
- **Styling**: Tailwind utilities composed via `cn()` from `src/lib/utils.ts`. Component variants use `class-variance-authority`. See `src/components/ui/Button.tsx` for the canonical pattern. No CSS modules. Avoid inline `style={{...}}` unless the value is dynamic.
- **Strings**: user-visible text is Arabic, hard-coded. Error messages surfaced from the API are already Arabic — just show them.
- **Imports**: prefer named exports; one default export per file (typical for pages/components).

## Lint

- `npm run lint` — ESLint flat config, extends `next/core-web-vitals` + `next/typescript`.
- No Prettier, no pre-commit hooks.

## Anti-patterns — don't

- Add a new state/form/i18n/data-fetching library.
- Call `fetch()` or `src/lib/api.ts` directly from a page/component — use `useQuery`/`useMutation` so the write lands in the outbox and the read subscribes to change events. (Exceptions: file downloads, auth, explicitly-flagged fan-out endpoints.)
- Use `pl-*` / `pr-*` — RTL breaks. Use `ps-*` / `pe-*`.
- Hard-code English strings in UI.
- Read/write JWTs outside `src/lib/api.ts`.
- Create a new `useEffect`-based fetch hook when `useQuery` / `useMutation` exist.
- Add a query key without declaring its `depends: ResourceName[]` — the hook won't refetch on mutation otherwise.

## Canonical example files

- API client: `src/lib/api.ts`
- Read dispatcher + hook: `src/hooks/queries.ts`, `src/hooks/useApi.ts`
- Write dispatcher + hook: `src/hooks/mutations.ts`, `src/hooks/useMutation.ts`
- Component + CVA pattern: `src/components/ui/Button.tsx`
- Page pattern: `src/app/(dashboard)/courses/page.tsx`, `src/app/(dashboard)/students/page.tsx`
- Modal pattern: `src/components/modals/CourseModals.tsx`
- Role gate: `src/components/auth/RoleGate.tsx`
