import io
from pathlib import Path

from students.models import Student
from records.models import WeeklyPlan, DailyRecord

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

    student = Student.objects.select_related("user", "teacher").get(id=student_id)

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
    teacher_name = student.teacher.full_name if student.teacher else "غير معيّن"
    info_data = [
        [_ar("الاسم"), _ar(student.full_name)],
        [_ar("رقم الهوية"), _ar(student.national_id)],
        [_ar("الصف الدراسي"), _ar(student.grade)],
        [_ar("المحفظ"), _ar(teacher_name)],
        [_ar("تاريخ الالتحاق"), str(student.enrollment_date)],
        [_ar("الحالة الصحية"), _ar(student.get_health_status_display())],
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

    # Weekly plans summary
    heading_style = ParagraphStyle(
        "ArabicHeading",
        parent=styles["Heading2"],
        fontName="Arabic",
        alignment=2,  # Right
    )
    elements.append(Paragraph(_ar("السجل الحفظي"), heading_style))
    elements.append(Spacer(1, 0.3 * cm))

    plans = WeeklyPlan.objects.filter(student=student).order_by("-week_start")[:12]

    normal_style = ParagraphStyle(
        "ArabicNormal",
        parent=styles["Normal"],
        fontName="Arabic",
        alignment=2,  # Right
    )

    if plans:
        plan_data = [
            [
                _ar("الأسبوع"),
                _ar("بداية الأسبوع"),
                _ar("المطلوب"),
                _ar("المنجز"),
                _ar("نسبة الإنجاز"),
            ]
        ]
        for plan in plans:
            plan_data.append(
                [
                    str(plan.week_number),
                    str(plan.week_start),
                    str(plan.total_required),
                    str(plan.total_achieved),
                    f"{plan.completion_rate}%",
                ]
            )

        plan_table = Table(plan_data, colWidths=[2.5 * cm, 3.5 * cm, 3 * cm, 3 * cm, 4 * cm])
        plan_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a472a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, -1), "Arabic"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
                ]
            )
        )
        elements.append(plan_table)
    else:
        elements.append(Paragraph(_ar("لا توجد سجلات حفظية بعد."), normal_style))

    doc.build(elements)
    return buffer.getvalue()
