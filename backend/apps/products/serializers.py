from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    offImageUrl = serializers.CharField(source="off_image_url", required=False, allow_blank=True)
    displayUrl = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Product
        fields = ("id", "name", "category", "offImageUrl", "barcode", "source", "displayUrl", "createdAt")
        read_only_fields = ("id", "createdAt")

    def get_displayUrl(self, obj):
        if obj.off_image_url:
            return obj.off_image_url
        if obj.image:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None
