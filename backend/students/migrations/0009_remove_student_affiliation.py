from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0008_student_affiliation"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="student",
            name="affiliation",
        ),
    ]
