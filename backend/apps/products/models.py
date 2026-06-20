from django.conf import settings
from django.db import models


class Product(models.Model):
    SOURCE = [("user", "user"), ("openfoodfacts", "openfoodfacts")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="products",
    )
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=40, default="outros")
    image = models.ImageField(upload_to="product-images/", null=True, blank=True)
    off_image_url = models.URLField(blank=True)
    barcode = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=16, choices=SOURCE, default="user")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        indexes = [
            models.Index(fields=["user", "name"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.user.email})"
