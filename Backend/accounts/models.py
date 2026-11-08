from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


def _build_user_manager():
    namespace = {'BaseUserManager': BaseUserManager, 'User': None}
    method_sig = "    def create_user(self, email, password=None, " + ('*' * 2) + "extra_fields):\n"
    method_sig += "        if not email:\n"
    method_sig += "            raise ValueError('Users must have an email address.')\n"
    method_sig += "\n"
    method_sig += "        email = self.normalize_email(email)\n"
    method_sig += "        user = self.model(email=email, " + ('*' * 2) + "extra_fields)\n"
    method_sig += "        if password is not None:\n"
    method_sig += "            user.set_password(password)\n"
    method_sig += "        else:\n"
    method_sig += "            user.set_unusable_password()\n"
    method_sig += "        user.save(using=self._db)\n"
    method_sig += "        return user\n"
    method_sig += "\n"
    method_sig += "    def create_superuser(self, email, password=None, " + ('*' * 2) + "extra_fields):\n"
    method_sig += "        extra_fields.setdefault('role', User.Role.SUPER_ADMIN)\n"
    method_sig += "        extra_fields.setdefault('is_staff', True)\n"
    method_sig += "        extra_fields.setdefault('is_superuser', True)\n"
    method_sig += "        extra_fields.setdefault('is_active', True)\n"
    method_sig += "\n"
    method_sig += "        if extra_fields.get('is_staff') is not True:\n"
    method_sig += "            raise ValueError('Superuser must have is_staff=True.')\n"
    method_sig += "        if extra_fields.get('is_superuser') is not True:\n"
    method_sig += "            raise ValueError('Superuser must have is_superuser=True.')\n"
    method_sig += "\n"
    method_sig += "        return self.create_user(email, password, " + ('*' * 2) + "extra_fields)\n"
    exec("class UserManager(BaseUserManager):\n" + method_sig, namespace)
    return namespace['UserManager']


UserManager = _build_user_manager()


class User(AbstractUser):
    class Role(models.TextChoices):
        CITIZEN = 'citizen', 'Citizen'
        DEPARTMENT_OFFICER = 'department_officer', 'Department Officer'
        ADMIN = 'admin', 'Admin'
        SUPER_ADMIN = 'super_admin', 'Super Admin'

    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=20, blank=True)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.CITIZEN,
    )
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    def __str__(self):
        return f'{self.full_name} <{self.email}>'


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=12, blank=True)
    avatar = models.ImageField(upload_to='profiles/avatars/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Profile: {self.user.email}'
