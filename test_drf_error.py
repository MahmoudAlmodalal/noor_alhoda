from rest_framework.exceptions import ValidationError
try:
    raise ValidationError({"guardian_name": "هذا الحقل مطلوب."})
except ValidationError as e:
    print(repr(e.detail))
