"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  BookMarked,
  Calendar,
  FileText,
  Hash,
  Loader2,
  Trash2,
} from "lucide-react";
import { toArabicNumeral } from "@/lib/data/surahs";
import { runMutation } from "@/hooks/mutations";
import type { ProgressRecord } from "@/lib/db/repos/progress";
import { cn } from "@/lib/utils";

type SortKey = "date" | "surah" | "juz";

interface Props {
  entries: ProgressRecord[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function ProgressTable({ entries }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...entries];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = (a.recorded_at ?? "").localeCompare(b.recorded_at ?? "");
          break;
        case "surah":
          cmp = (a.surah_number ?? 0) - (b.surah_number ?? 0);
          break;
        case "juz":
          cmp = (a.juz_number ?? 0) - (b.juz_number ?? 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [entries, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await runMutation({
        resource: "progress",
        action: "delete",
        payload: { id },
      });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-subtle bg-white py-16 motion-fade-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <BookMarked className="h-7 w-7 text-emerald-400" />
        </div>
        <p className="mt-4 text-[var(--text-large)] font-bold text-text-title">
          لا يوجد سجل تقدم حتى الآن
        </p>
        <p className="mt-1 text-[var(--text-small)] text-text-muted">
          استخدم النموذج أعلاه لتسجيل تقدم الطالب في الحفظ
        </p>
      </div>
    );
  }

  const SortButton = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKeyVal)}
      className={cn(
        "inline-flex items-center gap-1 text-[var(--text-micro)] font-bold uppercase tracking-wide transition-colors",
        sortKey === sortKeyVal ? "text-primary" : "text-text-muted hover:text-text-body"
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="mt-6 overflow-hidden rounded-[var(--radius-xl)] border border-border-card bg-white shadow-card motion-fade-up">
      <div className="overflow-x-auto">
        <table className="w-full text-[var(--text-body)]">
          <thead>
            <tr className="border-b border-border-card bg-surface-subtle">
              <th className="px-4 py-3 text-start">
                <SortButton label="التاريخ" sortKeyVal="date" />
              </th>
              <th className="px-4 py-3 text-start">
                <SortButton label="السورة" sortKeyVal="surah" />
              </th>
              <th className="px-4 py-3 text-start">
                <SortButton label="الجزء" sortKeyVal="juz" />
              </th>
              <th className="px-4 py-3 text-start">
                <span className="text-[var(--text-micro)] font-bold text-text-muted">الصفحات</span>
              </th>
              <th className="px-4 py-3 text-start">
                <span className="text-[var(--text-micro)] font-bold text-text-muted">ملاحظة</span>
              </th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, i) => (
              <tr
                key={entry.id}
                className={cn(
                  "border-b border-border-card transition-colors hover:bg-surface-subtle/50",
                  i % 2 === 0 ? "bg-white" : "bg-surface-subtle/30"
                )}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-text-muted" />
                    <span className="text-[var(--text-small)] text-text-body">
                      {formatDate(entry.recorded_at)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-[var(--radius-xs)] bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                      {toArabicNumeral(entry.surah_number)}
                    </span>
                    <span className="font-medium text-text-title">{entry.surah_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[var(--text-small)]">
                    <Hash className="h-3 w-3 text-text-muted" />
                    <span className="font-medium text-text-body">
                      {toArabicNumeral(entry.juz_number)}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.from_page || entry.to_page ? (
                    <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-tile-blue px-2 py-0.5 text-[11px] font-bold text-primary">
                      {entry.from_page && toArabicNumeral(entry.from_page)}
                      {entry.from_page && entry.to_page && " → "}
                      {entry.to_page && toArabicNumeral(entry.to_page)}
                    </span>
                  ) : (
                    <span className="text-[var(--text-small)] text-text-muted">—</span>
                  )}
                </td>
                <td className="max-w-[200px] px-4 py-3">
                  {entry.note ? (
                    <div className="flex items-start gap-1.5">
                      <FileText className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                      <span className="truncate text-[var(--text-small)] text-text-body">
                        {entry.note}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[var(--text-small)] text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {confirmDeleteId === entry.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-xs)] bg-red-500 px-2 text-[10px] font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "تأكيد"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="inline-flex h-7 items-center rounded-[var(--radius-xs)] bg-surface-subtle px-2 text-[10px] font-bold text-text-muted transition hover:bg-border-card"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-xs)] text-text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="حذف"
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between border-t border-border-card bg-surface-subtle/50 px-4 py-2.5">
        <span className="text-[var(--text-micro)] text-text-muted">
          إجمالي السجلات: <span className="font-bold text-text-body">{toArabicNumeral(entries.length)}</span>
        </span>
        <span className="text-[var(--text-micro)] text-text-muted">
          السور المسجلة: <span className="font-bold text-text-body">{toArabicNumeral(new Set(entries.map((e) => e.surah_number)).size)}</span>
        </span>
      </div>
    </div>
  );
}
