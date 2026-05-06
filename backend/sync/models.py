import uuid

from django.db import models
from django.core.cache import cache

from accounts.models import User


class SyncGeneration(models.Model):
    """
    Single-row model to track the current sync generation.
    When the server database is wiped or reset, the generation ID changes.
    Clients compare their stored generation against the server's current one;
    if different, they wipe their local IndexedDB and do a full re-sync.
    """

    generation_id = models.UUIDField(
        default=uuid.uuid4, verbose_name="معرّف الجيل الحالي للمزامنة"
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخر تحديث")

    class Meta:
        verbose_name = "جيل المزامنة"
        verbose_name_plural = "أجيال المزامنة"

    def save(self, *args, **kwargs):
        self.pk = 1  # Enforce single row
        cache.delete("sync_generation")  # Invalidate cache
        super().save(*args, **kwargs)

    def __str__(self):
        return f"SyncGeneration {self.generation_id}"

    @classmethod
    def get_current(cls):
        """Get or create the current generation, with caching."""
        cached = cache.get("sync_generation")
        if cached:
            return cached
        obj, _ = cls.objects.get_or_create(pk=1)
        cache.set("sync_generation", obj.generation_id, timeout=None)
        return obj.generation_id


class Tombstone(models.Model):
    """
    Records a hard delete so offline clients can learn about it on the next
    pull. Written in the same transaction as the delete itself — see
    `sync.services.tombstone_service.tombstone_write`.

    `resource` uses the same short-name vocabulary as the sync pull/push
    endpoints. `resource_uuid` is the UUID of the deleted row (it no longer
    exists in its original table by the time this row is readable).
    """

    class Resource(models.TextChoices):
        STUDENT = "student", "طالب"
        TEACHER = "teacher", "محفظ"
        PARENT = "parent", "ولي أمر"
        PARENT_STUDENT_LINK = "parent_student_link", "ربط ولي أمر بطالب"
        WEEKLY_PLAN = "weekly_plan", "خطة أسبوعية"
        DAILY_RECORD = "daily_record", "سجل يومي"
        REVIEW_RECORD = "review_record", "سجل مراجعة"
        EVALUATION = "evaluation", "اختبار"
        NOTIFICATION = "notification", "إشعار"
        COURSE = "course", "دورة"
        STUDENT_COURSE = "student_course", "تسجيل طالب بدورة"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    resource = models.CharField(
        max_length=32,
        choices=Resource.choices,
        verbose_name="النوع",
    )
    resource_uuid = models.UUIDField(verbose_name="معرّف السجل المحذوف")
    deleted_at = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الحذف")
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="من قام بالحذف",
    )
    # Optional scope hint used by pull to filter tombstones to users who
    # could previously see the row. E.g., for a DailyRecord, this is the
    # teacher's UUID at time of delete. Null means "visible to all roles".
    scope_user_id = models.UUIDField(null=True, blank=True, verbose_name="نطاق الرؤية")

    class Meta:
        verbose_name = "شاهدة حذف"
        verbose_name_plural = "شواهد الحذف"
        ordering = ["-deleted_at"]
        indexes = [
            models.Index(fields=["resource", "deleted_at"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self):
        return f"[TOMBSTONE] {self.resource} {self.resource_uuid}"


class IdempotencyKey(models.Model):
    """
    Stores the result of a processed sync push op, keyed by the
    client-generated `op_id`. A replayed op returns the cached result
    instead of re-running the mutation. Prevents duplicate student
    creation, duplicate attendance rows, duplicate absence notifications.
    """

    op_id = models.UUIDField(primary_key=True, verbose_name="معرّف العملية")
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="+",
        verbose_name="المستخدم",
    )
    resource = models.CharField(max_length=32, verbose_name="النوع")
    action = models.CharField(max_length=16, verbose_name="الإجراء")
    status = models.CharField(max_length=16, verbose_name="الحالة")
    result_json = models.JSONField(verbose_name="نتيجة محفوظة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مفتاح منع التكرار"
        verbose_name_plural = "مفاتيح منع التكرار"
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"IdempotencyKey {self.op_id} ({self.status})"
