"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import type {
  BulkStudentImportResult,
  Course,
  PaginatedData,
  Student,
  StudentSkills,
  Teacher,
} from "@/types/api";

const PAGE_SIZE = 25;

type XLSXSheet = Record<string, unknown>;
type XLSXWorkbook = {
  SheetNames: string[];
  Sheets: Record<string, XLSXSheet>;
};
type XLSXModule = {
  read(data: ArrayBuffer, options: { type: string; cellDates: boolean }): XLSXWorkbook;
  writeFile(workbook: Record<string, unknown>, filename: string): void;
  utils: {
    json_to_sheet(
      rows: Record<string, string>[],
      options: { header: string[] },
    ): Record<string, unknown>;
    book_new(): Record<string, unknown>;
    book_append_sheet(
      workbook: Record<string, unknown>,
      worksheet: Record<string, unknown>,
      name: string,
    ): void;
    sheet_to_json(
      sheet: XLSXSheet,
      options: { header: number; defval: string; raw: boolean },
    ): unknown[];
  };
};

const GRADE_LABEL: Record<string, string> = {
  "1": "الأول",
  "2": "الثاني",
  "3": "الثالث",
  "4": "الرابع",
  "5": "الخامس",
  "6": "السادس",
  "7": "السابع",
  "8": "الثامن",
  "9": "التاسع",
  "10": "العاشر",
  "11": "الحادي عشر",
  "12": "الثاني عشر",
};

const HEALTH_LABEL: Record<string, string> = {
  normal: "",
  martyr_son: "ابن شهيد",
  sick: "مريض",
  injured: "جريح",
  other: "",
};

const AFFILIATION_LABEL: Record<string, string> = {
  awqaf: "أوقاف",
  dar_quran: "دار القرآن",
  sheikh_tabaea: "شيخ التباعية",
};

const COLUMNS: { label: string; get: (student: Student, index: number) => string }[] = [
  { label: "م", get: (_student, index) => String(index + 1) },
  { label: "الاسم الرباعي", get: (student) => student.full_name },
  { label: "رقم الهوية", get: (student) => student.national_id },
  { label: "تاريخ الميلاد", get: (student) => student.birthdate },
  { label: "العمر", get: (student) => computeAge(student.birthdate) },
  { label: "الصف الدراسي", get: (student) => GRADE_LABEL[student.grade] || student.grade },
  { label: "رقم الجوال", get: (student) => student.mobile || "" },
  { label: "رقم الواتساب", get: (student) => student.whatsapp || "" },
  { label: "عنوان السكن", get: (student) => student.address || "" },
  { label: "الحالة الخاصة", get: (student) => formatHealth(student) },
  { label: "المهارات", get: (student) => formatSkills(student.skills) },
  { label: "الدورات السابقة", get: (student) => student.previous_courses || "" },
  { label: "اسم ولي الأمر", get: (student) => student.guardian_name || "" },
  { label: "رقم هوية ولي الأمر", get: (student) => student.guardian_national_id || "" },
  { label: "رقم جوال ولي الأمر", get: (student) => student.guardian_mobile || "" },
  { label: "رقم الحساب", get: (student) => student.bank_account_number || "" },
  { label: "اسم الحساب", get: (student) => student.bank_account_name || "" },
  { label: "نوع الحساب", get: (student) => student.bank_account_type || "" },
  { label: "اسم الشيخ", get: (student) => student.teacher_name || "" },
  { label: "التباعية", get: (student) => AFFILIATION_LABEL[student.affiliation || ""] || student.affiliation || "" },
];

function computeAge(birthdate: string): string {
  if (!birthdate || birthdate === "1900-01-01") return "";

  const date = new Date(birthdate);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age >= 0 && age <= 120 ? String(age) : "";
}

function formatHealth(student: Student): string {
  const status = HEALTH_LABEL[student.health_status] || "";
  const note = student.health_note || "";
  if (status && note) return `${status}، ${note}`;
  return status || note || "";
}

function formatSkills(skills: StudentSkills | null | undefined): string {
  if (!skills) return "";

  const labels: string[] = [];
  if (skills.quran) labels.push("قراءة القرآن");
  if (skills.nasheed) labels.push("إنشاد");
  if (skills.poetry) labels.push("شعر");
  if (skills.other_text) labels.push(skills.other_text);
  else if (skills.other) labels.push("أخرى");

  return labels.join("، ");
}

