"""
냉장고 API. View는 파싱·Service/Selector 호출·ResponseMaker 반환만 수행.
"""
from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, When
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import filters, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination

from common.utils import ResponseMaker
from common.response_code import ResponseCode

from .models import StandardIngredient
from .selectors import (
    get_accessible_fridges,
    get_fridge_for_user,
    get_fridge_items,
    get_recipes_by_ingredients,
    get_shared_fridges,
)
from .serializers import (
    FridgeItemCreateUpdateSerializer,
    FridgeItemPartialUpdateSerializer,
    FridgeItemSerializer,
    FridgeSerializer,
    StandardIngredientSerializer,
)
from .services import FridgeService, get_or_create_my_fridge

from common.exceptions import BusinessLogicException


def _parse_positive_int(value, field_name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise BusinessLogicException(
            message=f"유효한 {field_name} 값이 필요합니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    if parsed <= 0:
        raise BusinessLogicException(
            message=f"유효한 {field_name} 값이 필요합니다.",
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
        )
    return parsed


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@extend_schema(tags=["Fridges"])
class FridgeViewSet(viewsets.GenericViewSet):
    """냉장고·식자재·추천 레시피 API. DB/비즈니스 로직은 services·selectors에 위임."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FridgeSerializer
    pagination_class = StandardResultsSetPagination

    def list(self, request, *args, **kwargs):
        """
        GET /api/v1/fridges/ — 유저가 접근 가능한 모든 냉장고(개인 + 그룹 공유) 통합 목록.
        """
        queryset = get_accessible_fridges(request.user)
        serializer = FridgeSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="냉장고 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="my-fridge", methods=["get"])
    def my_fridge(self, request):
        """GET /api/v1/fridges/my-fridge/ — 내 개인 냉장고 조회. 없으면 자동 생성 후 반환."""
        fridge = get_or_create_my_fridge(request.user)
        serializer = FridgeSerializer(fridge)
        return ResponseMaker.success_response(
            message="내 냉장고 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="shared", methods=["get"])
    def shared(self, request):
        """GET /api/v1/fridges/shared/ — 내가 속한 그룹의 공유 냉장고 목록."""
        queryset = get_shared_fridges(request.user)
        serializer = FridgeSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="공유 냉장고 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="expiring-summary", methods=["get"])
    def expiring_summary(self, request):
        """
        GET /api/v1/fridges/expiring-summary/
        접근 가능한 모든 냉장고에 대해 imminent/warning 개수 합산.
        """
        from .models import FridgeItem

        fridge_ids = list(get_accessible_fridges(request.user).values_list("id", flat=True))
        if not fridge_ids:
            return ResponseMaker.success_response(
                message="만료 임박 요약 조회에 성공했습니다.",
                result={"imminent": 0, "warning": 0},
                status_code=ResponseCode.HttpStatusCode.Success,
            )
        today = timezone.now().date()
        d3 = today + timedelta(days=3)
        d7 = today + timedelta(days=7)
        qs = FridgeItem.objects.filter(
            fridge_id__in=fridge_ids,
        ).filter(
            Q(status=FridgeItem.Status.ACTIVE) | Q(status=FridgeItem.Status.EXPIRED)
        )
        agg = qs.aggregate(
            total=Count("id"),
            imminent=Count(
                Case(
                    When(expiry_date__lte=d3, then=1),
                    output_field=IntegerField(),
                )
            ),
            warning=Count(
                Case(
                    When(expiry_date__gt=d3, expiry_date__lte=d7, then=1),
                    output_field=IntegerField(),
                )
            ),
        )
        return ResponseMaker.success_response(
            message="만료 임박 요약 조회에 성공했습니다.",
            result={
                "imminent": int(agg.get("imminent") or 0),
                "warning": int(agg.get("warning") or 0),
            },
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="summary", methods=["get"])
    def summary(self, request, pk=None):
        """
        GET /api/v1/fridges/{id}/summary/
        유통기한 상태 요약 카운트:
        - imminent: D-day <= 3 (지난 것 포함)
        - warning: 4~7일
        - fresh: 8일 이상 (expiry_date 없음도 포함)
        """
        fridge_id = _parse_positive_int(pk, "fridge_id")
        # 권한 검사는 기존 selector 경로를 사용 (없으면/권한 없으면 예외)
        _ = get_fridge_items(request.user, fridge_id)

        today = timezone.now().date()
        d3 = today + timedelta(days=3)
        d7 = today + timedelta(days=7)

        from .models import FridgeItem

        qs = FridgeItem.objects.filter(
            fridge_id=fridge_id,
        ).filter(
            Q(status=FridgeItem.Status.ACTIVE) | Q(status=FridgeItem.Status.EXPIRED)
        )

        agg = qs.aggregate(
            total=Count("id"),
            imminent=Count(
                Case(
                    When(expiry_date__lte=d3, then=1),
                    output_field=IntegerField(),
                )
            ),
            warning=Count(
                Case(
                    When(expiry_date__gt=d3, expiry_date__lte=d7, then=1),
                    output_field=IntegerField(),
                )
            ),
            fresh=Count(
                Case(
                    When(Q(expiry_date__gt=d7) | Q(expiry_date__isnull=True), then=1),
                    output_field=IntegerField(),
                )
            ),
        )

        return ResponseMaker.success_response(
            message="냉장고 요약 조회에 성공했습니다.",
            result={
                "total": int(agg.get("total") or 0),
                "imminent": int(agg.get("imminent") or 0),
                "warning": int(agg.get("warning") or 0),
                "fresh": int(agg.get("fresh") or 0),
            },
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="items", methods=["get", "post"])
    def items(self, request, pk=None):
        """GET: 식자재 목록 (?name= / ?search= 이름 부분 검색, ?status=, ?ordering=). POST: 식자재 추가."""
        fridge_id = _parse_positive_int(pk, "fridge_id")
        if request.method == "POST":
            serializer = FridgeItemCreateUpdateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            item = FridgeService.add_fridge_item(
                request.user,
                fridge_id,
                serializer.validated_data,
            )
            out = FridgeItemSerializer(item)
            return ResponseMaker.success_response(
                message="식자재를 추가했습니다.",
                result=out.data,
                status_code=ResponseCode.HttpStatusCode.Created,
            )

        queryset = get_fridge_items(request.user, fridge_id)

        # 이름 검색 (?name=우유 또는 ?search=우유)
        name_q = (request.query_params.get("name") or request.query_params.get("search") or "").strip()
        if name_q:
            queryset = queryset.filter(name__icontains=name_q)

        # 상태 필터 (?status=ACTIVE)
        status_param = (request.query_params.get("status") or "").strip()
        if status_param:
            queryset = queryset.filter(status=status_param)

        # 정렬 (?ordering=expiry_date or ?ordering=-created_at)
        ordering = (request.query_params.get("ordering") or "").strip()
        allowed_ordering = {"expiry_date", "-expiry_date", "created_at", "-created_at"}
        if ordering in allowed_ordering:
            queryset = queryset.order_by(ordering)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FridgeItemSerializer(page, many=True)
            paginated = self.get_paginated_response(serializer.data).data
            return ResponseMaker.success_response(
                message="식자재 목록 조회에 성공했습니다.",
                result=paginated,
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        serializer = FridgeItemSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="식자재 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="items/expiring", methods=["get"])
    def expiring_items(self, request, pk=None):
        """
        GET /api/v1/fridges/{id}/items/expiring/?mode=imminent|warning
        - imminent: D-day <= 3 (지난 것 포함)
        - warning: 4~7일
        """
        fridge_id = _parse_positive_int(pk, "fridge_id")
        queryset = get_fridge_items(request.user, fridge_id)

        today = timezone.now().date()
        d3 = today + timedelta(days=3)
        d7 = today + timedelta(days=7)

        mode = (request.query_params.get("mode") or "imminent").strip().lower()
        if mode == "warning":
            queryset = queryset.filter(expiry_date__gt=d3, expiry_date__lte=d7)
        else:
            # default imminent
            queryset = queryset.filter(expiry_date__lte=d3)

        # 만료 임박 상세는 ACTIVE/EXPIRED 중심
        from .models import FridgeItem
        queryset = queryset.filter(
            Q(status=FridgeItem.Status.ACTIVE) | Q(status=FridgeItem.Status.EXPIRED)
        )

        # expiry_date 가까운 순서로 보여주는 게 자연스러움
        queryset = queryset.order_by("expiry_date", "-created_at")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FridgeItemSerializer(page, many=True)
            paginated = self.get_paginated_response(serializer.data).data
            return ResponseMaker.success_response(
                message="만료 임박 식자재 목록 조회에 성공했습니다.",
                result=paginated,
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        serializer = FridgeItemSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="만료 임박 식자재 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="meta", methods=["get"])
    def meta(self, request, pk=None):
        """GET /api/v1/fridges/{id}/meta/ — 냉장고 메타 + (그룹인 경우) 내 역할."""
        fridge_id = _parse_positive_int(pk, "fridge_id")
        fridge = get_fridge_for_user(request.user, fridge_id)

        my_role = None
        if fridge.group_id:
            from community.models import ConnectGroupMember

            m = (
                ConnectGroupMember.objects.filter(
                    group_id=fridge.group_id,
                    user=request.user,
                    status=ConnectGroupMember.Status.ACCEPTED,
                )
                .only("role")
                .first()
            )
            my_role = getattr(m, "role", None)

        data = {
            "id": fridge.id,
            "name": fridge.name,
            "fridge_type": fridge.fridge_type,
            "owner_identifier": getattr(fridge.owner, "identifier", None) if fridge.owner_id else None,
            "group": fridge.group_id,
            "group_info": {"id": fridge.group.id, "name": fridge.group.name} if fridge.group_id else None,
            "my_role": my_role,
            "is_active": getattr(fridge, "is_active", True),
        }
        return ResponseMaker.success_response(
            message="냉장고 메타 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="recommend-recipes", methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def recommend_recipes(self, request, pk=None):
        """
        POST /api/v1/fridges/{id}/recommend-recipes/
        Body: selected_standard_ingredient_ids (표준 식재료 PK, 권장),
              selected_ingredients (문자열, 레거시). 합산 최대 5개.
        """
        selected_ingredients = request.data.get("selected_ingredients") or []
        selected_standard_ingredient_ids = request.data.get("selected_standard_ingredient_ids")
        if selected_standard_ingredient_ids is None:
            selected_standard_ingredient_ids = []
        queryset = get_recipes_by_ingredients(
            request.user,
            fridge_id=_parse_positive_int(pk, "fridge_id"),
            selected_ingredients=selected_ingredients,
            selected_standard_ingredient_ids=selected_standard_ingredient_ids,
        )
        sort = (request.query_params.get("sort") or "match").strip().lower()
        if sort == "latest":
            queryset = queryset.order_by("-created_at")
        elif sort == "views":
            queryset = queryset.order_by("-total_views", "-created_at")

        from recipes.serializers import RecipeListSerializer

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = RecipeListSerializer(page, many=True, context={"request": request})
            paginated = self.get_paginated_response(serializer.data).data
            return ResponseMaker.success_response(
                message="추천 레시피 조회에 성공했습니다.",
                result=paginated,
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        serializer = RecipeListSerializer(queryset, many=True, context={"request": request})
        return ResponseMaker.success_response(
            message="추천 레시피 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Fridges"])
class FridgeItemViewSet(viewsets.GenericViewSet):
    """PATCH/DELETE /api/v1/fridges/items/{item_id}/ — 냉장고 식자재 수정·삭제(소프트)."""
    permission_classes = [permissions.IsAuthenticated]

    def partial_update(self, request, pk=None):
        """PATCH /api/v1/fridges/items/{item_id}/ — 수량·유통기한·상태·메모 부분 수정."""
        item_id = _parse_positive_int(pk, "item_id")
        serializer = FridgeItemPartialUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        item = FridgeService.update_fridge_item(
            request.user,
            item_id,
            serializer.validated_data,
        )
        out = FridgeItemSerializer(item)
        return ResponseMaker.success_response(
            message="식자재를 수정했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def destroy(self, request, pk=None):
        """DELETE /api/v1/fridges/items/{item_id}/ — 상태를 DISCARDED로 변경(소프트 삭제)."""
        item_id = _parse_positive_int(pk, "item_id")
        FridgeService.delete_fridge_item(request.user, item_id)
        return ResponseMaker.success_response(
            message="식자재를 삭제했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Fridges"])
class StandardIngredientViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/v1/fridges/standard-ingredients/?search=키워드 — 이름 검색 자동완성."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StandardIngredientSerializer
    queryset = StandardIngredient.objects.all()
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "search_keywords"]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category", "").strip()
        if category:
            qs = qs.filter(category=category)
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            paginated = self.get_paginated_response(serializer.data).data
            return ResponseMaker.success_response(
                message="식자재 사전 목록 조회에 성공했습니다.",
                result=paginated,
                status_code=ResponseCode.HttpStatusCode.Success,
            )
        serializer = self.get_serializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="식자재 사전 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return ResponseMaker.success_response(
            message="식자재 사전 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="categories", methods=["get"])
    def categories(self, request, *args, **kwargs):
        """GET /api/v1/fridges/standard-ingredients/categories/ — distinct category 목록."""
        qs = self.get_queryset()
        categories = list(
            qs.values_list("category", flat=True).distinct().order_by("category")
        )
        return ResponseMaker.success_response(
            message="식자재 카테고리 목록 조회에 성공했습니다.",
            result=categories,
            status_code=ResponseCode.HttpStatusCode.Success,
        )
