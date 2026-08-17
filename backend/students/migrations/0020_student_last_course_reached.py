from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("students", "0019_alter_student_memorized_verses"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="last_course_reached",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="آخر دورة وصل إليها",
            ),
        ),
    ]

