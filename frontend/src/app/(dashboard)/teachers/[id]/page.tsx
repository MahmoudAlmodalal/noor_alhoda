"use client";

import { use, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  ClipboardCheck,
  Edit,
  IdCard,
  Phone,
  PlusCircle,
  RotateCcw,
  Target,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Pattern } from "@/components/ui/Pattern";
import { Segmented } from "@/components/ui/Segmented";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { WeeklyPlanModal } from "@/components/plans/WeeklyPlanModal";
import { EvaluationCreateModal } from "@/components/modals/EvaluationCreateModal";
import { TeacherStudentsTab } from "@/components/teachers/TeacherStudentsTab";
import { TeacherRecitationTab } from "@/components/teachers/TeacherRecitationTab";
import { TeacherPlansTab } from "@/components/teachers/TeacherPlansTab";
import { TeacherEvaluationsTab } from "@/components/teachers/TeacherEvaluationsTab";
import { TeacherReviewsTab } from "@/components/teachers/TeacherReviewsTab";
import { cn } from "@/lib/utils";
import { useQuery } from "@/hooks/useApi";
import type { StudentWithTeacher, TeacherWithUser } from "@/hooks/queries";
import type {
  DailyRecordWithStudent,
  TeacherAggregateStats,
} from "@/lib/db/repos/aggregates";
import {
  ConfirmDeleteModal,
  EditTeacherModal,
} from "@/components/modals/TeacherModals";
import { RoleGate } from "@/components/auth/RoleGate";

type TabKey = "students" | "recitation" | "plans" | "evaluations" | "reviews";

const DAY_LABELS: Record<string, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
};

const ARABIC_DAY_TO_CODE: Record<string, string> = {
  السبت: "sat",
  الأحد: "sun",
  الاثنين: "mon",
  الإثنين: "mon",
  الثلاثاء: "tue",
  الأربعاء: "wed",
  الخميس: "thu",
  الجمعة: "fri",
};

const AFFILIATION_LABELS: Record<string, string> = {
  dar_quran: "دار القرآن",
  awqaf: "أوقاف",
  sheikh_tabaea: "شيخ التباعية",
};

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function formatAffiliation(value: string): string {
  if (!value) return "—";
  return AFFILIATION_LABELS[value] ?? value;
}