function classifyHeader(raw: string, counters: Record<string, number>): string | null {
  const header = String(raw || "").trim();
  if (!header || header === "م" || header === "#" || header === "العمر") {
    return null;
  }

  if (header.includes("ولي")) {
    if (header.includes("هوية")) return "guardian_national_id";
    if (header.includes("جوال") || header.includes("حوال") || header.includes("هاتف") || header.includes("موبايل")) {
      return "guardian_mobile";
    }
    if (header.includes("اسم")) return "guardian_name";
    return null;
  }

  if (header.includes("الشيخ") || header.includes("المحفظ")) return "teacher_name";
  if (header.includes("الحساب")) {
    if (header.includes("رقم")) return "bank_account_number";
    if (header.includes("اسم")) return "bank_account_name";
    if (header.includes("نوع")) return "bank_account_type";
  }
  if (header.includes("التباع") || header.includes("التبع")) return "affiliation";
  if (header.includes("الواتس")) return "whatsapp";
  if (header.includes("الميلاد") || header.includes("تاريخ")) return "birthdate";
  if (header.includes("الصف")) return "grade";
  if (header.includes("العنوان") || header.includes("السكن")) return "address";
  if (header.includes("الحالة") || header.includes("الخاصه")) return "health_status";
  if (header.includes("المهارات") || header.includes("المهارة")) return "skills";
  if (header.includes("الدورات") || header.includes("السابقة")) return "previous_courses";
  if (header.includes("المطلوب")) return "desired_courses";

  if (header.includes("اسم")) {
    counters.name = (counters.name || 0) + 1;
    return counters.name === 1 ? "full_name" : "guardian_name";
  }
  if (header.includes("هوية")) {
    counters.id = (counters.id || 0) + 1;
    return counters.id === 1 ? "national_id" : "guardian_national_id";
  }
  if (header.includes("جوال") || header.includes("حوال") || header.includes("هاتف") || header.includes("موبايل")) {
    counters.phone = (counters.phone || 0) + 1;
    return counters.phone === 1 ? "mobile" : "guardian_mobile";
  }

  return null;
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

async function uploadChunkWithRetry(
  chunkData: Record<string, string>[],
  maxRetries = 3,
  initialDelay = 1000,
): Promise<BulkStudentImportResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await api.post<BulkStudentImportResult>("/api/students/bulk-create/", {
        rows: chunkData,
      });
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
    }
  }

  throw lastError || new Error("فشل الرفع بعد عدة محاولات");
}

