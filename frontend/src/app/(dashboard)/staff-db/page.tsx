"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import type {
  BulkStaffImportResult,
  StaffJobTitle,
  StaffMember,
} from "@/types/api";

type XLSXSheet = Record<string, unknown>;
type XLSXWorkbook = {
  SheetNames: string[];
  Sheets: Record<string, XLSXSheet>;
};
type XLSXModule = {
  read(data: ArrayBuffer, options: { type: string; cellDates: boolean }): XLSXWorkbook;
  utils: {
    sheet_to_json(
      sheet: XLSXSheet,
      options: { header: number; defval: string; raw: boolean },
    ): unknown[];
  };
};

interface TeacherListEntry {
  id: string;
  user_id: string;
  national_id?: string;
  phone_number: string;
  full_name: string;
  affiliation?: string;
  ring_name?: string;
  birthdate?: string | null;
  marital_status?: string;
  education_qualification?: string;
  last_tajweed_course?: string;
  family_members_count?: number | null;
  wallet_name?: string;
  wallet_number?: string;
  job_title?: StaffJobTitle;
}

type Row = {
  id: string;
  full_name: string;
  national_id: string;
  phone_number: string;
  job_title: StaffJobTitle | "";
  job_title_display: string;
  birthdate: string | null;
  marital_status: string;
  education_qualification: string;
  last_tajweed_course: string;
  wallet_name: string;
  wallet_number: string;
  family_members_count: number | null;
  source: "teacher" | "staff";
};

const JOB_TITLE_LABEL: Record<string, string> = {
  director: "مدير المركز",
  deputy_director: "نائب المدير",
  admin: "الإداري",
  media: "إعلامي",
  teacher: "محفظ",
  teacher_reception: "محفظ استقبال",
  teacher_year_circle: "محفظ حلقة سنة",
  teacher_forum_circle: "محفظ حلقة منتدى",
  teacher_assistant: "مساعد محفظ",
  course_instructor: "معلم دورات",
  admin_teacher: "مساعد إداري + محفظ",
};

const MARITAL_LABEL: Record<string, string> = {
  single: "أعزب",
  married: "متزوج",
};

const SORT_ORDER: StaffJobTitle[] = [
  "director",
  "deputy_director",
  "admin",
  "admin_teacher",
  "teacher",
  "teacher_reception",
  "teacher_year_circle",
  "teacher_forum_circle",
  "teacher_assistant",
  "course_instructor",
  "media",
];

const COLUMNS: { label: string; get: (row: Row, index: number) => string }[] = [
  { label: "م", get: (_row, index) => String(index + 1) },
  { label: "الاسم", get: (row) => row.full_name },
  { label: "رقم الهوية", get: (row) => row.national_id },
  { label: "رقم التواصل", get: (row) => row.phone_number || "" },
  { label: "تاريخ الميلاد", get: (row) => row.birthdate || "" },
  { label: "اسم المحفظة", get: (row) => row.wallet_name || "" },
  { label: "رقم المحفظة", get: (row) => row.wallet_number || "" },
  { label: "الحالة", get: (row) => MARITAL_LABEL[row.marital_status] || "" },
  { label: "المؤهل العلمي", get: (row) => row.education_qualification || "" },
  { label: "آخر دورة تجويد", get: (row) => row.last_tajweed_course || "" },
  {
    label: "عدد أفراد الأسرة",
    get: (row) => (row.family_members_count != null ? String(row.family_members_count) : ""),
  },
  { label: "المسمى الوظيفي", get: (row) => row.job_title_display || JOB_TITLE_LABEL[row.job_title] || "" },
];

function classifyHeader(raw: string): keyof StaffImportRow | null {
  const header = String(raw || "").trim();
  if (!header || header === "##" || header === "م" || header === "#") return null;
  if (header.includes("عدد الطلاب")) return null;

  if (header.includes("الإسم") || header.includes("الاسم")) return "full_name";
  if (header.includes("هوية")) return "national_id";
  if (header.includes("التواصل") || header.includes("الجوال") || header.includes("الهاتف"))
    return "phone_number";
  if (header.includes("الميلاد") || header.includes("تاريخ")) return "birthdate";
  if (header.includes("اسم المحفظة")) return "wallet_name";
  if (header.includes("رقم المحفظة")) return "wallet_number";
  if (header.includes("الحالة")) return "marital_status";
  if (header.includes("المؤهل")) return "education_qualification";
  if (header.includes("تجويد") || header.includes("الدورة")) return "last_tajweed_course";
  if (header.includes("الأسرة") || header.includes("افراد")) return "family_members_count";
  if (header.includes("المسمى") || header.includes("الوظيف")) return "job_title";
  return null;
}

