import * as React from "react";
import { cn } from "@/lib/utils";

export type QualityValue = "excellent" | "good" | "acceptable" | "weak" | "none";

const QUALITY_META: Record<QualityValue, { label: string; className: string }> = {
  excellent: {
    label: "ممتاز",
    className: "bg-emerald-50 text-emerald-600",
  },
  good: {
    label: "جيد جداً",
    className: "bg-blue-50 text-blue-600",
  },
  acceptable: {
    label: "جيد",
    className: "bg-orange-50 text-orange-600",
  },
  weak: {
    label: "ضعيف",
    className: "bg-red-50 text-red-600",
  },
  none: {
    label: "لا يوجد",
    className: "bg-neutral-100 text-neutral-500",
  },
};

export function QualityBadge({
  value,
  className,
}: {
  value: QualityValue | string;
  className?: string;
}) {
  const key: QualityValue = (value in QUALITY_META
    ? (value as QualityValue)
    : "none");
  const meta = QUALITY_META[key];
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

export { QUALITY_META };
