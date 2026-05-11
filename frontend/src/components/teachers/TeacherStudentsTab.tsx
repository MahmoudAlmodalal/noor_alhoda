"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Search, Users, Edit2, TrendingUp } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AttendancePill, type AttendanceValue } from "@/components/ui/AttendancePill";
import { UpdateMemorizationModal } from "@/components/modals/UpdateMemorizationModal";
import { cn } from "@/lib/utils";
import type { StudentWithTeacher } from "@/hooks/queries";
import type { DailyRecordWithStudent } from "@/lib/db/repos/aggregates";
import type { StudentRecord } from "@/lib/db/repos/students";

type SortKey = "name" | "attendance" | "verses";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "الاسم" },
  { value: "attendance", label: "الحضور" },
  { value: "verses", label: "الإنجاز" },
];

const ATTENDANCE_ORDER: Record<string, number> = {
  present: 0,
  late: 1,
  excused: 2,
  absent: 3,
};

interface Props {
  students: StudentWithTeacher[];
  recordByStudent: Map<string, DailyRecordWithStudent>;
  onJumpToRecitation: (student_id: string) => void;
}

export function TeacherStudentsTab({
  students,
  recordByStudent,
  onJumpToRecitation,
}: Props) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [memorizationTarget, setMemorizationTarget] = useState<StudentRecord | null>(null);

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = students.slice();
    if (q) {
      list = list.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.national_id ?? "").toLowerCase().includes(q)
      );
    }
    if (sort === "name") {
      list.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    } else if (sort === "attendance") {
      list.sort((a, b) => {
        const ra = recordByStudent.get(a.id);
        const rb = recordByStudent.get(b.id);
        const oa = ra ? ATTENDANCE_ORDER[ra.attendance] ?? 9 : 10;
        const ob = rb ? ATTENDANCE_ORDER[rb.attendance] ?? 9 : 10;
        if (oa !== ob) return oa - ob;
        return a.full_name.localeCompare(b.full_name, "ar");
      });
    } else {
      list.sort((a, b) => {
        const ra = recordByStudent.get(a.id);
        const rb = recordByStudent.get(b.id);
        const va = ra?.achieved_verses ?? 0;
        const vb = rb?.achieved_verses ?? 0;
        if (va !== vb) return vb - va;
        return a.full_name.localeCompare(b.full_name, "ar");
      });
    }
    return list;
  }, [students, search, sort, recordByStudent]);

  return (
    <section className="overflow-hidden rounded-[24px] border border-border-card bg-white shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex flex-col gap-3 border-b border-border-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-text-body">
            طلاب المحفظ
            <span className="ms-2 text-xs font-medium text-text-muted">
              ({sorted.length})
            </span>
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن طالب..."
              className="h-10 w-full rounded-[10px] border border-border-subtle bg-white pe-9 ps-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-56"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-10 rounded-[10px] border border-border-subtle bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="ترتيب"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                ترتيب: {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm font-medium text-text-muted">
            {students.length === 0
              ? "لا يوجد طلاب معيّنون لهذا المحفظ بعد."
              : "لا توجد نتائج مطابقة للبحث."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border-card">
          {sorted.map((student) => {
            const rec = recordByStudent.get(student.id);
            const rate =
              rec && rec.required_verses > 0
                ? Math.round((rec.achieved_verses / rec.required_verses) * 100)
                : null;
            return (
              <li
                key={student.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle sm:flex-nowrap"
              >
                <Avatar name={student.full_name} size={40} className="shrink-0" />
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
                  {(student.current_surah || student.current_juz != null || student.memorized_verses > 0) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-text-muted">
                      <p className="flex flex-wrap gap-x-2">
                        {student.current_surah && (
                          <span>
                            <span className="font-semibold text-text-body">السورة:</span>{" "}
                            {student.current_surah}
                          </span>
                        )}
                        {student.current_page != null && (
                          <span>
                            <span className="font-semibold text-text-body">الصفحة:</span>{" "}
                            {student.current_page}
                          </span>
                        )}
                        {student.current_juz != null && (
                          <span>
                            <span className="font-semibold text-text-body">الجزء:</span>{" "}
                            {student.current_juz}
                          </span>
                        )}
                        {student.memorized_verses > 0 && (
                          <span>
                            <span className="font-semibold text-text-body">الآيات:</span>{" "}
                            {student.memorized_verses}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setMemorizationTarget(student)}
                        className="ms-1 inline-flex items-center justify-center h-4 w-4 rounded text-text-muted hover:text-primary transition-colors"
                        aria-label="تعديل موضع الحفظ"
                        title="تعديل موضع الحفظ"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                {rec ? (
                  <AttendancePill value={rec.attendance as AttendanceValue} />
                ) : (
                  <span className="inline-flex items-center rounded-md bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-text-muted">
                    لم يُسجَّل
                  </span>
                )}
                {rec && rec.required_verses > 0 ? (
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold",
                      rate! >= 80
                        ? "bg-green-50 text-green-600"
                        : rate! >= 50
                          ? "bg-orange-50 text-orange-600"
                          : "bg-red-50 text-red-600"
                    )}
                  >
                    {rec.achieved_verses}/{rec.required_verses}
                  </span>
                ) : null}
                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onJumpToRecitation(student.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-tile-blue px-2.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
                    aria-label="تسميع اليوم"
                    title="تسميع اليوم"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    تسميع
                  </button>
                  <Link
                    href={`/progress/${student.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-100"
                    title="تقدم الحفظ"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    التقدم
                  </Link>
                  <Link
                    href={`/students/${student.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-surface-subtle px-2.5 text-[11px] font-bold text-text-body transition-colors hover:bg-border-card"
                  >
                    الملف
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {memorizationTarget && (
        <UpdateMemorizationModal
          isOpen={true}
          onClose={() => setMemorizationTarget(null)}
          student={memorizationTarget}
          onSuccess={() => setMemorizationTarget(null)}
        />
      )}
    </section>
  );
}
