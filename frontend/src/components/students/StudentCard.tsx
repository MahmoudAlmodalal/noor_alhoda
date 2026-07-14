"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Edit,
  FileText,
  IdCard,
  Phone,
  Trash2,
  UserCog,
  UserMinus,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  AttendancePill,
  type AttendanceValue,
} from "@/components/ui/AttendancePill";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { StudentWithTeacher } from "@/hooks/queries";

interface StudentCardProps {
  student: StudentWithTeacher;
  canEdit: boolean;
  canDelete?: boolean;
  onAssignTeacher?: () => void;
  onRequestRemoveTeacher?: () => void;
  onRequestDelete?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownloadPdf: () => void;
  animationDelay?: number;
}

export function StudentCard({
  student,
  canEdit,
  canDelete = false,
  onAssignTeacher,
  onRequestRemoveTeacher,
  onRequestDelete,
  onEdit,
  onDelete,
  onDownloadPdf,
  animationDelay = 0,
}: StudentCardProps) {
  const memorized = student.memorized_ajza_count ?? 0;
  const goalPct = Math.min(100, Math.round((memorized / 30) * 100));
  const hasTeacher = Boolean(student.teacher_name);
  const attendance = student.today_attendance_status;

  const progressBadgeClass =
    memorized >= 20
      ? "bg-emerald-50 text-emerald-700"
      : memorized >= 10
        ? "bg-amber-50 text-amber-700"
        : "bg-tile-blue text-primary";

  const progressFillClass =
    memorized >= 20
      ? "bg-emerald-500"
      : memorized >= 10
        ? "bg-amber-500"
        : "bg-primary";

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[24px] border-border-card bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-200",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(11,83,148,0.25)]"
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <Avatar name={student.full_name} size={52} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold leading-snug text-text-title">
              {student.full_name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-text-muted" dir="ltr">
              {student.national_id || "—"}
            </p>
          </div>
          {attendance ? (
            <AttendancePill value={attendance as AttendanceValue} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-md bg-tile-blue px-2.5 py-0.5 text-[11px] font-bold text-primary hover:bg-tile-blue">
            الصف {student.grade || "—"}
          </Badge>
          {hasTeacher ? (
            <Badge className="rounded-md bg-role-admin-bg px-2.5 py-0.5 text-[11px] font-bold text-primary hover:bg-role-admin-bg">
              <UserCog className="me-1 inline h-3 w-3" />
              {`الشيخ ${student.teacher_name}`}
            </Badge>
          ) : (
            <Badge className="rounded-md bg-tile-amber px-2.5 py-0.5 text-[11px] font-bold text-[#92710e] hover:bg-tile-amber">
              غير مسنَد
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="ولي الأمر"
            value={student.guardian_name || "—"}
          />
          <InfoRow
            icon={<IdCard className="h-4 w-4" />}
            label="الجوال"
            value={student.mobile || student.guardian_mobile || "—"}
            ltr
          />
        </div>

        <div className="mt-auto rounded-[16px] bg-surface-subtle p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-body">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>الأجزاء المحفوظة</span>
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-bold",
                progressBadgeClass
              )}
            >
              {memorized} / 30
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-card">
            <div
              className={cn("h-full rounded-full transition-all", progressFillClass)}
              style={{ width: `${Math.max(4, goalPct)}%` }}
            />
          </div>
        </div>
      </CardContent>

      <div className="flex items-center gap-2 border-t border-border-card bg-surface-subtle/50 px-4 py-3">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary/90"
        >
          عرض التفاصيل
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-white hover:text-primary"
          onClick={onDownloadPdf}
          aria-label={`تحميل تقرير الطالب ${student.full_name}`}
        >
          <FileText className="h-[18px] w-[18px]" />
        </Button>
        {canEdit && onAssignTeacher ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-white hover:text-primary"
            onClick={onAssignTeacher}
            aria-label={`تعيين محفظ للطالب ${student.full_name}`}
          >
            <UserCog className="h-[18px] w-[18px]" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-white hover:text-primary"
            onClick={onEdit}
            aria-label={`تعديل الطالب ${student.full_name}`}
          >
            <Edit className="h-[18px] w-[18px]" />
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
            aria-label={`حذف الطالب ${student.full_name}`}
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </Button>
        ) : null}
        {onRequestRemoveTeacher ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-amber-50 hover:text-amber-600"
            onClick={onRequestRemoveTeacher}
            aria-label={`طلب إزالة الطالب ${student.full_name} من الحلقة`}
            title="طلب إزالة من الحلقة"
          >
            <UserMinus className="h-[18px] w-[18px]" />
          </Button>
        ) : null}
        {onRequestDelete ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-red-50 hover:text-red-600"
            onClick={onRequestDelete}
            aria-label={`طلب حذف الطالب ${student.full_name}`}
            title="طلب حذف الطالب"
          >
            <Trash2 className="h-[18px] w-[18px]" />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function InfoRow({
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
    <div className="flex items-center justify-between rounded-[12px] bg-surface-subtle px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
      </div>
      <span
        className="truncate ps-2 text-xs font-bold text-text-body"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
