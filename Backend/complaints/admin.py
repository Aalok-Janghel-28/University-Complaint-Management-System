from django.contrib import admin

from .models import AIInsight, Complaint, ComplaintComment, ComplaintHistory, Department, Notification, SLAConfig


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'email', 'phone', 'is_active')
    filter_horizontal = ('officers',)
    search_fields = ('name', 'code', 'email')


@admin.register(Complaint)
class ComplaintAdmin(admin.ModelAdmin):
    list_display = ('ticket_id', 'title', 'category', 'status', 'priority', 'department', 'assigned_to', 'created_at')
    list_filter = ('status', 'category', 'priority', 'department')
    search_fields = ('ticket_id', 'title', 'description', 'citizen__email', 'citizen__full_name')
    readonly_fields = ('ticket_id', 'resolved_at', 'created_at', 'updated_at')


@admin.register(ComplaintComment)
class ComplaintCommentAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'author', 'created_at')


@admin.register(ComplaintHistory)
class ComplaintHistoryAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'action', 'actor', 'created_at')
    readonly_fields = ('complaint', 'action', 'actor', 'details', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'complaint', 'notification_type', 'is_read', 'created_at')


@admin.register(SLAConfig)
class SLAConfigAdmin(admin.ModelAdmin):
    list_display = ('department', 'response_hours', 'resolution_hours', 'auto_escalate')


@admin.register(AIInsight)
class AIInsightAdmin(admin.ModelAdmin):
    list_display = ('complaint', 'risk_score', 'confidence', 'created_at')
