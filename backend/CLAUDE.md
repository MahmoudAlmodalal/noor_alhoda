# Backend — Django Conventions

See the root `CLAUDE.md` for project-wide rules (Arabic/RTL, `national_id` auth, UUID PKs, roles).

## Apps and what they own

| App | Owns |
|---|---|
| `accounts` | Custom `User`, JWT login, OTP password reset, lockout after 5 failed attempts |
| `students` | `Student` profile (enrollment card fields), teacher assignment, parent link |
| `teacher` | `Teacher` profile, specialization, ring name, course M2M |
| `courses` | `Course` catalog + `StudentCourse` enrollments |
| `records` | `WeeklyPlan` + `DailyRecord` (Sat–Thu memorization grid), `ReviewRecord` |
| `evaluations` | Scheduled tests: pass/fail/missed |
| `notifications` | In-app notifications, read/unread |
| `reports` | Dashboards, attendance/achievement reports, PDF export, honor board |
| `core` | Shared permission classes, custom DRF exception handler, health check |

## Layering (non-negotiable for new code)

1. **`models.py`** — ORM only. UUID PKs. Arabic `verbose_name` on fields. No business logic, no queries beyond model methods that are pure.
2. **`selectors/`** — pure read functions. Names: `<entity>_list()`, `<entity>_get()`, `<entity>_<filter>()`. **Row-level RBAC lives here** (e.g., `can_access_student`). See `students/selectors/student_selectors.py`.
3. **`services/`** — all writes and business logic. Wrap multi-step writes in `transaction.atomic`. See `accounts/services/auth_services.py` (`user_login`) for the canonical shape.
4. **`views/`** — `APIView` subclasses only. **No `ModelViewSet`.** Serializers are defined **inline in the view file** (no separate `serializers.py`). Class naming: `<Resource><Action>Api` (e.g., `LoginApi`, `StudentListApi`).
5. **`urls/`** — split by domain when a file grows (e.g., `accounts/urls/auth_urls.py`, `accounts/urls/user_urls.py`).

## Signals

Used for auto-aggregation — don't duplicate the math in views or services.

- `records/signals.py`: `DailyRecord` `post_save` updates `WeeklyPlan.total_required` and `total_achieved`.

## Permissions

Use the classes in `core/permissions.py`:

- `IsAdmin`, `IsTeacher`, `IsStudent`
- `IsAdminOrTeacher`, `IsAdminOrTeacherOrSelf`

Apply at the view (`permission_classes = [IsAdminOrTeacher]`), but always also enforce row-level access **inside the selector** — permission classes check role, selectors check ownership.

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

## Infra notes

- Gunicorn + WhiteNoise static serving.
- PDF export: `reportlab` + `arabic-reshaper` + `python-bidi` (RTL text shaping).
- Rate limits: `django-ratelimit` — login 5/min, OTP 3/min.
- API docs: `drf-spectacular` at `/api/schema/swagger-ui/`.

## Anti-patterns — don't

- Put business logic in a view. Move it to a service.
- Skip the selector layer and query inside a view.
- Use `ModelViewSet`.
- Put serializers in a separate `serializers.py` — they go inline in the view file.
- Hard-code English strings in user-facing responses.
- Add `.env` values, tokens, or keys to git (see root `.gitignore`).

## Canonical example files

- Service shape: `accounts/services/auth_services.py`
- Selector + RBAC: `students/selectors/student_selectors.py`
- Aggregation signal: `records/signals.py`
- Permission classes: `core/permissions.py`
- API response envelope: `accounts/views/auth_views.py` (`LoginApi`)
