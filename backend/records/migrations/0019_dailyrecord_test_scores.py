from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("records", "0018_dailyrecord_evaluation"),
    ]

    operations = [
        migrations.AddField(
            model_name="dailyrecord",
            name="scattered_test_score",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                verbose_name="اختبار أجزاء متفرقة",
            ),
        ),
        migrations.AddField(
            model_name="dailyrecord",
            name="combined_test_score",
            field=models.PositiveSmallIntegerField(
                blank=True,
                null=True,
                verbose_name="اختبار أجزاء مجمعة",
            ),
        ),
    ]

