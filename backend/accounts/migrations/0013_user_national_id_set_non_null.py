from django.db import migrations, models


class Migration(migrations.Migration):
    """
    الخطوة الثانية: تحويل national_id إلى non-null بعد تعبئة البيانات.
    شغّل هذه الـ migration فقط بعد التأكد أن جميع المستخدمين الموجودين
    لديهم قيمة في national_id.
    """

    dependencies = [
        ('accounts', '0012_user_national_id_alter_user_phone_number_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='national_id',
            field=models.CharField(
                max_length=20,
                unique=True,
                verbose_name='رقم الهوية',
                help_text='يُستخدم لتسجيل الدخول',
            ),
        ),
    ]
