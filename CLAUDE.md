# Noor Al-Huda — Project Context

## What this is

Noor Al-Huda is a Quran-memorization center management PWA. It replaces paper-based enrollment, attendance, and memorization tracking with an offline-first digital system for ~300+ students.

- **Backend**: Django 5 + DRF, PostgreSQL, JWT auth.
- **Frontend**: Next.js 16 (App Router) + React 19, TypeScript strict, Tailwind v4.
- **Three user environments**: Director (full oversight), Teacher (daily operations), Student/Parent (personal progress).

## Monorepo layout

```
backend/            Django project (see backend/CLAUDE.md, backend/README.md)
frontend/           Next.js app (see frontend/CLAUDE.md, frontend/README.md)
frontend/e2e/       Playwright end-to-end tests
docker-compose.yml  Local stack
render.yaml         Primary deploy target
Dockerfile          Backend container image
start.sh            Container entrypoint (migrations, default admin, gunicorn)
test_*.js, test_*.py  Ad-hoc scratch scripts, not CI
```

## Cross-cutting rules (apply everywhere)

- **Arabic-first, RTL.** All user-facing strings are hard-coded Arabic. There is no i18n library. Do not introduce English copy in user-visible surfaces (responses, UI, errors).
- **Auth by `national_id`**, not username/email. The custom `User.USERNAME_FIELD` is `national_id`.
- **Timezone**: `Asia/Gaza`. School week: Saturday–Thursday (6 days).
- **Roles**: `admin`, `teacher`, `student`, `parent`. Row-level access is enforced in backend **selectors** (not only permission classes).
- **UUID primary keys** across all domain models.
- **Offline-first frontend.** Pages read/write through dispatchers (`useQuery` / `useMutation`), not `src/lib/api.ts` directly. Local Dexie IndexedDB is the source of truth; the sync runner pushes to and pulls from the server.
- **No secrets in git.** `.mcp.json`, `.env*`, and `.claude/settings.local.json` are in `.gitignore`. If you need to share a token, ask — never commit it.

## Where to read more

- `README.md` — feature list and product overview.
- `DEPLOYMENT_GUIDE.md` — infra and deploy procedure.
- `backend/TEST_CASES.md` — acceptance criteria (AUTH-01, STU-01, REC-01, …).
- `backend/README.md` — backend setup, environment variables, Django app catalog.
- `backend/CLAUDE.md` — Django conventions (selectors/services/views, RBAC, signals).
- `frontend/README.md` — frontend setup, environment variables, structure.
- `frontend/CLAUDE.md` — Next.js conventions (App Router, dispatcher pattern, RTL, styling).

## Deployment

- **Primary**: Render (see `render.yaml`). Auto-deploy on push to `main`.
- **Fallback configs**: `backend/railway.json`, `frontend/vercel.json`.
- **Runtime**: Gunicorn (backend), Next.js standalone (frontend).
- **DB**: PostgreSQL, migrations run on deploy.
- **Media**: Cloudinary (optional).
