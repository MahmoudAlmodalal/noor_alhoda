import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Reset password for admin user (0590000000)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='0000',
            help='New password for admin user (default: 0000)',
        )

    def handle(self, *args, **options):
        national_id = "0590000000"
        password = options['password']

        try:
            user = User.objects.get(national_id=national_id)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Password reset for admin {national_id}: {password}'
                )
            )
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'✗ Admin user {national_id} not found')
            )
