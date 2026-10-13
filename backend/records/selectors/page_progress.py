"""Page workloads from existing assignments and daily logs (15 lines/page)."""


def revision_pages(record):
    if record.review_lines:
        return record.review_lines / 15
    if (record.review_from_page is not None and record.review_to_page is not None
            and record.review_to_page >= record.review_from_page):
        return record.review_to_page - record.review_from_page + 1
    return 0


def page_progress(*, plans, records):
    def category(required, completed):
        return {
            "required": round(required, 2),
            "completed": round(completed, 2),
            "remaining": round(max(0, required - completed), 2),
            "percentage": round(min(100, completed / required * 100), 2) if required else 0,
        }

    return {
        "has_assignment": bool(plans),
        "memorization": category(
            sum(float(p.required_pages or 0) or (p.total_required_lines or 0) / 15 for p in plans),
            sum((r.memorized_lines or 0) / 15 for r in records),
        ),
        "revision": category(
            sum(float(p.review_required_pages or 0) for p in plans),
            sum(revision_pages(r) for r in records),
        ),
    }
