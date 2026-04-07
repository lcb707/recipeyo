"""
냉장고 기반 조회 로직 (복잡한 쿼리·정렬).
비즈니스 규칙은 services, 읽기 전용·성능 최적화는 여기.
"""
import logging

from django.db.models import Count, OuterRef, Q, QuerySet, Subquery

from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode
from recipes.models import Recipe

from community.models import ConnectGroupMember

from .ingredient_matching import (
    build_recipe_ingredient_match_q,
    build_recipe_ingredient_match_q_for_count,
    collect_terms_from_fridge_item_names,
    collect_terms_from_free_text,
    collect_terms_from_standard_ingredients,
)
from .models import Fridge, FridgeItem, StandardIngredient
from .services import _user_has_fridge_access


def get_fridge_for_user(user, fridge_id: int) -> Fridge:
    """fridge_id에 해당하는 Fridge를 조회하고, user 접근 권한을 검사."""
    fridge = (
        Fridge.objects.select_related("group", "owner")
        .filter(pk=fridge_id)
        .first()
    )
    if not fridge:
        raise BusinessLogicException(
            message="해당 냉장고를 찾을 수 없습니다.",
            error_code=ResponseCode.ErrorCode.ApiNotFound,
        )
    if not _user_has_fridge_access(user, fridge):
        raise BusinessLogicException(
            message="해당 냉장고에 대한 접근 권한이 없습니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied,
        )
    return fridge


def get_accessible_fridges(user) -> QuerySet:
    """
    로그인 유저가 접근 가능한 모든 냉장고 목록.
    - 개인 냉장고: owner=user, is_active=True
    - 그룹 냉장고: group 멤버(ACCEPTED) + group.is_active=True + fridge.is_active=True
    """
    return (
        Fridge.objects.filter(
            is_active=True,
        )
        .filter(
            Q(owner=user)
            | Q(
                group__is_active=True,
                group__connect_group_members__user=user,
                group__connect_group_members__status=ConnectGroupMember.Status.ACCEPTED,
            )
        )
        .distinct()
        .select_related("group", "owner")
        .order_by("-created_at")
    )


def get_shared_fridges(user) -> QuerySet:
    """내가 속한 그룹(ACCEPTED)의 공유 냉장고 목록. is_active인 그룹·냉장고만."""
    return (
        Fridge.objects.filter(
            fridge_type=Fridge.FridgeType.SHARED,
            is_active=True,
            group__is_active=True,
            group__connect_group_members__user=user,
            group__connect_group_members__status=ConnectGroupMember.Status.ACCEPTED,
        )
        .distinct()
        .select_related("group")
        .order_by("-created_at")
    )


def get_fridge_item_for_user(user, item_id: int) -> FridgeItem:
    """
    item_id에 해당하는 FridgeItem을 조회하고, 해당 냉장고에 대한 user 접근 권한을 검사.
    권한 없거나 아이템 없으면 BusinessLogicException.
    """
    item = (
        FridgeItem.objects.select_related("fridge")
        .filter(pk=item_id)
        .first()
    )
    if not item:
        raise BusinessLogicException(
            message="해당 식자재를 찾을 수 없습니다.",
            error_code=ResponseCode.ErrorCode.ApiNotFound,
        )
    if not _user_has_fridge_access(user, item.fridge):
        raise BusinessLogicException(
            message="해당 냉장고에 대한 접근 권한이 없습니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied,
        )
    return item

logger = logging.getLogger("backend")

# selected_ingredients 최대 개수 (요구사항)
MAX_SELECTED_INGREDIENTS = 5


def annotate_fridge_item_standard_ingredient_id(queryset: QuerySet) -> QuerySet:
    """
    FridgeItem.name 과 StandardIngredient.name 을 대소문자 무시 일치(iexact)로 연결한 표준 식재료 PK.
    목록 조회 시 N+1 방지용 annotate.
    """
    sub = StandardIngredient.objects.filter(name__iexact=OuterRef("name")).values("id")[:1]
    return queryset.annotate(standard_ingredient_id=Subquery(sub))


def get_fridge_items(user, fridge_id: int) -> QuerySet:
    """
    해당 냉장고에 대한 user 접근 권한을 검사한 뒤, 해당 냉장고의 FridgeItem queryset 반환.
    권한 없으면 BusinessLogicException.
    """
    _ = get_fridge_for_user(user, fridge_id)
    qs = FridgeItem.objects.filter(fridge_id=fridge_id)
    qs = annotate_fridge_item_standard_ingredient_id(qs)
    return qs.order_by("-created_at")


