"use client";

import { useState, useMemo, useCallback } from "react";
import { BookOpen, ChevronDown, FileText, Hash, Loader2 } from "lucide-react";
import { SURAHS, SURAH_BY_NUMBER, toArabicNumeral } from "@/lib/data/surahs";
import { runMutation } from "@/hooks/mutations";
import { cn } from "@/lib/utils";

interface Props {
  studentId: string;
  onSuccess?: () => void;
}

export function ProgressForm({ studentId, onSuccess }: Props) {
  const [surahNumber, setSurahNumber] = useState<number | "">("");
  const [juzNumber, setJuzNumber] = useState<number | "">("");
  const [fromPage, setFromPage] = useState<string>("");
  const [toPage, setToPage] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [surahSearch, setSurahSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-set juz when surah is selected
  const handleSurahSelect = useCallback((num: number) => {
    setSurahNumber(num);
    const surah = SURAH_BY_NUMBER.get(num);
    if (surah) {
      setJuzNumber(surah.juz);
    }
    setShowDropdown(false);
    setSurahSearch("");
  }, []);

  const filteredSurahs = useMemo(() => {
    const q = surahSearch.trim();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.name_ar.includes(q) ||
        String(s.number).includes(q)
    );
  }, [surahSearch]);

  const selectedSurah = typeof surahNumber === "number" ? SURAH_BY_NUMBER.get(surahNumber) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surahNumber || !juzNumber) return;
    setSubmitting(true);
    try {
      const result = await runMutation({
        resource: "progress",
        action: "create",
        payload: {
          student_id: studentId,
          surah_number: surahNumber,
          juz_number: juzNumber,
          from_page: fromPage ? parseInt(fromPage) : null,
          to_page: toPage ? parseInt(toPage) : null,
          note,
        },
      });
      if (result.ok) {
        setSurahNumber("");
        setJuzNumber("");
        setFromPage("");
        setToPage("");
        setNote("");
        onSuccess?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-xl)] border border-border-card bg-white p-5 shadow-card motion-fade-up"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-emerald-50">
          <BookOpen className="h-4.5 w-4.5 text-emerald-600" />
        </div>
        <h3 className="text-[var(--text-h3)] font-bold leading-[var(--text-h3--line-height)] text-text-title">
          تسجيل تقدم جديد
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Surah Dropdown */}
        <div className="relative">
          <label className="mb-1.5 block text-[var(--text-small)] font-medium text-text-label">
            السورة <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-[var(--radius-md)] border px-3 text-[var(--text-body)] transition-colors",
              showDropdown
                ? "border-primary bg-white ring-2 ring-primary/20"
                : "border-border-subtle bg-surface-subtle hover:border-primary/30"
            )}
          >
            <span className={selectedSurah ? "text-text-title font-medium" : "text-text-placeholder"}>
              {selectedSurah
                ? `${toArabicNumeral(selectedSurah.number)}. ${selectedSurah.name_ar}`
                : "اختر السورة"}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform", showDropdown && "rotate-180")} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-60 w-full overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-white shadow-lg motion-pop">
              <div className="sticky top-0 border-b border-border-subtle bg-white p-2">
                <input
                  type="text"
                  value={surahSearch}
                  onChange={(e) => setSurahSearch(e.target.value)}
                  placeholder="ابحث عن سورة..."
                  className="h-9 w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-subtle px-3 text-[var(--text-small)] placeholder:text-text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              <ul className="max-h-48 overflow-y-auto py-1">
                {filteredSurahs.map((s) => (
                  <li key={s.number}>
                    <button
                      type="button"
                      onClick={() => handleSurahSelect(s.number)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-start text-[var(--text-small)] transition-colors hover:bg-surface-subtle",
                        surahNumber === s.number && "bg-primary/5 font-bold text-primary"
                      )}
                    >
                      <span className="inline-flex h-6 w-8 items-center justify-center rounded-[var(--radius-xs)] bg-surface-subtle text-[10px] font-bold text-text-muted">
                        {toArabicNumeral(s.number)}
                      </span>
                      <span>{s.name_ar}</span>
                      <span className="ms-auto text-[10px] text-text-muted">
                        جزء {toArabicNumeral(s.juz)}
                      </span>
                    </button>
                  </li>
                ))}
                {filteredSurahs.length === 0 && (
                  <li className="px-3 py-4 text-center text-[var(--text-small)] text-text-muted">
                    لا توجد نتائج
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Juz Number */}
        <div>
          <label className="mb-1.5 block text-[var(--text-small)] font-medium text-text-label">
            الجزء <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Hash className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <select
              value={juzNumber}
              onChange={(e) => setJuzNumber(e.target.value ? parseInt(e.target.value) : "")}
              className="h-11 w-full appearance-none rounded-[var(--radius-md)] border border-border-subtle bg-surface-subtle pe-3 ps-9 text-[var(--text-body)] text-text-title transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">اختر الجزء</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                <option key={j} value={j}>
                  الجزء {toArabicNumeral(j)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        {/* From Page */}
        <div>
          <label className="mb-1.5 block text-[var(--text-small)] font-medium text-text-label">
            من صفحة
          </label>
          <input
            type="number"
            min="1"
            max="604"
            value={fromPage}
            onChange={(e) => setFromPage(e.target.value)}
            placeholder="اختياري"
            className="h-11 w-full rounded-[var(--radius-md)] border border-border-subtle bg-surface-subtle px-3 text-[var(--text-body)] text-text-title placeholder:text-text-placeholder transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* To Page */}
        <div>
          <label className="mb-1.5 block text-[var(--text-small)] font-medium text-text-label">
            إلى صفحة
          </label>
          <input
            type="number"
            min="1"
            max="604"
            value={toPage}
            onChange={(e) => setToPage(e.target.value)}
            placeholder="اختياري"
            className="h-11 w-full rounded-[var(--radius-md)] border border-border-subtle bg-surface-subtle px-3 text-[var(--text-body)] text-text-title placeholder:text-text-placeholder transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Note */}
      <div className="mt-4">
        <label className="mb-1.5 block text-[var(--text-small)] font-medium text-text-label">
          <FileText className="mb-0.5 inline h-3.5 w-3.5" /> ملاحظة
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="ملاحظة اختيارية عن أداء الطالب..."
          className="w-full resize-none rounded-[var(--radius-md)] border border-border-subtle bg-surface-subtle px-3 py-2.5 text-[var(--text-body)] text-text-title placeholder:text-text-placeholder transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Submit */}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={submitting || !surahNumber || !juzNumber}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-primary px-6 text-[var(--text-body)] font-bold text-white shadow-xs transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4" />
              حفظ التقدم
            </>
          )}
        </button>
      </div>
    </form>
  );
}
