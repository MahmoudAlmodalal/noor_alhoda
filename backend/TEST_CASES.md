# Noor Al-Huda Test Cases

This checklist is derived from `noor_alhuda_prd_srs.pdf` and focuses on the MVP backend behaviors that can be validated now.

## Authentication

| ID | Requirement | Preconditions | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| AUTH-01 | FR-01 login by phone + password | Active user exists | Call `POST /api/auth/login/` with valid `phone_number` and `password` | Response is `200` and returns `access` and `refresh` tokens |
| AUTH-02 | FR-01 invalid credentials | Active user exists | Call login with valid phone and wrong password | Response is `401` with authentication error |
| AUTH-03 | FR-04/FR-05 OTP reset | User exists | Call `POST /api/auth/otp/send/` | OTP row is created with hashed value, not plain text |
| AUTH-04 | FR-04 OTP expiry | Existing OTP older than 10 minutes | Call `POST /api/auth/otp/verify/` with expired code | Response is `400` and password is not changed |
| AUTH-05 | FR-06 logout blacklist | Valid refresh token exists | Call `POST /api/auth/logout/` with refresh token, then try refresh again | Logout succeeds and reused refresh token is rejected |

## Students and RBAC

| ID | Requirement | Preconditions | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| STU-01 | Feature 2.1 create student | Admin user authenticated | Call `POST /api/students/create/` with required fields | Student and linked user are created successfully |
| STU-02 | FR-08 teacher row-level access | Teacher A and Teacher B each have students | Teacher A requests Teacher B student detail | Response is `403` |
| STU-03 | FR-10 parent child access | Parent linked to one student | Parent requests linked student stats | Response is `200` and returns linked child data only |
| STU-04 | Feature 2.5 soft delete | Admin authenticated, active student exists | Call `DELETE /api/students/<id>/delete/` | Student `is_active=False` and linked user `is_active=False` |

## Daily Records and Weekly Plans

| ID | Requirement | Preconditions | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| REC-01 | FR-12 bulk attendance | Teacher authenticated with active students | Call `POST /api/records/bulk-attendance/` with one week-day date and all students | Records are created/updated in one request |
| REC-02 | FR-14 weekly totals signal | Weekly plan exists | Create or update a daily record with required/achieved verses | `WeeklyPlan.total_required` and `total_achieved` are recalculated |
| REC-03 | FR-16 edit restriction | Teacher owns a daily record older than 7 days | Call `PATCH /api/records/<id>/` | Response is `403` unless actor is admin |
| REC-04 | Day validation | Teacher authenticated | Submit bulk attendance for Friday | Response is `400` and no record is created |

## Notifications

| ID | Requirement | Preconditions | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| NOT-01 | FR-17/FR-20 absence notification | Student has linked parent | Create daily record with `attendance=absent` | Parent notification is created and marked unread |
| NOT-02 | Notification read flow | User has unread notifications | Call `PATCH /api/notifications/<id>/read/` | Notification becomes `is_read=True` |
| NOT-03 | Mark all as read | User has multiple unread notifications | Call `PATCH /api/notifications/read-all/` | All notifications become read and count matches |

## Reports

| ID | Requirement | Preconditions | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| REP-01 | Feature 5.2 attendance report | Admin authenticated, month data exists | Call `GET /api/reports/attendance/?month=<m>&year=<y>` | Monthly summary and per-student breakdown are returned |
| REP-02 | Teacher report isolation | Teacher A and Teacher B have separate students | Teacher A calls attendance report without filters | Response includes Teacher A students only |
| REP-03 | Student PDF authorization | Teacher A and Teacher B have separate students | Teacher A requests Teacher B student PDF | Response is `403` |
| REP-04 | Feature 5.4 leaderboard | Month data exists | Call `GET /api/reports/leaderboard/?month=<m>&year=<y>` | Top students are returned ordered by achieved verses |
