from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_remove_teacher_sheikh_type'),
        ('courses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='ring_name',
            field=models.CharField(blank=True, default='', max_length=100, verbose_name='اسم الحلقة'),
        ),
        migrations.AddField(
            model_name='teacher',
            name='courses',
            field=models.ManyToManyField(blank=True, related_name='teachers', to='courses.course', verbose_name='الدورات'),
        ),
    ]
