import os
import secrets

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

NATIONAL_ID = "0590000000"


class Command(BaseCommand):
    help = "Create a default admin user (national_id: 0590000000) if none exists."

    def handle(self, *args, **options):
        user = User.objects.filter(national_id=NATIONAL_ID).first()

        if user:
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
            if user.first_name == "Admin" and user.last_name == "System":
                user.first_name = "مدير"
                user.last_name = "المركز"
                changed.extend(["first_name", "last_name"])
            if changed:
                user.save(update_fields=changed)
                self.stdout.write(self.style.SUCCESS(f"Default admin updated: {NATIONAL_ID}"))
            else:
                self.stdout.write(self.style.WARNING(f"Default admin already exists: {NATIONAL_ID}"))
            return

        password = (os.environ.get("DEFAULT_ADMIN_PASSWORD") or "").strip()
        generated = False
        if not password:
            password = secrets.token_urlsafe(16)
            generated = True

        User.objects.create_superuser(
            national_id=NATIONAL_ID,
            password=password,
            first_name="مدير",
            last_name="المركز",
            role="admin",
            is_active=True,
        )

        if generated:
            banner = "=" * 70
            self.stdout.write(self.style.WARNING(banner))
            self.stdout.write(self.style.WARNING(
                f"DEFAULT ADMIN CREATED — national_id={NATIONAL_ID}"
            ))
            self.stdout.write(self.style.WARNING(
                f"GENERATED PASSWORD (save now, will not appear again): {password}"
            ))
            self.stdout.write(self.style.WARNING(
                "Set DEFAULT_ADMIN_PASSWORD env var to control this in future deploys."
            ))
            self.stdout.write(self.style.WARNING(banner))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Default admin created: {NATIONAL_ID} (using DEFAULT_ADMIN_PASSWORD env)"
            ))
