import django
from django.core.exceptions import ValidationError

try:
    raise ValidationError({'guardian_name': ['This field cannot be blank.'], 'guardian_mobile': ['This field cannot be blank.']})
except ValidationError as e:
    print("Django ValidationError:", str(e))
