import io
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Product
from .serializers import ProductSerializer
from .services import search_off

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_DIMENSION = 2048                 # px; redimensiona o lado maior


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
        if file.size > MAX_UPLOAD_BYTES:
            return Response({"error": "Imagem muito grande. Use um arquivo de até 10 MB."}, status=status.HTTP_400_BAD_REQUEST)

        # Re-encoda via Pillow: descarta nome/extensão originais e qualquer payload
        # embutido (polyglot). O arquivo salvo é sempre um webp limpo com nome uuid.
        try:
            img = Image.open(file)
            img.load()
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buffer = io.BytesIO()
            img.save(buffer, format="WEBP", quality=82)
        except (UnidentifiedImageError, OSError, ValueError):
            return Response({"error": "Arquivo não é uma imagem válida."}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get("name") or "").strip() or "Produto"
        category = request.data.get("category") or "outros"
        product = Product.objects.create(
            user=request.user, name=name, category=category, source="user",
        )
        product.image.save(f"{uuid4().hex}.webp", ContentFile(buffer.getvalue()), save=True)
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
