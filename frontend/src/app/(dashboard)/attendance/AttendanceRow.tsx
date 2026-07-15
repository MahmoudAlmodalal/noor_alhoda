"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import type { AttendanceStatus } from "@/types/api";

export interface DraftRecord {
  student_id: string;
  student_name: string;
  record_id?: string;
  attendance?: AttendanceStatus;
  surah_name: string;
  required_verses: number;
  achieved_verses: number;
  quality: string;
  note: string;
  dirty: boolean;
  review_surah_name: string;
  review_from_ayah: number | "";
  review_to_ayah: number | "";
  review_quality: string;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "حاضر", color: "bg-attend-present-bg text-attend-present-text border-attend-present-text/30" },
  { value: "absent",  label: "غائب",  color: "bg-attend-absent-bg text-attend-absent-text border-attend-absent-text/30" },
  { value: "late",    label: "متأخر", color: "bg-attend-late-bg text-attend-late-text border-attend-late-text/30" },
  { value: "excused", label: "مستأذن", color: "bg-attend-excused-bg text-attend-excused-text border-attend-excused-text/30" },
];

const QUALITY_OPTIONS = [
  { value: "none", label: "—" },
  { value: "excellent", label: "ممتاز" },
  { value: "good", label: "جيد" },
  { value: "acceptable", label: "مقبول" },
  { value: "weak", label: "ضعيف" },
];

interface Props {
  draft: DraftRecord;
  onChange: (patch: Partial<DraftRecord>) => void;
}

export function AttendanceRow({ draft, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);

  const inputCls =
    "h-10 w-full rounded-[10px] border border-border-subtle bg-surface-subtle px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div
      className={`bg-white rounded-[16px] border ${
        draft.dirty ? "border-primary/40" : "border-border-card"
      } shadow-sm overflow-hidden`}
    >
      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="flex items-center gap-3 w-full min-w-0 sm:w-auto sm:flex-1">
          <div className="w-10 h-10 bg-tile-blue rounded-full flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-text-body truncate">{draft.student_name}</h3>
            {draft.dirty && (
              <p className="text-[10px] text-primary font-bold mt-0.5">تغييرات غير محفوظة</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-2 rounded-[10px] text-text-muted hover:bg-surface-subtle hover:text-primary sm:hidden"
            aria-label="تفاصيل الحفظ"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {STATUS_OPTIONS.map((opt) => {
            const active = draft.attendance === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ attendance: opt.value })}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-[10px] border transition-colors ${
                  active ? opt.color : "border-border-subtle text-text-muted hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="hidden p-2 rounded-[10px] text-text-muted hover:bg-surface-subtle hover:text-primary sm:inline-flex"
          aria-label="تفاصيل الحفظ"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border-card p-4 bg-surface-subtle space-y-3">
          <div className="text-xs font-bold text-primary mb-1 pb-0.5 border-b border-border-card/50">الحفظ الجديد</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">السورة</label>
              <input
                type="text"
                value={draft.surah_name}
                onChange={(e) => onChange({ surah_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">الصفحات المطلوبة</label>
              <input
                type="number"
                min={0}
                value={draft.required_verses}
                onChange={(e) => onChange({ required_verses: Number(e.target.value) })}
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">الصفحات المنجزة</label>
              <input
                type="number"
                min={0}
                value={draft.achieved_verses}
                onChange={(e) => onChange({ achieved_verses: Number(e.target.value) })}
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">تقدير الحفظ</label>
              <select
                value={draft.quality}
                onChange={(e) => onChange({ quality: e.target.value })}
                className={inputCls}
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-text-label">ملاحظات الحفظ</label>
              <input
                type="text"
                value={draft.note}
                onChange={(e) => onChange({ note: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="text-xs font-bold text-primary mt-3 mb-1 pb-0.5 border-b border-border-card/50">المراجعة</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">سورة المراجعة</label>
              <input
                type="text"
                value={draft.review_surah_name}
                onChange={(e) => onChange({ review_surah_name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">من آية</label>
              <input
                type="number"
                min={0}
                value={draft.review_from_ayah}
                onChange={(e) => onChange({ review_from_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                className={inputCls}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">إلى آية</label>
              <input
                type="number"
                min={0}
                value={draft.review_to_ayah}
                onChange={(e) => onChange({ review_to_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                className={inputCls}
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">تقدير المراجعة</label>
              <select
                value={draft.review_quality}
                onChange={(e) => onChange({ review_quality: e.target.value })}
                className={inputCls}
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
