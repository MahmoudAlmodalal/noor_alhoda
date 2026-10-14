# Teacher and student analytics

Admin → إدارة المحفّظين → teacher → الإحصائيات والإنجاز. Existing roster,
recitation, plans, evaluation and review tools remain available on that page.
The analytics tabs are read-only; grades and activity records are never written.
All reporting calendar days use the existing Asia/Gaza application timezone.
Attendance defaults now use the same existing local-date helper, preventing
late-evening UTC sessions from being saved under yesterday's application date.

## API

All four endpoints require the existing `IsAdmin` permission (including Django
superusers). Student endpoints also require the student to be in that teacher's
current roster. JSON uses the application's `success`/`data` envelope. Responses
and PDFs have `Cache-Control: private, no-store`.

- `GET /api/reports/teachers/{teacher_id}/analytics/`
- `GET /api/reports/teachers/{teacher_id}/students/{student_id}/analytics/`
- Append `pdf/` to either URL for the complete report; `print=1` serves it inline.

Filters: `period=all|week|month|quarter|year|custom`, custom `from`/`to` ISO dates
(inclusive), `group_by=week|month`, `q`, `status=all|active|inactive`,
`sort=name|memorization|revision`, `page`, `page_size` (1–100). Weeks start Saturday;
quarter means the current calendar month and the previous two months; year means
the current year to date. PDF exports use the same filters and calculation service
and include **all** matching students and history, regardless of list pagination.
Student details and individual exports retain the period independently of roster
search/status. UI draft dates are applied only on submission.

The frontend uses the existing query dispatcher and change bus. These two queries
are explicitly server-authoritative rather than local/offline aggregates: only
persisted records qualify for analytics and PDF export. Offline/error states offer
a retry; analytics are not saved to an unencrypted client cache. Pending offline
writes remain in the existing workflow and appear after synchronization.

## Data and calculation contract

`reports/services/analytics.py` batches five history queries with joined recorders.
Together with teacher, roster and counts, teacher analytics uses nine queries,
independent of student count. History is fetched in chunks and summary responses
omit detailed tables; student lists are paginated on the server. No per-student
queries, plan cache totals, fixed Quran page totals, or simulated activity.

- **Current roster:** all active and inactive students currently assigned to the
  teacher, optionally filtered. Original recorders are retained on historical
  activity. The schema has no complete dated teacher-assignment history (direct
  admin transfers have no historical membership record), no teacher field on
  plans, and no dated scheduled-session table. Consequently these are **current
  students' academic totals**, including their prior history, not a historical
  attribution or ranking of teachers. Removed/transferred students disappear
  from the old teacher's current roster. No historical membership is fabricated.
- **New memorization:** chronological union of explicit global page ranges and,
  separately, verse intervals per normalized Surah. Overlapping/repeated ranges
  add only previously unseen content. Deduplication runs from the earliest record
  through the period cutoff before date filtering. Independent progress rows
  never turn verses or Juz into pages. The existing application defines 15 lines
  per page; line amounts are converted only for completely new, identified,
  nonoverlapping verse portions without competing page representation.
- **Ambiguous records:** quantities without identifiable portions, partial-page
  line amounts without line positions, and overlapping verse/line records are
  retained in history and flagged unquantified. Full pages recorded after prior
  partial pages improve confirmed cumulative coverage, but cannot be credited
  as wholly new period achievement. Completed pages are a verified lower bound;
  uncertain percentages and remaining quantities are `null`, not an invented
  completion. Verse totals and page equivalents are separate views of Quran
  coverage and must never be added together. Workloads retain unrounded quantities
  through teacher aggregation; rounding is applied only to presentation values.
  The current profile position and manually stored verse count are shown separately
  from verified historical coverage. Unknown chart quantities are null, not zeros.
- **Targets:** complete monthly or Saturday–Thursday weekly plans intersecting
  the reporting period are included; no unsupported daily proration. Pages use
  `required_pages` or the established required-lines fallback. Review uses
  `review_required_pages`. Missing/zero page targets produce null percentages
  and remaining counts. Persisted daily `required_verses` targets are calculated
  separately against deduplicated, valid Surah verse ranges; verse counts are never
  converted into pages. Individual completion uses page plans when assigned,
  otherwise the daily verse targets. Both units remain visible independently.
  Plan cached achievement totals are ignored. The latest recorded next target
  can be checked for remaining verse intervals only if it names one known Surah
  and has a valid verse range. Only subsequent recorded recitations can fulfill
  a next-recitation assignment, including revision assignments. Unstructured
  text remains unverified. Session tables
  display stored line/page equivalents even when the new quantity cannot be
  deduplicated; these workload values never inflate newly memorized pages.
- **Revision:** actual daily review lines/pages are workload, including repeated
  reviews; they never increase memorization. ReviewRecord and revision-type
  StudentProgress remain separate history entries with unknown page quantities.
  Same-date/same-Surah mirrored records count as one review session.
- **Attendance:** denominator is valid persisted DailyRecord statuses; present
  plus late are attended, and excused is in the denominator, matching the current
  attendance-report status rule. Friday and invalid attendance statuses are excluded
  under the attendance screen’s existing working-day rules; those rows remain
  visible with an exclusion label. Unrecorded dates are not assumed to be absences.
- **Exams:** use evaluated date, falling back to scheduled date for ungraded
  records. Passed/failed scored evaluations with a valid stored maximum are
  normalized to percent. Scheduled/missed exams do not influence grade averages.
  Daily scores mirrored to evaluations are not counted again; unmatched daily
  marks are displayed without an assumed maximum and excluded from averages.
  Completed exams mean assessed exams, excluding missed/scheduled. The last mark
  is the actual most recent assessed score, displaying its recorded maximum when
  available; it is never assigned an invented maximum.
- **Teacher averages:** arithmetic mean of calculable individual completion
  percentages, with eligible-student counts disclosed. Exam average is the mean
  of valid normalized exam marks, with graded-exam count disclosed. Attendance
  uses the sum of attended/recorded days, not the mean of student percentages.
  Remaining work sums individual deficits; one student's surplus never offsets
  another student's unfinished target. Academic achievements are read independently
  of attendance status; a recorded absence cannot erase an actual recitation.
- **Timeline:** derived from existing history and the latest persisted evaluation
  update timestamp, including recent updates to exams from older reporting periods.
  The application has no version history for prior edits.

## Reports and checks

ReportLab produces A4 reports with the bundled Amiri font embedded, the existing
logo and blue branding, Arabic shaping and BiDi, wrapped Paragraph table cells,
repeated headers, in-row splitting for long notes, automatic pagination and page
numbers. The dashboard and both reports consume the same dataset. Reports have
no legacy 12-plan/20-exam history cap.

Run from `backend`: `python3 manage.py test reports.test_analytics`, then
`python3 manage.py test` for regression coverage. From `frontend`: `npm run lint`,
`npm run build`, and `npx playwright test e2e/teacher-analytics.spec.ts`.

Verification in the implementation environment: 437 Django tests,
including 40 analytics cases; all 41 production-browser regression tests;
additional production runs of the analytics and PDF workflows; ESLint,
TypeScript and production builds. Arabic reports were rasterized and inspected,
and long-note pagination/font embedding are covered by automated tests.
