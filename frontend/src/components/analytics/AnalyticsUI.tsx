"use client";
import { useState, type ReactNode } from "react";
import {
  displayNumber,
  unitLabel,
  labels,
  type HistoryEntry,
  type Trend,
  type Workload,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const actionClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
export const fieldClass =
  "w-full rounded-xl border border-border-card bg-white px-3 py-2 text-sm text-text-body focus:outline-2 focus:outline-primary";
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border-card bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Stats({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-border-card bg-white p-4 shadow-sm"
        >
          <dt className="mb-2 text-xs leading-5 text-text-muted">{label}</dt>
          <dd className="text-xl font-extrabold text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Progress({ value }: { value: number | null }) {
  return (
    <div className="min-w-24">
      <span className="text-xs font-bold text-primary">
        {displayNumber(value, "%")}
      </span>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="نسبة الإنجاز"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value == null ? "لا يمكن حساب النسبة" : `${value}%`}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}
export function WorkSummary({
  title,
  value,
}: {
  title: string;
  value: Workload;
}) {
  return (
    <Panel title={title}>
      <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
        {[
          ["المطلوب", value.required],
          ["المنجز الموثق", value.completed],
          ["المتبقي", value.remaining],
        ].map(([label, amount]) => (
          <div key={String(label)}>
            <dt className="text-text-muted">{label}</dt>
            <dd className="mt-2 font-bold text-primary">
              {displayNumber(amount as number | null)} {unitLabel(value.unit)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mb-4 space-y-2" aria-label="مقارنة المطلوب والمنجز">
        {(
          [
            ["المطلوب", value.required],
            ["المنجز الموثق", value.completed],
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-text-muted">{label}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={
                  label === "المطلوب"
                    ? "h-full rounded-full bg-slate-400"
                    : "h-full rounded-full bg-primary"
                }
                style={{
                  width: `${(amount / Math.max(1, value.required, value.completed)) * 100}%`,
                }}
              />
            </div>
            <span className="w-12 text-xs">{displayNumber(amount)}</span>
          </div>
        ))}
      </div>
      <Progress value={value.percentage} />
      {!value.has_target && (
        <p className="mt-3 text-xs text-text-muted">
          لا يوجد هدف صالح بهذه الوحدة لحساب النسبة أو المتبقي.
        </p>
      )}
      {value.unquantified_sessions > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          {displayNumber(value.unquantified_sessions)} سجلًا لا يمكن التحقق من
          كميته الجديدة؛ المنجز المعروض حد موثق، والنسبة والمتبقي غير محسومين.
        </p>
      )}
    </Panel>
  );
}
export function DataTable({
  headers,
  rows,
  caption,
  paginated = true,
}: {
  headers: string[];
  rows: ReactNode[][];
  caption?: string;
  paginated?: boolean;
}) {
  const [page, setPage] = useState(1);
  const size = paginated ? 15 : Math.max(1, rows.length);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-text-muted">
          لا توجد سجلات خلال الفترة المحددة.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              {caption && <caption className="sr-only">{caption}</caption>}
              <thead className="bg-surface-subtle text-xs text-text-muted">
                <tr>
                  {headers.map((h) => (
                    <th
                      scope="col"
                      key={h}
                      className="whitespace-nowrap px-3 py-3 font-bold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice((current - 1) * size, current * size)
                  .map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border-card align-top last:border-0"
                    >
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-3 leading-6">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                className={actionClass}
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                السابق
              </button>
              <span className="text-xs">
                {current} / {pages}
              </span>
              <button
                className={actionClass}
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex gap-2 overflow-x-auto rounded-2xl border border-border-card bg-white p-2"
    >
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-current={value === key ? "page" : undefined}
          onClick={() => onChange(key)}
          className={cn(
            "shrink-0 rounded-xl px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-primary",
            value === key
              ? "bg-primary text-white"
              : "text-text-muted hover:bg-primary/5",
          )}
        >
          {text}
        </button>
      ))}
    </nav>
  );
}
export function TrendChart({
  title,
  rows,
  metric,
  percent = false,
  unit = "صفحة",
}: {
  title: string;
  rows: Trend[];
  metric:
    "memorization" | "memorization_verses" | "revision" | "exam" | "attendance";
  percent?: boolean;
  unit?: string;
}) {
  const points = rows.filter((r) => r[metric] !== null);
  if (points.length < 2)
    return (
      <Panel title={title}>
        <p className="text-sm text-text-muted">
          لا تتوفر فترتان مسجلتان لعرض اتجاه موثوق.
        </p>
      </Panel>
    );
  const max = percent ? 100 : Math.max(1, ...points.map((r) => r[metric] ?? 0));
  const x = (i: number) => 34 + (i / Math.max(1, points.length - 1)) * 432;
  const y = (v: number) => 130 - (v / max) * 106;
  return (
    <Panel title={title}>
      <svg
        viewBox="0 0 500 165"
        role="img"
        aria-label={title}
        className="w-full"
      >
        <text x="5" y="26" fontSize="10" fill="#64748b">
          {displayNumber(max, percent ? "%" : "")}
        </text>
        <text x="5" y="132" fontSize="10" fill="#64748b">
          0
        </text>
        <path
          d="M34 24H466 M34 77H466 M34 130H466"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <polyline
          points={points
            .map((r, i) => `${x(i)},${y(r[metric] ?? 0)}`)
            .join(" ")}
          fill="none"
          stroke="#0b5394"
          strokeWidth="2.5"
        />
        {points.map((r, i) => (
          <circle
            key={r.date}
            cx={x(i)}
            cy={y(r[metric] ?? 0)}
            r="3"
            fill="#0b5394"
          >
            <title>
              {r.date}: {displayNumber(r[metric], percent ? "%" : ` ${unit}`)}
            </title>
          </circle>
        ))}
        <text x="34" y="155" fontSize="10" fill="#64748b">
          {points[0].date}
        </text>
        <text x="466" y="155" textAnchor="end" fontSize="10" fill="#64748b">
          {points.at(-1)?.date}
        </text>
      </svg>
      <details className="mt-2 text-xs text-text-muted">
        <summary className="cursor-pointer">عرض قيم الرسم</summary>
        <DataTable
          headers={["الفترة", percent ? "النسبة" : `الكمية الموثقة (${unit})`]}
          rows={points.map((r) => [
            r.date,
            displayNumber(r[metric], percent ? "%" : ""),
          ])}
        />
      </details>
    </Panel>
  );
}
export function portion(e: HistoryEntry) {
  return e.from_ayah && e.to_ayah
    ? `آيات ${e.from_ayah}–${e.to_ayah}`
    : e.from_page && e.to_page
      ? `صفحات ${e.from_page}–${e.to_page}`
      : "النطاق غير محدد";
}
export function History({
  rows,
  revision = false,
}: {
  rows: HistoryEntry[];
  revision?: boolean;
}) {
  return (
    <DataTable
      caption={revision ? "سجل المراجعة" : "سجل الحفظ"}
      headers={[
        "التاريخ",
        "السورة / الجزء",
        "من",
        "إلى",
        "الصفحات / الآيات",
        ...(revision ? ["الحالة"] : ["الحفظ الجديد"]),
        "التقييم",
        "الملاحظات / المسجّل",
      ]}
      rows={rows.map((e) => [
        e.date,
        <span key="surah">
          {e.surah || "—"}
          {e.juz ? <small className="block">الجزء {e.juz}</small> : null}
        </span>,
        e.from_ayah
          ? `آية ${e.from_ayah}`
          : e.from_page
            ? `صفحة ${e.from_page}`
            : "—",
        e.to_ayah ? `آية ${e.to_ayah}` : e.to_page ? `صفحة ${e.to_page}` : "—",
        <span key="pages">
          {displayNumber(e.pages)}
          {e.verses != null && (
            <small className="block">
              {displayNumber(e.verses)} آية في الجلسة
            </small>
          )}
          {e.lines > 0 && (
            <small className="block">{displayNumber(e.lines)} سطر</small>
          )}
        </span>,
        revision ? (
          labels[e.result || ""] || "مسجلة"
        ) : (
          <span key="new">
            {displayNumber(e.new_pages)} صفحة
            <small className="block">{displayNumber(e.new_verses)} آية</small>
            {!e.quantified && (
              <small className="block text-amber-800">
                كمية الصفحات غير محسومة
              </small>
            )}
          </span>
        ),
        labels[e.quality || ""] || "—",
        <div key="note" className="max-w-64 whitespace-pre-wrap break-words">
          {e.note || "—"}
          <small className="block text-text-muted">
            {e.recorder?.name || "المسجّل غير متوفر"}
          </small>
        </div>,
      ])}
    />
  );
}