def get_recipes_by_ingredients(
    user,
    fridge_id=None,
    selected_ingredients: list = None,
    selected_standard_ingredient_ids: list = None,
) -> QuerySet:
    """
    선택 식재료(최대 5개 슬롯) 및/또는 냉장고 ACTIVE 재료 기준 레시피 추천.

    - ``selected_standard_ingredient_ids``: StandardIngredient PK 목록. 각 항목의 name +
      search_keywords(쉼표 구분)를 정규화·확장한 뒤, 레시피 재료명과 iexact/icontains로 매칭.
    - ``selected_ingredients``: 문자열 목록(레거시). 정규화 후 동일 매칭 규칙 적용.
    - 한 요청에서 표준 ID 개수 + 문자열 개수 합이 MAX_SELECTED_INGREDIENTS 를 넘으면 오류.
    - 냉장고 재료명(FridgeItem.name)도 정규화·유사 매칭으로 fridge_score 계산.
    """
    selected_ingredients = list(selected_ingredients or [])
    selected_standard_ingredient_ids = list(selected_standard_ingredient_ids or [])

    # 타입 정리 (문자열로 들어온 ID 등)
    norm_strings: list[str] = []
    for s in selected_ingredients:
        if s is None:
            continue
        t = str(s).strip()
        if t:
            norm_strings.append(t)

    norm_ids: list[int] = []
    for x in selected_standard_ingredient_ids:
        if x is None:
            continue
        try:
            norm_ids.append(int(x))
        except (TypeError, ValueError):
            raise BusinessLogicException(
                message="selected_standard_ingredient_ids 항목은 정수여야 합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

    if len(norm_strings) + len(norm_ids) > MAX_SELECTED_INGREDIENTS:
        raise BusinessLogicException(
            message=f"선택 식재료(표준 ID + 재료명 문자열)는 최대 {MAX_SELECTED_INGREDIENTS}개까지 가능합니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )

    std_terms, _found_std_ids = collect_terms_from_standard_ingredients(norm_ids)
    free_terms = collect_terms_from_free_text(norm_strings)
    # 선택 재료 용어: 표준 확장 + 자유 문자열(중복 제거)
    selected_terms: list[str] = []
    seen_sel: set[str] = set()
    for t in std_terms + free_terms:
        if t not in seen_sel:
            seen_sel.add(t)
            selected_terms.append(t)

    fridge_item_names = []
    if fridge_id is not None:
        has_access = Fridge.objects.filter(pk=fridge_id).filter(
            Q(owner=user) | Q(group__connect_group_members__user=user)
        ).exists()
        if not has_access:
            raise BusinessLogicException(
                message="해당 냉장고에 대한 접근 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )
        fridge_item_names = list(
            FridgeItem.objects.filter(
                fridge_id=fridge_id,
                status=FridgeItem.Status.ACTIVE,
            )
            .values_list("name", flat=True)
            .distinct()
        )

    fridge_terms = collect_terms_from_fridge_item_names(fridge_item_names)

    qs = Recipe.objects.all()
    if selected_terms:
        qs = qs.filter(build_recipe_ingredient_match_q(selected_terms)).distinct()

    sel_filter = (
        build_recipe_ingredient_match_q_for_count(selected_terms)
        if selected_terms
        else Q(pk__in=[])
    )
    fridge_filter = (
        build_recipe_ingredient_match_q_for_count(fridge_terms)
        if fridge_terms
        else Q(pk__in=[])
    )

    qs = qs.annotate(
        selected_score=Count(
            "recipe_ingredients",
            filter=sel_filter,
            distinct=True,
        ),
        fridge_score=Count(
            "recipe_ingredients",
            filter=fridge_filter,
            distinct=True,
        ),
    ).order_by("-selected_score", "-fridge_score", "-created_at")

    qs = qs.select_related("author").prefetch_related(
        "recipe_ingredients",
        "recipe_steps",
    )
    return qs


def get_recommended_recipes_by_fridge(user) -> QuerySet:
    """
    해당 user가 소유하거나 권한이 있는 냉장고의 식재료(FridgeItem.name)를 기준으로,
    RecipeIngredient.name과 가장 많이 일치하는 순서대로 Recipe 쿼리셋을 반환한다.

    동작 요약:
    1) user의 냉장고 ID 수집: 개인 냉장고(owner=user) + 공유 냉장고(group 멤버인 경우).
    2) 해당 냉장고들의 FridgeItem name 목록을 중복 제거해 리스트로 만든다.
    3) Recipe에 서브쿼리로 '일치하는 RecipeIngredient 개수'를 annotate(match_count)한다.
    4) match_count 내림차순, 동점이면 created_at 내림차순 정렬.
    5) N+1 방지를 위해 select_related('author'), prefetch_related('recipe_ingredients', 'recipe_steps') 적용.
    """
    # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
    # logger.info("[get_recommended_recipes_by_fridge] entry | user_id=%s", getattr(user, "id", None))
    # 1) user가 접근 가능한 냉장고 ID (소유 냉장고 OR 공유 그룹 멤버인 냉장고)
    fridge_ids = Fridge.objects.filter(
        Q(owner=user) | Q(group__connect_group_members__user=user)
    ).values_list("id", flat=True).distinct()

    # 2) 해당 냉장고들의 식재료 이름 목록 (중복 제거)
    fridge_item_names = list(
        FridgeItem.objects.filter(
            fridge_id__in=fridge_ids,
            status=FridgeItem.Status.ACTIVE,
        )
        .values_list("name", flat=True)
        .distinct()
    )
    # logger.info("[get_recommended_recipes_by_fridge] fridge_item_names len=%s", len(fridge_item_names))

    fridge_terms = collect_terms_from_fridge_item_names(fridge_item_names)
    fridge_filter = (
        build_recipe_ingredient_match_q_for_count(fridge_terms)
        if fridge_terms
        else Q(pk__in=[])
    )

    qs = Recipe.objects.annotate(
        match_count=Count(
            "recipe_ingredients",
            filter=fridge_filter,
            distinct=True,
        )
    ).order_by("-match_count", "-created_at")

    # 4) N+1 방지: author, recipe_ingredients, recipe_steps 한 번에 로드
    qs = qs.select_related("author").prefetch_related(
        "recipe_ingredients",
        "recipe_steps",
    )

    return qs
