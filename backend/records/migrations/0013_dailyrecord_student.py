from django.db import migrations, models
import django.db.models.deletion


def backfill_student(apps, schema_editor):
    DailyRecord = apps.get_model('records', 'DailyRecord')
    for record in DailyRecord.objects.filter(weekly_plan__isnull=False).select_related('weekly_plan'):
        if record.weekly_plan and record.weekly_plan.student_id:
            record.student_id = record.weekly_plan.student_id
            record.save(update_fields=['student_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0019_alter_student_memorized_verses'),
        ('records', '0012_dailyrecord_from_page_dailyrecord_to_page'),
    ]

    operations = [
        # 1. Add student as nullable ForeignKey
        migrations.AddField(
            model_name='dailyrecord',
            name='student',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='daily_records',
                to='students.student',
                verbose_name='الطالب',
            ),
        ),
        # 2. Backfill historical records from weekly_plan.student
        migrations.RunPython(backfill_student, reverse_code=migrations.RunPython.noop),
        # 3. Make student non-nullable
        migrations.AlterField(
            model_name='dailyrecord',
            name='student',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='daily_records',
                to='students.student',
                verbose_name='الطالب',
            ),
        ),
        # 4. Make weekly_plan nullable
        migrations.AlterField(
            model_name='dailyrecord',
            name='weekly_plan',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='daily_records',
                to='records.weeklyplan',
                verbose_name='الخطة الأسبوعية',
            ),
        ),
        # 5. Remove unique_together
        migrations.AlterUniqueTogether(
            name='dailyrecord',
            unique_together=set(),
        ),
        # 6. Add constraint and index
        migrations.AddConstraint(
            model_name='dailyrecord',
            constraint=models.UniqueConstraint(fields=('student', 'date'), name='unique_daily_record_student_date'),
        ),
        migrations.AddIndex(
            model_name='dailyrecord',
            index=models.Index(fields=['student'], name='records_dai_student_447ff4_idx'),
        ),
    ]
