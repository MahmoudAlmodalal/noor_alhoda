"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type BackendStudent = {
  id: string;
  full_name: string;
  national_id: string;
  birthdate: string;
  grade: string;
  address: string;
  whatsapp: string;
  mobile: string;
  previous_courses: string;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_account_type: string | null;
  guardian_name: string;
  guardian_national_id: string;
  guardian_mobile: string;
  teacher_id: string | null;
  teacher_name: string | null;
  health_status: string;
  health_note: string;
  skills: Record<string, unknown> | null;
  follow_up: string;
};

type BulkResult = {
  created_count: number;
  error_count: number;
  errors: { row: number; national_id: string; message: string }[];
};

const GRADE_LABEL: Record<string, string> = {
  "1": "الأول", "2": "الثاني", "3": "الثالث", "4": "الرابع",
  "5": "الخامس", "6": "السادس", "7": "السابع", "8": "الثامن",
  "9": "التاسع", "10": "العاشر", "11": "الحادي عشر", "12": "الثاني عشر",
};

const HEALTH_LABEL: Record<string, string> = {
  normal: "",
  martyr_son: "ابن شهيد",
  sick: "مريض",
  injured: "جريح",
  other: "",
};

const COLUMNS: { label: string; get: (s: BackendStudent, i: number) => string }[] = [
  { label: "م", get: (_s, i) => String(i + 1) },
  { label: "الاسم الرباعي", get: (s) => s.full_name },
  { label: "رقم الهوية", get: (s) => s.national_id },
  { label: "تاريخ الميلاد", get: (s) => s.birthdate },
  { label: "العمر", get: (s) => computeAge(s.birthdate) },
  { label: "الصف الدراسي", get: (s) => GRADE_LABEL[s.grade] || s.grade },
  { label: "رقم الجوال", get: (s) => s.mobile },
  { label: "رقم الواتساب", get: (s) => s.whatsapp },
  { label: "عنوان السكن", get: (s) => s.address },
  { label: "الحالة الخاصة", get: (s) => HEALTH_LABEL[s.health_status] || s.health_note || "" },
  { label: "المهارات", get: (s) => (s.skills && typeof s.skills === "object" && "description" in s.skills ? String((s.skills as Record<string, unknown>).description || "") : "") },
  { label: "الدورات السابقة", get: (s) => s.previous_courses },
  { label: "اسم ولي الأمر", get: (s) => s.guardian_name },
  { label: "رقم هوية ولي الأمر", get: (s) => s.guardian_national_id },
  { label: "رقم جوال ولي الأمر", get: (s) => s.guardian_mobile },
  { label: "رقم الحساب", get: (s) => s.bank_account_number || "" },
  { label: "اسم الحساب", get: (s) => s.bank_account_name || "" },
  { label: "نوع الحساب", get: (s) => s.bank_account_type || "" },
  { label: "اسم الشيخ", get: (s) => s.teacher_name || "" },
  { label: "التباعية", get: (s) => s.follow_up },
];

function computeAge(birthdate: string): string {
  if (!birthdate) return "";
  const d = new Date(birthdate);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 && age <= 120 ? String(age) : "";
}

