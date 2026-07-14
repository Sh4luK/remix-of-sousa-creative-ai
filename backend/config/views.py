from django.http import JsonResponse


def healthz(_request):
    """Liveness/readiness probe para o PaaS. Sem auth e sem hit no banco
    (deploy não deve falhar por lentidão do Postgres)."""
    return JsonResponse({"status": "ok"})
