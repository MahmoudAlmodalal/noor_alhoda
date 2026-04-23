"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Edit,
  IdCard,
  Phone,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { TeacherWithUser } from "@/hooks/queries";

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

const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function normalizeDay(day: string): { code: string; label: string } {
  const trimmed = day.trim();
  if (DAY_LABELS[trimmed.toLowerCase()]) {
    const code = trimmed.toLowerCase();
    return { code, label: DAY_LABELS[code] };
  }
  if (ARABIC_DAY_TO_CODE[trimmed]) {
    const code = ARABIC_DAY_TO_CODE[trimmed];
    return { code, label: trimmed };
  }
  return { code: trimmed, label: trimmed };
}

const AFFILIATION_LABELS: Record<string, string> = {
  dar_quran: "دار القرآن",
  awqaf: "أوقاف",
  sheikh_tabaea: "شيخ التباعية",
};

function formatAffiliation(value: string): string {
  if (!value) return "—";
  return AFFILIATION_LABELS[value] ?? value;
}

interface TeacherCardProps {
  teacher: TeacherWithUser;
  studentsCount: number;
  onEdit: () => void;
  onDelete: () => void;
  animationDelay?: number;
}

export function TeacherCard({
  teacher,
  studentsCount,
  onEdit,
  onDelete,
  animationDelay = 0,
}: TeacherCardProps) {
  const todayCode = JS_DAY_TO_CODE[new Date().getDay()];
  const capacity = teacher.max_students || 25;
  const ratio = Math.min(1, studentsCount / capacity);
  const ratioColor =
    ratio >= 0.9
      ? "bg-red-500"
      : ratio >= 0.6
        ? "bg-amber-500"
        : "bg-emerald-500";
  const counterBadgeClasses =
    ratio >= 0.9
      ? "bg-red-50 text-red-600"
      : ratio >= 0.6
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";

  const affiliationLabel = formatAffiliation(teacher.affiliation);
  const hasAffiliation = Boolean(teacher.affiliation);

  return (
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[24px] border-border-card bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-200",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(11,83,148,0.25)]"
      )}
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <CardContent className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <Avatar name={teacher.full_name} size={52} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold leading-snug text-text-title">
              {teacher.full_name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
              {teacher.specialization || "محفظ"}
            </p>
            {hasAffiliation ? (
              <Badge
                variant="secondary"
                className="mt-2 rounded-md bg-tile-amber px-2 py-0.5 font-bold text-[#92710e] hover:bg-tile-amber"
              >
                {affiliationLabel}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <InfoRow
            icon={<IdCard className="h-4 w-4" />}
            label="رقم الهوية"
            value={teacher.national_id || "—"}
            ltr
          />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="رقم الجوال"
            value={teacher.phone_number || "—"}
            ltr
          />
          <InfoRow
            icon={<BookOpen className="h-4 w-4" />}
            label="اسم الحلقة"
            value={teacher.ring_name || "—"}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted">
              أيام الحلقة
            </span>
            {teacher.session_days?.length ? (
              <span className="text-[11px] text-text-muted">
                {teacher.session_days.length} أيام
              </span>
            ) : null}
          </div>
          {teacher.session_days?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {teacher.session_days.map((day, idx) => {
                const { code, label } = normalizeDay(day);
                const isToday = code === todayCode;
                return (
                  <span
                    key={`${code}-${idx}`}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-bold",
                      isToday
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                        : "bg-surface-subtle text-text-body"
                    )}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted">غير محدد</p>
          )}
        </div>

        <div className="rounded-[16px] bg-surface-subtle p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-body">
              <Users className="h-4 w-4 text-primary" />
              <span>الطلاب المعيّنون</span>
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-bold",
                counterBadgeClasses
              )}
            >
              {studentsCount} / {capacity}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-card">
            <div
              className={cn("h-full rounded-full transition-all", ratioColor)}
              style={{ width: `${Math.max(4, ratio * 100)}%` }}
            />
          </div>
        </div>
      </CardContent>

      <div className="flex items-center gap-2 border-t border-border-card bg-surface-subtle/50 px-4 py-3">
        <Link
          href={`/teachers/${teacher.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary px-3 text-xs font-bold text-white transition-colors hover:bg-primary/90"
        >
          عرض التفاصيل
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-white hover:text-primary"
          onClick={onEdit}
          aria-label={`تعديل المحفظ ${teacher.full_name}`}
        >
          <Edit className="h-[18px] w-[18px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-[12px] text-text-muted hover:bg-red-50 hover:text-red-600"
          onClick={onDelete}
          aria-label={`حذف المحفظ ${teacher.full_name}`}
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </Button>
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
