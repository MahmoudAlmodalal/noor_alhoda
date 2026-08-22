from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("evaluations", "0004_evaluation_evaluated_date"),
    ]

    operations = [
        migrations.AlterField(
            model_name="evaluation",
            name="scheduled_date",
            field=models.DateField(verbose_name="شهر الاختبار"),
        ),
    ]
