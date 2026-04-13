import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


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

    # Unhandled exceptions — log full details, return generic message
    logger.exception("Unhandled exception in %s", context.get("view", "unknown"))
    return Response(
        {
            "success": False,
            "error": {
                "code": 500,
                "message": "خطأ داخلي في الخادم",
                "details": None,
            },
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


def _get_error_message(response):
    """Return the actual error message from the response, falling back to a generic one."""
    data = response.data
    if isinstance(data, dict):
        msg = data.get("detail") or data.get("message")
        if msg:
            return str(msg)
    fallback = {
        400: "طلب غير صالح",
        401: "غير مصرح - يرجى تسجيل الدخول",
        403: "ليس لديك صلاحية للوصول",
        404: "المورد غير موجود",
        405: "الطريقة غير مسموحة",
        429: "عدد الطلبات تجاوز الحد المسموح",
    }
    return fallback.get(response.status_code, "حدث خطأ")


from rest_framework.exceptions import APIException

class BusinessLogicError(APIException):
    status_code = 400
    default_detail = "A business logic error occurred."
    default_code = "business_logic_error"
