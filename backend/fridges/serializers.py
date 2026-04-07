"""
냉장고·식자재 API 시리얼라이저.
검색 자동완성용 / 읽기 전용 / 쓰기 전용 분리.
"""
from rest_framework import serializers

from common.image_url import AbsoluteImageField

from .models import Fridge, FridgeItem, StandardIngredient


class StandardIngredientSerializer(serializers.ModelSerializer):
    """검색 자동완성용. 보관방법·기본단위·키워드·아이콘 포함."""

    icon_image = AbsoluteImageField(read_only=True)

    class Meta:
        model = StandardIngredient
        fields = [
            "id",
            "name",
            "category",
            "default_storage",
            "default_expiry_days",
            "search_keywords",
            "default_unit",
            "icon_url",
            "icon_image",
        ]
        read_only_fields = fields


class FridgeSerializer(serializers.ModelSerializer):
    """냉장고 기본 정보. 소유자는 식별용 identifier만 노출."""

    owner_identifier = serializers.CharField(source="owner.identifier", read_only=True, allow_null=True)
    group_info = serializers.SerializerMethodField()

    def get_group_info(self, obj):
        group = getattr(obj, "group", None)
        if not group:
            return None
        return {
            "id": group.id,
            "name": getattr(group, "name", ""),
        }

    class Meta:
        model = Fridge
        fields = [
            "id",
            "name",
            "fridge_type",
            "owner_identifier",
            "group",
            "group_info",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class FridgeItemSerializer(serializers.ModelSerializer):
    """식자재 목록용(읽기 전용)."""

    standard_ingredient_id = serializers.SerializerMethodField()

    class Meta:
        model = FridgeItem
        fields = [
            "id",
            "fridge",
            "name",
            "quantity",
            "unit",
            "expiry_date",
            "status",
            "memo",
            "standard_ingredient_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_standard_ingredient_id(self, obj):
        """annotate 없이 직렬화된 단건(POST/PATCH 등)은 DB에서 1회 조회."""
        if hasattr(obj, "standard_ingredient_id"):
            return obj.standard_ingredient_id
        return (
            StandardIngredient.objects.filter(name__iexact=(obj.name or "").strip())
            .values_list("id", flat=True)
            .first()
        )


class FridgeItemCreateUpdateSerializer(serializers.Serializer):
    """식재료 추가/수정용(쓰기 전용). expiry_date 등 입력."""

    name = serializers.CharField(max_length=100, allow_blank=False)
    quantity = serializers.CharField(max_length=50, required=False, default="1")
    unit = serializers.CharField(max_length=20, required=False, allow_blank=True, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    memo = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)


class FridgeItemPartialUpdateSerializer(serializers.Serializer):
    """식자재 부분 수정(PATCH)용. quantity, expiry_date, status, memo만 허용."""

    quantity = serializers.CharField(max_length=50, required=False)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=FridgeItem.Status.choices,
        required=False,
    )
    memo = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)
