"""A4 Arabic reports from the exact dashboard dataset, without history limits."""

import io
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    LongTable,
    TableStyle,
    PageBreak,
    Image,
)
from reports.services.report_services import FONT_PATH, _ar

LABELS = {
    "present": "حاضر",
    "late": "متأخر",
    "absent": "غائب",
    "excused": "مستأذن",
    "passed": "ناجح",
    "failed": "راسب",
    "missed": "متغيب",
    "scheduled": "مجدول",
    "recorded": "درجة مسجلة",
    "excellent": "ممتاز",
    "good": "جيد جداً",
    "acceptable": "جيد",
    "weak": "ضعيف",
    "none": "لم يسمع",
    "pass": "ناجح",
    "fail": "راسب",
    "pending": "معلق",
    "memorization": "إتمام حفظ",
    "revision": "جلسة مراجعة",
    "exam": "اختبار",
    "attendance": "حضور",
    "evaluation_update": "تحديث تقييم",
}
BLUE = colors.HexColor("#0b5394")


def shown(value, suffix=""):
    if value is None:
        return "غير محسوم"
    if isinstance(value, (int, float)):
        value = f"{value:.2f}".rstrip("0").rstrip(".")
    return f"{value}{suffix}"


def generate_analytics_pdf(data, individual=False):
    if "AnalyticsArabic" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("AnalyticsArabic", str(FONT_PATH)))
    style = ParagraphStyle(
        "AnalyticsArabic",
        fontName="AnalyticsArabic",
        fontSize=9,
        leading=16,
        alignment=TA_RIGHT,
        wordWrap="CJK",
    )
    heading = ParagraphStyle(
        "AnalyticsHeading",
        parent=style,
        fontSize=14,
        leading=24,
        textColor=BLUE,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    # Wrap logical Arabic before reshaping each line. Reshaping a whole long
    # paragraph and then wrapping visual text reverses the line order in RTL.
    def p(value, cell_width=480, st=style):
        text = str(value if value is not None else "—")
        lines = []
        for logical_line in text.splitlines() or [""]:
            current = ""
            for word in logical_line.split():
                candidate = f"{current} {word}".strip()
                if (
                    current
                    and pdfmetrics.stringWidth(_ar(candidate), st.fontName, st.fontSize)
                    > cell_width - 14
                ):
                    lines.append(escape(_ar(current)))
                    current = word
                else:
                    current = candidate
            lines.append(escape(_ar(current)))
        return Paragraph("<br/>".join(lines), st)

    elements = []

    def title(text):
        elements.append(p(text, st=heading))

    def table(headers, rows, weights=None):
        if not rows:
            elements.append(p("لا توجد سجلات خلال الفترة المحددة."))
            return
        widths = [
            480 * w / sum(weights or [1] * len(headers))
            for w in (weights or [1] * len(headers))
        ]
        matrix = [[p(v, widths[i]) for i, v in enumerate(headers)]]
        matrix += [[p(v, widths[i]) for i, v in enumerate(row)] for row in rows]
        # Reverse columns, retaining wrapped Arabic paragraphs for true RTL.
        t = LongTable(
            [list(reversed(row)) for row in matrix],
            colWidths=list(reversed(widths)),
            repeatRows=1,
            hAlign="RIGHT",
            splitInRow=1,
        )
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f0f8")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f6f8fb")],
                    ),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#d4dce6")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(t)
        elements.append(Spacer(1, 8))

    def metrics(r):
        m, v, a, e = r["memorization_goal"], r["revision"], r["attendance"], r["exams"]
        unit = "آية" if m["unit"] == "verses" else "صفحة"
        table(
            ["المؤشر", "الحفظ", "المراجعة"],
            [
                [
                    "المطلوب",
                    shown(m["required"], f" {unit}"),
                    shown(v["required"], " صفحة"),
                ],
                [
                    "المنجز الموثق",
                    shown(m["completed"], f" {unit}"),
                    shown(v["completed"], " صفحة"),
                ],
                [
                    "المتبقي",
                    shown(m["remaining"], f" {unit}"),
                    shown(v["remaining"], " صفحة"),
                ],
                [
                    "نسبة الإنجاز",
                    shown(m["percentage"], "%"),
                    shown(v["percentage"], "%"),
                ],
                [
                    "سجلات غير قابلة للتحقق",
                    m["unquantified_sessions"],
                    v["unquantified_sessions"],
                ],
            ],
        )
        if r["verse_memorization"]["has_target"] and m["unit"] != "verses":
            native = r["verse_memorization"]
            elements.append(
                p(
                    f"أهداف الآيات المستقلة: المطلوب {shown(native['required'])} آية · المنجز {shown(native['completed'])} آية · المتبقي {shown(native['remaining'])} آية · الإنجاز {shown(native['percentage'], '%')}"
                )
            )
        table(
            [
                "الحضور",
                "المتأخر",
                "الغياب",
                "المستأذن",
                "نسبة الحضور",
                "الاختبارات",
                "متوسط الاختبارات",
            ],
            [
                [
                    a["present"],
                    a["late"],
                    a["absent"],
                    a["excused"],
                    shown(a["percentage"], "%"),
                    e["total"],
                    shown(e["average"], "%"),
                ]
            ],
        )

    logo = Path(__file__).resolve().parent.parent / "assets" / "logo.png"
    if logo.exists():
        img = Image(str(logo), width=95, height=68, kind="proportional")
        img.hAlign = "RIGHT"
        elements.append(img)
    title("تقرير إنجاز الطالب" if individual else "تقرير أداء المحفّظ وطلابه")
    teacher = data["teacher"]
    period = data["period"]
    elements.append(
        p(f"المحفّظ: {teacher['name']} · الحلقة: {teacher['ring'] or 'غير مسجلة'}")
    )
    elements.append(
        p(
            f"الفترة: {period['from'] or 'من أول سجل'} إلى {period['to']} · تاريخ الإصدار: {data['generated_at'][:10]}"
        )
    )
    if not individual:
        table(
            ["التواصل", "تاريخ الانضمام", "المسجلون", "النشطون"],
            [
                [
                    teacher["phone"] or teacher["email"] or "—",
                    teacher["joined"],
                    teacher["registered_students"],
                    teacher["active_students"],
                ]
            ],
        )
        title("ملخص أداء المجموعة")
        metrics(data["summary"])
        table(
            ["متوسط إنجاز الحفظ", "متوسط إنجاز المراجعة", "جلسات التسميع"],
            [
                [
                    shown(data["summary"]["memorization"]["average_percentage"], "%"),
                    shown(data["summary"]["revision"]["average_percentage"], "%"),
                    data["summary"]["recitation_sessions"],
                ]
            ],
        )
        table(
            [
                "الطالب",
                "الحفظ المطلوب",
                "الحفظ المنجز",
                "نسبة الحفظ",
                "المراجعة المطلوبة",
                "المراجعة المنجزة",
                "نسبة المراجعة",
            ],
            [
                [
                    r["student"]["name"],
                    shown(
                        r["memorization_goal"]["required"],
                        (
                            " آية"
                            if r["memorization_goal"]["unit"] == "verses"
                            else " صفحة"
                        ),
                    ),
                    shown(
                        r["memorization_goal"]["completed"],
                        (
                            " آية"
                            if r["memorization_goal"]["unit"] == "verses"
                            else " صفحة"
                        ),
                    ),
                    shown(r["memorization_goal"]["percentage"], "%"),
                    r["revision"]["required"],
                    r["revision"]["completed"],
                    shown(r["revision"]["percentage"], "%"),
                ]
                for r in data["students"]
            ],
            [2, 1, 1, 1, 1, 1, 1],
        )
    for index, r in enumerate(data["students"]):
        if not individual or index:
            elements.append(PageBreak())
        s = r["student"]
        title(f"ملف إنجاز الطالب: {s['name']}")
        elements.append(
            p(
                f"المحفّظ: {s['teacher_name']} · الحلقة: {s['ring'] or 'غير مسجلة'} · الحالة: {'نشط' if s['active'] else 'غير نشط'}"
            )
        )
        elements.append(
            p(
                f"الالتحاق: {s['enrollment_date']} · آخر نشاط في الفترة: {s['last_activity'] or 'لا يوجد'}"
            )
        )
        if (
            s.get("current_surah")
            or s.get("current_juz")
            or s.get("current_page")
            or s.get("reported_memorized_verses")
        ):
            elements.append(
                p(
                    f"الموضع المدون في الملف: {s.get('current_surah') or '—'} · الجزء {shown(s.get('current_juz'))} · الصفحة {shown(s.get('current_page'))} · عدد الآيات المدون {s.get('reported_memorized_verses', 0)}. بيانات الملف الحالية لا تُضاف إلى اتحاد النطاقات التاريخية لغياب تفاصيلها."
                )
            )
        c = r["cumulative"]
        elements.append(
            p(
                f"الحفظ التراكمي الموثق حتى {c['as_of']}: {c['pages']} صفحة مكافئة · {c['verses']} آية موثقة؛ الوحدتان لا تُجمعان. سجلات غير محددة: {c['unquantified_sessions']}"
            )
        )
        metrics(r)
        title("تفاصيل الحفظ")
        elements.append(
            p(
                f"جلسات الحفظ: {r['sessions']['memorization']} · آخر حفظ: {r['sessions']['last_memorization'] or '—'}"
            )
        )
        table(
            [
                "التاريخ",
                "السورة / الجزء",
                "من / إلى",
                "صفحات الجلسة / الجديد",
                "التقييم",
                "الملاحظة / المسجّل",
            ],
            [
                [
                    e["date"],
                    f"{e['surah']} {('جزء ' + str(e['juz'])) if e['juz'] else ''}",
                    portion(e),
                    f"{shown(e['pages'])} / {shown(e['new_pages'])}\nآيات الجلسة: {shown(e.get('verses'))}\nآيات جديدة: {e['new_verses']}",
                    LABELS.get(e["quality"], "—"),
                    f"{e['note']}\n{(e['recorder'] or {}).get('name', '—')}",
                ]
                for e in r["memorization_history"]
            ],
            [1.1, 1.4, 1.2, 1.4, 0.9, 2],
        )
        title("تفاصيل المراجعة")
        elements.append(
            p(
                f"جلسات المراجعة: {r['sessions']['revision']} · آخر مراجعة: {r['sessions']['last_revision'] or '—'}"
            )
        )
        table(
            ["التاريخ", "السورة / النطاق", "الصفحات", "التقييم", "الملاحظات"],
            [
                [
                    e["date"],
                    f"{e['surah']}\n{portion(e)}",
                    shown(e["pages"], " صفحة")
                    + (f" · {e['verses']} آية" if e.get("verses") is not None else ""),
                    LABELS.get(e["quality"], "—"),
                    e["note"],
                ]
                for e in r["revision_history"]
            ],
            [1, 2, 1, 1, 2],
        )
        title("الاختبارات والتقييمات")
        elements.append(
            p(
                f"المكتملة: {r['exams']['completed']} · أعلى درجة: {shown(r['exams']['highest'], '%')} · آخر درجة: {shown(r['exams']['last'])}{(' / ' + shown(r['exams']['last_max_score'])) if r['exams']['last_max_score'] else ''}"
            )
        )
        table(
            ["الاختبار", "التاريخ", "الدرجة", "النتيجة", "الملاحظات"],
            [
                [
                    e["title"],
                    e["date"],
                    (
                        f"{e['score']} / {e['max_score']}"
                        if e["max_score"]
                        else shown(e["score"])
                    ),
                    LABELS.get(e["status"], e["status"]),
                    e["note"],
                ]
                for e in r["exam_history"]
            ],
            [2, 1, 1, 1, 2],
        )
        title("سجل الحضور")
        table(
            ["التاريخ", "الحالة", "المسجّل"],
            [
                [
                    e["date"],
                    LABELS.get(e["status"], e["status"])
                    + ("" if e["counted"] else " (غير محتسب في النسبة)"),
                    (e["recorder"] or {}).get("name", "—"),
                ]
                for e in r["attendance_history"]
            ],
        )
        title("الأهداف والعمل المتبقي")
        table(
            ["الفترة / التاريخ", "التكليف", "التفاصيل / المتبقي"],
            [
                [
                    t["date"],
                    "خطة حفظ ومراجعة" if t["source"] == "plan" else LABELS[t["kind"]],
                    target_details(t),
                ]
                for t in r["targets"]
            ],
            [1, 1.5, 3],
        )
        title("الإنجاز عبر الزمن")
        table(
            ["الفترة", "الحفظ الجديد", "المراجعة", "الحضور", "الاختبارات"],
            [
                [
                    t["date"],
                    (
                        shown(t["memorization_verses"], " آية")
                        if r["memorization_goal"]["unit"] == "verses"
                        else shown(t["memorization"], " صفحة")
                    ),
                    shown(t["revision"]),
                    shown(t["attendance"], "%"),
                    shown(t["exam"], "%"),
                ]
                for t in r["trends"]
            ],
        )
        title("سجل الإنجازات")
        table(
            ["التاريخ", "النوع", "التفاصيل", "النتيجة"],
            [
                [
                    e["date"],
                    LABELS[e["type"]],
                    e["details"],
                    LABELS.get(e["result"], e["result"] or "—"),
                ]
                for e in r["timeline"]
            ],
            [1, 1, 2, 1],
        )
    title("منهجية الحساب")
    for method in data["methods"]:
        elements.append(p(method))
    buffer = io.BytesIO()

    def footer(canvas, doc):
        canvas.setFont("AnalyticsArabic", 9)
        canvas.setFillColor(BLUE)
        canvas.drawRightString(A4[0] - 42, 24, _ar(f"نور الهدى · صفحة {doc.page}"))
        canvas.drawString(42, 24, data["generated_at"][:10])

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=34,
        bottomMargin=44,
        title="تقرير إنجاز الطالب" if individual else "تقرير أداء المحفّظ وطلابه",
        author="نور الهدى",
    )
    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def portion(e):
    if e.get("from_ayah") and e.get("to_ayah"):
        return f"آيات {e['from_ayah']}–{e['to_ayah']}"
    if e.get("from_page") and e.get("to_page"):
        return f"صفحات {e['from_page']}–{e['to_page']}"
    return "النطاق غير محدد"


def target_details(t):
    if t["source"] == "plan":
        return f"حتى {t['end']} · حفظ {t['memorization_pages']} صفحة · مراجعة {t['revision_pages']} صفحة · آيات {t['verses']}\nالخطة لا تخزن أجزاء محددة؛ المتبقي الكمي في الملخص."
    remaining = t["remaining_ranges"]
    return f"{t['text']} · آيات {t['from_ayah'] or '—'}–{t['to_ayah'] or '—'}\n" + (
        "تم توثيق النطاق"
        if remaining == []
        else (
            "المتبقي: " + "، ".join(f"{a}–{b}" for a, b in remaining)
            if remaining
            else "لا يمكن التحقق من إتمام هذا التكليف"
        )
    )
