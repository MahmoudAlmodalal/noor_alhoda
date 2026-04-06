# Noor Al-Huda Quran Center — SRS & PRD Analysis
**Version:** 1.0.0 | **Date:** April 2026 | **Status:** First Draft

---

## 1. Executive Summary

The **Noor Al-Huda** app is an integrated mobile management platform for a Quran memorization center currently serving 300+ students (target: 500). It replaces paper-based tracking with a Progressive Web App (PWA) deployable on Android/iOS without app stores.

**Stack:** Django 5.x + DRF 3.x backend · PostgreSQL database · Tailwind CSS frontend · Railway hosting

**Three core user environments:**
- **Director Dashboard** — full center oversight, teacher/student management, reports
- **Teacher Dashboard** — daily attendance, memorization tracking per student
- **Student Interface** — personal progress, weekly plan, attendance history

---

## 2. Problem Statement

| Problem | Impact |
|---|---|
| Manual paper registration | Time-consuming, data loss risk |
| No memorization progress tracking over time | No longitudinal visibility |
| No automated reporting | Poor data-driven decisions |

---

## 3. Stakeholders & User Personas

| Stakeholder | Role | Primary Need |
|---|---|---|
| Center Director | Decision maker | Fast overview dashboard, printable reports |
| Teachers (Huffaz) | Primary users | Quick attendance entry, per-student tracking |
| Students | End users | Visual progress tracker, weekly plan |
| Dev Team | Implementers | Stable, scalable architecture with familiar tools |

### Key Personas
- **Mohammed (Director, 50)** — paper-accustomed, needs simplicity, wants quick dashboards
- **Abu Youssef (Teacher, 35)** — manages 20–25 students daily, needs 1-tap attendance
- **Ahmed (Student, 15)** — smartphone-native, wants visual progress indicators

---

## 4. Functional Requirements

### 4.1 Authentication & User Management

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Login via mobile number + password | Critical |
| FR-02 | JWT Access Token (60 min) + Refresh Token (7 days) | Critical |
| FR-03 | Account lockout after 5 failed attempts for 15 minutes | Critical |
| FR-04 | 6-digit OTP for password reset, valid 10 minutes | High |
| FR-05 | OTP stored as hash, never plain text | Critical |
| FR-06 | Refresh token blacklisted on logout | Critical |

### 4.2 Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| Admin/Director | Full access to all resources |
| Teacher | Own students only (Row-Level Security on all ViewSets) |
| Student | Read-only on own profile and memorization record |

### 4.3 Student Management & Enrollment

| ID | Requirement | Priority |
|---|---|---|
| FR-07 | Full digital enrollment form replacing paper (matching physical بطاقة انتساب) | Critical |
| FR-08 | Student list with search & filter (teacher, status, grade) | Critical |
| FR-09 | Full student profile page with complete memorization history | Critical |
| FR-10 | Assign/change teacher (admin only); teacher can register/edit own students' data | High |
| FR-11 | Soft-delete deactivation (data preserved) | High |

### 4.4 Daily Memorization & Attendance Tracking

| ID | Requirement | Priority |
|---|---|---|
| FR-13 | Bulk attendance registration (present/absent/late/excused) in one request | Critical |
| FR-14 | Auto-create DailyRecords for all students at start of each week | Critical |
| FR-15 | Auto-calculate `achieved_total` in WeeklyPlan via Django Signal on DailyRecord update | Critical |
| FR-16 | Record required vs. achieved verses + surah name per day | Critical |
| FR-17 | Weekly plan: 6-day grid (Sat–Thu) with required/achieved columns | Critical |
| FR-18 | Daily notes per student (text + timestamp) | High |
| FR-19 | Memorization quality rating: excellent / good / acceptable / weak | Medium |
| FR-20 | Teachers cannot edit records older than 7 days without admin override | Medium |
| FR-21 | Separate review tracking (old memorization review, independent of new) | Low |

### 4.5 Notifications & Communication

| ID | Requirement | Priority |
|---|---|---|
| FR-22 | Push notification (FCM) to relevant users within 2 minutes of absence being recorded | High |
| FR-23 | Auto WhatsApp message via pre-filled wa.me link | Medium |
| FR-24 | Daily reminder to student at 7:00 AM if weekly plan incomplete | Low |
| FR-25 | Director can send announcements to all or specific groups | Medium |
| FR-26 | All notifications stored in Notification table with `is_read` status | High |

### 4.6 Reports & Analytics

