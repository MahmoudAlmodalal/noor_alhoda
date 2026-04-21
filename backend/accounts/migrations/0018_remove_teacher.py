from django.db import migrations


class Migration(migrations.Migration):
    """
    State-only: remove the Teacher model from the `accounts` app now that it
    lives under the `teacher` app (see teacher/0001_initial). The physical
    table `accounts_teacher` and its M2M through `accounts_teacher_courses`
    are untouched.
    """

    dependencies = [
        ("accounts", "0017_add_updated_at"),
        ("students", "0012_alter_student_teacher_fk"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name="Teacher"),
            ],
            database_operations=[],
        ),
    ]
