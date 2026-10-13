# Evaluation, saving and student workload fixes

Implemented in the existing Django/DRF services and Next.js/Dexie application. No production database was connected or changed.

## Confirmed causes

- **Saving stalled in the shared mutation path:** the IndexedDB transaction wrapped the whole mutation in `Dexie.waitFor`, including IndexedDB operations. Native asynchronous continuations were also hidden behind a non-async transaction callback. Browser reproduction failed before any sync POST. The corrected transaction uses an explicit async scope, and keeps it alive only while Web Crypto runs. Domain writes and outbox enqueue remain atomic.
- **Misleading save feedback:** the common hook announced success after a local write; sync HTTP 200 can still contain validation errors, permission errors, or conflicts for individual operations. Attendance also announced success before checking the push result and did not protect its entire save path with `finally`.
- **Historical evaluation validation:** `created_by` permits database NULL but does not permit blank form validation. Calling unrestricted `full_clean()` rejected historical rows with a missing/deleted creator. Updating a grade also normalized a historical scheduled day unnecessarily. The update service preserves these immutable historical fields while still validating editable fields and ownership.
- **JSON validation mismatch:** sync supplies JSON strings to domain services, whereas REST serializers supply dates/decimals. Invalid decimal strings could reach model comparisons and produce TypeError rather than a validation response. Evaluation services now coerce/validate their editable fields before model validation.
- **Re-evaluation UI gaps:** completed tests in the teacher profile had no edit action, including the administrator's workflow. Grade limits assumed 100 instead of the saved maximum. The existing grade modal is reused with saved values and the correct record UUID and score scale.
- **Workload was incomplete/inconsistent:** student statistics omitted the revision assignment. Some summaries converted required verses to pages, omitted unlinked historical logs, or duplicated unlinked work across plans. The established page definition is 15 memorized/review lines per page, with an existing explicit review-page-range fallback. Verse counts and surah-only review events are not page measurements.
- **Related-state races:** attendance locally queued a separate evaluation write in addition to the backend's grade update. Attendance-only edits could also copy an old record score over a newer exam grade. The backend now performs score updates only when score fields are supplied, in the daily-record transaction; the frontend refreshes server-confirmed related rows.
- **Stale assignments/date bounds:** the plan editor retained initial props across openings; local-time month-end conversion could omit the last calendar day in Gaza. The editor refreshes its values and month bounds use UTC arithmetic for ISO calendar dates.

## Resulting behavior

Online success requires an acknowledgement for the specific outbox operation. Failures keep forms open, show the relevant error, and stop submission indicators in `finally`. Concurrent submissions are guarded. Permanent validation/permission failures restore the prior local target row without overwriting a later edit; the encrypted rejected intent remains available in the outbox and is not automatically replayed. Offline writes are explicitly labelled as awaiting server synchronization. Token refresh also has a request timeout.

Authorized teachers and administrators can edit old evaluations without creating another evaluation or changing unrelated historical dates/creators. Attendance regrading uses the same evaluation service. Existing role and student-ownership checks remain enforced.

A shared Arabic RTL table shows required, completed, remaining and percentage values for both حفظ and مراجعة on the student dashboard, student details, monthly report, and monthly plan. Current-month work uses the application's Gaza timezone; monthly views use their selected calendar period. Plans supply required pages and daily records supply completed work. Evaluations never multiply page totals. Zero targets return zero remaining/percentage while retaining actual completed work. Missing assignments display an explicit empty-state message.

## Modified files

Backend:
- `evaluations/services/evaluation_services.py`, `evaluations/test_persistence.py`
- `records/services/record_services.py`, `records/selectors/record_selectors.py`, `records/selectors/page_progress.py`
- `students/selectors/student_selectors.py`

Frontend:
- `src/hooks/mutations.ts`, `src/hooks/useMutation.ts`
- `src/lib/api.ts`, `src/lib/db/crypto.ts`, `src/lib/db/schema.ts`, `src/lib/db/repos/aggregates.ts`
- `src/lib/sync/outbox.ts`, `src/lib/sync/push.ts`, `src/lib/progress/pages.ts`, `src/types/api.ts`
- `src/components/modals/EvaluationGradeModal.tsx`, `src/components/plans/WeeklyPlanModal.tsx`
- `src/components/student/PageProgressTable.tsx`, `src/components/teachers/TeacherEvaluationsTab.tsx`
- `src/components/progress/ProgressForm.tsx`, `src/components/progress/ProgressTable.tsx`
- `src/app/(dashboard)/attendance/page.tsx`, `src/app/(dashboard)/attendance/AttendanceRow.tsx`
- `src/app/(dashboard)/student/page.tsx`, `src/app/(dashboard)/student/plan/page.tsx`, `src/app/(dashboard)/students/[id]/page.tsx`
- `e2e/persistence-progress.spec.ts`, `e2e/progress-save.spec.ts`

