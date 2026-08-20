"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User, BookOpen } from "lucide-react";
import type { AttendanceStatus } from "@/types/api";

export interface DraftRecord {
  student_id: string;
  student_name: string;
  record_id?: string;
  attendance?: AttendanceStatus;
  surah_name: string;
  from_ayah: number | "";
  to_ayah: number | "";
  from_page: number | "";
  memorized_lines: number;
  quality: string;
  morals_rating: string;
  scattered_test_score: number | "";
  combined_test_score: number | "";
  note: string;
  dirty: boolean;
  review_surah_name: string;
  review_from_ayah: number | "";
  review_to_ayah: number | "";
  review_lines: number;
  review_quality: string;
  next_memorization_target: string;
  next_memorization_from_ayah: number | "";
  next_memorization_to_ayah: number | "";
  next_review_target: string;
  next_review_from_ayah: number | "";
  next_review_to_ayah: number | "";
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: "present", label: "حاضر", color: "bg-attend-present-bg text-attend-present-text border-attend-present-text/30" },
  { value: "absent",  label: "غائب",  color: "bg-attend-absent-bg text-attend-absent-text border-attend-absent-text/30" },
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

  const calculatedPages = (draft.memorized_lines || 0) > 0
    ? ((draft.memorized_lines || 0) / 15).toFixed(1)
    : "0";

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
        <div className="border-t border-border-card p-4 bg-surface-subtle space-y-4">
          {/* الحفظ الجديد */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-primary pb-1 border-b border-border-card/50">
              <BookOpen className="w-4 h-4 text-secondary" />
              <span>تسجيل التسميع والحفظ الجديد</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">السورة</label>
                <input
                  type="text"
                  placeholder="اسم السورة"
                  value={draft.surah_name}
                  onChange={(e) => onChange({ surah_name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">من آية</label>
                <input
                  type="number"
                  min={0}
                  placeholder="من آية"
                  value={draft.from_ayah}
                  onChange={(e) => onChange({ from_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">إلى آية</label>
                <input
                  type="number"
                  min={0}
                  placeholder="إلى آية"
                  value={draft.to_ayah}
                  onChange={(e) => onChange({ to_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-label">عدد الأسطر المحفوظة اليوم</label>
              <input
                type="number"
                min={0}
                value={draft.memorized_lines}
                onChange={(e) => onChange({ memorized_lines: Number(e.target.value) })}
                className={inputCls}
                dir="ltr"
              />
            </div>

            {/* مؤشر حساب الصفحات التلقائي (15 سطر = 1 صفحة) */}
            <div className="bg-white border border-blue-100 rounded-xl p-2.5 flex items-center justify-between text-xs font-bold text-primary">
              <span className="text-text-body">يعادل: {calculatedPages} صفحة ({draft.memorized_lines || 0} سطر)</span>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-xs font-black">
                سيتم إضافتها تلقائياً إلى إنجاز الخطة الشهرية
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">ملاحظات الحفظ</label>
                <input
                  type="text"
                  placeholder="ملاحظات"
                  value={draft.note}
                  onChange={(e) => onChange({ note: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">تقييم الأخلاق والسلوك</label>
                <select
                  value={draft.morals_rating}
                  onChange={(e) => onChange({ morals_rating: e.target.value })}
                  className={inputCls}
                >
                  {QUALITY_OPTIONS.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">اختبار أجزاء متفرقة (%)</label>
                <p className="text-[10px] leading-4 text-text-muted">اختبار آيات أو مقاطع مختارة من مواضع مختلفة من المحفوظ.</p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.scattered_test_score}
                  onChange={(e) => onChange({ scattered_test_score: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">اختبار أجزاء مجمعة (%)</label>
                <p className="text-[10px] leading-4 text-text-muted">اختبار المقاطع المحفوظة متتابعة ومجتمعة ضمن تسميع واحد.</p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.combined_test_score}
                  onChange={(e) => onChange({ combined_test_score: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* المراجعة */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-primary pb-0.5 border-b border-border-card/50">المراجعة</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">سورة المراجعة</label>
                <input
                  type="text"
                  placeholder="اسم سورة المراجعة"
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
                  placeholder="من آية"
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
                  placeholder="إلى آية"
                  value={draft.review_to_ayah}
                  onChange={(e) => onChange({ review_to_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">عدد أسطر المراجعة</label>
                <input
                  type="number"
                  min={0}
                  value={draft.review_lines}
                  onChange={(e) => onChange({ review_lines: Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
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
          {/* المطلوب تسميعه غداً (حفظ) */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold text-amber-600 pb-0.5 border-b border-border-card/50">المطلوب تسميعه غداً (حفظ)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">السورة</label>
                <input
                  type="text"
                  placeholder="اسم السورة"
                  value={draft.next_memorization_target}
                  onChange={(e) => onChange({ next_memorization_target: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">من آية</label>
                <input
                  type="number"
                  min={0}
                  placeholder="من آية"
                  value={draft.next_memorization_from_ayah}
                  onChange={(e) => onChange({ next_memorization_from_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-text-label">إلى آية</label>
                <input
                  type="number"
                  min={0}
                  placeholder="إلى آية"
                  value={draft.next_memorization_to_ayah}
                  onChange={(e) => onChange({ next_memorization_to_ayah: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={inputCls}
                  dir="ltr"
                />
              </div>
            </div>
          </div>



        </div>
      )}
    </div>
  );
}
