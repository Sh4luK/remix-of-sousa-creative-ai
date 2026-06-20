from PIL import Image, UnidentifiedImageError
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Product
from .serializers import ProductSerializer
from .services import search_off


class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = Product.objects.filter(user=self.request.user).order_by("-created_at")
        query = self.request.query_params.get("q", "").strip()
        if query:
            qs = qs.filter(name__icontains=query)
        return qs[:50]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        name = serializer.validated_data.get("name", "")
        existing = Product.objects.filter(user=request.user, name__iexact=name).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProductDestroyView(generics.DestroyAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.filter(user=self.request.user)


class ProductUploadImageView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "Arquivo obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            Image.open(file).verify()
            file.seek(0)
        except (UnidentifiedImageError, OSError):
            return Response({"error": "Arquivo não é uma imagem válida."}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get("name") or "").strip() or "Produto"
        category = request.data.get("category") or "outros"
        product = Product.objects.create(
            user=request.user, name=name, category=category, image=file, source="user",
        )
        data = ProductSerializer(product, context={"request": request}).data
        return Response({"id": product.id, "displayUrl": data["displayUrl"]}, status=status.HTTP_201_CREATED)


class ProductSearchOFFView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "")
        try:
            limit = int(request.query_params.get("limit", 8))
        except (TypeError, ValueError):
            limit = 8
        return Response(search_off(query, limit))
