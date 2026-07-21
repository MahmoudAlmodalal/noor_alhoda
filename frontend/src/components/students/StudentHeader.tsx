"use client";

import {
  BookMarked,
  FileText,
  MessageSquare,
  PlusCircle,
  UserCog,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AttendancePill,
  type AttendanceValue,
} from "@/components/ui/AttendancePill";
import type { StudentWithTeacher } from "@/hooks/queries";
import type { StudentStats } from "@/types/api";

interface StudentHeaderProps {
  student: StudentWithTeacher;
  stats?: StudentStats | null;
  isAdmin: boolean;
  onDownloadPdf: () => void;
  onOpenPlan: () => void;
  onOpenCourses?: () => void;
  onSendMessage?: () => void;
}

export function StudentHeader({
  student,
  stats,
  isAdmin,
  onDownloadPdf,
  onOpenPlan,
  onOpenCourses,
  onSendMessage,
}: StudentHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-primary via-[#0a4a85] to-[#083d73] p-6 text-white shadow-[0_10px_30px_-12px_rgba(11,83,148,0.45)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 1.5px, transparent 2px), radial-gradient(circle at 70% 60%, white 1.5px, transparent 2px), radial-gradient(circle at 40% 85%, white 1.5px, transparent 2px)",
          backgroundSize: "80px 80px, 140px 140px, 100px 100px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -start-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -end-10 h-64 w-64 rounded-full bg-[#eabd5b]/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
        <div className="shrink-0">
          <Avatar name={student.full_name} size={88} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-black leading-tight text-white">
            {student.full_name}
          </h1>
          <p className="text-xs text-white/70" dir="ltr">
            {student.national_id}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
              الصف {student.grade || "—"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur-sm">
              <UserCog className="h-3 w-3" />
              {student.teacher_name ? `الشيخ ${student.teacher_name}` : "غير مسنَد"}
            </span>
            {stats?.today_record?.attendance ? (
              <AttendancePill
                value={stats.today_record.attendance as AttendanceValue}
                className="bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-sm"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap items-center gap-2 border-t border-white/15 pt-4">
        <button
          type="button"
          onClick={onDownloadPdf}
          className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <FileText className="h-4 w-4" />
          تحميل التقرير
        </button>
        <button
          type="button"
          onClick={onOpenPlan}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-white/90"
        >
          <PlusCircle className="h-4 w-4" />
          إضافة واجب
        </button>
        {isAdmin && onOpenCourses ? (
          <button
            type="button"
            onClick={onOpenCourses}
            className="inline-flex items-center gap-2 rounded-xl bg-[#eabd5b] px-4 py-2 text-xs font-bold text-[#5c4a20] transition-colors hover:bg-[#eabd5b]/90"
          >
            <BookMarked className="h-4 w-4" />
            الدورات التي اجتازها
          </button>
        ) : null}
        {onSendMessage ? (
          <button
            type="button"
            onClick={onSendMessage}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-bold text-white ring-1 ring-emerald-400/30 backdrop-blur-sm transition-colors hover:bg-emerald-500/30"
          >
            <MessageSquare className="h-4 w-4" />
            إرسال رسالة
          </button>
        ) : null}
      </div>
    </div>
  );
}
