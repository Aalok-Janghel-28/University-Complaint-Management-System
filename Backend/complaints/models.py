import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    code = models.CharField(max_length=30, unique=True)
    description = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    officers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='departments', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('name',)

    def __str__(self):
        return self.name


class Complaint(models.Model):
    class Category(models.TextChoices):
        WATER_SUPPLY = 'water_supply', 'Water Supply'
        SANITATION = 'sanitation', 'Sanitation'
        ROAD = 'road', 'Road & Traffic'
        ELECTRICITY = 'electricity', 'Electricity'
        PUBLIC_SAFETY = 'public_safety', 'Public Safety'
        WASTE_MANAGEMENT = 'waste_management', 'Waste Management'
        HEALTHCARE = 'healthcare', 'Healthcare'
        EDUCATION = 'education', 'Education'
        GENERAL = 'general', 'General Service'

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        REVIEW = 'review', 'Review'
        ASSIGNED = 'assigned', 'Assigned'
        IN_PROGRESS = 'in_progress', 'In Progress'
        PENDING = 'pending', 'Pending'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'
        ESCALATED = 'escalated', 'Escalated'

    class Priority(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    ticket_id = models.CharField(max_length=20, unique=True, editable=False)
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_complaints',
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='complaints',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_complaints',
    )
    title = models.CharField(max_length=180)
    description = models.TextField()
    category = models.CharField(
        max_length=40,
        choices=Category.choices,
        default=Category.GENERAL,
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.NEW,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    source = models.CharField(max_length=30, default='web')
    location = models.CharField(max_length=160, blank=True)
    escalation_level = models.IntegerField(default=0)
    response_deadline = models.DateTimeField(null=True, blank=True)
    sla_deadline = models.DateTimeField(null=True, blank=True)
    ai_summary = models.TextField(blank=True)
    ai_sentiment = models.FloatField(default=0.0)
    ai_confidence = models.FloatField(default=0.0)
    resolution_summary = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    feedback_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    feedback_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)

    @property
    def sla_status(self):
        if not self.sla_deadline:
            return 'not_set'
        if self.status in {self.Status.RESOLVED, self.Status.CLOSED}:
            return 'completed'
        now = timezone.now()
        if now > self.sla_deadline or (
            self.response_deadline and self.status in {self.Status.NEW, self.Status.REVIEW}
            and now > self.response_deadline
        ):
            return 'breached'
        return 'on_track'

    def save(self, *args, **kwargs):
        if not self.ticket_id:
            self.ticket_id = f'CMP-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.ticket_id} - {self.title}'


class ComplaintComment(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='complaint_comments',
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment on {self.complaint.ticket_id}'


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='complaints/%Y/%m/')
    original_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name


class ComplaintHistory(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='history',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='complaint_history',
    )
    action = models.CharField(max_length=80)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.complaint.ticket_id}: {self.action}'


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
    )
    message = models.TextField()
    notification_type = models.CharField(max_length=40, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.recipient.email}: {self.notification_type}'


class SLAConfig(models.Model):
    department = models.OneToOneField(Department, on_delete=models.CASCADE, related_name='sla_config')
    response_hours = models.IntegerField(default=24)
    resolution_hours = models.IntegerField(default=96)
    auto_escalate = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'SLA for {self.department.name}'


class AIInsight(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='ai_insights',
    )
    summary = models.TextField()
    risk_score = models.IntegerField(default=0)
    recommendations = models.JSONField(default=list, blank=True)
    confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'AI Insight for {self.complaint.ticket_id}'
