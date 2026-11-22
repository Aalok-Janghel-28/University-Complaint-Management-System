from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class AuthenticationAPITests(APITestCase):
    def setUp(self):
        self.register_payload = {
            'email': 'citizen@example.com',
            'full_name': 'Test Citizen',
            'phone_number': '9876543210',
            'password': 'StrongPass123!',
            'password_confirm': 'StrongPass123!',
        }

    def test_user_can_register_and_receive_tokens(self):
        response = self.client.post('/api/auth/register/', self.register_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertIn('refresh_token', response.cookies)
        self.assertTrue(response.cookies['refresh_token']['httponly'])
        self.assertEqual(response.data['user']['email'], self.register_payload['email'])
        self.assertEqual(response.data['user']['role'], User.Role.CITIZEN)

    def test_user_can_login(self):
        User.objects.create_user(
            email='citizen@example.com',
            full_name='Test Citizen',
            password='StrongPass123!',
        )

        response = self.client.post(
            '/api/auth/login/',
            {'email': 'citizen@example.com', 'password': 'StrongPass123!'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['email'], 'citizen@example.com')

    def test_profile_requires_authentication(self):
        response = self.client.get('/api/auth/profile/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_update_profile(self):
        user = User.objects.create_user(
            email='citizen@example.com',
            full_name='Test Citizen',
            password='StrongPass123!',
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            '/api/auth/profile/',
            {
                'full_name': 'Updated Citizen',
                'profile': {
                    'city': 'Ahmedabad',
                    'state': 'Gujarat',
                    'pincode': '380001',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'Updated Citizen')
        self.assertEqual(response.data['profile']['city'], 'Ahmedabad')

    def test_authenticated_user_can_change_password(self):
        user = User.objects.create_user(
            email='citizen@example.com',
            full_name='Test Citizen',
            password='StrongPass123!',
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            '/api/auth/change-password/',
            {
                'old_password': 'StrongPass123!',
                'new_password': 'NewStrongPass123!',
                'new_password_confirm': 'NewStrongPass123!',
            },
            format='json',
        )

        user.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(user.check_password('NewStrongPass123!'))

# Create your tests here.
