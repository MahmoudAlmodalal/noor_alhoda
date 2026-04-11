from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Reset teacher/student passwords to the last 4 digits of their phone number."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without saving.",
        )
        parser.add_argument(
            "--role",
            choices=["teacher", "student", "both"],
            default="both",
            help="Which role(s) to reset. Defaults to both.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        role = options["role"]

        roles = ["teacher", "student"] if role == "both" else [role]
        qs = User.objects.filter(role__in=roles)

        total = qs.count()
        self.stdout.write(f"Found {total} user(s) with role in {roles}.")

        updated = 0
        skipped = 0
        for user in qs.iterator():
            phone = (user.phone_number or "").strip()
            if len(phone) < 4:
                self.stdout.write(
                    self.style.WARNING(
                        f"  - skipping {user.id} ({phone!r}): phone too short"
                    )
                )
                skipped += 1
                continue

            new_password = phone[-4:]
            if dry_run:
                self.stdout.write(f"  - would reset {phone} -> {new_password}")
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
