/**
 * Tiny pure validators for plain-React forms. No external dependency —
 * frontend/CLAUDE.md forbids adding a form library. Each returns a
 * discriminated union so call sites can branch on `.ok` and surface
 * `.error` directly to the user (Arabic).
 *
 * IMPORTANT: These are UX-only — the backend is the source of truth and
 * MUST enforce the same rules. If you change a rule here, change the
 * matching server-side check too:
 *   - isSaturday      → backend/records/services/record_services.py
 *                       (weekly_plan_create / Saturday-only enforcement)
 *   - positiveInt /   → backend/records/services/record_services.py
 *     verseRange        (verse range validation)
 *   - requiredString  → DRF serializer field constraints in the relevant view
 *   - isoDate         → DRF DateField parsing
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function requiredString(
  value: string | undefined | null,
  fieldLabel = "الحقل"
): ValidationResult {
  if (!value || !value.trim()) {
    return { ok: false, error: `${fieldLabel} مطلوب.` };
  }
  return { ok: true };
}

export function positiveInt(
  value: number | string | undefined | null,
  fieldLabel = "القيمة"
): ValidationResult {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === undefined || n === null || Number.isNaN(n)) {
    return { ok: false, error: `${fieldLabel} يجب أن تكون رقماً.` };
  }
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, error: `${fieldLabel} يجب أن تكون عدداً صحيحاً موجباً.` };
  }
  return { ok: true };
}

export function nonNegativeInt(
  value: number | string | undefined | null,
  fieldLabel = "القيمة"
): ValidationResult {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === undefined || n === null || Number.isNaN(n)) {
    return { ok: false, error: `${fieldLabel} يجب أن تكون رقماً.` };
  }
  if (!Number.isInteger(n) || n < 0) {
    return {
      ok: false,
      error: `${fieldLabel} يجب أن تكون عدداً صحيحاً غير سالب.`,
    };
  }
  return { ok: true };
}

export function isoDate(
  value: string | undefined | null,
  fieldLabel = "التاريخ"
): ValidationResult {
  if (!value) {
    return { ok: false, error: `${fieldLabel} مطلوب.` };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: `${fieldLabel} غير صالح (YYYY-MM-DD).` };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, error: `${fieldLabel} غير صالح.` };
  }
  return { ok: true };
}

export function isSaturday(
  value: string | undefined | null,
  fieldLabel = "بداية الأسبوع"
): ValidationResult {
  const base = isoDate(value, fieldLabel);
  if (!base.ok) return base;
  const d = new Date(value as string);
  if (d.getUTCDay() !== 6) {
    return { ok: false, error: `${fieldLabel} يجب أن تكون يوم سبت.` };
  }
  return { ok: true };
}

export function verseRange(
  from: number | string | undefined,
  to: number | string | undefined
): ValidationResult {
  const f = typeof from === "string" ? Number(from) : from;
  const t = typeof to === "string" ? Number(to) : to;
  if (f === undefined || t === undefined) {
    return { ok: false, error: "نطاق الآيات مطلوب." };
  }
  if (
    !Number.isInteger(f) ||
    f <= 0 ||
    !Number.isInteger(t) ||
    t <= 0
  ) {
    return {
      ok: false,
      error: "نطاق الآيات يجب أن يكون أعداداً صحيحة موجبة.",
    };
  }
  if (f > t) {
    return {
      ok: false,
      error: "بداية النطاق يجب أن تكون أصغر أو تساوي النهاية.",
    };
  }
  return { ok: true };
}

/**
 * Combine multiple validators, returning the first failure or { ok: true }.
 */
export function all(...results: ValidationResult[]): ValidationResult {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return { ok: true };
}
