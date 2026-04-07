from django.db import connections
from django.utils import timezone
from django.core.cache import cache
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView
from rest_framework import status, permissions
import logging

from .utils import ResponseMaker
from .response_code import ResponseCode
from .schemas import SuccessResponseSerializer, ErrorResponseSerializer

logger = logging.getLogger("backend")


class HealthCheckView(APIView):
    """GET /health/ — Readiness(DB·Redis 체크). 기존 동작 유지. 503 시 트래픽 제외용."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(summary="Readiness 체크", description="DB·Redis 연결 확인. 실패 시 503.", responses={200: SuccessResponseSerializer, 503: ErrorResponseSerializer}, tags=["Health"])
    def get(self, request):
        health_data = {
            "status": "healthy",
            "components": {
                "database": "up",
                "redis": "up",
            },
        }

        try:
            for conn in connections.all():
                conn.cursor()
        except Exception as e:
            health_data["status"] = "unhealthy"
            health_data["components"]["database"] = "down"
            logger.warning(
                "[health] database check failed | exception_type=%s",
                type(e).__name__,
            )

        try:
            cache.set("health_check", "ok", timeout=5)
            if cache.get("health_check") != "ok":
                raise Exception("Redis get/set failure")
        except Exception as e:
            health_data["status"] = "unhealthy"
            health_data["components"]["redis"] = "down"
            logger.warning(
                "[health] redis check failed | exception_type=%s",
                type(e).__name__,
            )

        if health_data["status"] == "healthy":
            return ResponseMaker.success_response(
                message="Health check passed.",
                result=health_data,
                status_code=status.HTTP_200_OK,
            )

        return ResponseMaker.error_response(
            error_code=ResponseCode.ErrorCode.ServerError,
            message="Health check failed.",
            result=health_data,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class HealthLiveView(APIView):
    """GET /health/live/ — Liveness. 앱 프로세스 생존만 확인. DB/Redis 미체크. K8s livenessProbe용."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(summary="Liveness 체크", description="앱 프로세스 생존만 확인.", responses={200: SuccessResponseSerializer}, tags=["Health"])
    def get(self, request):
        return ResponseMaker.success_response(
            message="Live.",
            result={"status": "ok"},
            status_code=status.HTTP_200_OK,
        )


class HealthReadyView(APIView):
    """GET /health/ready/ — Readiness. DB·Redis 체크. 기존 /health/ 와 동일 로직."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(summary="Readiness 체크 (alias)", description="/health/ 와 동일. DB·Redis 체크.", responses={200: SuccessResponseSerializer, 503: ErrorResponseSerializer}, tags=["Health"])
    def get(self, request):
        return HealthCheckView().get(request)


class AdminStatsView(APIView):
    """GET /api/v1/admin/stats/ — 관리자 대시보드 통계 (가입자·레시피·그룹·요리일지 수, 주간 집계)."""
    permission_classes = [permissions.IsAdminUser]

    @extend_schema(summary="관리자 대시보드 통계", description="가입자·레시피·그룹·요리일지 수 및 최근 7일 집계. 관리자 전용.", responses={200: SuccessResponseSerializer, 403: ErrorResponseSerializer}, tags=["Admin"])
    def get(self, request):
        from django.contrib.auth import get_user_model
        from datetime import timedelta

        User = get_user_model()
        try:
            from recipes.models import Recipe
            from community.models import ConnectGroup, CookingJournal
        except ImportError:
            return ResponseMaker.error_response(
                message="Required apps not available.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        now = timezone.now()
        week_ago = now - timedelta(days=7)

        user_count = User.objects.count()
        users_last_7_days = User.objects.filter(date_joined__gte=week_ago).count()
        recipe_count = Recipe.objects.count()
        recipes_last_7_days = Recipe.objects.filter(created_at__gte=week_ago).count()
        group_count = ConnectGroup.objects.count()
        cooking_journal_count = CookingJournal.objects.count()

        result = {
            "user_count": user_count,
            "users_last_7_days": users_last_7_days,
            "recipe_count": recipe_count,
            "recipes_last_7_days": recipes_last_7_days,
            "group_count": group_count,
            "cooking_journal_count": cooking_journal_count,
        }
        return ResponseMaker.success_response(
            message="관리자 통계 조회에 성공했습니다.",
            result=result,
            status_code=status.HTTP_200_OK,
        )