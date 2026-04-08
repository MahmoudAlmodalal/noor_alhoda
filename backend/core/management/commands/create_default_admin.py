from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create a default admin superuser if none exists."

    def handle(self, *args, **options):
        email = "ghg17273@gmail.com"
        username = "admin"
        password = "admin"

        user = User.objects.filter(username=username).first() or User.objects.filter(email=email).first()

        if user:
            updated_fields = []
            if not user.is_superuser:
                user.is_superuser = True
                updated_fields.append("is_superuser")
            if not user.is_staff:
                user.is_staff = True
                updated_fields.append("is_staff")
            if user.role != "admin":
                user.role = "admin"
                updated_fields.append("role")
            if updated_fields:
                user.save(update_fields=updated_fields)
                self.stdout.write(self.style.SUCCESS(f"Default admin updated: {username} / {email}"))
            else:
                self.stdout.write(self.style.WARNING("Default admin already configured."))
            return

        user = User.objects.create_superuser(username=username, email=email, password=password)
        user.role = "admin"
        user.is_staff = True
        user.save(update_fields=["role", "is_staff"])
        self.stdout.write(self.style.SUCCESS(f"Default admin created: {username} / {email}"))
