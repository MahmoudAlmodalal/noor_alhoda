from django.core.management.base import BaseCommand
from accounts.models import User

class Command(BaseCommand):
    help = "Reset passwords for all students and teachers to the last 4 digits of their phone_number (national_id)."

    def handle(self, *args, **options):
        users = User.objects.filter(role__in=["student", "teacher"])
        count = 0
        for user in users:
            # Use the last 4 digits of the phone_number (which is the national_id)
            password = user.phone_number[-4:]
            user.set_password(password)
            user.save()
            count += 1
            self.stdout.write(self.style.SUCCESS(f"Reset password for {user.phone_number} ({user.role})"))
        
        self.stdout.write(self.style.SUCCESS(f"Successfully reset passwords for {count} users."))
