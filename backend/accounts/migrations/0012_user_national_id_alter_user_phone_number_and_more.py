# Fixed migration: split AddField into 3 steps to handle existing rows
# with unique=True constraint on national_id

import uuid
from django.db import migrations, models


def populate_national_ids(apps, schema_editor):
    """Assign a temporary unique national_id to every existing user that has none."""
    User = apps.get_model('accounts', 'User')
    for user in User.objects.filter(national_id__isnull=True):
        # Generate a unique placeholder; admins should update these after deploy
        user.national_id = uuid.uuid4().hex[:20]
        user.save(update_fields=['national_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_user_is_active'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # Step 1 — add the column as nullable so existing rows don't conflict
        migrations.AddField(
            model_name='user',
            name='national_id',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=20,
                verbose_name='رقم الهوية',
                help_text='يُستخدم لتسجيل الدخول',
            ),
        ),
        # Step 2 — fill in unique placeholder values for every existing user
        migrations.RunPython(populate_national_ids, migrations.RunPython.noop),
        # Step 3 — now it's safe to enforce NOT NULL + UNIQUE
        migrations.AlterField(
            model_name='user',
            name='national_id',
            field=models.CharField(
                max_length=20,
                unique=True,
                verbose_name='رقم الهوية',
                help_text='يُستخدم لتسجيل الدخول',
            ),
        ),
        migrations.AlterField(
            model_name='user',
            name='phone_number',
            field=models.CharField(
                blank=True,
                help_text='يُستخدم للتواصل والإشعارات',
                max_length=15,
                verbose_name='رقم الجوال',
            ),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['national_id'], name='accounts_us_nationa_9c8e24_idx'),
        ),
    ]
