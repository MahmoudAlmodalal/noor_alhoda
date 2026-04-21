import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    State-only: repoint Student.teacher from accounts.Teacher to teacher.Teacher.
    The underlying FK column (`teacher_id`) and its constraint are unchanged.
    """

    dependencies = [
        ("students", "0011_remove_student_national_id"),
        ("teacher", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterField(
                    model_name="student",
                    name="teacher",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="students",
                        to="teacher.teacher",
                        verbose_name="المحفظ المسؤول",
                    ),
                ),
            ],
            database_operations=[],
        ),
    ]
