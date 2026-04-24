"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type CountdownProps = {
  target: Date | string;
  className?: string;
  /** Render compact "بعد ٣ أيام" vs full with hours/minutes when under a day. */
  compact?: boolean;
  pastLabel?: string;
};

const AR_NUM = new Intl.NumberFormat("ar-EG");

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDaysLabel(days: number): string {
  const abs = Math.abs(days);
  const prefix = days < 0 ? "منذ " : "بعد ";
  if (abs === 0) return "اليوم";
  if (abs === 1) return days < 0 ? "أمس" : "غداً";
  if (abs === 2) return days < 0 ? "قبل يومين" : "بعد يومين";
  if (abs >= 3 && abs <= 10) return `${prefix}${AR_NUM.format(abs)} أيام`;
  return `${prefix}${AR_NUM.format(abs)} يوماً`;
}

function formatHoursLabel(hours: number, minutes: number): string {
  if (hours <= 0 && minutes <= 0) return "الآن";
  if (hours <= 0) return `بعد ${AR_NUM.format(minutes)} دقيقة`;
  if (hours === 1) return "بعد ساعة";
  if (hours === 2) return "بعد ساعتين";
  if (hours >= 3 && hours <= 10) return `بعد ${AR_NUM.format(hours)} ساعات`;
  return `بعد ${AR_NUM.format(hours)} ساعة`;
}

export function Countdown({
  target,
  className,
  compact = true,
  pastLabel,
}: CountdownProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const targetDate = toDate(target);
  const dayDiff = Math.round(
    (startOfDay(targetDate).getTime() - startOfDay(now).getTime()) / 86400000,
  );

  let label: string;
  if (dayDiff < 0 && pastLabel) {
    label = pastLabel;
  } else if (dayDiff === 0 && !compact) {
    const msLeft = targetDate.getTime() - now.getTime();
    if (msLeft > 0) {
      const hours = Math.floor(msLeft / 3_600_000);
      const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
      label = formatHoursLabel(hours, minutes);
    } else {
      label = "اليوم";
    }
  } else {
    label = formatDaysLabel(dayDiff);
  }

  const tone =
    dayDiff < 0
      ? "text-[color:var(--color-text-muted)]"
      : dayDiff === 0
        ? "text-[color:var(--color-attend-late-text)]"
        : dayDiff <= 2
          ? "text-[color:var(--color-attend-late-text)]"
          : "text-[color:var(--color-primary)]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-[600] text-[length:var(--text-body)]",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
