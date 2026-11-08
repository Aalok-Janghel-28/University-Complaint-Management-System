from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AIInsight, Complaint, ComplaintComment, ComplaintHistory, Department, Notification

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'


class ComplaintSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    citizen_name = serializers.SerializerMethodField()
    assigned_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

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
            'sla_deadline',
            'ai_summary',
            'ai_sentiment',
            'ai_confidence',
            'resolution_summary',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'ticket_id', 'citizen', 'citizen_name', 'assigned_name', 'department_name', 'ai_summary', 'ai_sentiment', 'ai_confidence', 'created_at', 'updated_at')

    def get_citizen_name(self, obj):
        return obj.citizen.full_name if obj.citizen else ''

    def get_assigned_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else ''

    def get_department_name(self, obj):
        return obj.department.name if obj.department else 'Unassigned'


class ComplaintStatusSerializer(serializers.ModelSerializer):
    note = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Complaint
        fields = ('status', 'priority', 'note')


class ComplaintAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('department', 'assigned_to')


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
