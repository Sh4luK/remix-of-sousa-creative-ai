from django.contrib import admin

from .models import UsageQuota


@admin.register(UsageQuota)
class UsageQuotaAdmin(admin.ModelAdmin):
    list_display = ("user", "count", "window_start")
    search_fields = ("user__email",)
    list_filter = ("window_start",)
    readonly_fields = ("window_start",)
    raw_id_fields = ("user",)