| Report | Content | Priority |
|---|---|---|
| Individual Student Report | Full data + memorization progress chart | High |
| Weekly Circle Report | Attendance %, average achievement, top student | High |
| Monthly Center Report | Total verses memorized, attendance rates | Medium |
| Honor Board | Top 10 students this month | Medium |
| Export | All reports exportable to Excel/PDF | High |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| API response time (P95) | < 200ms | Django Debug Toolbar |
| First page load (3G) | < 3 seconds | Lighthouse Score |
| Bulk attendance (30 students) | < 500ms | Unit Tests |
| PDF report export | < 5 seconds | Manual Testing |
| Concurrent users | 50 simultaneous | Locust Load Testing |

### 5.2 Security

| Requirement | Implementation |
|---|---|
| HTTPS enforced | HSTS redirect, no plain HTTP |
| SQL Injection prevention | Django ORM (no raw queries) |
| CSRF protection | Django CSRF Middleware + JWT |
| Password storage | bcrypt/PBKDF2, never plain text |
| Rate limiting | 100 req/min API, 5 attempts login (django-ratelimit) |
| JWT Secret Key | 256-bit random, env variables only |
| Audit logging | All create/edit/delete with IP + user |
| Children's data protection | Encrypted national ID, no third-party sharing |

### 5.3 Quality Attributes

| Attribute | Target |
|---|---|
| Availability | 99% monthly uptime |
| Scalability | Supports 500 students + 50 teachers without architecture changes |
| Test Coverage | ≥ 70% unit test coverage |
| Usability | Full class attendance recorded in < 3 taps |
| Browser Compatibility | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Accessibility | Screen reader support, high-contrast colors, readable fonts |
| Backup | Daily automatic PostgreSQL backup to Supabase |

---

## 6. Database Schema

### 6.1 User (Profile)
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| username | CharField(50) | Unique |
| phone_number | CharField(15) | Unique, used for login + notifications |
| role | CharField(20) | admin / teacher / student |
| is_active | Boolean | Default: True |
| fcm_token | TextField | Nullable, for push notifications |

### 6.2 Student
> Fields derived from the physical **بطاقة انتساب** form used at the center.

**البيانات الشخصية (Personal Data)**
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user | OneToOne(User) | |
| full_name | CharField(100) | الاسم الرباعي — Required |
| national_id | CharField(20) | رقم الهوية — Unique |
| birthdate | DateField | تاريخ الميلاد — Required |
| grade | CharField(50) | الصف الدراسي — Required |
| mobile | CharField(15) | رقم الجوال |
| whatsapp | CharField(15) | رقم واتساب — Nullable |
| address | TextField | عنوان السكن — Nullable |

**البيانات التعليمية (Educational Data)**
| Field | Type | Notes |
|---|---|---|
| previous_courses | TextField | الدورات السابقة — Blank allowed |
| desired_courses | TextField | الدورات المطلوب الالتحاق بها — Blank allowed |

**الحالة الصحية (Health Status)**
| Field | Type | Notes |
|---|---|---|
| health_status | CharField(20) | son_of_martyr / injured / sick / other / normal |
| health_note | TextField | تفاصيل إن وجد مرض — Blank allowed |

**المهارات والقدرات (Skills)**
| Field | Type | Notes |
|---|---|---|
| skills | JSONField | quran_recitation, nasheed, poetry, other |

**بيانات الحساب البنكي (Bank Account)**
| Field | Type | Notes |
|---|---|---|
| bank_account_number | CharField(30) | رقم الحساب — Nullable |
| bank_account_name | CharField(100) | اسم الحساب — Nullable |
| bank_account_type | CharField(50) | نوع الحساب — Nullable |

**بيانات ولي الأمر (Guardian Info — stored on student, no separate account)**
| Field | Type | Notes |
|---|---|---|
| guardian_name | CharField(100) | اسم ولي الأمر — Required |
| guardian_national_id | CharField(20) | رقم الهوية — Nullable |
| guardian_mobile | CharField(15) | رقم الجوال — Required |

**الحالة والتعيين**
| Field | Type | Notes |
|---|---|---|
| teacher | FK(Teacher) | Nullable |
| is_active | Boolean | Soft delete flag |
| enrollment_date | DateField | auto_now_add |

### 6.3 WeeklyPlan
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| student | FK(Student) | Required |
| week_number | PositiveInt | |
| start_week | DateField | Saturday start |
| required_total | PositiveInt | Total verses required |
| achieved_total | PositiveInt | Auto-calculated |
| completion_rate | DecimalField(5,2) | Computed @property |

