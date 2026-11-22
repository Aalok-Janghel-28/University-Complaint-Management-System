from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import AIInsight, Complaint, ComplaintAttachment, ComplaintComment, ComplaintHistory, Department, Notification, SLAConfig

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ('id', 'name', 'code', 'description', 'email', 'phone', 'is_active', 'created_at', 'updated_at')


class StaffAccountCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.filter(is_active=True))

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email


class SLAConfigSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = SLAConfig
        fields = ('id', 'department', 'department_name', 'response_hours', 'resolution_hours', 'auto_escalate')

    def validate_response_hours(self, value):
        if value < 1:
            raise serializers.ValidationError('Response target must be at least one hour.')
        return value

    def validate_resolution_hours(self, value):
        if value < 1:
            raise serializers.ValidationError('Resolution target must be at least one hour.')
        return value


class ComplaintSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    citizen_name = serializers.SerializerMethodField()
    assigned_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = (
            'id',
            'ticket_id',
            'title',
            'description',
            'category',
            'status',
            'priority',
            'source',
            'location',
            'department',
            'department_name',
            'assigned_to',
            'citizen',
            'citizen_name',
            'assigned_name',
            'escalation_level',
            'response_deadline',
            'sla_deadline',
            'sla_status',
            'ai_summary',
            'ai_sentiment',
            'ai_confidence',
            'resolution_summary',
            'resolved_at',
            'feedback_rating',
            'feedback_comment',
            'attachments',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'ticket_id', 'citizen', 'citizen_name', 'assigned_name', 'department', 'department_name',
                            'assigned_to', 'status', 'priority', 'category', 'source', 'escalation_level', 'response_deadline',
                            'sla_deadline', 'sla_status', 'ai_summary', 'ai_sentiment', 'ai_confidence', 'resolution_summary',
                            'resolved_at',
                            'feedback_rating', 'feedback_comment', 'attachments', 'created_at', 'updated_at')

    def get_citizen_name(self, obj):
        return obj.citizen.full_name if obj.citizen else ''

    def get_assigned_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else ''

    def get_department_name(self, obj):
        return obj.department.name if obj.department else 'Unassigned'

    def get_attachments(self, obj):
        return [
            {'id': item.id, 'name': item.original_name, 'url': f'/api/complaints/attachments/{item.id}/download/',
             'created_at': item.created_at}
            for item in obj.attachments.all()
        ]


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintAttachment
        fields = ('id', 'original_name', 'file', 'created_at')
        read_only_fields = ('id', 'original_name', 'created_at')


class ComplaintFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('feedback_rating', 'feedback_comment')

    def validate_feedback_rating(self, value):
        if value is not None and not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value


class ComplaintStatusSerializer(serializers.ModelSerializer):
    note = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Complaint
        fields = ('status', 'priority', 'note')

    def validate_status(self, value):
        if value in {Complaint.Status.RESOLVED, Complaint.Status.CLOSED}:
            raise serializers.ValidationError('Use the resolution or closure action for this status.')
        return value


class ComplaintAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('department', 'assigned_to')

    def validate(self, attrs):
        assignee = attrs.get('assigned_to')
        department = attrs.get('department', getattr(self.instance, 'department', None))
        if assignee and assignee.role != User.Role.DEPARTMENT_OFFICER:
            raise serializers.ValidationError({'assigned_to': 'Complaints can only be assigned to department officers.'})
        if assignee and department is None:
            raise serializers.ValidationError({'department': 'Choose a department before assigning an officer.'})
        if assignee and not department.officers.filter(pk=assignee.pk).exists():
            raise serializers.ValidationError({'assigned_to': 'Choose an officer assigned to this department.'})
        return attrs


class ComplaintResolutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('status', 'resolution_summary')


class ComplaintCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintComment
        fields = ('id', 'complaint', 'author', 'author_name', 'message', 'created_at')
        read_only_fields = ('id', 'author', 'author_name', 'created_at')

    def get_author_name(self, obj):
        return obj.author.full_name if obj.author else ''


class ComplaintHistorySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintHistory
        fields = ('id', 'action', 'details', 'actor', 'actor_name', 'created_at')
        read_only_fields = ('id', 'actor', 'actor_name', 'created_at')

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor else ''


class NotificationSerializer(serializers.ModelSerializer):
    complaint_ticket = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ('id', 'complaint', 'complaint_ticket', 'message', 'notification_type', 'is_read', 'created_at')
        read_only_fields = ('id', 'complaint_ticket', 'created_at')

    def get_complaint_ticket(self, obj):
        return obj.complaint.ticket_id if obj.complaint else None


class AIInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIInsight
        fields = ('id', 'summary', 'risk_score', 'recommendations', 'confidence', 'created_at')
        read_only_fields = ('id', 'created_at')


class AIAnalyzeRequestSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=180)
    description = serializers.CharField(required=False, allow_blank=True)
    location = serializers.CharField(required=False, allow_blank=True, max_length=160)


class AIChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)


class AITrainRequestSerializer(serializers.Serializer):
    samples = serializers.IntegerField(required=False, min_value=1000, max_value=2_000_000, default=100_000)
    generate_if_missing = serializers.BooleanField(required=False, default=True)
