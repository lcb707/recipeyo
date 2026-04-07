from django.test import TestCase
from django.contrib.auth.hashers import make_password

from user.models import User


# Create your tests here.
class TestUser(TestCase):

    @classmethod
    def setUpTestData(cls):
        User.objects.create(email="login_test@gmail.com",
                            nickname="login_test",
                            name="login_test",
                            password=make_password("login_test"),
                            profile_image="default_profile.png"
                            )

    def test_1(self):
        self.assertEqual(1, 1)

    def test_post_join(self):
        response = self.client.post('/user/join',
                                    dict(
                                        email="test_email@google.com",
                                        nickname="test_nickname",
                                        name="test_name",
                                        password="test_password")
                                    )
        self.assertEqual(response.status_code, 200)

        test_user = User.objects.filter(email="test_email@google.com").first()
        self.assertEqual(test_user.nickname, "test_nickname")
        self.assertEqual(test_user.name, "test_name")
        self.assertTrue(test_user.check_password("test_password"))

    def test_post_login(self):
        response = self.client.post('/user/login',
                                    dict(
                                        email="login_test@gmail.com",
                                        password="login_test")
                                    )
        self.assertEqual(response.status_code, 200)
