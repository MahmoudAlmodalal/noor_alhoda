import * as React from "react";
import { cn } from "@/lib/utils";

export type EvaluationStatusValue = "scheduled" | "passed" | "failed" | "missed";

const STATUS_META: Record<
  EvaluationStatusValue,
  { label: string; className: string }
> = {
  scheduled: {
    label: "مجدول",
    className: "bg-blue-50 text-blue-600",
  },
  passed: {
    label: "ناجح",
    className: "bg-emerald-50 text-emerald-600",
  },
  failed: {
    label: "راسب",
    className: "bg-red-50 text-red-600",
  },
  missed: {
    label: "متغيّب",
    className: "bg-amber-50 text-amber-700",
  },
};

export function EvaluationStatusBadge({
  value,
  className,
}: {
  value: EvaluationStatusValue | string;
  className?: string;
}) {
  const key: EvaluationStatusValue = (value in STATUS_META
    ? (value as EvaluationStatusValue)
    : "scheduled");
  const meta = STATUS_META[key];
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-[11px] font-bold",
        meta.className,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

export { STATUS_META as EVALUATION_STATUS_META };
