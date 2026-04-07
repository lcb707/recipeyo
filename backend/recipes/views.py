import logging

from datetime import timedelta

from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status as http_status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from django.db.models import Count, Q
from django.utils import timezone

from common.pagination import (
    DEFAULT_PAGE_SIZE,
    build_paginated_response,
    get_page_params,
    paginate_queryset,
)
from common.permissions import IsAuthorOrReadOnly
from common.throttles import (
    YouTubeImportBurstThrottle,
    YouTubeImportDayThrottle,
    YouTubeImportPollThrottle,
)
from common.utils import ResponseMaker
from common.response_code import ResponseCode
from .models import Recipe, RecipeCategoryRelation, RecipeReport
from .selectors import get_recommended_recipes, get_recipe_categories, get_recipe_tags

logger = logging.getLogger("backend")
from .form_data_parser import normalize_recipe_request_data
from .serializers import (
    RecipeCategorySerializer,
    RecipeCreateSerializer,
    RecipeDetailSerializer,
    RecipeListSerializer,
    RecipeReportSerializer,
    RecipeTagSerializer,
    YouTubeImportSerializer,
)
from .services import RecipeService


@extend_schema(tags=["Recipes"])
class RecipeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsAuthorOrReadOnly]

    def get_parser_classes(self):
        # 유튜브 임포트는 JSON Body
        if self.action in ("youtube_import",):
            from rest_framework.parsers import JSONParser

            return [JSONParser]
        # 파일 첨부가 필요한 생성·수정은 form-data 전용 (JSON 미지원)
        if self.action in ("create", "update", "partial_update"):
            return [MultiPartParser, FormParser]
        return super().get_parser_classes()

    def get_queryset(self):
        return (
            Recipe.objects
            .select_related('author')
            .prefetch_related('recipe_ingredients', 'recipe_steps', 'recipe_category_relations')
        )

    def get_serializer_class(self):
        if self.action in ['list', 'search']:
            return RecipeListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return RecipeCreateSerializer
        return RecipeDetailSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().order_by("-created_at")
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        total = queryset.count()
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = self.get_serializer(page_queryset, many=True, context=self.get_serializer_context())
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data, base_path=request.path.rstrip("/")
        )
        return ResponseMaker.success_response(
            message="레시피 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="categories", methods=["get"])
    def categories(self, request):
        """GET /api/v1/recipes/categories/ — 카테고리 목록."""
        queryset = get_recipe_categories()
        serializer = RecipeCategorySerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="카테고리 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="tags", methods=["get"])
    def tags(self, request):
        """GET /api/v1/recipes/tags/ — 태그 목록."""
        queryset = get_recipe_tags()
        serializer = RecipeTagSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="태그 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @extend_schema(
        request=YouTubeImportSerializer,
        summary="유튜브 URL로 레시피 자동 생성",
        description=(
            "YouTube Data API v3(선택, `YOUTUBE_API_KEY`) 또는 yt-dlp로 제목·설명·썸네일을 수집하고, "
            "가능하면 자막을 포함해 OpenAI(`OPENAI_API_KEY`)로 재료·조리 단계 JSON을 생성한 뒤 DB에 저장합니다. "
            "Body에 `\"async\": true` 를 주면 Celery로 비동기 처리하고 202 + `job_id` 를 반환합니다."
        ),
    )
    @action(
        detail=False,
        url_path="youtube-import",
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_classes=[YouTubeImportDayThrottle, YouTubeImportBurstThrottle],
    )
    def youtube_import(self, request):
        """
        POST /api/v1/recipes/youtube-import/
        - 동기: {\"youtube_url\": \"...\"} → 201, recipe_id
        - 비동기: {\"youtube_url\": \"...\", \"async\": true} → 202, job_id (Celery 워커 필요)
        """
        serializer = YouTubeImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        url = serializer.validated_data["youtube_url"]
        use_async = bool(serializer.validated_data.get("async", False))

        if use_async:
            from .tasks import youtube_import_recipe_task
            from .youtube_import_jobs import create_job

            existing = RecipeService.get_existing_youtube_recipe(url)
            if existing is not None:
                return ResponseMaker.success_response(
                    message="이미 등록된 유튜브 레시피가 있습니다.",
                    result={"recipe_id": existing.pk, "already_exists": True},
                    status_code=ResponseCode.HttpStatusCode.Success,
                )

            job_id = create_job(request.user.pk)
            youtube_import_recipe_task.delay(request.user.pk, url, job_id)
            logger.info(
                "youtube_import queued | job_id=%s | user_id=%s",
                job_id,
                getattr(request.user, "pk", None),
            )
            return ResponseMaker.success_response(
                message="유튜브 레시피 생성 작업이 접수되었습니다.",
                result={"job_id": job_id, "status": "pending"},
                status_code=http_status.HTTP_202_ACCEPTED,
            )

        existing = RecipeService.get_existing_youtube_recipe(url)
        if existing is not None:
            return ResponseMaker.success_response(
                message="이미 등록된 유튜브 레시피가 있습니다.",
                result={"recipe_id": existing.pk, "already_exists": True},
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        recipe = RecipeService.import_recipe_from_youtube(request.user, url)
        logger.info(
            "youtube_import ok | recipe_id=%s | user_id=%s",
            recipe.pk,
            getattr(request.user, "pk", None),
        )
        return ResponseMaker.success_response(
            message="유튜브 레시피가 생성되었습니다.",
            result={"recipe_id": recipe.pk},
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    @extend_schema(
        summary="유튜브 임포트 작업 상태 조회",
        description="POST `youtube-import` 에서 `async: true` 로 받은 `job_id` 의 진행 상태입니다. 본인 작업만 조회 가능.",
    )
    @action(
        detail=False,
        url_path=r"youtube-import/jobs/(?P<job_id>[0-9a-fA-F-]{36})",
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
        throttle_classes=[YouTubeImportPollThrottle],
    )
    def youtube_import_job_status(self, request, job_id=None):
        """GET /api/v1/recipes/youtube-import/jobs/{job_id}/"""
        from .youtube_import_jobs import get_job

        payload = get_job(job_id)
        if not payload:
            return ResponseMaker.error_response(
                error_code=ResponseCode.ErrorCode.ApiNotFound,
                message="작업을 찾을 수 없거나 만료되었습니다.",
                status_code=http_status.HTTP_404_NOT_FOUND,
            )
        if payload.get("user_id") != getattr(request.user, "pk", None):
            return ResponseMaker.error_response(
                error_code=ResponseCode.ErrorCode.PermissionDenied,
                message="해당 작업을 조회할 권한이 없습니다.",
                status_code=http_status.HTTP_403_FORBIDDEN,
            )
        return ResponseMaker.success_response(
            message="작업 상태 조회에 성공했습니다.",
            result={
                "job_id": job_id,
                "status": payload.get("status"),
                "recipe_id": payload.get("recipe_id"),
                "error_message": payload.get("error_message") or "",
                "updated_at": payload.get("updated_at"),
            },
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="search", methods=["get"])
    def search(self, request):
        """
        GET /api/v1/recipes/search/
        쿼리 파라미터: title(레시피명), category(카테고리 id), difficulty,
        is_recommended(기본 false, true 시 추천 알고리즘·현재 랜덤),
        ordering(-created_at 기본 최신순), page_size(기본 10), page(기본 1).
        """
        queryset = self.get_queryset()
        title = (request.query_params.get("title") or "").strip()
        category = request.query_params.get("category")
        difficulty = request.query_params.get("difficulty")
        # is_recommended 기본값 False: 명시적으로 true일 때만 추천 경로 사용
        raw_recommended = request.query_params.get("is_recommended")
        is_recommended = str(raw_recommended).lower() in ("true", "1", "yes") if raw_recommended is not None else False
        # sort/period: 조회수 랭킹용
        sort = (request.query_params.get("sort") or "latest").strip().lower()
        period = (request.query_params.get("period") or "all").strip().lower()

        ordering = request.query_params.get("ordering", "-created_at")
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)

        if title:
            queryset = queryset.filter(title__icontains=title)
        if category:
            try:
                cid = int(category)
                queryset = queryset.filter(
                    recipe_category_relations__category_id=cid
                ).distinct()
            except (TypeError, ValueError):
                pass
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)

        if is_recommended:
            page_queryset, total_count = get_recommended_recipes(queryset, page, page_size)
        else:
            if sort == "views":
                if period == "all":
                    queryset = queryset.order_by("-total_views", "-created_at")
                else:
                    days = 7 if period == "weekly" else 30 if period == "monthly" else None
                    if days is None:
                        queryset = queryset.order_by("-total_views", "-created_at")
                    else:
                        since = timezone.now() - timedelta(days=days)
                        queryset = queryset.annotate(
                            period_views=Count("view_logs", filter=Q(view_logs__created_at__gte=since))
                        ).order_by("-period_views", "-total_views", "-created_at")
            else:
                allowed_ordering = {"created_at", "-created_at", "title", "-title", "cooking_time", "-cooking_time"}
                if ordering in allowed_ordering:
                    queryset = queryset.order_by(ordering)
                else:
                    queryset = queryset.order_by("-created_at")
            total_count = queryset.count()
            offset = (page - 1) * page_size
            page_queryset = queryset[offset : offset + page_size]

        serializer = RecipeListSerializer(
            page_queryset, many=True, context=self.get_serializer_context()
        )
        # 표준 형식: count, next, previous, results (next/previous 절대 URL)
        class _CountOnly:
            def count(self): return total_count
        data = build_paginated_response(
            request, _CountOnly(), page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="레시피 검색에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="me", methods=["get"])
    def me(self, request):
        """GET /api/v1/recipes/me/ — 로그인한 유저가 작성한 레시피만. search/keyword, page, page_size 지원."""
        queryset = self.get_queryset().filter(author=request.user).order_by("-created_at")
        q = (request.query_params.get("search") or request.query_params.get("keyword") or "").strip()
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) | Q(recipe_ingredients__name__icontains=q)
            ).distinct()
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = RecipeListSerializer(
            page_queryset, many=True, context=self.get_serializer_context()
        )
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="내 레시피 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="bulk-delete", methods=["delete"])
    def bulk_delete(self, request):
        """DELETE /api/v1/recipes/bulk-delete/ — Body: recipe_ids. 소유한 레시피만 삭제."""
        recipe_ids = request.data.get("recipe_ids") if isinstance(request.data, dict) else []
        deleted_count = RecipeService.bulk_delete_recipes(request.user, recipe_ids)
        return ResponseMaker.success_response(
            message=f"선택한 레시피 {deleted_count}건을 삭제했습니다.",
            result={"deleted_count": deleted_count},
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, *args, **kwargs):
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[recipe_retrieve] start | pk=%s", kwargs.get("pk"))
        instance = self.get_object()
        # 조회수 기록: 로그인 유저는 하루 1회만 증가
        RecipeService.record_recipe_view(recipe=instance, user=request.user)
        # total_views 반영을 위해 재조회
        instance = self.get_queryset().get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return ResponseMaker.success_response(
            message="레시피 상세 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def create(self, request, *args, **kwargs):
        # form-data 시 ingredients/steps JSON 문자열 파싱 및 step_image_0,1,... 매핑 (RECIPE_STEP_IMAGES_API_DESIGN.md)

        data = normalize_recipe_request_data(request)
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        # validated_data 키: 시리얼라이저 필드명(ingredients/steps) 또는 클라이언트가 보낸 이름(recipe_ingredients/recipe_steps) 모두 처리
        ingredients_data = list(
            validated.pop("recipe_ingredients", validated.pop("ingredients", [])) or []
        )
        steps_data = list(
            validated.pop("recipe_steps", validated.pop("steps", [])) or []
        )
        category_ids = validated.pop("category_ids", []) or []
        recipe_data = dict(validated)
        recipe = RecipeService.create_recipe(
            request.user, recipe_data, ingredients_data, steps_data, category_ids=category_ids
        )

        # 직렬화 시 관계 데이터 보장: 동일 쿼리셋(select/prefetch)으로 재조회
        recipe = self.get_queryset().get(pk=recipe.pk)
        detail_data = RecipeDetailSerializer(
            recipe, context=self.get_serializer_context()
        ).data

        return ResponseMaker.success_response(
            message="레시피 생성에 성공했습니다.",
            result=detail_data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        # form-data 시 ingredients/steps JSON 파싱 및 step_image_0,1,... 매핑
        data = normalize_recipe_request_data(request)
        serializer = self.get_serializer(
            instance, data=data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        # validated_data 키: ingredients/steps 또는 recipe_ingredients/recipe_steps 모두 처리
        ingredients_data = validated.pop("recipe_ingredients", validated.pop("ingredients", None))
        steps_data = validated.pop("recipe_steps", validated.pop("steps", None))
        category_ids = validated.pop("category_ids", None)
        validated.pop("author", None)
        recipe_data = {
            k: v
            for k, v in validated.items()
            if k in RecipeService._UPDATE_ALLOWED
        }

        recipe = RecipeService.update_recipe_with_nested(
            instance=instance,
            ingredients=ingredients_data,
            steps=steps_data,
            category_ids=category_ids,
            **recipe_data,
        )
        # logger.info("[recipe_update] RecipeService.update_recipe_with_nested done | recipe_id=%s", instance.id)
        detail_data = RecipeDetailSerializer(
            recipe, context=self.get_serializer_context()
        ).data
        return ResponseMaker.success_response(
            message="레시피 수정에 성공했습니다.",
            result=detail_data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="report", methods=["post"])
    def report(self, request, pk=None):
        """
        POST /api/v1/recipes/{id}/report/
        Body: reason (필수), detail (선택). 스팸·저작권 등 신고 접수.
        """
        instance = self.get_object()
        serializer = RecipeReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        RecipeReport.objects.create(
            recipe=instance,
            reporter=request.user,
            reason=serializer.validated_data["reason"],
            detail=serializer.validated_data.get("detail") or "",
        )
        return ResponseMaker.success_response(
            message="신고가 접수되었습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def destroy(self, request, *args, **kwargs):
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[recipe_destroy] start | pk=%s", kwargs.get("pk"))
        instance = self.get_object()
        self.perform_destroy(instance)
        return ResponseMaker.success_response(
            message="레시피 삭제에 성공했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.NoContent,
        )
