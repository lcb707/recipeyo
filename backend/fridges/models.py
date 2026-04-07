from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
import os
import uuid

from core.models import TimeStampedModel


# 표준 식자재 소비기한 허용 범위 (일)
STANDARD_INGREDIENT_EXPIRY_DAYS_MIN = 1
STANDARD_INGREDIENT_EXPIRY_DAYS_MAX = 365


def _ingredient_icon_upload_to(instance, filename: str) -> str:
    """표준 식재료 아이콘 업로드 경로."""
    _, ext = os.path.splitext(filename or "")
    ext = (ext or "").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    return f"icons/ingredients/{uuid.uuid4().hex}{ext}"


class StandardIngredient(models.Model):

    class StorageType(models.TextChoices):
        FRIDGE = 'FRIDGE', '냉장'
        FREEZER = 'FREEZER', '냉동'
        ROOM_TEMP = 'ROOM_TEMP', '실온'

    # 기본 정보 (name은 검색/매칭에 사용 → db_index)
    name = models.CharField(
        max_length=100, unique=True, verbose_name="식자재명", db_index=True
    )
    category = models.CharField(max_length=50, verbose_name="카테고리", blank=False)

    # 보관 방법 (냉장/냉동/실온)
    default_storage = models.CharField(
        max_length=20,
        choices=StorageType.choices,
        default=StorageType.FRIDGE,
        verbose_name="기본 보관 방법",
    )

    # 소비기한 (1~365일 범위 검증)
    default_expiry_days = models.PositiveIntegerField(
        default=7,
        validators=[
            MinValueValidator(STANDARD_INGREDIENT_EXPIRY_DAYS_MIN),
            MaxValueValidator(STANDARD_INGREDIENT_EXPIRY_DAYS_MAX),
        ],
        help_text="기본 유통/소비기한(일). 등록 시 expiry_date 자동 계산에 사용.",
        verbose_name="기본 소비기한(일)",
    )

    # 검색용 키워드/동의어 (쉼표로 구분)
    search_keywords = models.CharField(
        max_length=255,
        blank=True,
        help_text="예: 돼지고기, 겹살이, 포크 (쉼표로 구분)",
        verbose_name="검색 키워드",
    )

    # 기본 계량 단위
    default_unit = models.CharField(
        max_length=20,
        default="개",
        help_text="예: g, ml, 개, 단, 마리",
        verbose_name="기본 단위",
    )

    # 프론트엔드용 아이콘/이미지 URL
    icon_url = models.URLField(
        max_length=500,
        blank=True,
        null=True,
        help_text="앱 화면에 보여줄 식자재 아이콘 이미지 주소",
        verbose_name="아이콘 URL",
    )
    icon_image = models.ImageField(
        upload_to=_ingredient_icon_upload_to,
        blank=True,
        null=True,
        help_text="업로드한 식재료 아이콘 이미지 파일",
        verbose_name="아이콘 이미지",
    )

    class Meta:
        verbose_name = "표준 식자재"
        verbose_name_plural = "표준 식자재 목록"
        ordering = ['category', 'name']

    def __str__(self):
        return f"[{self.get_default_storage_display()}] {self.name} ({self.default_unit})"

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValidationError({"name": "식자재명은 비울 수 없습니다."})
        if self.category is not None:
            self.category = self.category.strip()
            if not self.category:
                raise ValidationError({"category": "카테고리는 비울 수 없습니다."})
        if self.search_keywords:
            self.search_keywords = self.search_keywords.strip()
        if self.icon_url is not None and self.icon_url.strip() == "":
            self.icon_url = None


class Fridge(TimeStampedModel):
    """냉장고 (단일: owner만, 공유: group 연결, 권한은 ConnectGroupMember로 관리)."""

    class FridgeType(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        SHARED = 'shared', 'Shared'

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='fridges',
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        'community.ConnectGroup',
        on_delete=models.CASCADE,
        related_name='fridges',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    fridge_type = models.CharField(max_length=20, choices=FridgeType.choices)
    is_active = models.BooleanField(default=True)


class FridgeItem(TimeStampedModel):
    """냉장고 식재료. 수동 입력·StandardIngredient 기준 유통기한 모두 expiry_date에 저장."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "보유중"
        CONSUMED = "CONSUMED", "소비됨"
        EXPIRED = "EXPIRED", "만료"
        DISCARDED = "DISCARDED", "폐기"

    fridge = models.ForeignKey(
        Fridge,
        on_delete=models.CASCADE,
        related_name="fridge_items",
    )
    name = models.CharField(max_length=100)
    quantity = models.CharField(max_length=50)
    unit = models.CharField(max_length=20, blank=True, null=True)
    expiry_date = models.DateField(
        blank=True,
        null=True,
        help_text="수동 입력 또는 StandardIngredient.default_expiry_days 기준 자동 설정.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    memo = models.CharField(max_length=255, blank=True, null=True)
