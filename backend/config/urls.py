from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import ThrottledLoginView, ThrottledRegisterView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Views com throttle vêm ANTES dos includes para ter precedência de rota.
    path("api/auth/login/", ThrottledLoginView.as_view(), name="rest_login"),
    path("api/auth/registration/", ThrottledRegisterView.as_view(), name="rest_register"),
    path("api/auth/", include("dj_rest_auth.urls")),
    path("api/auth/registration/", include("dj_rest_auth.registration.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/brand/", include("apps.branding.urls")),
    path("api/products/", include("apps.products.urls")),
    path("api/generations/", include("apps.generations.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
