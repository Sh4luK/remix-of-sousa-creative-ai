from django.conf import settings
from django.db import models
from django.utils import timezone


class UsageQuota(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="usage_quota",
    )
    window_start = models.DateTimeField(default=timezone.now)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Quota de Uso"
        verbose_name_plural = "Quotas de Uso"

    def __str__(self) -> str:
        return f"{self.user.email} — {self.count}/10"
