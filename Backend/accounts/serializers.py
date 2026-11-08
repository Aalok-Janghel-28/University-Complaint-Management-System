from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('address', 'city', 'state', 'pincode', 'avatar')


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'email',
            'full_name',
            'phone_number',
            'role',
            'is_verified',
            'profile',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'role', 'is_verified', 'created_at', 'updated_at')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'email', 'full_name', 'phone_number', 'password', 'password_confirm')
        read_only_fields = ('id',)

    def validate_email(self, value):
        email = value.lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return email

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        email = validated_data['email']
        full_name = validated_data.get('full_name', '')
        phone_number = validated_data.get('phone_number', '')
        user = User(email=email, full_name=full_name)
        user.phone_number = phone_number
        user.role = User.Role.CITIZEN
        for field_name, value in validated_data.items():
            if field_name in {'email', 'full_name', 'phone_number'}:
                continue
            setattr(user, field_name, value)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['full_name'] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class UserUpdateSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = ('full_name', 'phone_number', 'profile')

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if profile_data is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()

        return instance


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Old password is incorrect.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower().strip()

    def save(self):
        email = self.validated_data['email']
        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            return None

        return {
            'uid': urlsafe_base64_encode(force_bytes(user.pk)),
            'token': default_token_generator.make_token(user),
        }


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Passwords do not match.'})

        try:
            user_id = force_str(urlsafe_base64_decode(attrs['uid']))
            user = User.objects.get(pk=user_id, is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError({'uid': 'Invalid password reset link.'})

        if not default_token_generator.check_token(user, attrs['token']):
            raise serializers.ValidationError({'token': 'Invalid or expired password reset token.'})

        attrs['user'] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data['user']
        user.set_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user
