from rest_framework import generics

from .models import Brand
from .serializers import BrandSerializer


class BrandView(generics.RetrieveUpdateAPIView):
    serializer_class = BrandSerializer

    def get_object(self):
        brand, _ = Brand.objects.get_or_create(user=self.request.user)
        return brand