### 6.4 DailyRecord
> Structure mirrors the physical weekly tracking sheet (كشف الأسبوعي). Each row = one student × one day, with المطلوب/الإنجاز sub-fields. Sheet also has تقييم and نتيجة columns, mapped below.

| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| weekly_plan | FK(WeeklyPlan) | |
| day | CharField(3) | sat/sun/mon/tue/wed/thu — matches sheet columns |
| date | DateField | |
| attendance | CharField(10) | present/absent/late/excused |
| verses_required | PositiveInt | المطلوب |
| verses_achieved | PositiveInt | الإنجاز |
| surah_name | CharField(100) | Blank allowed |
| quality | CharField(10) | التقييم — excellent/good/acceptable/weak/none |
| result | CharField(10) | النتيجة — pass/fail/pending (weekly summary column) |
| note | TextField | Teacher daily note |
| recorded_by | FK(User) | Nullable |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |
| **Unique constraint** | (weekly_plan, day) | One record per student per day |

### 6.5 Teacher
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user | OneToOne(User) | |
| full_name | CharField(100) | |
| specialization | CharField(100) | Quranic authorization |
| session_days | JSONField | e.g. ["sat","sun",...] |
| max_students | PositiveInt | Default: 25 |

---

## 7. API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | /api/auth/login/ | Login → access+refresh token | Public |
| POST | /api/auth/token/refresh/ | Refresh access token | Refresh Token |
| POST | /api/auth/logout/ | Logout + blacklist token | JWT |
| POST | /api/auth/otp/send/ | Send OTP for password reset | Public |
| POST | /api/auth/otp/verify/ | Verify OTP + set new password | OTP Token |
| GET | /api/auth/me/ | Current user data + role | JWT |

### Students
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | /api/students/ | Student list with filters | admin, teacher |
| POST | /api/students/ | Create student (enrollment form) | admin |
| GET | /api/students/{id}/ | Full student data | admin, teacher, student(self) |
| PATCH | /api/students/{id}/ | Edit student data | admin, teacher |
| DELETE | /api/students/{id}/ | Soft delete | admin |
| GET | /api/students/{id}/history/ | Full memorization history | admin, teacher, student(self) |
| GET | /api/students/{id}/stats/ | Attendance %, total memorization | admin, teacher, student(self) |

### Records
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | /api/records/?date=YYYY-MM-DD | Day records for teacher's circle | teacher |
| POST | /api/records/ | Create daily record | teacher |
| PATCH | /api/records/{id}/ | Update record | teacher |
| POST | /api/records/bulk-attendance/ | Bulk attendance for all students | teacher |
| GET | /api/records/weekly-summary/{student_id} | Weekly summary for a student | teacher, student |

### Reports
| Method | Endpoint | Description | Roles |
|---|---|---|---|
| GET | /api/reports/dashboard/ | Director dashboard data | admin |
| GET | /api/reports/attendance/?month=&teacher= | Monthly attendance report | admin |
| GET | /api/reports/student/{id}/pdf/ | PDF report for student | admin, teacher |
| GET | /api/reports/leaderboard/?month= | Monthly honor board | all |

---

## 8. UI/UX Requirements

### Design Principles
- **RTL (Right-to-Left):** Full Arabic interface
- **Mobile-First:** Designed for phone, scales to tablet/desktop
- **Simplicity:** Teachers are not tech-savvy power users
- **Offline-Ready:** Core features work without internet, sync later
- **Typography:** Cairo or Noto Naskh Arabic fonts

---

### 8.1 Director Screens (المدير)
> Based on actual implemented app screens.

#### Side Navigation Menu (القائمة الجانبية)
Slide-in drawer accessible via hamburger icon. Contains:
- **الرئيسية** — Dashboard home (active state: dark blue background)
- **تسجيل طالب** — New student enrollment
- **إدارة المحفظين** — Teachers management
- **سجل الطلاب** — Students register
- **إدارة الحلقات** — Circles management
- **تسجيل الخروج** — Logout (red color, bottom of menu)

---

#### Screen 1: لوحة التحكم الرئيسية (Director Dashboard)
| Element | Detail |
|---|---|
| Welcome header | "مرحباً، مدير المركز" + blessing text |
| Academic year badge | "العام الدراسي الحالي · 1447هـ - 2026م" with book icon |
| Stat card 1 | عدد الطلاب المسجلين — large number (e.g. 156) |
| Stat card 2 | عدد الحلقات — large number in gold (e.g. 12) |
| Stat card 3 | الحفظة المتقنون — large number (e.g. 23) with star icon |
| Quick action 1 | Dark blue button: **تسجيل طالب جديد** (+ icon) |
| Quick action 2 | Gold button: **سجل الحضور** (clipboard icon) |
| Activity feed | "أحدث النشاطات والإشعارات" — scrollable list of recent events with icons (bell for registration, star for memorization, clipboard for attendance) |

