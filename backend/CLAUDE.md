
# Backend — Django Conventions

See the root `CLAUDE.md` for project-wide rules (Arabic/RTL, `national_id` auth, UUID PKs, roles).

## Apps and what they own

| App | Owns |
|---|---|
| `accounts` | Custom `User` (national_id login), `Parent` + `ParentStudentLink`, JWT auth, OTP password reset, lockout after 5 failed attempts |
| `students` | `Student` profile (enrollment card fields), teacher assignment, parent link, student-self endpoints (today's tasks, review interval) |
| `teacher` | `Teacher` profile (specialization, ring name, session days, course M2M, affiliation) |
| `courses` | `Course` catalog + `StudentCourse` enrollments |
| `records` | `WeeklyPlan` + `DailyRecord` (Sat–Thu memorization grid), `ReviewRecord`, `SurahMastery` (spaced-repetition state) |
| `evaluations` | `Evaluation` (scheduled tests: scheduled/passed/failed/missed) and `QuizQuestion` (admin-only authoring; student endpoints not yet exposed) |
| `notifications` | In-app `Notification` (types: absence/announcement/reminder/report), read/unread, admin announcements |
| `reports` | Dashboard stats, monthly attendance, leaderboard, per-student PDF export (RTL via `arabic-reshaper` + `python-bidi`) |
| `sync` | Offline-client sync: `Tombstone` (delete trail), `IdempotencyKey` (push replay protection), pull/push endpoints |
| `core` | `BaseModel` (UUID + timestamps), shared permission classes, custom DRF exception handler, health check, default-admin command |

## Layering (non-negotiable for new code)

1. **`models.py`** — ORM only. UUID PKs. Arabic `verbose_name` on fields. No business logic, no queries beyond model methods that are pure.
2. **`selectors/`** — pure read functions. Names: `<entity>_list()`, `<entity>_get()`, `<entity>_<filter>()`. **Row-level RBAC lives here** (e.g., `can_access_student`). See `students/selectors/student_selectors.py`.
3. **`services/`** — all writes and business logic. Wrap multi-step writes in `transaction.atomic`. See `accounts/services/auth_services.py` (`user_login`) for the canonical shape.
4. **`views/`** — `APIView` subclasses only. **No `ModelViewSet`.** Serializers are defined **inline in the view file** (no separate `serializers.py`). Class naming: `<Resource><Action>Api` (e.g., `LoginApi`, `StudentListApi`).
5. **`urls/`** — split by domain when a file grows (e.g., `accounts/urls/auth_urls.py`, `accounts/urls/user_urls.py`).

## Signals

Used for auto-aggregation and inference — don't duplicate the math in views or services.

- `records/signals.py` → `update_weekly_plan_totals`: `DailyRecord` `post_save` aggregates `WeeklyPlan.total_required` and `total_achieved`.
- `records/signals.py` → `infer_daily_record_result`: when `result == "pending"` and attendance is `present` or `late`, auto-sets `result` to `pass` if `achieved/required ≥ RECORD_PASS_THRESHOLD` (default `0.8`, env-overridable), else `fail`. Uses `.update()` to avoid recursion. Teachers can override by explicitly setting `result`.

## Permissions

Use the classes in `core/permissions.py`:

- `IsAdmin`, `IsTeacher`, `IsStudent`, `IsParent`
- `IsAdminOrTeacher`, `IsAdminOrTeacherOrSelf`

Apply at the view (`permission_classes = [IsAdminOrTeacher]`), but always also enforce row-level access **inside the selector** — permission classes check role, selectors check ownership. The selector pattern is `can_access_<entity>(actor, obj)` (admin → full, teacher → assigned students, student → self, parent → linked children via `ParentStudentLink`).

## Response envelope

Follow the shape from `accounts/views/auth_views.py` → `LoginApi`:

```python
{"success": true, "data": {...}}  # on success
{"success": false, "errors": {...}}  # on failure
```

Error messages in responses are **Arabic**.

## Testing

- Acceptance criteria: `backend/TEST_CASES.md`.
- Each app has `tests.py`. Integration tests hit a real test DB — **do not mock the ORM**.

## Settings

Four modules under `noor_alhuda/settings/`:

- `base.py` — shared (apps, middleware, JWT, throttles, RTL/Arabic, `RECORD_PASS_THRESHOLD`).
- `local.py` — `DEBUG=True`, SQLite, `CORS_ALLOW_ALL_ORIGINS=True`.
- `production.py` — `DEBUG=False`, PostgreSQL via `DATABASE_URL`, HSTS, secure cookies, `OTP_DEV_FALLBACK=False`.
- `docker.py` — used by `docker-compose.yml`.

Selected via `DJANGO_SETTINGS_MODULE`. Key env vars: `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `OTP_DEV_FALLBACK`, `RECORD_PASS_THRESHOLD`.

## Infra notes

- Gunicorn + WhiteNoise static serving (`start.sh` runs `migrate` and `create_default_admin` before launching gunicorn).
- PDF export: `reportlab` + `arabic-reshaper` + `python-bidi` (RTL text shaping).
- Rate limits: DRF `ScopedRateThrottle` — login 5/min, OTP 3/min (configured in `REST_FRAMEWORK`).
- API docs: `drf-spectacular` at `/api/schema/swagger-ui/` and `/api/schema/redoc/`.
- URL prefixes mounted in `noor_alhuda/urls.py`: `/api/{auth,users,students,records,notifications,reports,courses,evaluations,sync}/`.

## Anti-patterns — don't

- Put business logic in a view. Move it to a service.
- Skip the selector layer and query inside a view.
- Use `ModelViewSet`.
- Put serializers in a separate `serializers.py` — they go inline in the view file.
- Hard-code English strings in user-facing responses.
- Add `.env` values, tokens, or keys to git (see root `.gitignore`).

## Canonical example files

- Service shape (login, OTP, lockout): `accounts/services/auth_services.py`
- Selector + row-level RBAC: `students/selectors/student_selectors.py`
- Auto-aggregation + result inference signals: `records/signals.py`
- Permission classes: `core/permissions.py`
- API response envelope: `accounts/views/auth_views.py` (`LoginApi`)
- Offline-sync server side: `sync/services/` (`Tombstone`, `IdempotencyKey`, pull/push)
