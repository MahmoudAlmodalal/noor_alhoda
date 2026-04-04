from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom exception handler that wraps errors in a consistent format:
    {
        "success": false,
        "error": {
            "code": "...",
            "message": "...",
            "details": {...}
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {
            "success": False,
            "error": {
                "code": response.status_code,
                "message": _get_error_message(response),
                "details": response.data,
            },
        }
        response.data = error_data
        return response

    # Unhandled exceptions
    return Response(
        {
            "success": False,
            "error": {
                "code": 500,
                "message": "خطأ داخلي في الخادم",
                "details": str(exc),
            },
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _get_error_message(response):
    """Return a human-readable error message based on status code."""
    messages = {
        400: "طلب غير صالح",
        401: "غير مصرح - يرجى تسجيل الدخول",
        403: "ليس لديك صلاحية للوصول",
        404: "المورد غير موجود",
        405: "الطريقة غير مسموحة",
        429: "عدد الطلبات تجاوز الحد المسموح",
    }
    return messages.get(response.status_code, "حدث خطأ")
