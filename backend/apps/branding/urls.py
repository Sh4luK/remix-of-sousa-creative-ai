from django.urls import path

from .views import BrandView

urlpatterns = [
    path("", BrandView.as_view(), name="brand"),
]
