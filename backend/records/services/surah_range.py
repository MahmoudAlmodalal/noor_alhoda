"""
Conservative surah-range parser for evaluations.

Accepts inputs like:
  "البقرة 1-40"
  "البقرة"
  "الفاتحة, الناس"
  "البقرة 1-40, آل عمران 1-20"

Returns a list of distinct surah names (verse numbers stripped). If an
input is ambiguous or empty, it is skipped rather than corrupting the
mastery reset downstream.
"""

from __future__ import annotations

import re


_SEPARATORS = re.compile(r"[,،؛;/|\n\r]+")
_VERSE_PATTERN = re.compile(r"\d+\s*[-–—]\s*\d+|\d+")


def surah_range_to_names(surah_range: str | None) -> list[str]:
    if not surah_range:
        return []
    raw = str(surah_range).strip()
    if not raw:
        return []

    result: list[str] = []
    seen: set[str] = set()

    for part in _SEPARATORS.split(raw):
        if not part:
            continue
        name = _VERSE_PATTERN.sub("", part).strip()
        if not name:
            continue
        if name in seen:
            continue
        seen.add(name)
        result.append(name)

    return result