interface StaffImportRow {
  full_name: string;
  national_id: string;
  phone_number: string;
  birthdate: string;
  wallet_name: string;
  wallet_number: string;
  marital_status: string;
  education_qualification: string;
  last_tajweed_course: string;
  family_members_count: string;
  job_title: string;
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    const year = cell.getFullYear();
    const month = String(cell.getMonth() + 1).padStart(2, "0");
    const day = String(cell.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(cell).trim();
}

function teacherToRow(teacher: TeacherListEntry): Row {
  return {
    id: teacher.id,
    full_name: teacher.full_name,
    national_id: teacher.national_id || "",
    phone_number: teacher.phone_number,
    job_title: (teacher.job_title || "teacher") as StaffJobTitle,
    job_title_display: JOB_TITLE_LABEL[teacher.job_title || "teacher"] || teacher.job_title || "محفظ",
    birthdate: teacher.birthdate || null,
    marital_status: teacher.marital_status || "",
    education_qualification: teacher.education_qualification || "",
    last_tajweed_course: teacher.last_tajweed_course || "",
    wallet_name: teacher.wallet_name || "",
    wallet_number: teacher.wallet_number || "",
    family_members_count: teacher.family_members_count ?? null,
    source: "teacher",
  };
}

function staffToRow(staff: StaffMember): Row {
  return {
    id: staff.id,
    full_name: staff.full_name,
    national_id: staff.national_id,
    phone_number: staff.phone_number,
    job_title: staff.job_title,
    job_title_display: staff.job_title_display || JOB_TITLE_LABEL[staff.job_title] || staff.job_title,
    birthdate: staff.birthdate,
    marital_status: staff.marital_status,
    education_qualification: staff.education_qualification,
    last_tajweed_course: staff.last_tajweed_course,
    wallet_name: staff.wallet_name,
    wallet_number: staff.wallet_number,
    family_members_count: staff.family_members_count,
    source: "staff",
  };
}

function compareRows(a: Row, b: Row): number {
  const ai = SORT_ORDER.indexOf(a.job_title as StaffJobTitle);
  const bi = SORT_ORDER.indexOf(b.job_title as StaffJobTitle);
  const ax = ai === -1 ? SORT_ORDER.length : ai;
  const bx = bi === -1 ? SORT_ORDER.length : bi;
  if (ax !== bx) return ax - bx;
  return a.full_name.localeCompare(b.full_name, "ar");
}

async function uploadChunkWithRetry(
  chunkData: Record<string, string>[],
  maxRetries = 3,
  initialDelay = 1000,
  timeoutMs = 120_000,
): Promise<BulkStaffImportResult> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await api.post<BulkStaffImportResult>(
        "/api/users/teachers/bulk-create/",
        { rows: chunkData },
        controller.signal,
      );
      if (!response.success) {
        throw new Error(response.error?.message || "خطأ غير معروف من الخادم");
      }
      return response.data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  throw lastError || new Error("فشل الرفع بعد عدة محاولات");
}

