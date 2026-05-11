from django.contrib import admin

from progress.models import StudentProgress


@admin.register(StudentProgress)
class StudentProgressAdmin(admin.ModelAdmin):
    list_display = [
        "student",
        "surah_name",
        "surah_number",
        "juz_number",
        "from_page",
        "to_page",
        "recorded_at",
    ]
    list_filter = ["juz_number", "recorded_at"]
    search_fields = ["student__full_name", "surah_name"]
    raw_id_fields = ["student", "teacher"]
    ordering = ["-recorded_at"]
