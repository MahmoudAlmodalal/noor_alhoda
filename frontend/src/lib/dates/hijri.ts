const HIJRI_FMT = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const HIJRI_PARTS_FMT = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const GREGORIAN_FMT = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const WEEKDAY_FMT = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });

export type HijriParts = {
  year: number;
  month: number;
  day: number;
};

export function toHijriParts(date: Date): HijriParts {
  const parts = HIJRI_PARTS_FMT.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

export function formatHijri(date: Date): string {
  return HIJRI_FMT.format(date).replace(/هـ?$/u, "هـ").trim();
}

export function formatGregorian(date: Date): string {
  return GREGORIAN_FMT.format(date);
}

export function formatWeekday(date: Date): string {
  return WEEKDAY_FMT.format(date);
}

export function formatDualDate(date: Date = new Date()): {
  hijri: string;
  gregorian: string;
  weekday: string;
} {
  return {
    hijri: formatHijri(date),
    gregorian: formatGregorian(date),
    weekday: formatWeekday(date),
  };
}
