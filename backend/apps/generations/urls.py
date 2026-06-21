from django.urls import path

from .views import GenerationDetailView, GenerationImageView, GenerationListCreateView

urlpatterns = [
    path("", GenerationListCreateView.as_view(), name="generation-list"),
    path("<int:pk>/", GenerationDetailView.as_view(), name="generation-detail"),
    path("<int:pk>/image/", GenerationImageView.as_view(), name="generation-image"),
]
