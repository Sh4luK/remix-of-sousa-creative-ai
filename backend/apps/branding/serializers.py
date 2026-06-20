from rest_framework import serializers

from .models import Brand


class BrandSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False, allow_blank=True)
    slogan = serializers.CharField(required=False, allow_blank=True)
    colors = serializers.JSONField(required=False)
    defaultPhrase = serializers.CharField(source="default_phrase", required=False, allow_blank=True)
    buttonText = serializers.CharField(source="button_text", required=False, allow_blank=True)
    signature = serializers.CharField(required=False, allow_blank=True)
    logo = serializers.ImageField(write_only=True, required=False, allow_null=True)
    logoUrl = serializers.SerializerMethodField()
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Brand
        fields = (
            "name", "slogan", "colors", "defaultPhrase",
            "buttonText", "signature", "logo", "logoUrl", "updatedAt",
        )

    def get_logoUrl(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
