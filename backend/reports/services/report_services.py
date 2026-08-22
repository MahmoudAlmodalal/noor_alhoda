import io
from pathlib import Path

from reports.selectors.report_selectors import (
    attendance_summary_for_report,
    evaluated_evaluations_for_report,
    student_for_report,
)
from students.selectors.student_selectors import monthly_history_for_student

FONT_PATH = Path(__file__).resolve().parent.parent.parent / "fonts" / "Amiri-Regular.ttf"
_font_registered = False


def _ar(text: str) -> str:
    """Reshape and apply BiDi algorithm so Arabic renders correctly in PDF."""
    import arabic_reshaper
    from bidi.algorithm import get_display

    reshaped = arabic_reshaper.reshape(str(text))
    return get_display(reshaped)


def generate_student_pdf(*, student_id) -> bytes:
    """
    Generate a PDF report for a student (feature 5.5).
    Contains student info + memorization history table.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    global _font_registered
    if not _font_registered:
        pdfmetrics.registerFont(TTFont("Arabic", str(FONT_PATH)))
        _font_registered = True

    student = student_for_report(student_id=student_id)
    attendance_summary = attendance_summary_for_report(student=student)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm)
    elements = []

    styles = getSampleStyleSheet()

    # Title
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName="Arabic",
        fontSize=18,
        alignment=1,  # Center
    )
    elements.append(Paragraph(_ar("مركز نور الهدى لتحفيظ القرآن الكريم"), title_style))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(_ar(f"تقرير الطالب: {student.full_name}"), title_style))
    elements.append(Spacer(1, 1 * cm))

    # Student info table
    info_data = [
        [_ar("الاسم"), _ar(student.full_name)],
        [_ar("رقم الهوية"), _ar(student.user.national_id or "غير متوفر")],
    ]

    info_table = Table(info_data, colWidths=[6 * cm, 10 * cm])
    info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1a472a")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, -1), "Arabic"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 1 * cm))

    # Monthly history summary — this is the same aggregation used by the
    # student detail page. WeeklyPlan totals are denormalized cache fields and
    # can lag briefly after an offline record is synchronized, so the report
    # must derive its values from the linked DailyRecord rows.
    heading_style = ParagraphStyle(
        "ArabicHeading",
        parent=styles["Heading2"],
        fontName="Arabic",
        alignment=2,  # Right
    )
    elements.append(Paragraph(_ar("السجل الشهري"), heading_style))
    elements.append(Spacer(1, 0.3 * cm))

    attendance_data = [
        [_ar("أيام الحضور"), str(attendance_summary["present_days"])],
        [_ar("أيام الغياب"), str(attendance_summary["absent_days"])],
    ]
    attendance_table = Table(attendance_data, colWidths=[6 * cm, 4 * cm])
    attendance_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1a472a")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, -1), "Arabic"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
            ]
        )
    )
    elements.append(attendance_table)
    elements.append(Spacer(1, 0.5 * cm))

    normal_style = ParagraphStyle(
        "ArabicNormal",
        parent=styles["Normal"],
        fontName="Arabic",
        alignment=2,  # Right
    )
    history = monthly_history_for_student(student=student)

    if history:
        history_data = [
            [
                _ar("الشهر"),
                _ar("المطلوب"),
                _ar("الحفظ المنجز"),
                _ar("المراجعة"),
                _ar("الحضور"),
                _ar("الاختبارات"),
                _ar("نسبة الإنجاز"),
            ]
        ]
        for month in history:
            required = f"{month['required_pages']:.1f} ص"
            saved = f"{month['total_pages']:.1f} ص · {month['total_lines']} سطر"
            saved += f"\n({month['total_achieved']} آية)"
            review = f"{month['total_review_pages']:.1f} ص · {month['total_review_lines']} سطر"
            review_required = month.get("required_review_pages", 0)
            if review_required:
                review = f"{review}\n(المطلوب {review_required:.1f} ص)"
            tests = (
                f"{month['evaluated_evaluation_count']}/{month['evaluation_count']}"
                f" ({month['evaluation_completion_rate']:.0f}%)"
                if month["evaluation_count"]
                else "0"
            )
            history_data.append(
                [
                    str(month["month_start"])[:7],
                    _ar(required),
                    _ar(saved),
                    _ar(review),
                    str(month["present_days"]),
                    tests,
                    f"{month['completion_rate']:.2f}%",
                ]
            )

        history_table = Table(
            history_data,
            colWidths=[2 * cm, 2.2 * cm, 3.4 * cm, 3.4 * cm, 1.7 * cm, 2.2 * cm, 2.2 * cm],
            repeatRows=1,
        )
        history_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a472a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("FONTNAME", (0, 0), (-1, -1), "Arabic"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        elements.append(history_table)
    else:
        elements.append(Paragraph(_ar("لا توجد سجلات حفظية بعد."), normal_style))

    evaluations = evaluated_evaluations_for_report(student=student)
    elements.append(Spacer(1, 0.7 * cm))
    elements.append(Paragraph(_ar("سجل الاختبارات"), heading_style))
    elements.append(Spacer(1, 0.3 * cm))
    if evaluations:
        status_labels = {
            "passed": "ناجح",
            "failed": "لم ينجح",
            "missed": "متغيب",
        }
        evaluation_data = [
            [
                _ar("التاريخ"),
                _ar("الاختبار"),
                _ar("نطاق السور"),
                _ar("النتيجة"),
                _ar("الدرجة"),
                _ar("ملاحظة المعلم"),
            ]
        ]
        for evaluation in evaluations:
            score = (
                "—"
                if evaluation.score is None
                else f"{evaluation.score.normalize():f}/{evaluation.max_score.normalize():f}"
            )
            evaluation_data.append(
                [
                    str(evaluation.scheduled_date),
                    _ar(evaluation.title),
                    _ar(evaluation.surah_range or "—"),
                    _ar(status_labels.get(evaluation.status, evaluation.status)),
                    score,
                    _ar(evaluation.result_note or "—"),
                ]
            )
        evaluation_table = Table(
            evaluation_data,
            colWidths=[2 * cm, 3 * cm, 3.5 * cm, 2 * cm, 2 * cm, 4.5 * cm],
            repeatRows=1,
        )
        evaluation_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a472a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("FONTNAME", (0, 0), (-1, -1), "Arabic"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(evaluation_table)
    else:
        elements.append(Paragraph(_ar("لا توجد اختبارات مقيّمة بعد."), normal_style))

    doc.build(elements)

    return buffer.getvalue()
