import * as React from "react";
import { cn } from "@/lib/utils";

export type ResultValue = "pass" | "fail" | "pending";

const RESULT_META: Record<ResultValue, { label: string; className: string }> = {
  pass: {
    label: "ناجح",
    className: "bg-emerald-50 text-emerald-600",
  },
  fail: {
    label: "راسب",
    className: "bg-red-50 text-red-600",
  },
  pending: {
    label: "قيد التسميع",
    className: "bg-neutral-100 text-neutral-500",
  },
};

export function ResultBadge({
  value,
  className,
}: {
  value: ResultValue | string;
  className?: string;
}) {
  const key: ResultValue = (value in RESULT_META
    ? (value as ResultValue)
    : "pending");
  const meta = RESULT_META[key];
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
