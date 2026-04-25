# Noor Al-Huda — Backend

Django 5 + DRF API for the Noor Al-Huda Quran-memorization center. Authenticated by `national_id` (custom user model), JWT via SimpleJWT, role-based access enforced inside selectors. Offline-sync endpoints support the encrypted Dexie store on the frontend.

For project-wide context see the root [`README.md`](../README.md). For Django conventions and architectural rules see [`CLAUDE.md`](CLAUDE.md).

## Stack

- Python **3.11**, Django **5.0**, Django REST Framework **3.14**.
- `djangorestframework-simplejwt` (60 min access, 7 day refresh, rotation + blacklist).
- PostgreSQL 16 (production) — SQLite for local dev.
- `drf-spectacular` (OpenAPI / Swagger / ReDoc).
- `reportlab` + `arabic-reshaper` + `python-bidi` for RTL PDF reports.
- `django-cors-headers`, `django-filter`, `django-ratelimit`, `whitenoise`, `cloudinary`.
- Server: `gunicorn` (via `start.sh`).

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=noor_alhuda.settings.local
python manage.py migrate
python manage.py create_default_admin
python manage.py runserver        # http://127.0.0.1:8000
```

Useful endpoints once it's up:

- `/api/schema/swagger-ui/` — interactive API docs.
- `/api/schema/redoc/` — alternative docs.
- `/api/schema/` — raw OpenAPI JSON.
- `/health` — health check.
- `/admin/` — Django admin (use the default-admin credentials).

## Environment variables

| Variable                  | Required                    | Default                          | Notes                                                  |
| ------------------------- | --------------------------- | -------------------------------- | ------------------------------------------------------ |
| `DJANGO_SETTINGS_MODULE`  | yes                         | `noor_alhuda.settings.local`     | `local` / `production` / `docker`                      |
| `SECRET_KEY`              | yes (prod)                  | insecure dev fallback            | 256-bit random in production                           |
| `DEBUG`                   | no                          | `True`                           | Boolean-safe parser; treats unknown strings as `False` |
| `ALLOWED_HOSTS`           | yes (prod)                  | `localhost,127.0.0.1`            | Comma-separated                                        |
| `DATABASE_URL`            | yes (prod)                  | SQLite at `backend/db.sqlite3`   | Parsed via `dj-database-url`                           |
| `CORS_ALLOWED_ORIGINS`    | yes (prod)                  | `[]`                             | Frontend URL(s)                                        |
| `CSRF_TRUSTED_ORIGINS`    | yes (prod)                  | `[]`                             | Frontend URL(s)                                        |
| `OTP_DEV_FALLBACK`        | no                          | `True` (dev) / `False` (prod)    | When `True`, OTP code is logged instead of SMS-sent    |
| `RECORD_PASS_THRESHOLD`   | no                          | `0.8`                            | `achieved/required` ratio for auto-pass inference      |
| `CLOUDINARY_URL`          | optional                    | unset                            | Media CDN                                              |
| `FCM_SERVER_KEY`          | optional                    | unset                            | Future push notifications                              |

## Apps

| App             | Purpose                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `accounts`      | Custom `User` (national_id login, lockout, OTP), `Parent`, `ParentStudentLink`, JWT       |
| `teacher`       | `Teacher` profile (specialization, ring name, session days, course M2M)                  |
| `students`      | `Student` enrollment + profile, today's tasks, review interval, parent linking            |
| `records`       | `WeeklyPlan`, `DailyRecord` (Sat–Thu grid), `ReviewRecord`, `SurahMastery`                |
| `courses`       | `Course` catalog + `StudentCourse` enrollments                                            |
| `evaluations`   | `Evaluation` (scheduled/passed/failed/missed) + `QuizQuestion` authoring (admin-only)     |
| `notifications` | In-app `Notification` (absence/announcement/reminder/report), admin announcements         |
| `reports`       | Dashboard, monthly attendance, leaderboard, per-student PDF (RTL)                         |
| `sync`          | Offline-client `pull` / `push` with `Tombstone` (delete trail) + `IdempotencyKey`         |
| `core`          | `BaseModel` (UUID + timestamps), permission classes, exception handler, health, commands  |

## Architecture

Each domain app follows the same layering — see [`CLAUDE.md`](CLAUDE.md) for the binding rules.

```
models.py        ORM only (UUID PKs, Arabic verbose_name)
selectors/       Pure read functions + row-level RBAC (can_access_<entity>)
services/        Writes and business logic (transaction.atomic)
views/           APIView subclasses, inline serializers, naming <Resource><Action>Api
urls/            Split by domain when the file grows
```

**Permissions** in `core/permissions.py`: `IsAdmin`, `IsTeacher`, `IsStudent`, `IsParent`, `IsAdminOrTeacher`, `IsAdminOrTeacherOrSelf`. Role checks happen on the view; ownership checks happen inside selectors.

**Response envelope** (used everywhere):

```json
{ "success": true, "data": { ... } }
{ "success": false, "errors": { ... } }
```

All user-facing error messages are Arabic.

**Signals** (`records/signals.py`):

- `update_weekly_plan_totals` — `DailyRecord.post_save` aggregates `WeeklyPlan.total_required` and `total_achieved`.
- `infer_daily_record_result` — when `result == "pending"` and attendance is `present` / `late`, auto-set `pass` if `achieved/required ≥ RECORD_PASS_THRESHOLD`, else `fail`.

## API surface

Mounted in `noor_alhuda/urls.py` under `/api/`:

| Prefix                 | Owner          | Examples                                                                       |
| ---------------------- | -------------- | ------------------------------------------------------------------------------ |
| `/api/auth/`           | `accounts`     | `login/`, `token/refresh/`, `logout/`, `otp/send/`, `otp/verify/`, `me/`       |
| `/api/users/`          | `accounts`     | User CRUD, `teachers/`, `teachers/create/`                                     |
| `/api/students/`       | `students`     | List, `create/`, `bulk-create/`, `export/`, `<id>/history/`, `<id>/stats/`, …  |
| `/api/records/`        | `records`      | List, `create/`, `<id>/` (PATCH), `bulk-attendance/`, `weekly-summary/<id>/`   |
| `/api/notifications/`  | `notifications`| List, `<id>/read/`, `read-all/`, `announce/`                                   |
| `/api/reports/`        | `reports`      | `dashboard/`, `attendance/`, `student/<id>/pdf/`, `leaderboard/`               |
| `/api/courses/`        | `courses`      | List, `create/`, `<id>/`, `students/<id>/`, `students/<id>/toggle/`            |
| `/api/evaluations/`    | `evaluations`  | List/create, `<id>/`                                                           |
| `/api/sync/`           | `sync`         | `pull/`, `push/`                                                               |

Use the Swagger UI at `/api/schema/swagger-ui/` for the canonical, generated reference.

## Auth flow

1. **Login** `POST /api/auth/login/` → `{access, refresh, user}`. 5 failed attempts in a row trigger a 30-minute lockout.
2. **Refresh** `POST /api/auth/token/refresh/` rotates the refresh token (old one is blacklisted).
3. **Logout** `POST /api/auth/logout/` blacklists the refresh token.
4. **OTP reset** `POST /api/auth/otp/send/` then `POST /api/auth/otp/verify/`. Codes are stored as SHA-256 hashes with a 10-minute expiry; `OTP_DEV_FALLBACK=True` logs the code instead of sending SMS.
5. **Me** `GET /api/auth/me/` returns the authenticated user with the role-specific profile (teacher / student / parent).

## Sync (offline clients)

The frontend keeps an encrypted Dexie store and reconciles via two endpoints under `/api/sync/`:

- `POST /api/sync/pull/` — fetches deltas since a `since` timestamp.
- `POST /api/sync/push/` — applies a batch of client writes. Each operation carries an `op_id`; the `IdempotencyKey` table makes retries safe.

Server-side deletes write a `Tombstone` row in the same transaction, so offline clients learn about deletions when they next pull.

## Testing

```bash
python manage.py test
```

DRF `APITestCase`-based, hits a real test database — **do not mock the ORM**. Each app has its own `tests.py`. The acceptance matrix (feature IDs `AUTH-01..05`, `STU-01..04`, `REC-01..04`, `NOT-01..03`, `REP-01..04`) lives in [`TEST_CASES.md`](TEST_CASES.md).

## Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

Migrations run automatically in `start.sh` on container boot, so production deploys don't need a manual step.

## Settings

Four modules under `noor_alhuda/settings/`:

- `base.py` — shared (apps, middleware, JWT, throttles, RTL/Arabic, `RECORD_PASS_THRESHOLD`).
- `local.py` — `DEBUG=True`, SQLite, `CORS_ALLOW_ALL_ORIGINS=True`.
- `production.py` — `DEBUG=False`, PostgreSQL via `DATABASE_URL`, HSTS, secure cookies, `OTP_DEV_FALLBACK=False`.
- `docker.py` — used by `docker-compose.yml`.

Selected via `DJANGO_SETTINGS_MODULE`.

## Deployment

`start.sh` is the container entrypoint:

```bash
python manage.py migrate --noinput
python manage.py create_default_admin
gunicorn noor_alhuda.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120
```

Static files are served by WhiteNoise (`CompressedManifestStaticFilesStorage`). Render is the primary deploy target (`render.yaml` at the repo root); `railway.json` and `vercel.json` exist as fallbacks. See [`../DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md) for step-by-step instructions.

## Management commands

- `create_default_admin` — provision the initial admin user (idempotent).
- `seed_e2e` — deterministic admin / teachers / students / courses for E2E.

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for the binding rules: layered architecture, inline serializers in views (no separate `serializers.py`), no `ModelViewSet`, row-level RBAC inside selectors, Arabic-only error messages, and the canonical example files for each pattern.
