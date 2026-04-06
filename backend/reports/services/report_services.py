import io

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from backend.students.models import Student
from backend.records.models import WeeklyPlan, DailyRecord


def generate_student_pdf(*, student_id) -> bytes:
    """
    Generate a PDF report for a student (feature 5.5).
    Contains student info + memorization history table.
    """
    student = Student.objects.select_related("user", "teacher").get(id=student_id)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm)
    elements = []

    styles = getSampleStyleSheet()

    # Title
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontSize=18,
        alignment=1,  # Center
    )
    elements.append(Paragraph("مركز نور الهدى لتحفيظ القرآن الكريم", title_style))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(f"تقرير الطالب: {student.full_name}", title_style))
    elements.append(Spacer(1, 1 * cm))

    # Student info table
    info_data = [
        ["الاسم", student.full_name],
        ["رقم الهوية", student.national_id],
        ["الصف الدراسي", student.grade],
        ["المحفظ", student.teacher.full_name if student.teacher else "غير معيّن"],
        ["تاريخ الالتحاق", str(student.enrollment_date)],
        ["الحالة الصحية", student.get_health_status_display()],
    ]

    info_table = Table(info_data, colWidths=[6 * cm, 10 * cm])
    info_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1a472a")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 1 * cm))

    # Weekly plans summary
    elements.append(Paragraph("السجل الحفظي", styles["Heading2"]))
    elements.append(Spacer(1, 0.3 * cm))

    plans = WeeklyPlan.objects.filter(student=student).order_by("-week_start")[:12]

    if plans:
        plan_data = [["الأسبوع", "بداية الأسبوع", "المطلوب", "المنجز", "نسبة الإنجاز"]]
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
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
                ]
            )
        )
        elements.append(plan_table)
    else:
        elements.append(Paragraph("لا توجد سجلات حفظية بعد.", styles["Normal"]))

    doc.build(elements)
    return buffer.getvalue()
