from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("evaluations", "0003_evaluation_evaluation_type_evaluation_max_score_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="evaluation",
            name="evaluated_date",
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name="تاريخ التقييم الفعلي",
            ),
        ),
    ]
