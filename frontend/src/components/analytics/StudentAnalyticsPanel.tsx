"use client";
import { useState } from "react";
import { ArrowRight, Download, Printer } from "lucide-react";
import { useQuery } from "@/hooks/useApi";
import type { QueryParams } from "@/hooks/queries";
import {
  displayNumber as n,
  exportAnalytics,
  unitLabel,
  labels,
  type ExamEntry,
  type StudentAnalyticsResponse,
} from "@/lib/analytics";
import {
  actionClass,
  DataTable,
  History,
  Panel,
  Stats,
  Tabs,
  TrendChart,
  WorkSummary,
} from "./AnalyticsUI";

type StudentTab =
  | "overview"
  | "memorization"
  | "revision"
  | "exams"
  | "attendance"
  | "timeline";
export function StudentAnalyticsPanel({
  teacherId,
  studentId,
  filters,
  onBack,
}: {
  teacherId: string;
  studentId: string;
  filters: QueryParams;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<StudentTab>("overview");
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exam, setExam] = useState<ExamEntry | null>(null);
  const { data, isLoading, error, refetch } =
    useQuery<StudentAnalyticsResponse>("teacher_student_analytics", {
      ...filters,
      teacher_id: teacherId,
      student_id: studentId,
    });
  const report = async (print = false) => {
    setBusy(true);
    setExportError("");
    try {
      await exportAnalytics(teacherId, filters, studentId, print);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "تعذر تصدير التقرير");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      id="student-analytics"
      aria-label="لوحة إنجاز الطالب"
      className="scroll-mt-8 space-y-4 rounded-3xl border-2 border-primary/20 bg-primary/[0.025] p-3 sm:p-5"
    >
      <button className={actionClass} onClick={onBack}>
        <ArrowRight size={16} /> العودة إلى إحصائيات المحفّظ
      </button>
      {isLoading ? (
        <p role="status" className="p-8 text-center text-text-muted">
          جارٍ تحميل سجل الطالب…
        </p>
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
      ) : data?.student.id === studentId ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-primary">
                {data.teacher.name} / الطلاب والإنجاز
              </p>
              <h2 className="mt-2 text-xl font-extrabold text-primary">
                إنجاز الطالب: {data.student.name}
              </h2>
              <p className="mt-2 text-xs text-text-muted">
                {data.period.from || "من أول سجل"} إلى {data.period.to} ·{" "}
                {data.student.active ? "نشط" : "غير نشط"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={actionClass}
                disabled={busy}
                onClick={() => void report()}
              >
                <Download size={16} /> تقرير الطالب PDF
              </button>
              <button
                className={actionClass}
                disabled={busy}
                onClick={() => void report(true)}
                aria-label="طباعة تقرير الطالب"
              >
                <Printer size={16} /> طباعة
              </button>
            </div>
          </div>
          {busy && (
            <p role="status" className="text-sm text-primary">
              جارٍ إعداد التقرير الكامل…
            </p>
          )}
          {exportError && (
            <p role="alert" className="text-sm text-red-700">
              {exportError}
            </p>
          )}
          <Tabs
            label="أقسام إنجاز الطالب"
            value={tab}
            onChange={setTab}
            options={[
              ["overview", "نظرة عامة"],
              ["memorization", "تفاصيل الحفظ"],
              ["revision", "تفاصيل المراجعة"],
              ["exams", "الاختبارات"],
              ["attendance", "الحضور"],
              ["timeline", "سجل الإنجازات"],
            ]}
          />
          {tab === "overview" && (
            <>
              <Panel title="معلومات الطالب">
                <dl className="grid gap-4 text-sm sm:grid-cols-4">
                  {[
                    ["اسم المحفّظ", data.student.teacher_name],
                    ["الحلقة", data.student.ring || "غير مسجلة"],
                    ["تاريخ الالتحاق", data.student.enrollment_date],
                    [
                      "آخر نشاط في الفترة",
                      data.student.last_activity || "لا يوجد",
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-text-muted">{label}</dt>
                      <dd className="mt-1 font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
                {(data.student.current_surah ||
                  data.student.current_juz ||
                  data.student.current_page ||
                  data.student.reported_memorized_verses > 0) && (
                  <p className="mt-4 border-t border-border-card pt-3 text-xs leading-6 text-text-muted">
                    الموضع المدون في ملف الطالب:{" "}
                    {data.student.current_surah || "—"} · الجزء{" "}
                    {n(data.student.current_juz)} · الصفحة{" "}
                    {n(data.student.current_page)}. عدد الآيات المدون:{" "}
                    {n(data.student.reported_memorized_verses)}. بيانات الملف
                    الحالية لا تُضاف إلى اتحاد النطاقات التاريخية لغياب
                    تفاصيلها.
                  </p>
                )}
              </Panel>
              <Stats
                items={[
                  [
                    "إجمالي الحفظ التراكمي الموثق",
                    data.memorization_goal.unit === "verses"
                      ? `${n(data.cumulative.verses)} آية`
                      : `${n(data.cumulative.pages)} صفحة`,
                  ],
                  [
                    "الحفظ المطلوب خلال الفترة",
                    `${n(data.memorization_goal.required)} ${unitLabel(data.memorization_goal.unit)}`,
                  ],
                  [
                    "الحفظ المنجز الموثق خلال الفترة",
                    `${n(data.memorization_goal.completed)} ${unitLabel(data.memorization_goal.unit)}`,
                  ],
                  [
                    "الحفظ المتبقي",
                    `${n(data.memorization_goal.remaining)} ${unitLabel(data.memorization_goal.unit)}`,
                  ],
                  [
                    "نسبة إنجاز خطة الحفظ",
                    n(data.memorization_goal.percentage, "%"),
                  ],
                  ["المراجعة المطلوبة", `${n(data.revision.required)} صفحة`],
                  ["المراجعة المنجزة", `${n(data.revision.completed)} صفحة`],
                  ["نسبة إنجاز المراجعة", n(data.revision.percentage, "%")],
                  ["نسبة الحضور", n(data.attendance.percentage, "%")],
                  ["متوسط درجات الاختبارات", n(data.exams.average, "%")],
                ]}
              />
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">
                الحفظ التراكمي حتى {data.cumulative.as_of}:{" "}
                {n(data.cumulative.verses)} آية موثقة مستقلّة عن مجموع الصفحات؛
                لا تُجمع الوحدتان. {n(data.cumulative.unquantified_sessions)}{" "}
                سجلًا لا يمكن تحديد كميته الجديدة بالصفحات. الرمز — يعني أن
                القيمة غير متوفرة أو غير محسومة.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <WorkSummary
                  title="أهداف الحفظ والعمل المتبقي"
                  value={data.memorization_goal}
                />
                <WorkSummary
                  title="أهداف المراجعة والعمل المتبقي"
                  value={data.revision}
                />
              </div>
              <Panel title="التكليفات المسجلة">
                <DataTable
                  headers={[
                    "التاريخ / الفترة",
                    "نوع التكليف",
                    "المطلوب",
                    "العمل المتبقي",
                  ]}
                  rows={data.targets.map((t) => [
                    <span key="date">
                      {t.date}
                      {t.end && <small className="block">إلى {t.end}</small>}
                    </span>,
                    t.source === "plan"
                      ? "خطة حفظ ومراجعة"
                      : labels[t.kind || ""] || "تكليف",
                    t.source === "plan"
                      ? `حفظ ${n(t.memorization_pages)} صفحة · مراجعة ${n(t.revision_pages)} صفحة · ${n(t.verses)} آية`
                      : `${t.text} · آيات ${t.from_ayah || "—"}–${t.to_ayah || "—"}`,
                    t.source === "plan"
                      ? "الخطة لا تخزن أجزاء محددة؛ المتبقي الكمي في الملخص."
                      : t.remaining_ranges?.length === 0
                        ? "تم توثيق النطاق"
                        : t.remaining_ranges
                          ? `آيات ${t.remaining_ranges.map((r) => r.join("–")).join("، ")}`
                          : "لا يمكن التحقق من إتمام التكليف",
                  ])}
                />
              </Panel>
              <div className="grid gap-4 md:grid-cols-2">
                <TrendChart
                  title="الحفظ الجديد أسبوعيًا"
                  rows={data.weekly_trends}
                  metric={
                    data.memorization_goal.unit === "verses"
                      ? "memorization_verses"
                      : "memorization"
                  }
                  unit={unitLabel(data.memorization_goal.unit)}
                />
                <TrendChart
                  title="الحفظ الجديد شهريًا"
                  rows={data.monthly_trends}
                  metric={
                    data.memorization_goal.unit === "verses"
                      ? "memorization_verses"
                      : "memorization"
                  }
                  unit={unitLabel(data.memorization_goal.unit)}
                />
                <TrendChart
                  title="المراجعة عبر الزمن"
                  rows={data.trends}
                  metric="revision"
                />
                <TrendChart
                  title="درجات الاختبارات عبر الزمن"
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
          {tab === "memorization" && (
            <>
              {data.verse_memorization.has_target &&
                data.memorization_goal.unit !== "verses" && (
                  <WorkSummary
                    title="أهداف السجلات اليومية بالآيات"
                    value={{ ...data.verse_memorization, unit: "verses" }}
                  />
                )}
              <WorkSummary
                title="إنجاز الحفظ في الفترة"
                value={data.memorization_goal}
              />
              <Stats
                items={[
                  ["الحفظ التراكمي الموثق", `${n(data.cumulative.pages)} صفحة`],
                  ["الآيات الموثقة تراكميًا", n(data.cumulative.verses)],
                  ["عدد جلسات الحفظ", n(data.sessions.memorization)],
                  ["آخر تاريخ حفظ", data.sessions.last_memorization || "—"],
                ]}
              />
              <Panel title="سجل الحفظ التفصيلي">
                <History rows={data.memorization_history} />
              </Panel>
            </>
          )}
          {tab === "revision" && (
            <>
              <WorkSummary
                title="إنجاز المراجعة في الفترة"
                value={data.revision}
              />
              <Stats
                items={[
                  ["عدد جلسات المراجعة", n(data.sessions.revision)],
                  ["آخر مراجعة", data.sessions.last_revision || "—"],
                ]}
              />
              <Panel title="سجل المراجعة التفصيلي">
                <History rows={data.revision_history} revision />
              </Panel>
            </>
          )}
          {tab === "exams" && (
            <>
              <Stats
                items={[
                  ["إجمالي الاختبارات", n(data.exams.total)],
                  ["الاختبارات المكتملة", n(data.exams.completed)],
                  ["متوسط الدرجات", n(data.exams.average, "%")],
                  ["أعلى درجة", n(data.exams.highest, "%")],
                  [
                    "آخر درجة",
                    `${n(data.exams.last)}${data.exams.last_max_score ? ` / ${n(data.exams.last_max_score)}` : ""}`,
                  ],
                ]}
              />
              <Panel title="سجل الاختبارات والتقييمات">
                <p className="mb-3 text-xs text-text-muted">
                  الدرجات ذات حد أقصى مسجل فقط تدخل في المتوسط. الدرجات اليومية
                  دون حد أقصى تظهر كما سُجلت.
                </p>
                <DataTable
                  headers={[
                    "الاختبار",
                    "التاريخ",
                    "الدرجة",
                    "النتيجة",
                    "الملاحظات",
                    "التفاصيل",
                  ]}
                  rows={data.exam_history.map((e) => [
                    e.title,
                    <span key="dates">
                      {e.date}
                      {e.scheduled_date && (
                        <small className="block">
                          شهر الاختبار: {e.scheduled_date.slice(0, 7)}
                        </small>
                      )}
                    </span>,
                    e.score == null
                      ? "—"
                      : `${n(e.score)}${e.max_score ? ` / ${n(e.max_score)}` : ""}`,
                    labels[e.status] || e.status,
                    <span
                      key="note"
                      className="block max-w-64 whitespace-pre-wrap break-words"
                    >
                      {e.note || "—"}
                    </span>,
                    <button
                      key="details"
                      className={actionClass}
                      onClick={() => setExam(e)}
                    >
                      عرض التقييم
                    </button>,
                  ])}
                />
              </Panel>
              {exam && (
                <Panel
                  title={`تفاصيل التقييم: ${exam.title}`}
                  action={
                    <button
                      className={actionClass}
                      onClick={() => setExam(null)}
                    >
                      إغلاق
                    </button>
                  }
                >
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="inline text-text-muted">السور: </dt>
                      <dd className="inline">{exam.surah || "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-muted">
                        التقييم الفعلي:{" "}
                      </dt>
                      <dd className="inline">
                        {exam.evaluated_date || "غير مسجل"}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-text-muted">الدرجة: </dt>
                      <dd className="inline">
                        {n(exam.score)} / {n(exam.max_score)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline text-text-muted">أنشأه: </dt>
                      <dd className="inline">{exam.recorder?.name || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">الملاحظات</dt>
                      <dd className="whitespace-pre-wrap break-words">
                        {exam.note || "—"}
                      </dd>
                    </div>
                  </dl>
                </Panel>
              )}
            </>
          )}
          {tab === "attendance" && (
            <>
              <Stats
                items={[
                  [
                    "عدد أيام الحضور",
                    n(data.attendance.present + data.attendance.late),
                  ],
                  ["عدد أيام الغياب", n(data.attendance.absent)],
                  ["عدد التأخيرات", n(data.attendance.late)],
                  ["نسبة الحضور", n(data.attendance.percentage, "%")],
                  ["آخر حضور", data.attendance.last_attendance || "—"],
                  ["أيام الاستئذان", n(data.attendance.excused)],
                ]}
              />
              <Panel title="سجل الحضور والالتزام">
                <p className="mb-4 text-xs text-text-muted">
                  تحتسب النسبة من الأيام المسجلة وفق قواعد الحضور الحالية. لا
                  توجد جلسات مجدولة مؤرخة لتقدير الأيام غير المسجلة.
                </p>
                <DataTable
                  headers={["التاريخ", "الحالة", "المسجّل"]}
                  rows={data.attendance_history.map((e) => [
                    e.date,
                    `${labels[e.status] || e.status}${e.counted ? "" : " (غير محتسب في النسبة)"}`,
                    e.recorder?.name || "—",
                  ])}
                />
              </Panel>
            </>
          )}
          {tab === "timeline" && (
            <Panel title="سجل الإنجازات والنشاط">
              <p className="mb-3 text-xs text-text-muted">
                تحديث التقييم يعرض آخر تحديث محفوظ؛ النظام لا يحتفظ بنسخ جميع
                التعديلات السابقة.
              </p>
              <DataTable
                headers={[
                  "التاريخ",
                  "نوع النشاط",
                  "التفاصيل",
                  "النتيجة",
                  "الملاحظة",
                ]}
                rows={data.timeline.map((e) => [
                  e.date,
                  labels[e.type],
                  e.details || "—",
                  labels[e.result || ""] || "—",
                  <span
                    key="note"
                    className="block max-w-64 whitespace-pre-wrap break-words"
                  >
                    {e.note || "—"}
                  </span>,
                ])}
              />
            </Panel>
          )}
        </>
      ) : null}
    </section>
  );
}
