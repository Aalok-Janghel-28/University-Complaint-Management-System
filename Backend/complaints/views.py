import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncMonth
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai.dataset_generator import write_training_csv
from .ai.engine import get_ai_engine
from .ai.services import apply_ai_analysis, reload_ai_engine
from .ai.trainer import ComplaintModelTrainer
from .ai.sla import process_sla_escalations
from .models import AIInsight, Complaint, ComplaintAttachment, ComplaintComment, ComplaintHistory, Department, Notification, SLAConfig
from .serializers import (
    AIAnalyzeRequestSerializer,
    AIChatRequestSerializer,
    AIInsightSerializer,
    AITrainRequestSerializer,
    ComplaintAssignmentSerializer,
    ComplaintFeedbackSerializer,
    ComplaintCommentSerializer,
    ComplaintHistorySerializer,
    ComplaintResolutionSerializer,
    ComplaintSerializer,
    ComplaintStatusSerializer,
    DepartmentSerializer,
    NotificationSerializer,
    SLAConfigSerializer,
    StaffAccountCreateSerializer,
)

User = get_user_model()


def _can_view_complaint(user, complaint):
    if user.role in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
        return True
    if user.role == User.Role.CITIZEN:
        return complaint.citizen_id == user.id
    return complaint.assigned_to_id == user.id or complaint.citizen_id == user.id or (
        complaint.department_id and complaint.department.officers.filter(pk=user.pk).exists()
    )


def _can_manage_complaint(user, complaint):
    if user.role in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
        return True
    return user.role == User.Role.DEPARTMENT_OFFICER and (
        complaint.assigned_to_id == user.id or
        (complaint.department_id and complaint.department.officers.filter(pk=user.pk).exists())
    )


class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (IsAuthenticated,)

    def perform_create(self, serializer):
        if self.request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            self.permission_denied(self.request, message='Only admins can create departments.')
        serializer.save()


class StaffDirectoryAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN, User.Role.DEPARTMENT_OFFICER}:
            return Response({'detail': 'Staff directory is only available to university staff.'}, status=status.HTTP_403_FORBIDDEN)
        departments = Department.objects.filter(is_active=True)
        officers = User.objects.filter(role=User.Role.DEPARTMENT_OFFICER, is_active=True).prefetch_related('departments')
        if request.user.role == User.Role.DEPARTMENT_OFFICER:
            departments = departments.filter(officers=request.user)
            officers = officers.filter(departments__officers=request.user)
        officers = officers.order_by('full_name').distinct()
        return Response({
            'departments': DepartmentSerializer(departments.distinct(), many=True).data,
            'officers': [{'id': user.id, 'full_name': user.full_name, 'email': user.email,
                          'department_ids': list(user.departments.values_list('id', flat=True))} for user in officers],
        })

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            return Response({'detail': 'Only admins can create staff accounts.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = StaffAccountCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = serializer.validated_data.pop('department')
        password = serializer.validated_data.pop('password')
        officer = User.objects.create_user(**serializer.validated_data, password=password, role=User.Role.DEPARTMENT_OFFICER)
        department.officers.add(officer)
        return Response({'id': officer.id, 'full_name': officer.full_name, 'email': officer.email,
                         'department_ids': [department.id]}, status=status.HTTP_201_CREATED)


class SLAConfigAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            return Response({'detail': 'Only admins can view SLA configuration.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(SLAConfigSerializer(SLAConfig.objects.select_related('department').all(), many=True).data)

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            return Response({'detail': 'Only admins can change SLA configuration.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = SLAConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        department = serializer.validated_data['department']
        config, _ = SLAConfig.objects.update_or_create(department=department, defaults={
            'response_hours': serializer.validated_data['response_hours'],
            'resolution_hours': serializer.validated_data['resolution_hours'],
            'auto_escalate': serializer.validated_data['auto_escalate'],
        })
        return Response(SLAConfigSerializer(config).data, status=status.HTTP_200_OK)


class ComplaintListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get_queryset(self):
        user = self.request.user
        if user.role != User.Role.CITIZEN:
            process_sla_escalations()
        queryset = Complaint.objects.select_related('citizen', 'department', 'assigned_to').prefetch_related('attachments').all()
        if user.role == User.Role.CITIZEN:
            return queryset.filter(citizen=user)
        if user.role == User.Role.DEPARTMENT_OFFICER:
            return queryset.filter(Q(assigned_to=user) | Q(department__officers=user) | Q(citizen=user)).distinct()
        return queryset

    def perform_create(self, serializer):
        complaint = serializer.save(citizen=self.request.user)
        apply_ai_analysis(complaint, actor=self.request.user)

        for uploaded_file in self.request.FILES.getlist('attachments'):
            ComplaintAttachment.objects.create(
                complaint=complaint, file=uploaded_file, original_name=uploaded_file.name[:255],
                uploaded_by=self.request.user,
            )

        Notification.objects.create(
            recipient=self.request.user,
            complaint=complaint,
            message=f'Complaint {complaint.ticket_id} was submitted and analyzed by AI.',
            notification_type='submission',
        )
        staff_recipients = set(complaint.department.officers.values_list('id', flat=True)) if complaint.department_id else set()
        if complaint.assigned_to_id:
            staff_recipients.add(complaint.assigned_to_id)
        for recipient_id in staff_recipients:
            Notification.objects.create(recipient_id=recipient_id, complaint=complaint,
                message=f'New complaint routed to your department: {complaint.ticket_id}.', notification_type='assignment')

        sla = SLAConfig.objects.filter(department=complaint.department).first() if complaint.department else None
        if sla and not complaint.sla_deadline:
            now = timezone.now()
            complaint.response_deadline = now + timedelta(hours=sla.response_hours)
            complaint.sla_deadline = now + timedelta(hours=sla.resolution_hours)
            complaint.save(update_fields=['response_deadline', 'sla_deadline', 'updated_at'])

    def create(self, request, *args, **kwargs):
        files = request.FILES.getlist('attachments')
        if len(files) > 5:
            return Response({'attachments': 'You can attach up to 5 files.'}, status=status.HTTP_400_BAD_REQUEST)
        for uploaded_file in files:
            if uploaded_file.size > 10 * 1024 * 1024:
                return Response({'attachments': f'{uploaded_file.name} exceeds the 10 MB limit.'}, status=status.HTTP_400_BAD_REQUEST)
            allowed_types = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
            }
            extension = uploaded_file.name.lower().rsplit('.', 1)[-1]
            expected_type = allowed_types.get(f'.{extension}')
            if not expected_type or uploaded_file.content_type != expected_type:
                return Response({'attachments': f'{uploaded_file.name} must be an image or PDF.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)


class ComplaintDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = (IsAuthenticated,)

    def get_serializer_context(self):
        return super().get_serializer_context()

    def get_queryset(self):
        user = self.request.user
        queryset = Complaint.objects.select_related('citizen', 'department', 'assigned_to')
        if user.role == User.Role.CITIZEN:
            return queryset.filter(citizen=user)
        if user.role == User.Role.DEPARTMENT_OFFICER:
            return queryset.filter(Q(assigned_to=user) | Q(department__officers=user) | Q(citizen=user)).distinct()
        return queryset

    def update(self, request, *args, **kwargs):
        complaint = self.get_object()
        if request.user.role != User.Role.CITIZEN or complaint.citizen_id != request.user.id:
            return Response({'detail': 'Complaint fields can only be edited by the submitting citizen.'}, status=status.HTTP_403_FORBIDDEN)
        if complaint.status != Complaint.Status.NEW:
            return Response({'detail': 'A complaint can only be edited before staff begin review.'}, status=status.HTTP_400_BAD_REQUEST)
        allowed = {'title', 'description', 'location'}
        if set(request.data.keys()) - allowed:
            return Response({'detail': 'Only title, description, and location can be edited.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


class ComplaintAssignmentAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint.objects.select_related('assigned_to', 'department'), pk=complaint_id)
        if not _can_manage_complaint(request.user, complaint):
            return Response({'detail': 'You cannot assign complaints.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ComplaintAssignmentSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        requested_department = serializer.validated_data.get('department', complaint.department)
        requested_assignee = serializer.validated_data.get('assigned_to', complaint.assigned_to)
        if request.user.role == User.Role.DEPARTMENT_OFFICER:
            if requested_department != complaint.department:
                return Response({'detail': 'Officers can only assign within their department.'}, status=status.HTTP_403_FORBIDDEN)
            if requested_assignee and not requested_department.officers.filter(pk=requested_assignee.pk).exists():
                return Response({'detail': 'Choose an officer from this department.'}, status=status.HTTP_400_BAD_REQUEST)
        previous_assignee = complaint.assigned_to_id
        previous_department = complaint.department_id
        complaint = serializer.save()

        if complaint.assigned_to and complaint.status == Complaint.Status.NEW:
            complaint.status = Complaint.Status.ASSIGNED
        if complaint.department_id != previous_department:
            sla = SLAConfig.objects.filter(department=complaint.department).first() if complaint.department_id else None
            if sla:
                now = timezone.now()
                complaint.response_deadline = now + timedelta(hours=sla.response_hours)
                complaint.sla_deadline = now + timedelta(hours=sla.resolution_hours)
            else:
                complaint.response_deadline = None
                complaint.sla_deadline = None
        complaint.save(update_fields=['status', 'response_deadline', 'sla_deadline', 'updated_at'])

        assignment_recipients = set()
        if complaint.assigned_to_id and complaint.assigned_to_id != previous_assignee:
            assignment_recipients.add(complaint.assigned_to_id)
        if complaint.department_id != previous_department and complaint.department_id:
            assignment_recipients.update(complaint.department.officers.values_list('id', flat=True))
        for recipient_id in assignment_recipients:
            if recipient_id != request.user.id:
                Notification.objects.create(recipient_id=recipient_id, complaint=complaint,
                    message=f'{complaint.ticket_id} was routed to your department.', notification_type='assignment')

        ComplaintHistory.objects.create(
            complaint=complaint,
            actor=request.user,
            action='assignment_updated',
            details=f'Assigned to {complaint.assigned_to.full_name if complaint.assigned_to else "unassigned"}. Department: {complaint.department.name if complaint.department else "unassigned"}.',
        )
        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintStatusAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if not _can_manage_complaint(request.user, complaint):
            return Response({'detail': 'Only an administrator or assigned officer can update this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ComplaintStatusSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_status = complaint.status
        complaint = serializer.save()

        if complaint.status != old_status:
            ComplaintHistory.objects.create(
                complaint=complaint,
                actor=request.user,
                action='status_updated',
                details=(f'Status changed from {old_status} to {complaint.status}.' +
                         (f' Note: {serializer.validated_data["note"]}' if serializer.validated_data.get('note') else '')),
            )
            Notification.objects.create(recipient=complaint.citizen, complaint=complaint,
                message=f'{complaint.ticket_id} is now {complaint.get_status_display()}.', notification_type='status')
        elif serializer.validated_data.get('note'):
            ComplaintHistory.objects.create(complaint=complaint, actor=request.user, action='staff_note',
                details=serializer.validated_data['note'])

        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintResolutionAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if not _can_manage_complaint(request.user, complaint):
            return Response({'detail': 'Only an administrator or assigned officer can resolve this complaint.'}, status=status.HTTP_403_FORBIDDEN)
        if complaint.status in {Complaint.Status.RESOLVED, Complaint.Status.CLOSED}:
            return Response({'detail': 'This complaint has already been resolved.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ComplaintResolutionSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get('resolution_summary', '').strip():
            return Response({'resolution_summary': 'Add a resolution summary before resolving this complaint.'}, status=status.HTTP_400_BAD_REQUEST)
        complaint = serializer.save(status=Complaint.Status.RESOLVED, resolved_at=timezone.now())

        ComplaintHistory.objects.create(
            complaint=complaint,
            actor=request.user,
            action='resolved',
            details=request.data.get('resolution_summary', 'Complaint resolved.'),
        )
        Notification.objects.create(recipient=complaint.citizen, complaint=complaint,
            message=f'{complaint.ticket_id} has been resolved. Please review the resolution and leave feedback.', notification_type='resolved')
        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintFeedbackAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if complaint.citizen_id != request.user.id:
            return Response({'detail': 'Only the submitting citizen can leave feedback.'}, status=status.HTTP_403_FORBIDDEN)
        if complaint.status not in {Complaint.Status.RESOLVED, Complaint.Status.CLOSED}:
            return Response({'detail': 'Feedback is available after resolution.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ComplaintFeedbackSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if 'feedback_rating' not in serializer.validated_data:
            return Response({'feedback_rating': 'Choose a rating from 1 to 5.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        ComplaintHistory.objects.create(complaint=complaint, actor=request.user, action='feedback_submitted',
            details=f"Citizen rated this resolution {complaint.feedback_rating}/5.")
        feedback_recipients = set(complaint.department.officers.values_list('id', flat=True)) if complaint.department_id else set()
        if complaint.assigned_to_id:
            feedback_recipients.add(complaint.assigned_to_id)
        for recipient_id in feedback_recipients:
            Notification.objects.create(recipient_id=recipient_id, complaint=complaint,
                message=f'The citizen left feedback on {complaint.ticket_id}.', notification_type='feedback')
        return Response(ComplaintSerializer(complaint, context={'request': request}).data, status=status.HTTP_200_OK)


class ComplaintClosureAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if complaint.citizen_id != request.user.id:
            return Response({'detail': 'Only the submitting citizen can close this complaint.'}, status=status.HTTP_403_FORBIDDEN)
        if complaint.status != Complaint.Status.RESOLVED:
            return Response({'detail': 'Only a resolved complaint can be closed.'}, status=status.HTTP_400_BAD_REQUEST)
        complaint.status = Complaint.Status.CLOSED
        complaint.save(update_fields=['status', 'updated_at'])
        ComplaintHistory.objects.create(complaint=complaint, actor=request.user, action='closed', details='The citizen confirmed closure of the resolved complaint.')
        if complaint.assigned_to_id:
            Notification.objects.create(recipient=complaint.assigned_to, complaint=complaint,
                message=f'{complaint.ticket_id} was closed by the citizen.', notification_type='closed')
        return Response(ComplaintSerializer(complaint, context={'request': request}).data, status=status.HTTP_200_OK)


class ComplaintAttachmentDownloadAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, attachment_id):
        attachment = get_object_or_404(ComplaintAttachment.objects.select_related('complaint'), pk=attachment_id)
        if not _can_view_complaint(request.user, attachment.complaint):
            raise NotFound()
        return FileResponse(attachment.file.open('rb'), as_attachment=True, filename=attachment.original_name)


class ComplaintCommentsAPIView(generics.ListCreateAPIView):
    serializer_class = ComplaintCommentSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        complaint_id = self.kwargs['complaint_id']
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if not _can_view_complaint(self.request.user, complaint):
            return ComplaintComment.objects.none()
        return complaint.comments.select_related('author').all()

    def perform_create(self, serializer):
        complaint = get_object_or_404(Complaint, pk=self.kwargs['complaint_id'])
        if not _can_view_complaint(self.request.user, complaint):
            self.permission_denied(self.request, message='You cannot comment on this complaint.')
        serializer.save(author=self.request.user, complaint=complaint)
        ComplaintHistory.objects.create(complaint=complaint, actor=self.request.user, action='comment_added', details='A comment was added to the complaint.')
        if self.request.user != complaint.citizen:
            recipients = {complaint.citizen_id}
        else:
            recipients = set(complaint.department.officers.values_list('id', flat=True)) if complaint.department_id else set()
            if complaint.assigned_to_id:
                recipients.add(complaint.assigned_to_id)
        recipients.discard(self.request.user.id)
        for recipient_id in recipients:
            Notification.objects.create(recipient_id=recipient_id, complaint=complaint,
                message=f'New update on {complaint.ticket_id}.', notification_type='comment')


class ComplaintHistoryAPIView(generics.ListAPIView):
    serializer_class = ComplaintHistorySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        complaint = get_object_or_404(Complaint, pk=self.kwargs['complaint_id'])
        if not _can_view_complaint(self.request.user, complaint):
            raise NotFound()
        return complaint.history.select_related('actor').all()


class NotificationListAPIView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')


class NotificationReadAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, notification_id):
        notification = get_object_or_404(Notification, pk=notification_id, recipient=request.user)
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return Response({'message': 'Notification marked as read.'}, status=status.HTTP_200_OK)


class ComplaintAnalyticsAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if request.user.role != User.Role.CITIZEN:
            process_sla_escalations()
        queryset = Complaint.objects.all()
        if request.user.role == User.Role.CITIZEN:
            queryset = queryset.filter(citizen=request.user)
        elif request.user.role == User.Role.DEPARTMENT_OFFICER:
            queryset = queryset.filter(Q(assigned_to=request.user) | Q(department__officers=request.user)).distinct()
        total = queryset.count()
        by_status = dict(queryset.values_list('status').annotate(count=Count('id')))
        by_priority = dict(queryset.values_list('priority').annotate(count=Count('id')))
        avg_resolution_days = queryset.filter(resolved_at__isnull=False).aggregate(avg=Avg(F('resolved_at') - F('created_at'))).get('avg')
        months = queryset.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month')

        return Response(
            {
                'total_complaints': total,
                'status_breakdown': by_status,
                'priority_breakdown': by_priority,
                'average_resolution_hours': round((avg_resolution_days.total_seconds() / 3600) if avg_resolution_days else 0, 2),
                'resolved_count': queryset.filter(status=Complaint.Status.RESOLVED).count(),
                'open_count': queryset.exclude(status__in=[Complaint.Status.RESOLVED, Complaint.Status.CLOSED]).count(),
                'category_breakdown': dict(queryset.values_list('category').annotate(count=Count('id'))),
                'department_breakdown': list(queryset.values('department__name').annotate(count=Count('id')).order_by('-count')),
                'sla_breached_count': queryset.filter(
                    Q(sla_deadline__lt=timezone.now()) |
                    (Q(response_deadline__lt=timezone.now()) & Q(status__in=[Complaint.Status.NEW, Complaint.Status.REVIEW]))
                ).exclude(status__in=[Complaint.Status.RESOLVED, Complaint.Status.CLOSED]).count(),
                'average_feedback_rating': round(queryset.aggregate(avg=Avg('feedback_rating'))['avg'] or 0, 2),
                'monthly_breakdown': [{'month': row['month'].strftime('%Y-%m'), 'count': row['count']} for row in months],
            },
            status=status.HTTP_200_OK,
        )


class ComplaintAIInsightAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if not _can_view_complaint(request.user, complaint):
            return Response({'detail': 'You cannot analyze this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        analysis = apply_ai_analysis(complaint, actor=request.user)
        insight = AIInsight.objects.filter(complaint=complaint).order_by('-created_at').first()
        payload = AIInsightSerializer(insight).data
        payload['analysis'] = analysis
        return Response(payload, status=status.HTTP_200_OK)


class AIStatusAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        engine = get_ai_engine()
        return Response(engine.get_status(), status=status.HTTP_200_OK)


class AIAnalyzeTextAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = AIAnalyzeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        engine = get_ai_engine()
        analysis = engine.analyze_text(
            title=payload.get('title', ''),
            description=payload.get('description', ''),
            location=payload.get('location', ''),
        )
        return Response(analysis, status=status.HTTP_200_OK)


class AIChatAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = AIChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        engine = get_ai_engine()
        message = serializer.validated_data['message']
        response = engine.chat(message)
        if response.get('intent') == 'status_check':
            ticket_match = re.search(r'CMP-\d{8}-[A-Z0-9]+', message, re.I)
            records = Complaint.objects.all()
            if request.user.role == User.Role.CITIZEN:
                records = records.filter(citizen=request.user)
            elif request.user.role == User.Role.DEPARTMENT_OFFICER:
                records = records.filter(Q(assigned_to=request.user) | Q(department__officers=request.user)).distinct()
            if ticket_match:
                records = records.filter(ticket_id__iexact=ticket_match.group(0))
            records = records.order_by('-created_at')[:5]
            if records.exists():
                response['reply'] = 'Here are your latest complaint updates: ' + '; '.join(
                    f'{item.ticket_id}: {item.get_status_display()}' for item in records
                )
            elif ticket_match:
                response['reply'] = 'I could not find that ticket in your account. Check the ticket ID or open your complaints board.'
        return Response(response, status=status.HTTP_200_OK)


class AITrainAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            return Response({'detail': 'Only admins can trigger AI training.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AITrainRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        samples = serializer.validated_data['samples']
        generate_if_missing = serializer.validated_data['generate_if_missing']
        data_path = settings.AI_TRAINING_DATA_PATH
        models_dir = settings.AI_MODELS_DIR

        if not data_path.exists():
            if not generate_if_missing:
                return Response({'detail': 'Training dataset missing. Generate data first.'}, status=status.HTTP_400_BAD_REQUEST)
            write_training_csv(data_path, total_samples=max(samples, settings.AI_DEFAULT_TRAIN_SAMPLES))

        trainer = ComplaintModelTrainer(models_dir=models_dir, data_path=data_path)
        metadata = trainer.train_from_csv(max_samples=samples)
        reload_ai_engine()

        return Response(
            {
                'message': 'AI models trained successfully.',
                'metadata': metadata,
            },
            status=status.HTTP_200_OK,
        )
