from django.contrib import admin

from .models import Brand


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "slogan", "updated_at")
    search_fields = ("name", "user__email", "slogan")
    list_filter = ("updated_at",)
    readonly_fields = ("updated_at",)
    raw_id_fields = ("user",)
