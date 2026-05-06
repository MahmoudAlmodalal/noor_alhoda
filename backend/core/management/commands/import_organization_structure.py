"""
Management command to import organization structure (teachers/staff) from Excel file.
Usage: python manage.py import_organization_structure /path/to/file.xlsx
"""
import openpyxl
from datetime import datetime, date
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from teacher.models import Teacher


class Command(BaseCommand):
    help = "Import organization structure (teachers/staff) from an Excel file."

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str, help="Path to the Excel file")

    def handle(self, *args, **options):
        file_path = options["file_path"]

        try:
            workbook = openpyxl.load_workbook(file_path)

            # Find the sheet with data
            sheet = None
            for sheet_name in workbook.sheetnames:
                candidate_sheet = workbook[sheet_name]
                if candidate_sheet.max_row > 3:
                    sheet = candidate_sheet
                    break

            if not sheet:
                raise CommandError("No sheet with data found in Excel file.")

            # Find header row (look for 'الإسم')
            header_row = None
            for row_idx in range(1, min(10, sheet.max_row + 1)):
                for cell in sheet[row_idx]:
                    if cell.value and 'الإسم' in str(cell.value):
                        header_row = row_idx
                        break
                if header_row:
                    break

            if not header_row:
                raise CommandError("Could not find header row in Excel file.")

            # Map columns by position
            column_index_map = {
                2: 'full_name',
                3: 'national_id',
                4: 'contact_number',
                5: 'birthdate',
                6: 'ring_name',
                7: 'ring_number',
                13: 'position',  # Job title
            }

            # Get or create admin user
            admin_user = User.objects.filter(role="admin").first()
            if not admin_user:
                self.stdout.write(
                    self.style.WARNING(
                        "No admin user found. Please create one first."
                    )
                )
                return

            # Read rows and create teachers
            created_count = 0
            updated_count = 0
            errors = []

            with transaction.atomic():
                for row_cells in sheet.iter_rows(min_row=header_row + 1, values_only=False):
                    # Skip completely empty rows
                    if not any(cell.value for cell in row_cells):
                        continue

                    row_dict = {}
                    for col_idx, cell in enumerate(row_cells):
                        if col_idx in column_index_map:
                            field_name = column_index_map[col_idx]
                            value = cell.value

                            # Convert datetime objects to date strings
                            if field_name == 'birthdate':
                                if isinstance(value, datetime):
                                    value = value.date().isoformat()
                                elif isinstance(value, date):
                                    value = value.isoformat()
                                elif isinstance(value, str) and value:
                                    # Handle DD\MM\YYYY or DD/MM/YYYY format
                                    try:
                                        value = value.replace('\\', '/')
                                        parts = value.split('/')
                                        if len(parts) == 3:
                                            # Assume DD/MM/YYYY format
                                            value = f"{parts[2]}-{parts[1]}-{parts[0]}"
                                    except:
                                        value = None
                            elif isinstance(value, date) and not isinstance(value, datetime):
                                value = value.isoformat()

                            row_dict[field_name] = value

                    # Only process rows with a name or national ID
                    if not (row_dict.get('full_name') or row_dict.get('national_id')):
                        continue

                    try:
                        national_id = str(row_dict.get('national_id', '')).strip()
                        phone_number = str(row_dict.get('contact_number', '')).strip()
                        full_name = str(row_dict.get('full_name', '')).strip()

                        # Create or update user for teacher
                        user, created = User.objects.get_or_create(
                            national_id=national_id,
                            defaults={
                                'phone_number': phone_number,
                                'role': 'teacher',
                                'is_active': True,
                            }
                        )

                        if not created:
                            user.phone_number = phone_number
                            user.save()

                        # Create or update teacher profile
                        teacher, t_created = Teacher.objects.get_or_create(
                            user=user,
                            defaults={
                                'ring_name': row_dict.get('ring_name') or full_name,
                                'birthdate': row_dict.get('birthdate'),
                            }
                        )

                        if not t_created:
                            teacher.ring_name = row_dict.get('ring_name') or full_name
                            teacher.birthdate = row_dict.get('birthdate')
                            teacher.save()

                        if t_created:
                            created_count += 1
                        else:
                            updated_count += 1

                    except Exception as e:
                        errors.append({
                            "name": row_dict.get('full_name', 'Unknown'),
                            "message": str(e)
                        })

            self.stdout.write(
                self.style.SUCCESS(f"✓ Created: {created_count} teachers")
            )
            self.stdout.write(
                self.style.SUCCESS(f"✓ Updated: {updated_count} teachers")
            )

            if errors:
                self.stdout.write(
                    self.style.WARNING(f"\n⚠ {len(errors)} errors encountered:")
                )
                for error in errors[:10]:  # Show first 10 errors
                    self.stdout.write(
                        self.style.WARNING(
                            f"  {error['name']}: {error['message']}"
                        )
                    )
            else:
                self.stdout.write(self.style.SUCCESS("✓ No errors!"))

        except FileNotFoundError:
            raise CommandError(f"File not found: {file_path}")
        except Exception as e:
            raise CommandError(f"Error importing Excel file: {str(e)}")
