from django.core.management.base import BaseCommand

from complaints.ai.sla import process_sla_escalations


class Command(BaseCommand):
    help = 'Escalate active complaints whose resolution SLA deadline has passed.'

    def handle(self, *args, **options):
        count = process_sla_escalations()
        self.stdout.write(self.style.SUCCESS(f'Escalated {count} overdue complaint(s).'))
