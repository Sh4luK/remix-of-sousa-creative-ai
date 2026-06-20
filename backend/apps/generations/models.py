from django.conf import settings
from django.db import models


class Generation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="generations",
    )
    prompt = models.TextField()
    image = models.ImageField(upload_to="generated-images/")
    product_name = models.CharField(max_length=160, blank=True)
    category = models.CharField(max_length=40, blank=True)
    style = models.CharField(max_length=40, blank=True)
    format = models.CharField(max_length=20, blank=True)
    favorite = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Geração"
        verbose_name_plural = "Gerações"
        indexes = [
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"#{self.pk} {self.product_name or '—'} ({self.user.email})"