## Database and rollout

No Django migration, destructive data repair, new dependency, or authentication/permission change is required. The optional unindexed outbox `permanent_error` field is backward-compatible; the Dexie schema version stays unchanged. Existing records and pending operations are retained. Existing migrations were applied only to the newly created local test database.

Deploy the updated backend and rebuilt frontend through the existing release process. Update installed clients to the current frontend assets and reload before verification. Do not reset client IndexedDB/outboxes to install this fix. Application rollback uses the previous backend/frontend release; there is no database migration to reverse. Deployment verification is separate from publishing these repository changes.

## Verification

- Full Django suite: **396 tests passed**.
- Final affected-domain suite (`evaluations records students`): **167 tests passed**, including the additional attendance-only edit/regraded-exam regression.
- Final persistence regression suite: **7 tests passed**.
- `manage.py check`, `makemigrations --check --dry-run`: passed; no migrations required.
- `npx tsc --noEmit`, `npm run lint`: passed on the final source.
- Production webpack build: passed, including TypeScript and static page generation (also required by the production Playwright server).
- **25 distinct browser scenarios passed** across the final targeted run and follow-up. The main run passed 23 scenarios; one new progress-form test initially matched both its textarea and the saved table note. Its locator was corrected to the table and that scenario passed on rerun. A mobile RTL/width/reload check also passed. No application changes were needed for that test correction.
- `git diff --check`: passed.

Reproduce with the project's installed dependencies:

```sh
cd backend
python manage.py test
python manage.py test evaluations records students
python manage.py check
python manage.py makemigrations --check --dry-run
cd ../frontend
npx tsc --noEmit
npm run lint
PLAYWRIGHT_PROD=1 npx playwright test persistence-progress.spec.ts progress-save.spec.ts regressions.spec.ts workflows.spec.ts offline.spec.ts
```

Run E2E against the local development database only: the existing Playwright setup invokes `migrate` and `seed_e2e`.

Browser coverage exercises real login, encrypted IndexedDB, HTTP sync and the local Django database. It includes new and historical evaluations, grading to 90, regrading, duplicate prevention, browser reload, administrator grading, attendance edits, memorization/revision forms, assignment changes, both page categories and percentages, missing assignments, storage rollback, permission/validation/network/conflict errors, offline queue/reconnection, Gaza month-end and existing student CRUD/PDF/PWA workflows. The new table also passed a 390px mobile viewport, RTL and browser-reload check. Error responses and quota failures are simulated only inside tests.

Limitations: tests use local SQLite and Chromium. Production PostgreSQL, production sessions/logs, physical mobile devices, and non-Chromium browsers were unavailable. The remaining frontend suites (authentication, page navigation and teacher requests) were not part of this targeted browser run. Existing drf-spectacular serializer warnings remain. The repository's optional graphify refresh could not run because graphify is not installed and no generated graph is present.

## Client verification

1. As the assigned teacher, open an old completed exam. Confirm the prior result, score and notes; save score 90 and changed notes. Reload, reopen and confirm the same exam contains the new values.
2. As administrator, open the teacher profile → الاختبارات → تعديل التقييم and repeat.
3. Change a student's attendance and حفظ/مراجعة lines, save, then reload. Confirm the saved attendance and lines and the matching page totals in student details.
4. Change the monthly حفظ/مراجعة page targets. Confirm the student dashboard and selected monthly plan show the same required/completed/remaining/percentage values.
5. Check a period without an assignment and a zero target; no division error or invented target should appear.
6. Disconnect, save, and confirm the message says the change awaits synchronization. Reconnect and confirm synchronization before checking another device.
7. Force a validation/permission failure on a test account. Confirm an error appears, the form remains usable, no success is announced, and reloading shows the previously accepted grade.
