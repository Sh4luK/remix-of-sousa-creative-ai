from django.conf import settings
from django.db import models


class Brand(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="brand",
    )
    name = models.CharField(max_length=120, default="PJ Mídia")
    slogan = models.CharField(max_length=200, blank=True)
    colors = models.JSONField(default=list)
    default_phrase = models.CharField(max_length=240, blank=True)
    button_text = models.CharField(max_length=60, blank=True)
    signature = models.CharField(max_length=160, blank=True)
    logo = models.ImageField(upload_to="brand-logos/", null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Marca"
        verbose_name_plural = "Marcas"

    def __str__(self) -> str:
        return f"{self.name} ({self.user.email})"
