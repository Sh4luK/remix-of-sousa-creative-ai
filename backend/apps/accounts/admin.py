from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

admin.site.unregister(User)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "username", "is_staff", "is_active", "date_joined")
    search_fields = ("email", "username")
    list_filter = ("is_staff", "is_active", "is_superuser")
    ordering = ("-date_joined",)
