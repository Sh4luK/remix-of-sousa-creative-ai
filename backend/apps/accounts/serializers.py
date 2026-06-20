from django.contrib.auth import get_user_model
from dj_rest_auth.registration.serializers import RegisterSerializer
from rest_framework import serializers

from .services import verify_turnstile

User = get_user_model()


class UserDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email")
        read_only_fields = ("id", "email")


class TurnstileRegisterSerializer(RegisterSerializer):
    turnstile_token = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def get_fields(self):
        fields = super().get_fields()
        fields.pop("username", None)
        return fields

    def validate_email(self, email):
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return email

    def validate(self, data):
        data = super().validate(data)
        token = data.pop("turnstile_token", "")
        if not verify_turnstile(token):
            raise serializers.ValidationError({"turnstileToken": "Verificação humana falhou."})
        return data

    def get_cleaned_data(self):
        return {
            "password1": self.validated_data.get("password1", ""),
            "email": self.validated_data.get("email", ""),
        }
