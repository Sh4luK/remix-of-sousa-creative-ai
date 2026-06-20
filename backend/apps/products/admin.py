from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "category", "source", "created_at")
    search_fields = ("name", "user__email", "barcode")
    list_filter = ("category", "source", "created_at")
    readonly_fields = ("created_at",)
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
