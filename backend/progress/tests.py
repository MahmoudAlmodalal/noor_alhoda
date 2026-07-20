from datetime import date
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.exceptions import ValidationError

from accounts.models import User
from teacher.models import Teacher
from students.models import Student
from progress.models import StudentProgress
from progress.services.progress_services import progress_create, progress_update


class ProgressTestCase(APITestCase):
    def setUp(self):
        # Admin
        self.admin = User.objects.create_user(
            national_id="970590100000",
            phone_number="970590100000",
            password="adminpass",
            role="admin",
        )

        # Teacher + profile
        self.teacher_user = User.objects.create_user(
            national_id="970590100010",
            phone_number="970590100010",
            password="secret123",
            role="teacher",
        )
        self.teacher = Teacher.objects.create(
            user=self.teacher_user,
            full_name="Teacher A",
            max_students=25,
        )

        # Student (belongs to teacher)
        self.student_user = User.objects.create_user(
            national_id="970590100031",
            phone_number="970590100030",
            password="secret123",
            role="student",
        )
        self.student = Student.objects.create(
            user=self.student_user,
            full_name="Student A",
            birthdate=date(2012, 1, 1),
            grade="Grade 7",
            teacher=self.teacher,
            guardian_name="Guardian A",
            guardian_mobile="0599000001",
        )

    def test_progress_create_success(self):
        # Create memorization progress via service
        entry = progress_create(
            actor=self.admin,
            student_id=self.student.id,
            surah_number=2,  # Al-Baqarah (286 verses)
            juz_number=1,
            from_ayah=1,
            to_ayah=5,
            type="memorization"
        )
        self.assertEqual(entry.from_ayah, 1)
        self.assertEqual(entry.to_ayah, 5)
        self.assertEqual(entry.type, "memorization")

    def test_progress_create_validation_range(self):
        # from_ayah > to_ayah should raise ValidationError
        with self.assertRaises(ValidationError):
            progress_create(
                actor=self.admin,
                student_id=self.student.id,
                surah_number=2,
                juz_number=1,
                from_ayah=10,
                to_ayah=5,
                type="memorization"
            )

    def test_progress_create_validation_exceed_verses(self):
        # from_ayah exceeds Al-Baqarah verses (286)
        with self.assertRaises(ValidationError):
            progress_create(
                actor=self.admin,
                student_id=self.student.id,
                surah_number=2,
                juz_number=1,
                from_ayah=287,
                to_ayah=287,
                type="memorization"
            )

    def test_progress_update_success(self):
        entry = progress_create(
            actor=self.admin,
            student_id=self.student.id,
            surah_number=2,
            juz_number=1,
            from_ayah=1,
            to_ayah=5,
            type="memorization"
        )
        updated = progress_update(
            progress=entry,
            actor=self.admin,
            data={"from_ayah": 6, "to_ayah": 10, "type": "revision"}
        )
        self.assertEqual(updated.from_ayah, 6)
        self.assertEqual(updated.to_ayah, 10)
        self.assertEqual(updated.type, "revision")

    def test_progress_update_validation(self):
        entry = progress_create(
            actor=self.admin,
            student_id=self.student.id,
            surah_number=2,
            juz_number=1,
            from_ayah=1,
            to_ayah=5,
            type="memorization"
        )
        with self.assertRaises(ValidationError):
            progress_update(
                progress=entry,
                actor=self.admin,
                data={"from_ayah": 20, "to_ayah": 10}
            )

    def test_progress_api_create_and_list(self):
        self.client.force_authenticate(user=self.admin)
        
        # Test POST create API
        url_create = "/api/progress/create/"
        payload = {
            "student_id": str(self.student.id),
            "surah_number": 2,
            "juz_number": 1,
            "from_ayah": 1,
            "to_ayah": 10,
            "type": "memorization",
            "note": "ممتاز"
        }
        response = self.client.post(url_create, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["from_ayah"], 1)
        self.assertEqual(response.data["data"]["to_ayah"], 10)
        self.assertEqual(response.data["data"]["type"], "memorization")

        # Test GET list API
        url_list = f"/api/progress/?student={self.student.id}"
        response = self.client.get(url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])
        self.assertEqual(len(response.data["data"]), 1)
        self.assertEqual(response.data["data"][0]["from_ayah"], 1)
        self.assertEqual(response.data["data"][0]["to_ayah"], 10)
        self.assertEqual(response.data["data"][0]["type"], "memorization")

    def test_progress_api_validation_errors(self):
        self.client.force_authenticate(user=self.admin)
        url_create = "/api/progress/create/"
        
        # Invalid range
        payload = {
            "student_id": str(self.student.id),
            "surah_number": 2,
            "juz_number": 1,
            "from_ayah": 10,
            "to_ayah": 5,
            "type": "memorization",
        }
        response = self.client.post(url_create, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Exceeds total verses
        payload = {
            "student_id": str(self.student.id),
            "surah_number": 1,  # Al-Fatihah (7 verses)
            "juz_number": 1,
            "from_ayah": 1,
            "to_ayah": 8,
            "type": "memorization",
        }
        response = self.client.post(url_create, data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
