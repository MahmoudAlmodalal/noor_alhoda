"""
Reset the sync generation UUID. All clients will detect the change on their next pull
and automatically wipe their local IndexedDB, then do a fresh full sync from the
newly empty/restored server.

Usage:
    python manage.py reset_sync_generation
"""
import uuid

from django.core.management.base import BaseCommand

from sync.models import SyncGeneration


class Command(BaseCommand):
    help = "Reset sync generation to trigger client IndexedDB wipes on next pull"

    def handle(self, *args, **options):
        old_gen = SyncGeneration.objects.filter(pk=1).first()
        old_id = str(old_gen.generation_id) if old_gen else None

        new_gen, _ = SyncGeneration.objects.get_or_create(pk=1)
        new_gen.generation_id = uuid.uuid4()
        new_gen.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Sync generation reset.\n"
                f"  Old: {old_id}\n"
                f"  New: {new_gen.generation_id}\n"
                f"\nAll connected clients will detect the change on their next pull "
                f"and automatically wipe their local IndexedDB, then re-sync from "
                f"the server."
            )
        )
