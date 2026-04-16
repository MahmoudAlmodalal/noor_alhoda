from django.core.management.base import BaseCommand

from accounts.models import User


ROLE_CHOICES = ["teacher", "student", "admin", "parent", "all"]


class Command(BaseCommand):
    help = (
        "Reset user passwords to the last 4 digits of their national_id. "
        "Covers admin, teacher, student, and parent roles."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving.",
        )
        parser.add_argument(
            "--role",
            choices=ROLE_CHOICES,
            default="all",
            help="Which role(s) to reset. Defaults to all.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        role = options["role"]

        roles = ["teacher", "student", "admin", "parent"] if role == "all" else [role]
        qs = User.objects.filter(role__in=roles)

        total = qs.count()
        self.stdout.write(f"Found {total} user(s) with role in {roles}.")

        updated = 0
        skipped = 0
        for user in qs.iterator():
            national_id = (user.national_id or "").strip()
            if len(national_id) < 4:
                self.stdout.write(
                    self.style.WARNING(
                        f"  - skipping {user.id} ({national_id!r}): national_id too short"
                    )
                )
                skipped += 1
                continue

            new_password = national_id[-4:]
            if dry_run:
                self.stdout.write(f"  - would reset {national_id} ({user.role}) -> {new_password}")
            else:
                user.set_password(new_password)
                user.save(update_fields=["password"])
            updated += 1

        action = "would update" if dry_run else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {action} {updated} user(s); skipped {skipped}."
            )
        )
