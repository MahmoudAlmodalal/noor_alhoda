const fs = require('fs');
function classifyHeader(raw, counters) {
  const h = String(raw || "").trim();
  if (!h) return null;
  if (h === "م" || h === "#") return null;
  if (h === "العمر") return null;

  if (h.includes("ولي")) {
    if (h.includes("هوية")) return "guardian_national_id";
    if (h.includes("جوال") || h.includes("حوال") || h.includes("هاتف") || h.includes("موبايل")) return "guardian_mobile";
    if (h.includes("اسم")) return "guardian_name";
    return null;
  }

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
  if (h.includes("الحالة")) return "health_status";
  if (h.includes("المهارات") || h.includes("المهارة")) return "skills";
  if (h.includes("الدورات") || h.includes("السابقة")) return "previous_courses";

  if (h.includes("اسم")) {
    counters.name = (counters.name || 0) + 1;
    return counters.name === 1 ? "full_name" : "guardian_name";
  }
  if (h.includes("هوية")) {
    counters.id = (counters.id || 0) + 1;
    return counters.id === 1 ? "national_id" : "guardian_national_id";
  }
  if (h.includes("جوال") || h.includes("حوال") || h.includes("هاتف") || h.includes("موبايل")) {
    counters.phone = (counters.phone || 0) + 1;
    return counters.phone === 1 ? "mobile" : "guardian_mobile";
  }

  return null;
}

const headersStr = "م\tالاسم رباعي\tرقم الهوية\tتاريخ الميلاد\tالعمر\tالصف الدراسي\tرقم الجوال\tرقم الواتساب\tعنوان السكن\tالحالة الخاصه\tالمهارات\tالدورات السابقة\tالاسم رباعي\tرقم الهوية\tرقم الحوال\tرقم الحساب\tاسم الحساب\tنوع الحساب\tاسم الشيخ\tالتباعيه";
const headers = headersStr.split('\t');
const counters = {};
const mapped = headers.map(h => classifyHeader(h, counters));

console.log(mapped.map((m, i) => `${headers[i]} => ${m}`).join("\n"));
