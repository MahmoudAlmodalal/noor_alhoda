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

    # Allow numeric strings (like national IDs) as valid usernames
    # Palestinian/Gaza IDs are 9 digits, Saudi IDs are 10 digits, etc.
    # We allow 7-15 digits to be safe for various ID and phone formats.
    if 7 <= len(phone) <= 15 and phone.isascii() and phone.isdigit():
        return phone

    raise ValidationError({"phone_number": "رقم الجوال أو الهوية غير صالح."})
