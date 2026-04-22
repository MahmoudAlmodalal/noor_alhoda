"""
Façade for the Excel import pipeline. The real implementation lives in the
`students.services.excel_import` sub-package:

- `normalization` — pure row/text/phone/date helpers.
- `resolvers` — cache-driven teacher/course/parent lookup-or-create.
- `orchestrator` — `excel_bulk_import` (top-level), student create/update.

Read-only lookups are defined in `students.selectors.import_selectors`.
"""
from students.services.excel_import.orchestrator import excel_bulk_import  # noqa: F401
