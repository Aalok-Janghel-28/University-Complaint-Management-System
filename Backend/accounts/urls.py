from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    ChangePasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    PasswordResetConfirmAPIView,
    PasswordResetRequestAPIView,
    ProfileAPIView,
    RegisterAPIView,
)

urlpatterns = [
    path('register/', RegisterAPIView.as_view(), name='auth-register'),
    path('login/', LoginAPIView.as_view(), name='auth-login'),
    path('logout/', LogoutAPIView.as_view(), name='auth-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('profile/', ProfileAPIView.as_view(), name='auth-profile'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change-password'),
    path('password-reset/', PasswordResetRequestAPIView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmAPIView.as_view(), name='password-reset-confirm'),
]
