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
│   ├── useApi.ts                 GET wrapper → { data, isLoading, error, refetch }
│   ├── useMutation.ts            POST/PATCH/DELETE wrapper
│   └── useDebounce.ts
├── lib/
│   ├── api.ts                    THE single API client
│   └── utils.ts                  cn() (clsx + tailwind-merge)
└── types/api.ts                  All shared TS interfaces
```

## Mandatory patterns

- **`"use client"`** on any interactive component.
- **API**: everything goes through `src/lib/api.ts` (`api.get/post/patch/delete/downloadBlob/login/logout/me`). Do **not** call `fetch()` directly. It handles JWT in localStorage, automatic 401 refresh, and Arabic error extraction.
- **Data fetching**: `useApi()` for reads, `useMutation()` (see `src/hooks/useMutation.ts`) for writes. Don't handroll `useEffect` + `fetch`.
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
- Call `fetch()` directly — go through `src/lib/api.ts`.
- Use `pl-*` / `pr-*` — RTL breaks. Use `ps-*` / `pe-*`.
- Hard-code English strings in UI.
- Read/write JWTs outside `src/lib/api.ts`.
- Create a new `useEffect`-based fetch hook when `useApi` / `useMutation` exist.

## Canonical example files

- API client: `src/lib/api.ts`
- Mutation hook: `src/hooks/useMutation.ts`
- Component + CVA pattern: `src/components/ui/Button.tsx`
- Page pattern: `src/app/(dashboard)/courses/page.tsx`
- Role gate: `src/components/auth/RoleGate.tsx`
