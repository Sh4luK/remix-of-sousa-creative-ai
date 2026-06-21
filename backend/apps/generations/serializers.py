from django.urls import reverse
from rest_framework import serializers

from .models import Generation


class GenerationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Generation
        fields = ("favorite",)  # only writable field via PATCH

    def to_representation(self, instance):
        request = self.context.get("request")
        image_path = reverse("generation-image", args=[instance.pk])
        image_url = request.build_absolute_uri(image_path) if request else image_path
        return {
            "id": str(instance.pk),
            "imageUrl": image_url,
            "prompt": instance.prompt,
            "productName": instance.product_name,
            "category": instance.category,
            "style": instance.style,
            "format": instance.format,
            "createdAt": instance.created_at.isoformat(),
            "favorite": instance.favorite,
        }
