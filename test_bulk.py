import json
from students.services.student_services import student_bulk_create
from accounts.models import User

creator = User.objects.filter(role="admin").first() or User.objects.first()

row = {
    "full_name": "Test Student",
    "national_id": "999999999",
    "birthdate": "2010-01-01",
    "grade": "1",
    "mobile": "0590000000",
    "guardian_name": "", # empty!
    "guardian_mobile": "", # empty!
}

try:
    res = student_bulk_create(creator=creator, rows=[row])
    print("Result:", res)
except Exception as e:
    print("Exception:", e)
