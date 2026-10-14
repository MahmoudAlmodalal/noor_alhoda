"use client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Download, Printer, RefreshCw, Search, Users } from "lucide-react";
import { useQuery } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import {
  displayNumber as n,
  exportAnalytics,
  unitLabel,
  type TeacherAnalytics,
} from "@/lib/analytics";
import {
  actionClass,
  DataTable,
  fieldClass,
  Panel,
  Progress,
  Stats,
  Tabs,
  TrendChart,
  WorkSummary,
} from "./AnalyticsUI";
import { StudentAnalyticsPanel } from "./StudentAnalyticsPanel";

type TeacherTab = "overview" | "students" | "work" | "exams" | "reports";
export function TeacherAnalyticsDashboard({
  teacherId,
}: {
  teacherId: string;
}) {
  const [tab, setTab] = useState<TeacherTab>("overview");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [groupBy, setGroupBy] = useState("month");
  const [applied, setApplied] = useState({
    period: "all",
    from: "",
    to: "",
    group_by: "month",
  });
  const [search, setSearch] = useState("");
  const query = useDebounce(search);
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const params = {
    teacher_id: teacherId,
    ...applied,
    q: query,
    status,
    sort,
    page,
  };
  const studentFilters = { ...applied };
  const { data, isLoading, error, refetch } = useQuery<TeacherAnalytics>(
    "teacher_analytics",
    params,
  );
  const openStudent = (id: string) => {
    setStudentId(id);
    window.setTimeout(
      () =>
        document
          .getElementById("student-analytics")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };
  const report = async (print = false) => {
    setBusy(true);
    setExportError("");
    try {
      await exportAnalytics(teacherId, params, undefined, print);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "تعذر تصدير التقرير");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5" aria-label="ملف المحفّظ وإحصائيات الطلاب">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-primary">
            ملف المحفّظ وإحصائيات الطلاب
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            بيانات محفوظة في النظام · يلزم الاتصال لعرض التحليلات وإعداد
            التقارير
          </p>
        </div>
        <button
          className={actionClass}
          onClick={() => void refetch()}
          disabled={isLoading}
        >
          <RefreshCw size={16} /> تحديث الإحصائيات
        </button>
      </div>
      <Panel title="فترة التقرير والفلاتر">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({
              period,
              from: period === "custom" ? from : "",
              to: period === "custom" ? to : "",
              group_by: groupBy,
            });
            setPage(1);
          }}
          className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="space-y-2 text-xs font-bold text-text-muted">
            <span>الفترة</span>
            <select
              className={fieldClass}
              aria-label="الفترة"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="all">كل السجل</option>
              <option value="week">أسبوعي</option>
              <option value="month">شهري</option>
              <option value="quarter">آخر 3 أشهر</option>
              <option value="year">سنوي</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </label>
          {period === "custom" && (
            <>
              <label className="space-y-2 text-xs font-bold text-text-muted">
                <span>من تاريخ</span>
                <input
                  className={fieldClass}
                  type="date"
                  required
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="space-y-2 text-xs font-bold text-text-muted">
                <span>إلى تاريخ</span>
                <input
                  className={fieldClass}
                  type="date"
                  required
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
          <label className="space-y-2 text-xs font-bold text-text-muted">
            <span>تجميع الرسوم</span>
            <select
              className={fieldClass}
              aria-label="تجميع الرسوم"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="month">شهري</option>
              <option value="week">أسبوعي</option>
            </select>
          </label>
          <button
            className={cn(
              actionClass,
              "bg-primary text-white hover:bg-primary/90",
            )}
            type="submit"
          >
            تطبيق الفترة
          </button>
        </form>
        <div className="mt-4 grid gap-3 border-t border-border-card pt-4 sm:grid-cols-3">
          <label className="space-y-2 text-xs font-bold text-text-muted">
            <span className="flex gap-1">
              <Search size={14} /> البحث باسم الطالب
            </span>
            <input
              className={fieldClass}
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="اكتب اسم الطالب"
            />
          </label>
          <label className="space-y-2 text-xs font-bold text-text-muted">
            <span>حالة الطالب</span>
            <select
              className={fieldClass}
              aria-label="حالة الطالب"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">جميع الطلاب</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </label>
          <label className="space-y-2 text-xs font-bold text-text-muted">
            <span>الترتيب</span>
            <select
              className={fieldClass}
              aria-label="الترتيب"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="name">اسم الطالب</option>
              <option value="memorization">
                نسبة إنجاز الحفظ: الأعلى أولًا
              </option>
              <option value="revision">
                نسبة إنجاز المراجعة: الأعلى أولًا
              </option>
            </select>
          </label>
        </div>
      </Panel>
      {isLoading ? (
        <div
          role="status"
          className="rounded-2xl bg-white p-10 text-center text-text-muted"
        >
          جارٍ حساب الإحصائيات من السجلات…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">
          {error}
          <button
            className={`${actionClass} ms-3`}
            onClick={() => void refetch()}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/5 p-3 text-xs text-primary">
            <span>
              الفترة المعروضة: {data.period.from || "من أول سجل"} إلى{" "}
              {data.period.to} · {n(data.summary.students)} طالبًا مطابقًا
            </span>
            <span>
              آخر حساب:{" "}
              <time dateTime={data.generated_at}>
                {new Date(data.generated_at).toLocaleString("ar")}
              </time>
            </span>
          </div>
          <Tabs
            label="أقسام إحصائيات المحفّظ"
            value={tab}
            onChange={setTab}
            options={[
              ["overview", "نظرة عامة"],
              ["students", "الطلاب والإنجاز"],
              ["work", "الحفظ والمراجعة"],
              ["exams", "الاختبارات والحضور"],
              ["reports", "التقارير"],
            ]}
          />
          {(tab === "overview" || tab === "reports") && (
            <Panel title="معلومات المحفّظ">
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                {[
                  ["اسم المحفّظ", data.teacher.name],
                  ["الحلقة", data.teacher.ring || "غير مسجلة"],
                  ["الطلاب المسجلون", n(data.teacher.registered_students)],
                  ["الطلاب النشطون", n(data.teacher.active_students)],
                  [
                    "التواصل",
                    [data.teacher.phone, data.teacher.email]
                      .filter(Boolean)
                      .join(" · ") || "غير مسجل",
                  ],
                  ["تاريخ الانضمام", data.teacher.joined],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-text-muted">{label}</dt>
                    <dd className="mt-1 font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
          {tab === "overview" && (
            <Stats
              items={[
                ["إجمالي الطلاب في الفلتر", n(data.summary.students)],
                [
                  "إجمالي الحفظ المطلوب",
                  `${n(data.summary.memorization_goal.required)} ${unitLabel(data.summary.memorization_goal.unit)}`,
                ],
                [
                  "إجمالي الحفظ المنجز الموثق",
                  `${n(data.summary.memorization_goal.completed)} ${unitLabel(data.summary.memorization_goal.unit)}`,
                ],
                [
                  "متوسط نسبة إنجاز الحفظ",
                  n(data.summary.memorization.average_percentage, "%"),
                ],
                [
                  "إجمالي المراجعة المطلوبة",
                  `${n(data.summary.revision.required)} صفحة`,
                ],
                [
                  "إجمالي المراجعة المنجزة",
                  `${n(data.summary.revision.completed)} صفحة`,
                ],
                [
                  "متوسط نسبة إنجاز المراجعة",
                  n(data.summary.revision.average_percentage, "%"),
                ],
                ["عدد الاختبارات", n(data.summary.exams.total)],
                ["متوسط درجات الاختبارات", n(data.summary.exams.average, "%")],
                ["نسبة الحضور", n(data.summary.attendance.percentage, "%")],
                [
                  "إجمالي جلسات التسميع المسجلة",
                  n(data.summary.recitation_sessions),
                ],
              ]}
            />
          )}
          {(tab === "overview" || tab === "work") && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <WorkSummary
                  title="الحفظ المطلوب مقابل المنجز"
                  value={data.summary.memorization_goal}
                />
                <WorkSummary
                  title="المراجعة المطلوبة مقابل المنجزة"
                  value={data.summary.revision}
                />
              </div>
              <Comparison data={data} onSelect={openStudent} />
              <div className="grid gap-4 md:grid-cols-2">
                <TrendChart
                  title="اتجاه إنجاز الحفظ للمجموعة"
                  rows={data.trends}
                  metric={
                    data.summary.memorization_goal.unit === "verses"
                      ? "memorization_verses"
                      : "memorization"
                  }
                  unit={unitLabel(data.summary.memorization_goal.unit)}
                />
                <TrendChart
                  title="اتجاه المراجعة للمجموعة"
                  rows={data.trends}
                  metric="revision"
                />
              </div>
            </>
          )}
          {tab === "work" &&
            data.summary.verse_memorization.has_target &&
            data.summary.memorization_goal.unit !== "verses" && (
              <WorkSummary
                title="أهداف السجلات اليومية بالآيات"
                value={{ ...data.summary.verse_memorization, unit: "verses" }}
              />
            )}
          {tab === "students" && (
            <Panel
              title="جميع الطلاب والإنجاز"
              action={
                <span className="text-xs text-text-muted">
                  {n(data.pagination.total)} طالبًا · الكمية بوحدة الهدف المسجل
                </span>
              }
            >
              <DataTable
                key={JSON.stringify(params)}
                paginated={false}
                headers={[
                  "اسم الطالب",
                  "الحفظ المطلوب",
                  "الحفظ المنجز",
                  "نسبة إنجاز الحفظ",
                  "المراجعة المطلوبة",
                  "المراجعة المنجزة",
                  "نسبة إنجاز المراجعة",
                  "نسبة الحضور",
                  "متوسط الاختبارات",
                  "آخر نشاط",
                  "عرض التفاصيل",
                ]}
                rows={data.students.map((r) => [
                  <button
                    key="name"
                    className="text-start font-bold text-primary hover:underline"
                    onClick={() => openStudent(r.student.id)}
                  >
                    {r.student.name}
                    <small className="block font-normal text-text-muted">
                      {r.student.active ? "نشط" : "غير نشط"}
                    </small>
                  </button>,
                  `${n(r.memorization_goal.required)} ${unitLabel(r.memorization_goal.unit)}`,
                  `${n(r.memorization_goal.completed)} ${unitLabel(r.memorization_goal.unit)}`,
                  <Progress key="mem" value={r.memorization_goal.percentage} />,
                  n(r.revision.required),
                  n(r.revision.completed),
                  <Progress key="rev" value={r.revision.percentage} />,
                  n(r.attendance.percentage, "%"),
                  n(r.exams.average, "%"),
                  r.student.last_activity || "—",
                  <button
                    key="details"
                    className={actionClass}
                    aria-label={`عرض تفاصيل ${r.student.name}`}
                    onClick={() => openStudent(r.student.id)}
                  >
                    عرض التفاصيل
                  </button>,
                ])}
              />
              {data.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    className={actionClass}
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    الصفحة السابقة
                  </button>
                  <span className="text-xs">
                    {page} / {data.pagination.pages}
                  </span>
                  <button
                    className={actionClass}
                    disabled={page >= data.pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    الصفحة التالية
                  </button>
                </div>
              )}
            </Panel>
          )}
          {tab === "exams" && (
            <>
              <Stats
                items={[
                  ["عدد الاختبارات", n(data.summary.exams.total)],
                  ["المكتملة", n(data.summary.exams.completed)],
                  ["متوسط الدرجات", n(data.summary.exams.average, "%")],
                  ["نسبة الحضور", n(data.summary.attendance.percentage, "%")],
                ]}
              />
              <Panel title="توزيع الحضور">
                <div className="grid gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["present", "حاضر"],
                      ["late", "متأخر"],
                      ["absent", "غائب"],
                      ["excused", "مستأذن"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="rounded-xl bg-surface-subtle p-3">
                      <p className="text-sm font-bold">
                        {label}: {n(data.summary.attendance[key])}
                      </p>
                      <Progress
                        value={
                          data.summary.attendance.total
                            ? (data.summary.attendance[key] /
                                data.summary.attendance.total) *
                              100
                            : null
                        }
                      />
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="الحضور ومتوسط الاختبارات لكل طالب">
                <DataTable
                  headers={["اسم الطالب", "نسبة الحضور", "متوسط الاختبارات"]}
                  rows={data.comparison.map((r) => [
                    <button
                      key="student"
                      className="font-bold text-primary hover:underline"
                      onClick={() => openStudent(r.id)}
                    >
                      {r.name}
                    </button>,
                    <Progress key="attend" value={r.attendance} />,
                    <Progress key="exam" value={r.exam} />,
                  ])}
                />
              </Panel>
              <div className="grid gap-4 md:grid-cols-2">
                <TrendChart
                  title="متوسط درجات الاختبارات عبر الزمن"
                  rows={data.trends}
                  metric="exam"
                  percent
                />
                <TrendChart
                  title="الحضور عبر الزمن"
                  rows={data.trends}
                  metric="attendance"
                  percent
                />
              </div>
            </>
          )}
          {tab === "reports" && (
            <Panel title="تقرير أداء المحفّظ وطلابه">
              <p className="mb-4 text-sm leading-7 text-text-muted">
                يشمل التقرير جميع الطلاب المطابقين للبحث والحالة، وكل سجلاتهم
                خلال الفترة، وأهدافهم والعمل المتبقي. يتم تضمين جميع صفحات
                النتائج تلقائيًا.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={actionClass}
                  disabled={busy}
                  onClick={() => void report()}
                >
                  <Download size={16} /> تحميل تقرير المحفّظ PDF
                </button>
                <button
                  className={actionClass}
                  disabled={busy}
                  onClick={() => void report(true)}
                >
                  <Printer size={16} /> طباعة تقرير المحفّظ
                </button>
              </div>
              <p className="mt-4 text-xs text-text-muted">
                لإعداد تقرير طالب واحد، افتح تفاصيله من الطلاب والإنجاز.
              </p>
              {busy && (
                <p role="status" className="mt-3 text-primary">
                  جارٍ إعداد التقرير الكامل…
                </p>
              )}
              {exportError && (
                <p role="alert" className="mt-3 text-red-700">
                  {exportError}
                </p>
              )}
            </Panel>
          )}
          <details className="rounded-xl border border-border-card bg-white p-4 text-xs text-text-muted">
            <summary className="cursor-pointer font-bold text-primary">
              منهجية الحساب وحدود البيانات
            </summary>
            <ul className="mt-3 space-y-3 leading-6">
              {data.methods.map((method) => (
                <li key={method}>{method}</li>
              ))}
            </ul>
            <p className="mt-3">
              طلاب متوسط الحفظ: {n(data.summary.memorization.eligible_students)}{" "}
              · طلاب متوسط المراجعة:{" "}
              {n(data.summary.revision.eligible_students)} · اختبارات المتوسط:{" "}
              {n(data.summary.exams.graded_count)}
            </p>
          </details>
        </>
      ) : null}
      {studentId && (
        <StudentAnalyticsPanel
          key={studentId}
          teacherId={teacherId}
          studentId={studentId}
          filters={studentFilters}
          onBack={() => {
            setStudentId(null);
          }}
        />
      )}
    </div>
  );
}
function Comparison({
  data,
  onSelect,
}: {
  data: TeacherAnalytics;
  onSelect: (id: string) => void;
}) {
  return (
    <Panel
      title="مقارنة إنجاز الطلاب"
      action={
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <Users size={14} /> اختر الطالب لعرض سجله
        </span>
      }
    >
      <DataTable
        headers={[
          "اسم الطالب",
          "إنجاز الحفظ",
          "إنجاز المراجعة",
          "الحفظ المطلوب / المنجز",
          "المراجعة المطلوبة / المنجزة",
        ]}
        rows={data.comparison.map((r) => [
          <button
            key="student"
            className="font-bold text-primary hover:underline"
            onClick={() => onSelect(r.id)}
          >
            {r.name}
          </button>,
          <Progress key="mem" value={r.memorization.percentage} />,
          <Progress key="rev" value={r.revision.percentage} />,
          `${n(r.memorization.required)} / ${n(r.memorization.completed)} ${unitLabel(r.memorization.unit)}`,
          `${n(r.revision.required)} / ${n(r.revision.completed)}`,
        ])}
      />
    </Panel>
  );
}
