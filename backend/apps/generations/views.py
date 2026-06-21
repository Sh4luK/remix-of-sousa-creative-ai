from uuid import uuid4

from django.core.files.base import ContentFile
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.usage import services as usage
from . import services
from .models import Generation
from .serializers import GenerationSerializer


class GenerationListCreateView(generics.ListCreateAPIView):
    serializer_class = GenerationSerializer

    def get_queryset(self):
        qs = Generation.objects.filter(user=self.request.user).order_by("-created_at")
        cursor = self.request.query_params.get("cursor")
        if cursor:
            parsed = parse_datetime(cursor)
            if parsed:
                qs = qs.filter(created_at__lt=parsed)
        try:
            limit = int(self.request.query_params.get("limit", 20))
        except (TypeError, ValueError):
            limit = 20
        return qs[: max(1, min(limit, 50))]

    def create(self, request, *args, **kwargs):
        prompt = (request.data.get("prompt") or "").strip()
        if not prompt:
            return Response({"error": "Prompt é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate inputs (cheap) before spending a quota slot.
        base_image = None
        try:
            if request.data.get("productImage"):
                base_image = services.decode_data_url_image(request.data["productImage"])
            if request.data.get("logoImage"):
                services.decode_data_url_image(request.data["logoImage"])
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            width = int(request.data.get("width") or 1024)
            height = int(request.data.get("height") or 1024)
        except (TypeError, ValueError):
            width = height = 1024

        if not usage.consume(request.user):
            return Response(
                {"error": "Limite de 10 gerações por 24h atingido. Tente amanhã."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            image_bytes = services.generate(prompt, width=width, height=height, base_image=base_image)
        except services.StabilityError as exc:
            return Response({"error": str(exc)}, status=exc.status)

        gen = Generation.objects.create(
            user=request.user,
            prompt=prompt,
            product_name=request.data.get("productName") or "",
            category=request.data.get("category") or "",
            style=request.data.get("style") or "",
            format=request.data.get("format") or "",
        )
        gen.image.save(f"{uuid4().hex}.webp", ContentFile(image_bytes), save=True)

        data = self.get_serializer(gen).data
        return Response({"imageUrl": data["imageUrl"], "generation": data}, status=status.HTTP_201_CREATED)


class GenerationDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = GenerationSerializer
    http_method_names = ["patch", "delete"]

    def get_queryset(self):
        return Generation.objects.filter(user=self.request.user)


class GenerationImageView(APIView):
    def get(self, request, pk):
        gen = get_object_or_404(Generation, pk=pk, user=request.user)
        if not gen.image:
            raise Http404
        return FileResponse(gen.image.open("rb"), content_type="image/webp")