function classifyHeader(raw: string, counters: Record<string, number>): string | null {
  const h = String(raw || "").trim();
  if (!h) return null;
  if (h === "م" || h === "#") return null;
  if (h === "العمر") return null;

  // Explicit guardian columns (when header includes "ولي").
  if (h.includes("ولي")) {
    if (h.includes("هوية")) return "guardian_national_id";
    if (h.includes("جوال") || h.includes("حوال") || h.includes("هاتف") || h.includes("موبايل") || h.includes("الحوال")) return "guardian_mobile";
    if (h.includes("اسم")) return "guardian_name";
    return null;
  }

  // Compound headers — specific before generic.
  if (h.includes("الشيخ") || h.includes("المحفظ")) return "teacher_name";
  if (h.includes("الحساب")) {
    if (h.includes("رقم")) return "bank_account_number";
    if (h.includes("اسم")) return "bank_account_name";
    if (h.includes("نوع")) return "bank_account_type";
  }
  if (h.includes("التباع") || h.includes("التبع")) return "follow_up";
  if (h.includes("الواتس")) return "whatsapp";
  if (h.includes("الميلاد") || h.includes("تاريخ")) return "birthdate";
  if (h.includes("الصف")) return "grade";
  if (h.includes("العنوان") || h.includes("السكن")) return "address";
  if (h.includes("الحالة") || h.includes("الخاصه")) return "health_status";
  if (h.includes("المهارات") || h.includes("المهارة")) return "skills";
  if (h.includes("الدورات") || h.includes("السابقة")) return "previous_courses";

  // Ambiguous headers that appear twice (student then guardian).
  // Match with or without the "ال" prefix.
  if (h.includes("اسم")) {
    counters.name = (counters.name || 0) + 1;
    return counters.name === 1 ? "full_name" : "guardian_name";
  }
  if (h.includes("هوية")) {
    counters.id = (counters.id || 0) + 1;
    return counters.id === 1 ? "national_id" : "guardian_national_id";
  }
  if (h.includes("جوال") || h.includes("حوال") || h.includes("هاتف") || h.includes("موبايل") || h.includes("الحوال")) {
    counters.phone = (counters.phone || 0) + 1;
    return counters.phone === 1 ? "mobile" : "guardian_mobile";
  }

  return null;
}

// Convert Excel cell values to string, handling Excel date serials.
function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    const y = cell.getFullYear();
    const m = String(cell.getMonth() + 1).padStart(2, "0");
    const d = String(cell.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(cell).trim();
}

