from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import UsageQuota

LIMIT = 10
WINDOW = timedelta(hours=24)


def consume(user) -> bool:
    """Atomically reserve one generation slot. Returns False when the window is exhausted."""
    with transaction.atomic():
        quota, _ = UsageQuota.objects.select_for_update().get_or_create(user=user)
        now = timezone.now()
        if now - quota.window_start > WINDOW:
            quota.window_start, quota.count = now, 0
        if quota.count >= LIMIT:
            return False
        quota.count += 1
        quota.save(update_fields=["window_start", "count"])
        return True
