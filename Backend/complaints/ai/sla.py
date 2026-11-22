from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from complaints.models import Complaint, ComplaintHistory, Notification


def process_sla_escalations():
    """Escalate overdue active complaints once; safe for repeated scheduled runs."""
    now = timezone.now()
    overdue = Complaint.objects.filter(department__sla_config__auto_escalate=True).filter(
        Q(sla_deadline__lt=now) |
        (Q(response_deadline__lt=now) & Q(status__in=[Complaint.Status.NEW, Complaint.Status.REVIEW]))
    ).exclude(status__in=[Complaint.Status.RESOLVED, Complaint.Status.CLOSED, Complaint.Status.ESCALATED])
    processed = 0
    for complaint in overdue.select_related('citizen', 'assigned_to').iterator():
        with transaction.atomic():
            changed = Complaint.objects.filter(pk=complaint.pk).exclude(
                status__in=[Complaint.Status.RESOLVED, Complaint.Status.CLOSED, Complaint.Status.ESCALATED]
            ).update(status=Complaint.Status.ESCALATED, escalation_level=complaint.escalation_level + 1, updated_at=now)
            if not changed:
                continue
            ComplaintHistory.objects.create(
                complaint=complaint, action='sla_escalated',
                details='The response or resolution SLA deadline passed. Complaint was automatically escalated.',
            )
            recipients = {complaint.citizen_id}
            if complaint.assigned_to_id:
                recipients.add(complaint.assigned_to_id)
            recipients.update(complaint.department.officers.values_list('id', flat=True))
            for recipient_id in recipients:
                Notification.objects.create(
                    recipient_id=recipient_id, complaint=complaint,
                    message=f'{complaint.ticket_id} exceeded its SLA and was automatically escalated.',
                    notification_type='escalation',
                )
            processed += 1
    return processed
