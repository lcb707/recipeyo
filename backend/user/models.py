import re
import secrets
import string
import os
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode


def _profile_image_upload_to(instance, filename: str) -> str:
    """프로필 이미지: users/profiles/{identifier}/ (다른 user와 구분)."""
    identifier = getattr(instance, "identifier", None) or str(getattr(instance, "pk", "anonymous"))
    safe = re.sub(r"[^\w\-]", "_", str(identifier).strip())[:50]
    _, ext = os.path.splitext(filename or "")
    ext = (ext or "").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    # upload_to는 반드시 파일명까지 포함해야 한다.
    return f"users/profiles/{safe or 'anonymous'}/{uuid.uuid4().hex}{ext}"


def generate_user_identifier():
    """12자리 영소문자+숫자 랜덤 문자열 생성 (식별용, 인덱스 id와 분리)."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(12))


class UserManager(BaseUserManager):
    def create_user(self, email, nickname, role='00001', password=None):
        if not email:
            raise BusinessLogicException(
                message="이메일 주소는 필수 항목입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid
            )
        user = self.model(
            email=self.normalize_email(email), 
            nickname=nickname,
            role=role
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, nickname, password):
        user = self.create_user(email, nickname, '00009', password)
        user.is_admin = True
        user.is_superuser = True
        user.save(using=self._db)
        return user

class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        # 00001 사용자 그룹
        USER_BASIC = "00001", "일반사용자"
        # 00009: 관리자 그룹
        ADMIN = "00009", "관리자"

    # id: DB 인덱스/내부용. identifier: API·그룹 초대 등 대외 식별용 (12자리 랜덤)
    identifier = models.CharField(
        max_length=12,
        unique=True,
        db_index=True,
        blank=True,
        null=True,
        verbose_name="식별용 ID",
    )
    email = models.EmailField(unique=True, max_length=255)
    nickname = models.CharField(max_length=50)
    role = models.CharField(
        max_length=10, 
        choices=Role.choices, 
        default=Role.USER_BASIC
    )
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)
    initial_provider = models.CharField(max_length=20, default='EMAIL')
    profile_image = models.ImageField(upload_to=_profile_image_upload_to, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nickname']

    @property
    def is_staff(self):
        return self.is_admin or self.role == self.Role.ADMIN

    def save(self, *args, **kwargs):
        if not self.identifier:
            for _ in range(20):
                candidate = generate_user_identifier()
                if not type(self).objects.filter(identifier=candidate).exists():
                    self.identifier = candidate
                    break
            else:
                import uuid
                self.identifier = uuid.uuid4().hex[:12]
        super().save(*args, **kwargs)


class SocialAccount(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    provider = models.CharField(max_length=20)  # 'GOOGLE', 'KAKAO', 'APPLE'
    social_id = models.CharField(max_length=255, unique=True)  # 구글에서 주는 고유 ID (sub)
    connected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('provider', 'social_id')