export default function StudentsDbPage() {
  const [students, setStudents] = useState<BackendStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [xlsxReady, setXlsxReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await api.get<BackendStudent[]>("/api/students/");
    if (res.success) {
      setStudents(res.data);
    } else {
      console.error(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as unknown as { XLSX?: unknown }).XLSX) {
      setXlsxReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.async = true;
    s.onload = () => setXlsxReady(true);
    document.body.appendChild(s);
    return () => {
      if (s.parentNode) s.parentNode.removeChild(s);
    };
  }, []);

  const handleExport = () => {
    const XLSX = (window as unknown as { XLSX?: any }).XLSX;
    if (!XLSX) {
      alert("جاري تحميل مكتبة التصدير، يرجى المحاولة بعد لحظات.");
      return;
    }
    const rows = students.map((s, i) =>
      COLUMNS.reduce<Record<string, string>>((acc, c) => {
        acc[c.label] = c.get(s, i);
        return acc;
      }, {})
    );
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: COLUMNS.map((c) => c.label),
    });
    ws["!rtl"] = true;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الطلاب");
    XLSX.writeFile(wb, "قاعدة_الطلاب.xlsx");
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = (window as unknown as { XLSX?: any }).XLSX;
    if (!XLSX) {
      alert("جاري تحميل مكتبة الاستيراد، يرجى المحاولة بعد لحظات.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setImportProgress(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      // Pick the sheet with the most rows (some files have an empty first sheet
      // or a summary sheet before the real data sheet).
      let aoa: unknown[][] = [];
      for (const name of wb.SheetNames) {
        const sheet = wb.Sheets[name];
        const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
        if (rowsRaw.length > aoa.length) {
          aoa = rowsRaw;
        }
      }
      console.log(`[import] اختير ورقة بعدد ${aoa.length} صف خام`);

      if (aoa.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      // Find the header row: scan the first few rows and pick the one that
      // classifies to the most known fields (handles title/merged rows above).
      let headerRowIdx = -1;
      let bestMap: (string | null)[] = [];
      for (let r = 0; r < Math.min(aoa.length, 5); r++) {
        const candidate = aoa[r].map(cellToString);
        const c: Record<string, number> = {};
        const m = candidate.map((h) => classifyHeader(h, c));
        if (m.includes("full_name") && m.includes("national_id")) {
          headerRowIdx = r;
          bestMap = m;
          break;
        }
      }

      if (headerRowIdx === -1) {
        alert(
          "لم يتم العثور على أعمدة 'الاسم الرباعي' و'رقم الهوية'.\n" +
          "تأكد أن أحد الصفوف الأولى يحتوي على أسماء الأعمدة بالعربية."
        );
        return;
      }

      const columnMap = bestMap;
      const fullNameIdx = columnMap.indexOf("full_name");
      const nationalIdIdx = columnMap.indexOf("national_id");
      const dataRows = aoa.slice(headerRowIdx + 1).filter((row) => {
        // Keep rows that have at least a name or national_id — skip blanks and totals.
        const name = cellToString(row[fullNameIdx]);
        const nid = cellToString(row[nationalIdIdx]);
        return name !== "" || nid !== "";
      });
      console.log(`[import] بعد الفلترة: ${dataRows.length} صف بيانات`);
      const rows = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        columnMap.forEach((key, idx) => {
          if (!key) return;
          obj[key] = cellToString(row[idx]);
        });
        return obj;
      });

      if (rows.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      // Upload in chunks to avoid timeout
      const CHUNK_SIZE = 50; // Number of rows per request
      let totalCreated = 0;
      let totalErrors: { row: number; national_id: string; message: string }[] = [];
      let rowOffset = 0;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
        
        setImportProgress({ current: chunkNumber, total: totalChunks });
        
        try {
          const res = await api.post<BulkResult>("/api/students/bulk-create/", { rows: chunk });
          if (!res.success) {
            alert(`فشل الاستيراد في الدفعة ${chunkNumber}: ${res.error?.message || "خطأ غير معروف"}`);
            return;
          }

          const { created_count, error_count, errors } = res.data;
          totalCreated += created_count;
          
          // Adjust error row numbers to match original file
          const adjustedErrors = errors.map(e => ({
            ...e,
            row: e.row + rowOffset
          }));
          totalErrors = totalErrors.concat(adjustedErrors);
          rowOffset += chunk.length;

          // Show progress
          console.log(`[import] الدفعة ${chunkNumber}/${totalChunks}: تم إنشاء ${created_count} طالب، فشل ${error_count}`);
        } catch (err) {
          console.error(`Error in chunk ${chunkNumber}:`, err);
          alert(`حدث خطأ في الدفعة ${chunkNumber}. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى.`);
          return;
        }
      }

      let msg = `تم إنشاء ${totalCreated} طالب بنجاح.`;
      if (totalErrors.length > 0) {
        msg += `\nفشل ${totalErrors.length} صف:\n`;
        msg += totalErrors
          .slice(0, 10)
          .map((e) => `صف ${e.row} (${e.national_id}): ${e.message}`)
          .join("\n");
        if (totalErrors.length > 10) msg += `\n... و${totalErrors.length - 10} خطأ إضافي.`;
      }
      alert(msg);
      await reload();
    } catch (err) {
      console.error(err);
      alert("تعذر قراءة الملف. تأكد من أنه ملف Excel صالح.");
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div dir="rtl" className="p-6 space-y-4 min-h-screen bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">
          قاعدة بيانات الطلاب
          <span className="text-sm text-slate-500 font-normal mr-3">
            ({students.length})
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!xlsxReady || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            تصدير Excel
          </button>
          <button
            onClick={handleImportClick}
            disabled={!xlsxReady || importing}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            {importing ? `جاري الاستيراد... (${importProgress?.current || 0}/${importProgress?.total || 0})` : "استيراد Excel"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-max w-full text-sm text-right">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.label}
                    className="px-3 py-3 font-semibold whitespace-nowrap border-b border-slate-200"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate-500">
                    لا يوجد طلاب. استخدم زر "استيراد Excel" لإضافة بيانات.
                  </td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr key={s.id} className="even:bg-slate-50 hover:bg-blue-50 transition-colors">
                    {COLUMNS.map((c) => (
                      <td
                        key={c.label}
                        className="px-3 py-2 whitespace-nowrap border-b border-slate-100 text-slate-700"
                      >
                        {c.get(s, i)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
