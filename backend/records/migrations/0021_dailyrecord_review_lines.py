from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("records", "0020_alter_weeklyplan_options_weeklyplan_month_start_and_more")]

    operations = [
        migrations.AddField(
            model_name="dailyrecord",
            name="review_lines",
            field=models.PositiveIntegerField(default=0, verbose_name="عدد أسطر المراجعة"),
        ),
    ]