export default function StaffDbPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [xlsxReady, setXlsxReady] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [teachersResp, staffResp] = await Promise.all([
      api.get<TeacherListEntry[]>("/api/users/teachers/"),
      api.get<StaffMember[]>("/api/users/staff-members/"),
    ]);

    const all: Row[] = [];
    if (teachersResp.success) all.push(...teachersResp.data.map(teacherToRow));
    else
      showToast(teachersResp.error?.message || "تعذر تحميل قائمة المحفظين.", "error");

    if (staffResp.success) all.push(...staffResp.data.map(staffToRow));
    else
      showToast(staffResp.error?.message || "تعذر تحميل قائمة الموظفين.", "error");

    all.sort(compareRows);
    setRows(all);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as Window & { XLSX?: XLSXModule }).XLSX) {
      setXlsxReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setXlsxReady(true);
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const XLSX = (window as Window & { XLSX?: XLSXModule }).XLSX;
    if (!XLSX) {
      showToast("جاري تحميل مكتبة الاستيراد، يرجى المحاولة بعد لحظات.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    setImportProgress(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      let rowsMatrix: unknown[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const candidate = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][];
        if (candidate.length > rowsMatrix.length) rowsMatrix = candidate;
      }

      if (rowsMatrix.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      let headerRowIndex = -1;
      let columnMap: (keyof StaffImportRow | null)[] = [];
      for (let rowIndex = 0; rowIndex < Math.min(rowsMatrix.length, 10); rowIndex += 1) {
        const candidateHeaders = rowsMatrix[rowIndex].map(cellToString);
        const detected = candidateHeaders.map(classifyHeader);
        if (detected.includes("full_name") && detected.includes("job_title")) {
          headerRowIndex = rowIndex;
          columnMap = detected;
          break;
        }
      }

      if (headerRowIndex === -1) {
        alert(
          "لم يتم العثور على أعمدة 'الاسم' و'المسمى الوظيفي'.\n" +
            "تأكد أن أحد الصفوف الأولى يحتوي على أسماء الأعمدة بالعربية.",
        );
        return;
      }

      const fullNameIdx = columnMap.indexOf("full_name");
      const jobTitleIdx = columnMap.indexOf("job_title");
      const dataRows = rowsMatrix.slice(headerRowIndex + 1).filter((row) => {
        const fullName = cellToString(row[fullNameIdx]);
        const jobTitle = cellToString(row[jobTitleIdx]);
        return fullName !== "" || jobTitle !== "";
      });

      const parsedRows = dataRows.map((row) => {
        const normalized: Record<string, string> = {};
        columnMap.forEach((key, columnIndex) => {
          if (!key) return;
          normalized[key] = cellToString(row[columnIndex]);
        });
        return normalized;
      });

      if (parsedRows.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      const chunkSize = 10;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors: BulkStaffImportResult["errors"] = [];

      for (let index = 0; index < parsedRows.length; index += chunkSize) {
        const chunk = parsedRows.slice(index, index + chunkSize);
        const chunkNumber = Math.floor(index / chunkSize) + 1;
        const totalChunks = Math.max(1, Math.ceil(parsedRows.length / chunkSize));
        setImportProgress({ current: chunkNumber, total: totalChunks });

        try {
          const result = await uploadChunkWithRetry(chunk);
          totalCreated += result.created_count;
          totalUpdated += result.updated_count;
          totalErrors = totalErrors.concat(
            result.errors.map((error) => ({
              ...error,
              row: index + error.row,
            })),
          );
        } catch (chunkError) {
          chunk.forEach((row, offset) => {
            totalErrors.push({
              row: index + offset + 1,
              national_id: row.national_id || null,
              message: chunkError instanceof Error ? chunkError.message : String(chunkError),
            });
          });
        }
      }

      let message = `تم إنشاء ${totalCreated} موظف`;
      if (totalUpdated > 0) message += `، وتحديث ${totalUpdated} سجل`;
      message += " بنجاح.";

      if (totalErrors.length > 0) {
        message += `\nفشل ${totalErrors.length} صف:\n`;
        message += totalErrors
          .slice(0, 10)
          .map((error) => `صف ${error.row} (${error.national_id || "بدون هوية"}): ${error.message}`)
          .join("\n");
        if (totalErrors.length > 10) {
          message += `\n... و${totalErrors.length - 10} خطأ إضافي.`;
        }
      }

      alert(message);
      await loadAll();
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "تعذر قراءة الملف أو استيراده. تأكد من أنه ملف Excel صالح.";
      alert(errorMessage);
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim();
    return (
      row.full_name.includes(q) ||
      row.national_id.includes(q) ||
      row.phone_number.includes(q) ||
      (row.job_title_display || "").includes(q)
    );
  });

  return (
    <div dir="rtl" className="min-h-screen space-y-4 bg-surface-subtle p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-body">هيكلية المركز</h1>
          <p className="mt-1 text-sm text-text-muted">
            عرض {filteredRows.length} من أصل {rows.length} موظف
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            disabled={!xlsxReady || importing}
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing
              ? `جاري الاستيراد... (${importProgress?.current || 0}/${importProgress?.total || 0})`
              : "استيراد Excel"}
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

      <div className="rounded-xl border border-border-subtle bg-white p-4">
        <label className="relative block max-w-md">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث بالاسم، رقم الهوية، أو المسمى الوظيفي..."
            className="w-full rounded-lg border border-border-subtle py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-right text-sm">
            <thead className="bg-surface-subtle text-text-body">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    className="border-b border-border-subtle px-4 py-3 font-semibold"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-text-muted">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-text-muted">
                    لا يوجد موظفون يطابقون البحث.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={`${row.source}-${row.id}`} className="transition-colors hover:bg-surface-subtle">
                    {COLUMNS.map((column) => (
                      <td key={column.label} className="px-4 py-3 text-text-label">
                        {column.get(row, index)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