function PaginationBar({
  page,
  totalPages,
  count,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        إجمالي السجلات: <span className="font-bold text-slate-900">{count}</span>
      </p>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          السابق
        </button>
        <span className="text-sm font-semibold text-slate-700">
          صفحة {page} من {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

export default function StudentsDbPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studentsPage, setStudentsPage] = useState<PaginatedData<Student> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [xlsxReady, setXlsxReady] = useState(false);

  const debouncedSearch = useDebounce(search);
  const { data: teachers } = useApi<Teacher[]>("/api/users/teachers/");
  const { data: courses } = useApi<Course[]>("/api/courses/");

  const fetchStudents = useCallback(
    async (pageToLoad = page) => {
      setLoading(true);
      const response = await api.get<PaginatedData<Student>>("/api/students/", {
        paginated: "1",
        page: String(pageToLoad),
        search: debouncedSearch || undefined,
        teacher_id: teacherFilter || undefined,
        course_id: courseFilter || undefined,
      });

      if (response.success) {
        setStudentsPage(response.data);
        if (response.data.page !== pageToLoad) {
          setPage(response.data.page);
        }
      } else {
        showToast(response.error?.message || "تعذر تحميل قائمة الطلاب.", "error");
      }

      setLoading(false);
    },
    [courseFilter, debouncedSearch, page, showToast, teacherFilter],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchStudents();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchStudents]);

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
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const handleExport = useCallback(async () => {
    const XLSX = (window as Window & { XLSX?: XLSXModule }).XLSX;
    if (!XLSX) {
      showToast("جاري تحميل مكتبة التصدير، يرجى المحاولة بعد لحظات.", "error");
      return;
    }

    const response = await api.get<Student[]>("/api/students/", {
      search: debouncedSearch || undefined,
      teacher_id: teacherFilter || undefined,
      course_id: courseFilter || undefined,
    });

    if (!response.success) {
      showToast(response.error?.message || "تعذر تصدير البيانات.", "error");
      return;
    }

    const rows = response.data.map((student, index) =>
      COLUMNS.reduce<Record<string, string>>((accumulator, column) => {
        accumulator[column.label] = column.get(student, index);
        return accumulator;
      }, {}),
    );

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: COLUMNS.map((column) => column.label),
    });
    worksheet["!rtl"] = true;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");
    XLSX.writeFile(workbook, "قاعدة_الطلاب.xlsx");
  }, [courseFilter, debouncedSearch, showToast, teacherFilter]);

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
        if (candidate.length > rowsMatrix.length) {
          rowsMatrix = candidate;
        }
      }

      if (rowsMatrix.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      let headerRowIndex = -1;
      let columnMap: (string | null)[] = [];
      for (let rowIndex = 0; rowIndex < Math.min(rowsMatrix.length, 6); rowIndex += 1) {
        const candidateHeaders = rowsMatrix[rowIndex].map(cellToString);
        const counters: Record<string, number> = {};
        const detectedColumns = candidateHeaders.map((header) => classifyHeader(header, counters));
        if (detectedColumns.includes("full_name") && detectedColumns.includes("national_id")) {
          headerRowIndex = rowIndex;
          columnMap = detectedColumns;
          break;
        }
      }

      if (headerRowIndex === -1) {
        alert(
          "لم يتم العثور على أعمدة 'الاسم الرباعي' و'رقم الهوية'.\n" +
            "تأكد أن أحد الصفوف الأولى يحتوي على أسماء الأعمدة بالعربية.",
        );
        return;
      }

      const fullNameIndex = columnMap.indexOf("full_name");
      const nationalIdIndex = columnMap.indexOf("national_id");
      const dataRows = rowsMatrix.slice(headerRowIndex + 1).filter((row) => {
        const fullName = cellToString(row[fullNameIndex]);
        const nationalId = cellToString(row[nationalIdIndex]);
        return fullName !== "" || nationalId !== "";
      });

      const parsedRows = dataRows.map((row) => {
        const normalizedRow: Record<string, string> = {};
        columnMap.forEach((key, columnIndex) => {
          if (!key) return;
          normalizedRow[key] = cellToString(row[columnIndex]);
        });
        return normalizedRow;
      });

      if (parsedRows.length === 0) {
        alert("لا يوجد صفوف في الملف.");
        return;
      }

      const chunkSize = 10;
      let totalCreated = 0;
      let totalUpdated = 0;
      let rowOffset = 0;
      let totalErrors: BulkStudentImportResult["errors"] = [];

      for (let index = 0; index < parsedRows.length; index += chunkSize) {
        const chunk = parsedRows.slice(index, index + chunkSize);
        const chunkNumber = Math.floor(index / chunkSize) + 1;
        const totalChunks = Math.ceil(parsedRows.length / chunkSize);
        setImportProgress({ current: chunkNumber, total: totalChunks });

        const result = await uploadChunkWithRetry(chunk);
        totalCreated += result.created_count;
        totalUpdated += result.updated_count;
        totalErrors = totalErrors.concat(
          result.errors.map((error) => ({
            ...error,
            row: error.row + rowOffset,
          })),
        );
        rowOffset += chunk.length;
      }

      let message = `تم إنشاء ${totalCreated} طالب`;
      if (totalUpdated > 0) {
        message += `، وتحديث ${totalUpdated} سجل`;
      }
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
      setPage(1);
      await fetchStudents(1);
    } catch (error) {
      console.error(error);
      alert("تعذر قراءة الملف أو استيراده. تأكد من أنه ملف Excel صالح.");
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const students = studentsPage?.items ?? [];
  const totalPages = studentsPage?.total_pages ?? 1;
  const rowOffset = ((studentsPage?.page ?? 1) - 1) * PAGE_SIZE;

  return (
    <div dir="rtl" className="min-h-screen space-y-4 bg-slate-50 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">قاعدة بيانات الطلاب</h1>
          <p className="mt-1 text-sm text-slate-500">
            عرض {students.length} من أصل {studentsPage?.count ?? 0} سجل
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={!xlsxReady || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            تصدير Excel
          </button>
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

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="البحث بالاسم أو الهوية..."
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <select
          value={teacherFilter}
          onChange={(event) => {
            setTeacherFilter(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">كل المحفظين</option>
          {(teachers ?? []).map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name}
            </option>
          ))}
        </select>

        <select
          value={courseFilter}
          onChange={(event) => {
            setCourseFilter(event.target.value);
            setPage(1);
          }}
          className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">كل الدورات</option>
          {(courses ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      <PaginationBar
        page={studentsPage?.page ?? 1}
        totalPages={totalPages}
        count={studentsPage?.count ?? 0}
        onPageChange={setPage}
      />

      {loading ? (
        <div className="py-20 text-center text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-max w-full text-right text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column.label}
                    className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate-500">
                    لا توجد نتائج مطابقة للبحث أو الفلاتر الحالية.
                  </td>
                </tr>
              ) : (
                students.map((student, index) => (
                  <tr key={student.id} className="transition-colors even:bg-slate-50 hover:bg-blue-50">
                    {COLUMNS.map((column) => (
                      <td
                        key={column.label}
                        className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700"
                      >
                        {column.get(student, rowOffset + index)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBar
        page={studentsPage?.page ?? 1}
        totalPages={totalPages}
        count={studentsPage?.count ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
