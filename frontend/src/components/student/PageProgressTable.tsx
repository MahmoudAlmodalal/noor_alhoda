import type { PageProgress } from "@/lib/progress/pages";

export function PageProgressTable({ progress, period }: { progress?: PageProgress; period: string }) {
  if (!progress) return null;
  const rows = [
    { label: "المطلوب", key: "required" },
    { label: "المنجز", key: "completed" },
    { label: "المتبقي", key: "remaining" },
    { label: "الإنجاز", key: "percentage" },
  ] as const;
  return (
    <section aria-label="تقدم الحفظ والمراجعة" className="rounded-2xl border border-border-card bg-white p-4 sm:p-6" dir="rtl">
      <h2 className="font-bold text-text-title">تقدم الحفظ والمراجعة</h2>
      <p className="mt-1 text-xs text-text-muted">الفترة: <bdi>{period}</bdi></p>
      {!progress.has_assignment ? <p className="mt-2 text-sm text-text-muted">لا توجد خطة لهذه الفترة.</p> : null}
      <table className="mt-4 w-full text-center text-sm">
        <thead className="bg-surface-subtle text-text-muted"><tr><th scope="col" className="p-3">المؤشر</th><th scope="col" className="p-3">الحفظ</th><th scope="col" className="p-3">المراجعة</th></tr></thead>
        <tbody>{rows.map(({ label, key }) => <tr key={key} className="border-t border-border-card">
          <th scope="row" className="p-3 text-text-body">{label}</th>
          {(["memorization", "revision"] as const).map((category) => <td key={category} className="p-3 text-text-body"><bdi>{progress[category][key]}{key === "percentage" ? "%" : " صفحة"}</bdi></td>)}
        </tr>)}</tbody>
      </table>
    </section>
  );
}
