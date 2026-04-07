from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class ShoppingList(TimeStampedModel):
    """장보기 리스트 (개인: owner, 공유: group)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shopping_lists',
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        'community.ConnectGroup',
        on_delete=models.CASCADE,
        related_name='shopping_lists',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)


class ShoppingItem(TimeStampedModel):
    """장보기 항목 (확장: 쿠팡 링크, 가격 추적)."""

    shopping_list = models.ForeignKey(
        ShoppingList,
        on_delete=models.CASCADE,
        related_name='shopping_items',
    )
    name = models.CharField(max_length=200)
    quantity = models.CharField(max_length=50, blank=True, null=True)
    is_purchased = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    external_link = models.URLField(blank=True, null=True)
    price_tracking_url = models.URLField(blank=True, null=True)
    last_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
    )
