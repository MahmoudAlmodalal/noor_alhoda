# Noor Al-Huda

**Noor Al-Huda** (نور الهدى) is an offline-first, Arabic-first PWA that replaces the paper workflow at a Quran-memorization center serving ~300 students. It tracks daily attendance, weekly memorization plans, evaluations, and reports across three role-specific environments — director, teacher, and student / parent.

> **Status:** Active development. School week is Saturday–Thursday (six days). Timezone: `Asia/Gaza`.

---

## Features

### Director (`admin`)
- Full center oversight: dashboard with student / teacher / circle counts and recent activity.
- Student CRUD + bulk import + Excel export.
- Teacher CRUD, ring assignment, course catalog management.
- Monthly attendance reports, leaderboard (top achievers), per-student PDF reports (RTL-shaped Arabic).
- Center-wide announcements that fan out to filtered recipients.

### Teacher
- Daily 1-tap bulk attendance for assigned students (Sat–Thu).
- Weekly memorization grid: required vs. achieved verses, surah, quality, auto-inferred pass / fail per day.
- Student detail with full memorization history and review tracking.
- Schedule and grade evaluations (scheduled / passed / failed / missed).
- 7-day edit window on records (admin override beyond that).

### Student / Parent
- Personal weekly plan, today's tasks, achievements feed.
- Attendance history and per-surah review schedule (spaced repetition via `SurahMastery`).
- Parents see linked children via `ParentStudentLink` (one parent ↔ many children).
- In-app notifications: absences, reminders, announcements.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (PWA)                             │
│                                                                │
│   React 19 ──▶ useQuery / useMutation (dispatchers)           │
│      │              │                                          │
│      │              ▼                                          │
│      │      Dexie (encrypted IndexedDB)  ◀── source of truth  │
│      │              │                                          │
│      │              ▼                                          │
│      │      outbox  ──▶  sync runner (push → pull)            │
│      │                          │                              │
│      └─ AuthContext / api.ts ───┤                              │
│                                  ▼                              │
│   Service Worker (offline shell, background sync)              │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS, JWT (Bearer)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Django + DRF (Gunicorn)                   │
│                                                                │
│   /api/{auth, users, students, records, notifications,        │
│         reports, courses, evaluations, sync}/                 │
│                                                                │
│   models  →  selectors (RBAC)  →  services  →  views          │
│                              │                                 │
│                              ▼                                 │
│                       PostgreSQL                               │
└──────────────────────────────────────────────────────────────┘
```

Pages never call the network directly — they read from Dexie via `useQuery` and write via `useMutation`. The sync runner reconciles with the Django API in the background; the UI keeps working when offline.

---

## Tech stack

| Layer    | Tech                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| Frontend | Next.js 16.2.2 (App Router), React 19.2.4, TypeScript strict, Tailwind v4       |
| Offline  | Dexie 4.4.2 (encrypted IndexedDB), Web Crypto (AES-256 + PBKDF2), Service Worker |
| Backend  | Python 3.11, Django 5, DRF 3.14, SimpleJWT 5.3, drf-spectacular                 |
| Auth     | JWT (60 min access, 7 day refresh, rotation + blacklist) keyed by `national_id` |
| Database | PostgreSQL 16 (production); SQLite (local dev fallback)                         |
| PDF / RTL | `reportlab` + `arabic-reshaper` + `python-bidi`                                |
| Hosting  | Render (primary), Vercel (frontend), Cloudinary (media, optional)               |
| Tests    | Django `APITestCase` (per app) + Playwright E2E (`frontend/e2e/`)               |

---

## Repository layout

```
backend/                Django 5 project (10 local apps)
  ├── accounts/          Custom User (national_id), Parent, JWT, OTP
  ├── teacher/           Teacher profile, ring assignments
  ├── students/          Student enrollment, profile, history
  ├── records/           WeeklyPlan, DailyRecord, ReviewRecord, SurahMastery
  ├── courses/           Course catalog, StudentCourse enrollments
  ├── evaluations/       Scheduled tests + future quiz authoring
  ├── notifications/     In-app notifications, announcements
  ├── reports/           Dashboards, PDF exports, leaderboard
  ├── sync/              Offline-client pull/push (Tombstone, IdempotencyKey)
  └── core/              BaseModel, permissions, exception handler, health
