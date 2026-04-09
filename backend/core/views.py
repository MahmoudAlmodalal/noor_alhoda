from django.http import JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok"})


def api_root(request):
    return JsonResponse({
        "message": "Noor Al-Huda API",
        "endpoints": {
            "auth": "/api/auth/",
            "users": "/api/users/",
            "students": "/api/students/",
            "records": "/api/records/",
            "notifications": "/api/notifications/",
            "reports": "/api/reports/",
            "docs": "/api/schema/swagger-ui/",
        },
    })