function normalizeDay(day: string): { code: string; label: string } {
  const trimmed = day.trim();
  const lower = trimmed.toLowerCase();
  if (DAY_LABELS[lower]) return { code: lower, label: DAY_LABELS[lower] };
  if (ARABIC_DAY_TO_CODE[trimmed]) {
    const code = ARABIC_DAY_TO_CODE[trimmed];
    return { code, label: trimmed };
  }
  return { code: trimmed, label: trimmed };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function TeacherDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("students");
  const [focusStudentId, setFocusStudentId] = useState<string | null>(null);

  const { data: teachers, isLoading: teachersLoading } = useQuery<
    TeacherWithUser[]
  >("teachers");
  const { data: students } = useQuery<StudentWithTeacher[]>(
    "students_with_teacher",
    { teacher_id: id }
  );
  const { data: todayRecords } = useQuery<DailyRecordWithStudent[]>(
    "daily_records_with_student",
    { date: todayIso(), teacher_id: id }
  );
  const { data: aggregate } = useQuery<TeacherAggregateStats>(
    "teacher_aggregate_stats",
    { teacher_id: id }
  );

  const teacher = useMemo(
    () => (teachers ?? []).find((t) => t.id === id),
    [teachers, id]
  );

  const teacherStudents = students ?? [];
  const studentsCount = teacherStudents.length;
  const capacity = teacher?.max_students || 25;
  const capacityUsage = Math.min(
    100,
    Math.round((studentsCount / capacity) * 100)
  );

  const presentToday = useMemo(
    () =>
      (todayRecords ?? []).filter(
        (r) => r.attendance === "present" || r.attendance === "late"
      ).length,
    [todayRecords]
  );
  const absentToday = useMemo(
    () => (todayRecords ?? []).filter((r) => r.attendance === "absent").length,
    [todayRecords]
  );

  const recordByStudent = useMemo(() => {
    const map = new Map<string, DailyRecordWithStudent>();
    for (const r of todayRecords ?? []) {
      map.set(r.student_id, r);
    }
    return map;
  }, [todayRecords]);

  const { isDownloading } = useAuth();

  if ((teachersLoading || isDownloading) && !teacher) return <PageLoading />;

  if (!teacher) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-16 text-center">
        <UserX className="mx-auto h-12 w-12 text-text-muted" />
        <p className="text-base text-text-muted">لم يتم العثور على المحفظ</p>
        <Link
          href="/teachers"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          الرجوع إلى قائمة المحفظين
        </Link>
      </div>
    );
  }

  const todayCode = JS_DAY_TO_CODE[new Date().getDay()];
  const hasAffiliation = Boolean(teacher.affiliation);

  const handleJumpToRecitation = (student_id: string) => {
    setFocusStudentId(student_id);
    setActiveTab("recitation");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <Link
        href="/teachers"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        الرجوع إلى قائمة المحفظين
      </Link>

      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary via-[#0a4a85] to-[#083d73] p-6 text-white shadow-[0_10px_30px_-12px_rgba(11,83,148,0.45)]">
        <Pattern kind="star8" color="#eabd5b" opacity={0.08} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-[#eabd5b]/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-start">
          <Avatar name={teacher.full_name} size={88} className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-black leading-tight text-white">
                {teacher.full_name}
              </h1>
              <p className="mt-1 text-xs text-white/70">
                {teacher.specialization || "محفظ"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasAffiliation ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
                  <UserCog className="h-3 w-3" />
                  {formatAffiliation(teacher.affiliation)}
                </span>
              ) : null}
              {teacher.ring_name ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
                  <BookOpen className="h-3 w-3" />
                  {teacher.ring_name}
                </span>
              ) : null}
              <span
                className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm"
                dir="ltr"
              >
                <IdCard className="h-3 w-3" />
                {teacher.national_id || "—"}
              </span>
              {teacher.phone_number ? (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm"
                  dir="ltr"
                >
                  <Phone className="h-3 w-3" />
                  {teacher.phone_number}
                </span>
              ) : null}
            </div>

            {teacher.session_days?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {teacher.session_days.map((d, idx) => {
                  const { code, label } = normalizeDay(d);
                  const isToday = code === todayCode;
                  return (
                    <span
                      key={`${code}-${idx}`}
                      className={cn(
                        "inline-flex h-6 items-center rounded-full px-2.5 text-[10px] font-bold",
                        isToday
                          ? "bg-emerald-400 text-emerald-950"
                          : "bg-white/10 text-white/80 ring-1 ring-white/10"
                      )}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-white/90"
          >
            <PlusCircle className="h-4 w-4" />
            إنشاء خطة
          </button>
          <button
            type="button"
            onClick={() => setEvalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#eabd5b] px-4 py-2 text-xs font-bold text-[#5c4a20] transition-colors hover:bg-[#eabd5b]/90"
          >
            <ClipboardCheck className="h-4 w-4" />
            جدولة اختبار
          </button>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/20"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/80 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" />
            حذف
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="عدد الطلاب"
          value={studentsCount}
          tint="blue"
          hint={`السعة ${capacityUsage}%`}
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="حضور اليوم"
          value={presentToday}
          tint="green"
        />
        <StatCard
          icon={<UserX className="h-5 w-5" />}
          label="غياب اليوم"
          value={absentToday}
          tint="red"
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="إنجاز الأسبوع"
          value={aggregate ? `${aggregate.avgWeeklyCompletion}%` : "—"}
          tint={
            aggregate && aggregate.avgWeeklyCompletion >= 80
              ? "green"
              : aggregate && aggregate.avgWeeklyCompletion >= 50
                ? "amber"
                : "red"
          }
        />
        <StatCard
          icon={<Award className="h-5 w-5" />}
          label="متوسط الجودة"
          value={aggregate?.avgQuality ?? "—"}
          tint="amber"
        />
        <StatCard
          icon={<RotateCcw className="h-5 w-5" />}
          label="مراجعات مستحقة"
          value={aggregate?.pendingReviews ?? 0}
          tint={
            aggregate && aggregate.pendingReviews > 0 ? "red" : "green"
          }
          hint={
            aggregate && aggregate.upcomingEvaluations > 0
              ? `+${aggregate.upcomingEvaluations} اختبارات قادمة`
              : undefined
          }
        />
      </div>

      <div className="flex justify-center overflow-x-auto">
        <Segmented<TabKey>
          options={[
            { value: "students", label: "الطلاب", icon: <Users className="h-3.5 w-3.5" /> },
            { value: "recitation", label: "التسميع", icon: <BookOpen className="h-3.5 w-3.5" /> },
            { value: "plans", label: "الخطط", icon: <Calendar className="h-3.5 w-3.5" /> },
            { value: "evaluations", label: "الاختبارات", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
            { value: "reviews", label: "المراجعة", icon: <RotateCcw className="h-3.5 w-3.5" /> },
          ]}
          value={activeTab}
          onChange={(v) => {
            if (v !== "recitation") setFocusStudentId(null);
            setActiveTab(v);
          }}
        />
      </div>

      {activeTab === "students" ? (
        <TeacherStudentsTab
          students={teacherStudents}
          recordByStudent={recordByStudent}
          onJumpToRecitation={handleJumpToRecitation}
        />
      ) : null}
      {activeTab === "recitation" ? (
        <TeacherRecitationTab
          teacherId={id}
          initialStudentId={focusStudentId}
        />
      ) : null}
      {activeTab === "plans" ? <TeacherPlansTab teacherId={id} /> : null}
      {activeTab === "evaluations" ? (
        <TeacherEvaluationsTab teacherId={id} />
      ) : null}
      {activeTab === "reviews" ? <TeacherReviewsTab teacherId={id} /> : null}

      {planOpen ? (
        <WeeklyPlanModal
          isOpen={planOpen}
          onClose={() => setPlanOpen(false)}
        />
      ) : null}

      {evalOpen ? (
        <EvaluationCreateModal
          isOpen={evalOpen}
          onClose={() => setEvalOpen(false)}
          teacherId={id}
        />
      ) : null}

      {editOpen ? (
        <EditTeacherModal
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          teacher={teacher}
          onSuccess={() => setEditOpen(false)}
        />
      ) : null}

      {deleteOpen ? (
        <ConfirmDeleteModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          targetName={teacher.full_name}
          resource="teacher"
          targetId={teacher.id}
          onSuccess={() => {
            setDeleteOpen(false);
            router.push("/teachers");
          }}
        />
      ) : null}
    </div>
  );
}

const TINT_CLASSES: Record<string, { bg: string; icon: string }> = {
  blue: { bg: "bg-tile-blue", icon: "text-primary" },
  green: { bg: "bg-tile-green", icon: "text-emerald-600" },
  red: { bg: "bg-tile-red", icon: "text-red-600" },
  amber: { bg: "bg-tile-amber", icon: "text-amber-700" },
  yellow: { bg: "bg-tile-yellow", icon: "text-yellow-700" },
};

function StatCard({
  icon,
  label,
  value,
  tint = "blue",
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tint?: keyof typeof TINT_CLASSES;
  hint?: string;
}) {
  const c = TINT_CLASSES[tint] ?? TINT_CLASSES.blue;
  return (
    <div className="rounded-[20px] border border-border-card bg-white p-4 shadow-sm">
      <div
        className={cn(
          "mb-3 flex h-10 w-10 items-center justify-center rounded-[12px]",
          c.bg,
          c.icon
        )}
      >
        {icon}
      </div>
      <p className="text-[11px] font-bold text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-black leading-tight text-text-title sm:text-2xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export default function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <RoleGate roles={["admin"]}>
      <TeacherDetailInner id={id} />
    </RoleGate>
  );
}
