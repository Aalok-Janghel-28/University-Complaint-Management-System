from django.core.management.base import BaseCommand

from accounts.models import User
from complaints.models import Complaint, Department, Notification, SLAConfig


class Command(BaseCommand):
    help = 'Seed initial complaint management departments and sample complaint data.'

    def handle(self, *args, **options):
        departments = [
            ('Water Supply', 'WS', 'Water and resource distribution issues', 'water@city.gov', '+1-555-2101'),
            ('Sanitation', 'SAN', 'Waste cleaning and sanitation management', 'sanitation@city.gov', '+1-555-2102'),
            ('Road & Traffic', 'RT', 'Road maintenance and traffic safety requests', 'roads@city.gov', '+1-555-2103'),
            ('Electricity', 'ELE', 'Power outage and electrical maintenance tickets', 'electrical@city.gov', '+1-555-2104'),
            ('Healthcare', 'HSC', 'Public health and local clinic support', 'health@city.gov', '+1-555-2105'),
            ('Public Safety', 'PS', 'Security and public safety complaints', 'safety@city.gov', '+1-555-2106'),
            ('Education', 'EDU', 'Classroom, laboratory, internet and academic facility concerns', 'education@city.gov', '+1-555-2107'),
            ('General Services', 'GEN', 'General campus services and maintenance requests', 'services@city.gov', '+1-555-2108'),
        ]

        created_departments = []
        for name, code, description, email, phone in departments:
            department, _ = Department.objects.get_or_create(
                code=code,
                defaults={'name': name, 'description': description, 'email': email, 'phone': phone},
            )
            if department.name != name:
                department.name = name
                department.save()
            SLAConfig.objects.get_or_create(
                department=department,
                defaults={'response_hours': 24, 'resolution_hours': 96, 'auto_escalate': True},
            )
            created_departments.append(department)

        citizen, _ = User.objects.get_or_create(
            email='citizen@example.com',
            defaults={'full_name': 'Demo Citizen', 'role': User.Role.CITIZEN, 'is_verified': True},
        )
        citizen.set_password('password123')
        citizen.save()

        officer, _ = User.objects.get_or_create(
            email='officer@example.com',
            defaults={'full_name': 'Demo Officer', 'role': User.Role.DEPARTMENT_OFFICER, 'is_verified': True},
        )
        officer.set_password('password123')
        officer.save()
        created_departments[0].officers.add(officer)

        admin, _ = User.objects.get_or_create(
            email='admin@example.com',
            defaults={
                'full_name': 'Demo Admin',
                'role': User.Role.ADMIN,
                'is_verified': True,
                'is_staff': True,
            },
        )
        admin.set_password('password123')
        admin.save()

        complaint_defaults = {
            'citizen': citizen,
            'department': created_departments[0],
            'assigned_to': officer,
            'title': 'Street water supply is interrupted for the past two days',
            'description': 'Residents in the Main Avenue block are receiving no municipal water supply after 7 pm. This is affecting daily household use and health conditions.',
            'category': Complaint.Category.WATER_SUPPLY,
            'status': Complaint.Status.ASSIGNED,
            'priority': Complaint.Priority.HIGH,
            'source': 'mobile_app',
            'location': 'Main Avenue Block 4',
            'ai_summary': 'High-priority service outage affecting residential water access during the evening peak period.',
            'ai_confidence': 0.91,
            'ai_sentiment': 0.76,
            'resolution_summary': 'Work order created and awaiting maintenance dispatch.',
        }
        complaint, created = Complaint.objects.get_or_create(ticket_id='CMP-20250101-DEMO1', defaults=complaint_defaults)
        if created:
            Notification.objects.get_or_create(
                recipient=officer,
                complaint=complaint,
                defaults={'message': 'A new high-priority water complaint requires review.', 'notification_type': 'assignment'},
            )

        self.stdout.write(self.style.SUCCESS('Complaint management seed data is now ready.'))
