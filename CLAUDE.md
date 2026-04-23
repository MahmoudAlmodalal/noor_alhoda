# Noor Al-Huda — Project Context

## What this is

Noor Al-Huda is a Quran-memorization center management PWA. It replaces paper-based enrollment, attendance, and memorization tracking with a digital system for ~300+ students.

- **Backend**: Django 5 + DRF, PostgreSQL, JWT auth.
- **Frontend**: Next.js 16 (App Router) + React 19, TypeScript strict, Tailwind v4.
- **Three user environments**: Director (full oversight), Teacher (daily operations), Student/Parent (personal progress).

## Monorepo layout

```
backend/            Django project (see backend/CLAUDE.md)
frontend/           Next.js app (see frontend/CLAUDE.md)
docker-compose.yml  Local stack
render.yaml         Primary deploy target
start.sh            Container entrypoint
test_*.js, test_*.py  Ad-hoc scratch scripts, not CI
```

## Cross-cutting rules (apply everywhere)

- **Arabic-first, RTL.** All user-facing strings are hard-coded Arabic. There is no i18n library. Do not introduce English copy in user-visible surfaces (responses, UI, errors).
- **Auth by `national_id`**, not username/email. The custom `User.USERNAME_FIELD` is `national_id`.
- **Timezone**: `Asia/Gaza`. School week: Saturday–Thursday (6 days).
- **Roles**: `admin`, `teacher`, `student`, `parent`. Row-level access is enforced in backend **selectors** (not only permission classes).
- **UUID primary keys** across all domain models.
- **No secrets in git.** `.mcp.json`, `.env*`, and `.claude/settings.local.json` are in `.gitignore`. If you need to share a token, ask — never commit it.

## Where to read more

- `README.md` — feature list and product overview.
- `DEPLOYMENT_GUIDE.md` — infra and deploy procedure.
- `backend/TEST_CASES.md` — acceptance criteria (AUTH-01, STU-01, REC-01, …).
- `backend/CLAUDE.md` — Django conventions (selectors/services/views, RBAC, signals).
- `frontend/CLAUDE.md` — Next.js conventions (App Router, `api.ts`, RTL, styling).

## Deployment

- **Primary**: Render (see `render.yaml`). Auto-deploy on push to `main`.
- **Fallback configs**: `backend/railway.json`, `frontend/vercel.json`.
- **Runtime**: Gunicorn (backend), Next.js standalone (frontend).
- **DB**: PostgreSQL, migrations run on deploy.
- **Media**: Cloudinary (optional).
