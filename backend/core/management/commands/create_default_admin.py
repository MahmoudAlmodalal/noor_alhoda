from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

PHONE = "0590000000"
PASSWORD = "0000"


class Command(BaseCommand):
    help = "Create a default admin user (phone: 0590000000) if none exists."

    def handle(self, *args, **options):
        user = User.objects.filter(phone_number=PHONE).first()

        if user:
            # Ensure admin privileges are set
            changed = []
            if not user.is_superuser:
                user.is_superuser = True
                changed.append("is_superuser")
            if not user.is_staff:
                user.is_staff = True
                changed.append("is_staff")
            if user.role != "admin":
                user.role = "admin"
                changed.append("role")
            if changed:
                user.save(update_fields=changed)
                self.stdout.write(self.style.SUCCESS(f"Default admin updated: {PHONE}"))
            else:
                self.stdout.write(self.style.WARNING(f"Default admin already exists: {PHONE}"))
            return

        user = User(
            phone_number=PHONE,
            username=PHONE,
            first_name="Admin",
            last_name="",
            role="admin",
            is_superuser=True,
            is_staff=True,
            is_active=True,
        )
        user.set_password(PASSWORD)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"Default admin created: {PHONE} / {PASSWORD}"))
