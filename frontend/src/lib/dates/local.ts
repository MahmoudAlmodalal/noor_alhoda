export const DEFAULT_TIME_ZONE = "Asia/Gaza";

/**
 * Return the current calendar date in the requested IANA time zone.
 * Using Intl parts avoids the UTC day shift caused by toISOString().
 */
export function todayISOInTimeZone(
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
