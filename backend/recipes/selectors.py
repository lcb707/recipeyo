"""
레시피 조회·추천 로직. 복잡한 쿼리·알고리즘은 여기로 분리.
"""
from typing import Tuple

from django.db.models import QuerySet

from .models import Recipe, RecipeCategory, RecipeTag


def get_recommended_recipes(
    queryset: QuerySet,
    page: int,
    page_size: int,
) -> Tuple[QuerySet, int]:
    """
    추천 알고리즘에 따라 레시피 목록을 반환.
    현재는 랜덤 정렬로 구현. 추후 특정 추천 알고리즘(선호도, 재료 기반 등)으로 교체 예정.
    """
    total_count = queryset.count()
    offset = (page - 1) * page_size
    # order_by('?') = 랜덤 (추후 알고리즘 적용 시 이 부분만 교체)
    page_queryset = queryset.order_by("?")[offset : offset + page_size]
    return page_queryset, total_count


def get_recipe_categories() -> QuerySet:
    """레시피 카테고리 목록 조회."""
    return RecipeCategory.objects.all().order_by("id")


def get_recipe_tags() -> QuerySet:
    """레시피 태그 목록 조회."""
    return RecipeTag.objects.all().order_by("id")
