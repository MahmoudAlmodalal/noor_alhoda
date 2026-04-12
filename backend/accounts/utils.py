def normalize_phone(raw: str) -> str:
    """
    Normalize Saudi phone numbers to the canonical '05XXXXXXXX' format.
    """
    phone = (raw or "").strip().replace(" ", "").replace("-", "")
    if phone.startswith("+966"):
        phone = "0" + phone[4:]
    elif phone.startswith("966"):
        phone = "0" + phone[3:]
    elif phone.startswith("5") and len(phone) == 9:
        phone = "0" + phone
    return phone
