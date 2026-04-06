from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create a default admin superuser if none exists."

    def handle(self, *args, **options):
        email = "ghg17273@gmail.com"
        username = "admin"
        password = "admin"

        if User.objects.filter(is_superuser=True).exists():
            self.stdout.write(self.style.WARNING("Superuser already exists — skipping."))
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Default admin created: {username} / {email}"))
