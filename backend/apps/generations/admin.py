from django.contrib import admin

from .models import Generation


@admin.register(Generation)
class GenerationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product_name", "category", "style", "format", "favorite", "created_at")
    search_fields = ("user__email", "product_name", "prompt")
    list_filter = ("category", "style", "format", "favorite", "created_at")
    readonly_fields = ("created_at",)
    raw_id_fields = ("user",)
    date_hierarchy = "created_at"
