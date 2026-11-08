from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, F, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai.dataset_generator import write_training_csv
from .ai.engine import get_ai_engine
from .ai.services import apply_ai_analysis, reload_ai_engine
from .ai.trainer import ComplaintModelTrainer
from .models import AIInsight, Complaint, ComplaintComment, ComplaintHistory, Department, Notification
from .serializers import (
    AIAnalyzeRequestSerializer,
    AIChatRequestSerializer,
    AIInsightSerializer,
    AITrainRequestSerializer,
    ComplaintAssignmentSerializer,
    ComplaintCommentSerializer,
    ComplaintHistorySerializer,
    ComplaintResolutionSerializer,
    ComplaintSerializer,
    ComplaintStatusSerializer,
    DepartmentSerializer,
    NotificationSerializer,
)

User = get_user_model()


class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = (IsAuthenticated,)

    def perform_create(self, serializer):
        if self.request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN}:
            self.permission_denied(self.request, message='Only admins can create departments.')
        serializer.save()


class ComplaintListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        queryset = Complaint.objects.select_related('citizen', 'department', 'assigned_to').all()
        if user.role == User.Role.CITIZEN:
            return queryset.filter(citizen=user)
        if user.role == User.Role.DEPARTMENT_OFFICER:
            return queryset.filter(Q(department__isnull=False) | Q(assigned_to=user) | Q(citizen=user))
        return queryset

    def perform_create(self, serializer):
        complaint = serializer.save(citizen=self.request.user)
        apply_ai_analysis(complaint, actor=self.request.user)

        Notification.objects.create(
            recipient=self.request.user,
            complaint=complaint,
            message=f'Complaint {complaint.ticket_id} was submitted and analyzed by AI.',
            notification_type='submission',
        )
        if complaint.department and complaint.assigned_to:
            Notification.objects.create(
                recipient=complaint.assigned_to,
                complaint=complaint,
                message=f'New complaint assigned to you: {complaint.ticket_id}.',
                notification_type='assignment',
            )


class ComplaintDetailAPIView(generics.RetrieveUpdateAPIView):
    serializer_class = ComplaintSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        user = self.request.user
        queryset = Complaint.objects.select_related('citizen', 'department', 'assigned_to')
        if user.role == User.Role.CITIZEN:
            return queryset.filter(citizen=user)
        if user.role == User.Role.DEPARTMENT_OFFICER:
            return queryset.filter(Q(department__isnull=False) | Q(assigned_to=user) | Q(citizen=user))
        return queryset

    def update(self, request, *args, **kwargs):
        complaint = self.get_object()
        previous_status = complaint.status
        response = super().update(request, *args, **kwargs)

        if request.data.get('status') and request.data['status'] != previous_status:
            ComplaintHistory.objects.create(
                complaint=complaint,
                actor=request.user,
                action='status_updated',
                details=f'Status changed from {previous_status} to {request.data["status"]}.',
            )

        return response


class ComplaintAssignmentAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint.objects.select_related('assigned_to', 'department'), pk=complaint_id)
        if request.user.role not in {User.Role.ADMIN, User.Role.SUPER_ADMIN, User.Role.DEPARTMENT_OFFICER}:
            return Response({'detail': 'You cannot assign complaints.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ComplaintAssignmentSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save()

        if complaint.assigned_to:
            Notification.objects.create(
                recipient=complaint.assigned_to,
                complaint=complaint,
                message=f'You have been assigned complaint {complaint.ticket_id}.',
                notification_type='assignment',
            )

        ComplaintHistory.objects.create(
            complaint=complaint,
            actor=request.user,
            action='assignment_updated',
            details=f'Assigned to {complaint.assigned_to.full_name if complaint.assigned_to else "unassigned"}.',
        )
        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintStatusAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if request.user.role == User.Role.CITIZEN and complaint.citizen != request.user:
            return Response({'detail': 'You cannot update this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ComplaintStatusSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        old_status = complaint.status
        complaint = serializer.save()

        if complaint.status != old_status:
            ComplaintHistory.objects.create(
                complaint=complaint,
                actor=request.user,
                action='status_updated',
                details=f'Status changed from {old_status} to {complaint.status}.',
            )

        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintResolutionAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if request.user.role == User.Role.CITIZEN and complaint.citizen != request.user:
            return Response({'detail': 'You cannot resolve this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ComplaintResolutionSerializer(complaint, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(status=Complaint.Status.RESOLVED)

        ComplaintHistory.objects.create(
            complaint=complaint,
            actor=request.user,
            action='resolved',
            details=request.data.get('resolution_summary', 'Complaint resolved.'),
        )
        return Response(ComplaintSerializer(complaint).data, status=status.HTTP_200_OK)


class ComplaintCommentsAPIView(generics.ListCreateAPIView):
    serializer_class = ComplaintCommentSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        complaint_id = self.kwargs['complaint_id']
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if self.request.user.role == User.Role.CITIZEN and complaint.citizen != self.request.user:
            return ComplaintComment.objects.none()
        return complaint.comments.select_related('author').all()

    def perform_create(self, serializer):
        complaint = get_object_or_404(Complaint, pk=self.kwargs['complaint_id'])
        serializer.save(author=self.request.user, complaint=complaint)


class ComplaintHistoryAPIView(generics.ListAPIView):
    serializer_class = ComplaintHistorySerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        complaint = get_object_or_404(Complaint, pk=self.kwargs['complaint_id'])
        if self.request.user.role == User.Role.CITIZEN and complaint.citizen != self.request.user:
            return ComplaintHistory.objects.none()
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
        queryset = Complaint.objects.all()
        total = queryset.count()
        by_status = dict(queryset.values_list('status').annotate(count=Count('id')))
        by_priority = dict(queryset.values_list('priority').annotate(count=Count('id')))
        avg_resolution_days = queryset.filter(status=Complaint.Status.RESOLVED).aggregate(avg=Avg(F('updated_at') - F('created_at'))).get('avg')

        return Response(
            {
                'total_complaints': total,
                'status_breakdown': by_status,
                'priority_breakdown': by_priority,
                'average_resolution_hours': round((avg_resolution_days.total_seconds() / 3600) if avg_resolution_days else 0, 2),
                'resolved_count': queryset.filter(status=Complaint.Status.RESOLVED).count(),
                'open_count': queryset.exclude(status__in=[Complaint.Status.RESOLVED, Complaint.Status.CLOSED]).count(),
            },
            status=status.HTTP_200_OK,
        )


class ComplaintAIInsightAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, complaint_id):
        complaint = get_object_or_404(Complaint, pk=complaint_id)
        if request.user.role == User.Role.CITIZEN and complaint.citizen != request.user:
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
        response = engine.chat(serializer.validated_data['message'])
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
