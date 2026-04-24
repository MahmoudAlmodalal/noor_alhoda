/**
 * Mirror of backend/records/services/surah_range.py. Conservative parser:
 * strips verse numbers/ranges, keeps distinct surah names. Used client-side
 * for the evaluation preparation readiness card.
 */

const SEPARATOR_PATTERN = /[,،؛;/|\n\r]+/;
const VERSE_PATTERN = /\d+\s*[-–—]\s*\d+|\d+/g;

export function parseSurahRange(surahRange: string | null | undefined): string[] {
    if (!surahRange) return [];
    const raw = String(surahRange).trim();
    if (!raw) return [];

    const result: string[] = [];
    const seen = new Set<string>();

    for (const part of raw.split(SEPARATOR_PATTERN)) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const name = trimmed.replace(VERSE_PATTERN, "").trim();
        if (!name) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        result.push(name);
    }

    return result;
}