---

#### Screen 2: بطاقة الانتساب - تسجيل طالب جديد (Enrollment Form)
Multi-section scrollable form:

| Section | Fields |
|---|---|
| **① البيانات الأساسية** (gold header) | رقم الهوية، الاسم الرباعي، تاريخ الميلاد، الصف الدراسي، رقم الجوال، عنوان السكن |
| **② بيانات ولي الأمر** (gold header) | اسم ولي الأمر، رقم الهوية، رقم الجوال |
| **الحالة الصحية** (gold badge) | Checkbox group: ابن شهيد · ابن جريح · مريض · أخرى |
| **المهارات والاهتمامات** (gold badge) | Checkbox group: قراءة قرآن · إنشاد · شعر · لأخرى |
| Action buttons | **حفظ البيانات وإصدار البطاقة** (dark blue, full width) · **طباعة البطاقة** (outlined) |

---

#### Screen 3: إدارة المحفظين (Teachers Management)
| Element | Detail |
|---|---|
| Search bar | "البحث بالاسم..." with search icon |
| Add button | Dark blue: **إضافة محفظ جديد** (person+ icon) |
| Teacher card | Name (bold), رقم الجوال, الحلقة المعينة (colored badge: green=assigned, red=غير معين), عدد الطلاب |
| Card actions | تعيين حلقة (green, checkmark icon) · edit icon · delete icon |

#### Modal: إضافة محفظ جديد
Fields: الاسم الرباعي · رقم الهوية · رقم الجوال · تعيين حلقة (اختياري)
Buttons: إلغاء (grey) · إضافة (dark blue)

#### Modal: تعديل بيانات المحفظ
Fields pre-filled: الاسم الرباعي · رقم الهوية · رقم الجوال
Buttons: إلغاء · **حفظ التعديلات** (with save icon)

#### Modal: تعيين حلقة للمحفظ
Shows teacher name · dropdown: اختر الحلقة
Buttons: إلغاء · **حفظ التعيين**

#### Dialog: تأكيد حذف المحفظ
Red trash icon · "هل أنت متأكد من حذف الشيخ **[Name]**؟"
Buttons: إلغاء · **نعم، احذف** (red)

---

#### Screen 4: سجل الطلاب (Students Register)
| Element | Detail |
|---|---|
| Search bar | "البحث بالاسم أو الهوية..." |
| Student card | Name (bold, blue) + national ID below, then: المستوى/الحفظ, المحفظ (colored tag or "غير معين" in red), الصف الدراسي, الحالة badge (نشط=green / منقطع=red/pink) |
| Card action icons (4) | 🗑 Delete · ✏ Edit · 📄 View card · 👤 Assign teacher |

#### Modal: تعديل بيانات الطالب
Fields: الاسم الرباعي · رقم الهوية · اسم ولي الأمر · رقم جوال ولي الأمر · الصف الدراسي · مستوى الحفظ · الحالة
Buttons: إلغاء · **حفظ التعديلات** (with save icon) · X close button top-left

#### Modal: تعيين الطالب لمحفظ
Shows student name · dropdown: اختر المحفظ / الحلقة
Buttons: إلغاء · **حفظ التعيين**

#### Dialog: تأكيد حذف الطالب
Red trash icon · "هل أنت متأكد من حذف الطالب **[Name]**؟"
Buttons: إلغاء · **نعم، احذف** (red)

---

#### Screen 5: إدارة الحلقات (Circles Management)
| Element | Detail |
|---|---|
| Search bar | "البحث باسم الحلقة أو المحفظ..." |
| Add button | Dark blue: **+ إنشاء حلقة جديدة** |
| Circle card | Name (bold) + status badge (نشط=green) + book icon, then: المحفظ, عدد الطلاب, المستوى |
| Card actions | **تعديل** (orange, edit icon) · delete icon (red background) |

#### Screen: إنشاء حلقة جديدة (Full page, not modal)
Fields:
- اسم الحلقة (text, placeholder: "مثال: حلقة الفجر، حلقة الإمام نافع...")
- المحفظ (text/select)
- مستوى الحلقة (text, placeholder: "مثال: مبتدئين، مراجعة، جزء عم...")
- **إضافة طلاب للحلقة**: search box "البحث باسم الطالب..." + scrollable checklist showing student name + memorization level per student
- Button: **حفظ وإنشاء الحلقة** (dark blue, full width, with save icon)

