/** Plans and daily logs use the existing 15-lines-per-page definition.
 * Evaluations and surah-only review logs carry no page workload. */
export interface PageCategoryProgress {
  required: number;
  completed: number;
  remaining: number;
  percentage: number;
}
export interface PageProgress {
  has_assignment: boolean;
  memorization: PageCategoryProgress;
  revision: PageCategoryProgress;
}

type Plan = { required_pages?: number; total_required_lines?: number; review_required_pages?: number };
type Record = { memorized_lines?: number; review_lines?: number; review_from_page?: number | null; review_to_page?: number | null };
const round = (n: number) => Math.round(n * 100) / 100;
const nonnegative = (n: unknown) => Math.max(0, Number(n) || 0);

export function revisionPages(record: Record): number {
  if (nonnegative(record.review_lines) > 0) return nonnegative(record.review_lines) / 15;
  if (record.review_from_page != null && record.review_to_page != null && record.review_to_page >= record.review_from_page) {
    return record.review_to_page - record.review_from_page + 1;
  }
  return 0;
}

export function computePageProgress(plans: Plan[], records: Record[]): PageProgress {
  function category(required: number, completed: number): PageCategoryProgress {
    return { required: round(required), completed: round(completed), remaining: round(Math.max(0, required - completed)), percentage: required > 0 ? round(Math.min(100, completed / required * 100)) : 0 };
  }
  return {
    has_assignment: plans.length > 0,
    memorization: category(
      plans.reduce((sum, p) => sum + (nonnegative(p.required_pages) || nonnegative(p.total_required_lines) / 15), 0),
      records.reduce((sum, r) => sum + nonnegative(r.memorized_lines) / 15, 0)
    ),
    revision: category(
      plans.reduce((sum, p) => sum + nonnegative(p.review_required_pages), 0),
      records.reduce((sum, r) => sum + revisionPages(r), 0)
    ),
  };
}
