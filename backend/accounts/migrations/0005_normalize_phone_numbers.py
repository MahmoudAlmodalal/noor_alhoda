from django.db import migrations


def normalize_phone(raw):
    phone = (raw or "").strip().replace(" ", "").replace("-", "")
    if phone.startswith("+966"):
        phone = "0" + phone[4:]
    elif phone.startswith("966"):
        phone = "0" + phone[3:]
    elif phone.startswith("5") and len(phone) == 9:
        phone = "0" + phone
    return phone


def fix_phones(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all():
        normalized = normalize_phone(user.phone_number)
        if normalized != user.phone_number:
            user.phone_number = normalized
            user.save(update_fields=["phone_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_alter_user_managers_remove_user_username"),
    ]

    operations = [
        migrations.RunPython(fix_phones, migrations.RunPython.noop),
    ]
