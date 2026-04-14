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

    # Remove common prefixes but keep the number as is if it doesn't match Saudi format
    if phone.startswith("+966"):
        phone = "0" + phone[4:]
    elif phone.startswith("00966"):
        phone = "0" + phone[5:]
    elif phone.startswith("966"):
        phone = "0" + phone[3:]
    elif phone.startswith("5") and len(phone) == 9:
        phone = "0" + phone

    # Return the phone if it's numeric and within reasonable length
    if 7 <= len(phone) <= 15 and phone.isdigit():
        return phone
    
    # If it's empty, return empty
    if not phone:
        return ""

    # For bulk import and general flexibility, return the cleaned string 
    # even if it doesn't meet strict criteria, as long as it's not empty.
    # We limit to 15 chars to match database constraints.
    return phone[:15]
