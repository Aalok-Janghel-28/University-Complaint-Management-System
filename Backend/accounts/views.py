from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from django.contrib.auth import get_user_model

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class RegisterAPIView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'message': 'Registration successful.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = (AllowAny,)


class LogoutAPIView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'refresh': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response(
                {'refresh': 'Invalid or expired refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'message': 'Logout successful.'}, status=status.HTTP_200_OK)


class ProfileAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', request.method == 'PATCH')
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        user = User.objects.select_related('profile').get(pk=user.pk)
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class ChangePasswordAPIView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class PasswordResetRequestAPIView(generics.GenericAPIView):
    serializer_class = PasswordResetRequestSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_payload = serializer.save()

        response = {
            'message': 'If this email exists, a password reset link will be sent.',
        }
        if reset_payload:
            response['development_reset'] = reset_payload

        return Response(response, status=status.HTTP_200_OK)


class PasswordResetConfirmAPIView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password reset successful.'}, status=status.HTTP_200_OK)