frontend/               Next.js 16 PWA (App Router)
  ├── src/app/           Routes (login, (dashboard)/*)
  ├── src/components/    UI primitives + domain widgets + modals
  ├── src/lib/           api.ts, db/ (Dexie), sync/, validators.ts
  ├── src/hooks/         useQuery / useMutation dispatchers
  └── e2e/               Playwright tests
docker-compose.yml      Local stack (Postgres + backend + frontend)
Dockerfile              Backend container image
render.yaml             Primary deploy config (Render)
start.sh                Container entrypoint (migrate + create_default_admin + gunicorn)
DEPLOYMENT_GUIDE.md     Step-by-step deploy procedure
backend/TEST_CASES.md   Acceptance criteria matrix (AUTH-01, STU-01, …)
```

For per-area conventions see [`backend/CLAUDE.md`](backend/CLAUDE.md), [`frontend/CLAUDE.md`](frontend/CLAUDE.md), and the project-wide [`CLAUDE.md`](CLAUDE.md).

---

## Local development

### Prerequisites

- **Docker** path: Docker + Docker Compose (recommended).
- **Native** path: Python 3.11, Node.js 20, PostgreSQL 16 (or SQLite for quick dev).

### Path A — Docker (recommended)

```bash
docker compose up --build
```

This starts:

- `db` — PostgreSQL 16 on port 5432.
- `backend` — Django + Gunicorn on `http://localhost:8000` using `noor_alhuda.settings.docker`.
- `frontend` — Next.js dev server on `http://localhost:3000`.

The first run applies migrations and creates a default admin (see [`backend/core/management/commands/create_default_admin.py`](backend/core/management/commands/create_default_admin.py) for credentials).

### Path B — Native

**Backend:**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=noor_alhuda.settings.local
python manage.py migrate
python manage.py create_default_admin
python manage.py runserver  # http://127.0.0.1:8000
```

**Frontend:**

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev  # http://localhost:3000
```

The frontend rewrites `/api/*` to `BACKEND_URL` (defaults to `http://127.0.0.1:8000`).

### Default admin and seed data

- `python manage.py create_default_admin` — creates the initial admin user.
- `python manage.py seed_e2e` — deterministic admin / teachers / students / courses for E2E (see `backend/core/management/commands/seed_e2e.py`).

---

## Environment variables

### Backend

| Variable                  | Required | Default                   | Notes                                          |
| ------------------------- | -------- | ------------------------- | ---------------------------------------------- |
| `DJANGO_SETTINGS_MODULE`  | yes      | `noor_alhuda.settings.local` | `local` / `production` / `docker`           |
| `SECRET_KEY`              | prod     | dev fallback              | 256-bit random in production                   |
| `DATABASE_URL`            | prod     | SQLite locally            | Parsed by `dj-database-url`                    |
| `ALLOWED_HOSTS`           | prod     | `localhost,127.0.0.1`     | Comma-separated                                |
| `CORS_ALLOWED_ORIGINS`    | prod     | `[]`                      | Frontend URL(s)                                |
| `CSRF_TRUSTED_ORIGINS`    | prod     | `[]`                      | Frontend URL(s)                                |
| `OTP_DEV_FALLBACK`        | no       | `True` (dev) / `False` (prod) | When `True`, OTP is logged instead of sent |
| `RECORD_PASS_THRESHOLD`   | no       | `0.8`                     | `achieved/required` ratio for auto pass        |
| `CLOUDINARY_URL`          | no       | unset                     | Optional media CDN                             |
| `FCM_SERVER_KEY`          | no       | unset                     | Optional push notifications                    |

### Frontend

| Variable                  | Required | Default                  | Notes                                       |
| ------------------------- | -------- | ------------------------ | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`     | yes      | `http://127.0.0.1:8000`  | Public backend URL (client + SSR fallback)  |
| `BACKEND_URL`             | server   | `NEXT_PUBLIC_API_URL`    | Server-side rewrite target                  |

---

## Testing

```bash
# Backend — DRF APITestCase per app, hits a real test DB
cd backend && python manage.py test

# Frontend — Playwright end-to-end
cd frontend && npm run test:e2e
```

Acceptance criteria are tracked in [`backend/TEST_CASES.md`](backend/TEST_CASES.md) by feature ID (AUTH-01..05, STU-01..04, REC-01..04, NOT-01..03, REP-01..04).

---

## Deployment

Primary target: **Render**. The repository's `render.yaml` defines a Docker web service that runs `start.sh` (migrations → default admin → Gunicorn). Auto-deploy is wired to pushes on `main`.

Frontend ships to **Vercel** via `frontend/vercel.json` (`npm install --legacy-peer-deps`, `npm run build`, standalone output).

For step-by-step infra notes see [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

---

## Conventions and where to read more

- [`CLAUDE.md`](CLAUDE.md) — cross-cutting rules (RTL, `national_id` auth, UUID PKs, offline-first).
- [`backend/CLAUDE.md`](backend/CLAUDE.md) — Django layering (models → selectors → services → views), permissions, signals.
- [`backend/README.md`](backend/README.md) — backend setup, environment variables, app catalog.
- [`frontend/CLAUDE.md`](frontend/CLAUDE.md) — App Router conventions, dispatcher pattern, RTL, styling.
- [`frontend/README.md`](frontend/README.md) — frontend setup and structure.
- [`backend/TEST_CASES.md`](backend/TEST_CASES.md) — acceptance test matrix.

### Cross-cutting rules at a glance

- **Arabic-first, RTL** — all user-facing strings are hard-coded Arabic; no i18n library.
- **Auth keyed by `national_id`** — not username, not email, not phone.
- **UUID primary keys** across all domain models.
- **Roles**: `admin`, `teacher`, `student`, `parent`. Row-level access enforced inside selectors, not only on permission classes.
- **Offline-first frontend** — pages go through `useQuery` / `useMutation`, never `fetch()` or `api.ts` directly.
- **No secrets in git** — `.env*`, `.mcp.json`, and `.claude/settings.local.json` are gitignored.
