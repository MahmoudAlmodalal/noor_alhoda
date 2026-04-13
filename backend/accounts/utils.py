from rest_framework.exceptions import ValidationError


_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
_EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
_DIGIT_TRANSLATION = str.maketrans(
    _ARABIC_DIGITS + _EASTERN_ARABIC_DIGITS,
    "0123456789" * 2,
)
_STRIP_CHARS = (" ", "\u00A0", "\t", "\n", "\r", "-", "(", ")", ".")


def normalize_phone(raw: str) -> str:
    """
    Normalize Saudi phone numbers to the canonical '05XXXXXXXX' format.
    Raises ValidationError if the result is not a valid 10-digit 05… number.
    """
    phone = (raw or "").strip().translate(_DIGIT_TRANSLATION)
    for ch in _STRIP_CHARS:
        phone = phone.replace(ch, "")

    if phone.startswith("+966"):
        phone = "0" + phone[4:]
    elif phone.startswith("00966"):
        phone = "0" + phone[5:]
    elif phone.startswith("966"):
        phone = "0" + phone[3:]
    elif phone.startswith("5") and len(phone) == 9:
        phone = "0" + phone

    if not (len(phone) == 10 and phone.startswith("05") and phone.isascii() and phone.isdigit()):
        raise ValidationError({"phone_number": "رقم الجوال غير صالح."})

    return phone
