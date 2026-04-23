"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Edit,
  IdCard,
  Phone,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useQuery } from "@/hooks/useApi";
import type { StudentWithTeacher, TeacherWithUser } from "@/hooks/queries";
import type { DailyRecordWithStudent } from "@/lib/db/repos/aggregates";
import {
  ConfirmDeleteModal,
  EditTeacherModal,
} from "@/components/modals/TeacherModals";
import { RoleGate } from "@/components/auth/RoleGate";

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
      (todayRecords ?? []).filter((r) => r.attendance === "present").length,
    [todayRecords]
  );
  const absentToday = useMemo(
    () =>
      (todayRecords ?? []).filter(
        (r) => r.attendance === "absent" || r.attendance === "late"
      ).length,
    [todayRecords]
  );
  const recordedToday = (todayRecords ?? []).length;
  const attendanceRate =
    recordedToday === 0
      ? null
      : Math.round((presentToday / recordedToday) * 100);

  const recordByStudent = useMemo(() => {
    const map = new Map<string, DailyRecordWithStudent>();
    for (const r of todayRecords ?? []) {
      map.set(r.student_id, r);
    }
    return map;
  }, [todayRecords]);

  if (teachersLoading && !teachers) return <PageLoading />;

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <Link
        href="/teachers"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
      >
        <ArrowRight className="h-4 w-4 rotate-180" />
        الرجوع إلى قائمة المحفظين
      </Link>

      <div className="relative overflow-hidden rounded-[24px] border border-border-card bg-white p-6 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-tile-blue opacity-60 blur-2xl"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar name={teacher.full_name} size={80} className="shrink-0" />
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-black text-text-title">
                {teacher.full_name}
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                {teacher.specialization || "محفظ"}
              </p>
              {hasAffiliation ? (
                <Badge
                  variant="secondary"
                  className="mt-2 rounded-md bg-tile-amber px-2.5 py-0.5 font-bold text-[#92710e] hover:bg-tile-amber"
                >
                  {formatAffiliation(teacher.affiliation)}
                </Badge>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile
                icon={<IdCard className="h-4 w-4" />}
                label="رقم الهوية"
                value={teacher.national_id || "—"}
                ltr
              />
              <InfoTile
                icon={<Phone className="h-4 w-4" />}
                label="رقم الجوال"
                value={teacher.phone_number || "—"}
                ltr
              />
              <InfoTile
                icon={<BookOpen className="h-4 w-4" />}
                label="اسم الحلقة"
                value={teacher.ring_name || "—"}
              />
              <InfoTile
                icon={<Users className="h-4 w-4" />}
                label="الحد الأقصى"
                value={`${capacity} طالب`}
              />
            </div>

            {teacher.session_days?.length ? (
              <div>
                <p className="mb-2 text-[11px] font-bold text-text-muted">
                  أيام الحلقة
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {teacher.session_days.map((d, idx) => {
                    const { code, label } = normalizeDay(d);
                    const isToday = code === todayCode;
                    return (
                      <span
                        key={`${code}-${idx}`}
                        className={cn(
                          "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-bold",
                          isToday
                            ? "bg-emerald-500 text-white"
                            : "bg-surface-subtle text-text-body"
                        )}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border-card pt-4">
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="h-10 gap-2 rounded-[12px] font-bold"
          >
            <Edit className="h-4 w-4" />
            تعديل البيانات
          </Button>
          <Button
            variant="ghost-danger"
            onClick={() => setDeleteOpen(true)}
            className="h-10 gap-2 rounded-[12px] font-bold"
          >
            <Trash2 className="h-4 w-4" />
            حذف المحفظ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="عدد الطلاب"
          value={studentsCount}
          tint="blue"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="الحاضرون اليوم"
          value={presentToday}
          tint="green"
          hint={
            recordedToday > 0
              ? `من أصل ${recordedToday} سجل اليوم`
              : "لا يوجد تسجيل لليوم"
          }
        />
        <StatCard
          icon={<UserX className="h-5 w-5" />}
          label="الغائبون اليوم"
          value={absentToday}
          tint="red"
        />
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="نسبة الإشغال"
          value={`${capacityUsage}%`}
          tint={
            capacityUsage >= 90 ? "red" : capacityUsage >= 60 ? "amber" : "green"
          }
          hint={`${studentsCount} / ${capacity}`}
        />
      </div>

      <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border-card px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-text-body">
              طلاب المحفظ
              {attendanceRate != null ? (
                <span className="ms-2 text-xs font-medium text-text-muted">
                  (حضور اليوم {attendanceRate}%)
                </span>
              ) : null}
            </h2>
          </div>
          <span className="text-xs text-text-muted">
            {studentsCount} {studentsCount === 1 ? "طالب" : "طلاب"}
          </span>
        </div>

        {teacherStudents.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm font-medium text-text-muted">
              لا يوجد طلاب معيّنون لهذا المحفظ بعد.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-card">
            {teacherStudents
              .slice()
              .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))
              .map((student) => {
                const rec = recordByStudent.get(student.id);
                return (
                  <li key={student.id}>
                    <Link
                      href={`/students/${student.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-subtle"
                    >
                      <Avatar name={student.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-text-title">
                          {student.full_name}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11px] text-text-muted"
                          dir="ltr"
                        >
                          {student.national_id}
                        </p>
                      </div>
                      <span className="hidden text-xs font-semibold text-text-muted sm:inline">
                        {student.grade || "—"}
                      </span>
                      <AttendancePill record={rec} />
                      <ArrowRight className="h-4 w-4 rotate-180 text-text-muted" />
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {recordedToday > 0 ? (
        <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-border-card px-5 py-4">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-text-body">
              نشاط اليوم
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-surface-subtle/80 text-xs text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">الطالب</th>
                  <th className="px-4 py-3 font-bold">الحضور</th>
                  <th className="px-4 py-3 font-bold">السورة</th>
                  <th className="px-4 py-3 font-bold">الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {(todayRecords ?? [])
                  .slice()
                  .sort((a, b) =>
                    a.student_name.localeCompare(b.student_name, "ar")
                  )
                  .map((r) => {
                    const rate =
                      r.required_verses > 0
                        ? Math.round(
                            (r.achieved_verses / r.required_verses) * 100
                          )
                        : 0;
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-border-card last:border-b-0"
                      >
                        <td className="px-4 py-3 font-semibold text-text-body">
                          {r.student_name}
                        </td>
                        <td className="px-4 py-3">
                          <AttendancePill record={r} />
                        </td>
                        <td className="px-4 py-3 text-text-label">
                          {r.surah_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.required_verses > 0 ? (
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-xs font-bold",
                                rate >= 80
                                  ? "bg-green-50 text-green-600"
                                  : rate >= 50
                                    ? "bg-orange-50 text-orange-600"
                                    : "bg-red-50 text-red-600"
                              )}
                            >
                              {r.achieved_verses} / {r.required_verses} ({rate}%)
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
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

function InfoTile({
  icon,
  label,
  value,
  ltr,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="rounded-[12px] bg-surface-subtle/80 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
      </div>
      <p
        className="truncate text-sm font-bold text-text-body"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </p>
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
      <p className="mt-1 text-2xl font-black leading-tight text-text-title">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function AttendancePill({ record }: { record?: DailyRecordWithStudent }) {
  if (!record) {
    return (
      <span className="inline-flex items-center rounded-md bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-text-muted">
        لم يُسجَّل
      </span>
    );
  }
  const status = record.attendance;
  if (status === "present") {
    return (
      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
        حاضر
      </span>
    );
  }
  if (status === "absent") {
    return (
      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
        غائب
      </span>
    );
  }
  if (status === "late") {
    return (
      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">
        متأخر
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      مُستأذن
    </span>
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
