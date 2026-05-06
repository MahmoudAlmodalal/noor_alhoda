from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0012_alter_student_teacher_fk'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='current_surah',
            field=models.CharField(
                blank=True,
                default='',
                max_length=100,
                verbose_name='السورة الحالية',
            ),
        ),
        migrations.AddField(
            model_name='student',
            name='current_juz',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='الجزء الحالي',
            ),
        ),
        migrations.AddField(
            model_name='student',
            name='memorized_verses',
            field=models.PositiveIntegerField(
                default=0,
                verbose_name='عدد الآيات',
            ),
        ),
    ]