#### Dialog: تأكيد حذف الحلقة
Red trash icon · "هل أنت متأكد من حذف حلقة **[Name]**؟ سيتم إزالة جميع الطلاب المرتبطين بها (لا يتم حذف الطلاب أنفسهم)."
Buttons: إلغاء · **نعم، احذف الحلقة** (red)

---

### 8.2 Key Screens — Teacher (المحفظ)
| Screen | Key Elements |
|---|---|
| Main Dashboard | Student list with present/absent toggle, search bar, "Record Today's Attendance" button |
| Student Detail | Basic info + 6-day weekly grid with required/achieved fields per day |
| Bulk Attendance | Checkbox list for all students + "Save All" at bottom |
| Progress View | Chart.js bar/line chart showing achievement trend over weeks |

---

### 8.3 Key Screens — Student (الطالب)
| Screen | Key Elements |
|---|---|
| Home | Total memorized badge + this week's completion % + latest teacher note |
| Weekly Plan | Interactive table per day with what was memorized |
| History | All weeks list with expandable daily detail |

---

### 8.4 PWA Requirements
- `manifest.json` with app name, icon, background color, `display: standalone`
- Service Worker caching static files + offline fallback page
- Install prompt shown to new users
- App icons: 192×192 and 512×512 PNG

---

## 9. Development Roadmap

| Phase | Duration | Deliverable |
|---|---|---|
| **Phase 1 – Foundation** | 2 weeks | Django + DRF + PostgreSQL setup, DB models, JWT auth, Railway deployment |
| **Phase 2 – Teacher** | 3 weeks | Teacher UI: attendance, daily memorization, student page, weekly plan |
| **Phase 3 – Director & Student** | 2 weeks | Director dashboard, digital enrollment form, student UI, basic reports |
| **Phase 4 – Enhancement** | 2 weeks | FCM notifications, PDF export, PWA manifest, honor board, UX polish |

**Total estimated timeline: ~9 weeks to full production-ready product**

### Out of Scope (This Release)
- Native Android/iOS app
- Detailed Tajweed evaluation system

---

## 10. Testing Plan

| Type | Tool | Scope |
|---|---|---|
| Unit Tests | pytest-django | Models, Serializers, Utils |
| Integration Tests | DRF APIClient | All API endpoints |
| E2E Tests | Playwright / Selenium | Full user flows (login → save record) |
| Load Tests | Locust | 50 concurrent users — bulk attendance |
| Security Tests | OWASP ZAP | XSS, CSRF, SQL Injection, Auth bypass |

### Acceptance Criteria
- All unit tests pass before every merge to `main`
- Test coverage ≥ 70%
- No OWASP Top 10 vulnerabilities in production
- Core API response < 200ms at P95
- Lighthouse Performance Score ≥ 85

---

## 11. Infrastructure & Dependencies

### Key Libraries
| Library | Version | Purpose |
|---|---|---|
| django | 5.x | Core framework |
| djangorestframework | 3.x | REST API |
| djangorestframework-simplejwt | 5.x | JWT Authentication |
| django-filter | 23.x | Advanced API filtering |
| celery | 5.x | Background tasks & notifications |
| psycopg2-binary | 2.x | PostgreSQL connection |
| cloudinary | 1.x | Image uploads |
| drf-spectacular | 0.27 | Swagger/OpenAPI docs |
| reportlab | 4.x | PDF report generation |
| django-ratelimit | 4.x | Rate limiting |

### Hosting Architecture
| Component | Service |
|---|---|
| Web Service | Django + Gunicorn (4 workers) on Railway |
| Worker Service | Celery Worker for async notifications |
| Database | Railway PostgreSQL (1 GB free) |
| Static Files | Whitenoise middleware |
| Images | Cloudinary free tier |
| Push Notifications | Firebase FCM (free) |
| CI/CD | GitHub repo auto-deploy on push |

---

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| User resistance to change from paper | High | High | Intensive training + very simple UI + early support |
| Internet outages in some areas | Medium | High | PWA Offline mode with later sync |
| Railway free tier limits exceeded | Low | Medium | Monitor usage, migrate to Render or cheap VPS |
| Teachers struggling with app usage | Medium | High | Simplified UX + short video tutorials |

---

*Document is confidential and exclusive to Noor Al-Huda Quran Center — Version 1.0.0 — April 2026*
