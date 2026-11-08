from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, UserProfile


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff', 'is_verified')
    ordering = ('email',)
    search_fields = ('email', 'full_name', 'phone_number')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal information', {'fields': ('full_name', 'phone_number', 'role', 'is_verified')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'full_name', 'role', 'password1', 'password2'),
            },
        ),
    )
    readonly_fields = ('created_at', 'updated_at')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'city', 'state', 'pincode', 'updated_at')
    search_fields = ('user__email', 'user__full_name', 'city', 'state', 'pincode')
