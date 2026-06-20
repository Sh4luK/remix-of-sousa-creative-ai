from django.urls import path

from .views import (
    ProductDestroyView,
    ProductListCreateView,
    ProductSearchOFFView,
    ProductUploadImageView,
)

urlpatterns = [
    path("", ProductListCreateView.as_view(), name="product-list"),
    path("upload-image/", ProductUploadImageView.as_view(), name="product-upload-image"),
    path("search-off/", ProductSearchOFFView.as_view(), name="product-search-off"),
    path("<int:pk>/", ProductDestroyView.as_view(), name="product-detail"),
]
