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
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "حاضر", color: "bg-green-100 text-green-700 border-green-300" },
  { value: "absent", label: "غائب", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "late", label: "متأخر", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "excused", label: "مستأذن", color: "bg-blue-100 text-blue-700 border-blue-300" },
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

  return (
    <div
      className={`bg-white rounded-2xl border ${
        draft.dirty ? "border-primary/40" : "border-slate-100"
      } shadow-sm overflow-hidden`}
    >
      <div className="p-4 flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-800 truncate">{draft.student_name}</h3>
          {draft.dirty && (
            <p className="text-[10px] text-primary font-bold mt-0.5">تغييرات غير محفوظة</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((opt) => {
            const active = draft.attendance === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ attendance: opt.value })}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-colors ${
                  active ? opt.color : "border-slate-200 text-slate-500 hover:border-slate-300"
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
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-primary"
          aria-label="تفاصيل الحفظ"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 bg-slate-50/40 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">السورة</label>
              <input
                type="text"
                value={draft.surah_name}
                onChange={(e) => onChange({ surah_name: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">الآيات المطلوبة</label>
              <input
                type="number"
                min={0}
                value={draft.required_verses}
                onChange={(e) => onChange({ required_verses: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">الآيات المنجزة</label>
              <input
                type="number"
                min={0}
                value={draft.achieved_verses}
                onChange={(e) => onChange({ achieved_verses: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                dir="ltr"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">التقدير</label>
              <select
                value={draft.quality}
                onChange={(e) => onChange({ quality: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {QUALITY_OPTIONS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">ملاحظات</label>
              <input
                type="text"
                value={draft.note}
                onChange={(e) => onChange({ note: e.target.value })}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
