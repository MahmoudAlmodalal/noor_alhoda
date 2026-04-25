# Noor Al-Huda — Frontend

Offline-first, Arabic-first PWA for the Noor Al-Huda Quran-memorization center. Built with Next.js 16 App Router, React 19, and an encrypted Dexie IndexedDB layer that keeps the app fully usable when the network is gone.

For project-wide context see the root [`README.md`](../README.md). For conventions and architectural rules see [`CLAUDE.md`](CLAUDE.md).

## Stack

- **Next.js** 16.2.2 (App Router) with `output: "standalone"`.
- **React** 19.2.4, TypeScript strict.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (theme inline in `src/app/globals.css`).
- **Dexie** 4.4.2 — encrypted IndexedDB (AES-256, PBKDF2 from password).
- **CVA + clsx + tailwind-merge** for component variants and class composition.
- **bcryptjs** + Web Crypto for client-side hashing and key derivation.
- **lucide-react** for icons.
- **Playwright** for E2E tests (no unit tests yet).

## Quick start

```bash
npm install --legacy-peer-deps
npm run dev        # http://localhost:3000
```

The dev server proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8000`). Run the Django backend separately — see the root README.

## Scripts

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `npm run dev`      | Next.js dev server                                    |
| `npm run build`    | Production build (`next build --webpack`, standalone) |
| `npm run start`    | Run the production build                              |
| `npm run lint`     | ESLint (flat config, `next/core-web-vitals`)          |
| `npm run test:e2e` | Playwright E2E tests in `e2e/`                        |

## Environment variables

| Variable              | Required        | Default                  | Purpose                                      |
| --------------------- | --------------- | ------------------------ | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | yes (client)    | `http://127.0.0.1:8000`  | Backend URL for the browser                  |
| `BACKEND_URL`         | yes (server)    | falls back to public URL | `/api/*` rewrite target in `next.config.ts`  |

Local dev typically only needs `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`.

## Project structure

```
src/
├── app/
│   ├── (dashboard)/        Authenticated routes (ProtectedRoute layout)
│   │   ├── error.tsx       Error boundary fallback
│   │   ├── students/, teachers/, courses/, plans/, attendance/,
│   │   ├── reports/, notifications/, leaderboard/,
│   │   └── student/        Student self-portal
│   ├── login/              Unauthenticated routes (login, OTP, reset)
│   ├── layout.tsx          Root layout: dir="rtl" lang="ar", SW, font
│   └── globals.css         Tailwind @theme + design tokens
├── components/
│   ├── ui/                 Button, Card, Input, Modal, ConfirmDialog, …
│   ├── auth/               ProtectedRoute, RoleGate
│   ├── layout/             LayoutWrapper (sidebar, header)
│   ├── students/, teachers/, plans/, notifications/, modals/, offline/
│   ├── ServiceWorkerRegistrar.tsx, UpdateNotifier.tsx, ErrorBoundary.tsx
├── contexts/               AuthContext, ToastContext, NotificationsContext
├── hooks/
│   ├── queries.ts          Read dispatcher: QueryKey → repo function
│   ├── mutations.ts        Write dispatcher: optimistic upsert + outbox
│   ├── useApi.ts, useMutation.ts, useDebounce.ts
├── lib/
│   ├── api.ts              HTTP client (sync/auth/blob downloads only)
│   ├── validators.ts       Pure validators (Arabic error messages)
│   ├── utils.ts            cn() helper
│   ├── db/                 Dexie schema, change events, repos/, aggregates
│   └── sync/               outbox, push, pull, runner
└── types/api.ts            Shared aggregate / API types

public/
├── sw.js                   Service worker (CACHE_VERSION-bumped manually)
├── manifest.json           PWA manifest (RTL, standalone)
└── icons/                  192/256/384/512 maskable icons

e2e/                        Playwright tests
```

## Key concepts

Full details are in [`CLAUDE.md`](CLAUDE.md); this is a cheat-sheet.

### Offline-first dispatcher pattern

Pages do **not** call `fetch()` or `src/lib/api.ts`. They use:

```ts
// Read
const { data, isLoading } = useQuery<Dashboard>("dashboard_stats", { month, year });

// Write
const { mutate, isPending } = useMutation("students", "create");
await mutate(payload);
```

Reads come from Dexie via the function registered in `src/hooks/queries.ts`. Writes do an optimistic local upsert, enqueue an outbox row, and fire-and-forget `triggerPush()`. The sync runner reconciles with the server in the background (boot, online, focus, 30 s heartbeat, SW background sync).

### RTL and Arabic

The root layout sets `dir="rtl" lang="ar"`. Use Tailwind **logical** properties — `ps-*` / `pe-*` / `ms-*` / `me-*`. Never use `pl-*` / `pr-*`. All user-visible copy is Arabic; there is no i18n library.

### PWA and service worker

`public/sw.js` precaches the shell and uses cache-first for `_next/static`, network-first for `/api`. Bump `CACHE_VERSION` whenever the SW changes. `UpdateNotifier` prompts the user to refresh when a new version is waiting. `manifest.json` declares the app as standalone with maskable icons.

## Build and deploy

- Output: `output: "standalone"` produces a self-contained build under `.next/standalone/`.
- Vercel: configured via `vercel.json` (`npm install --legacy-peer-deps`, `npm run build`).
- Docker: `Dockerfile` runs the dev server (Node 20 Alpine); used by `docker-compose.yml`.

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for the binding rules: dispatcher pattern, RTL logical properties, Arabic-only copy, no new state / form / data-fetching libraries, no direct `fetch` from pages, and the canonical example files for each pattern.
