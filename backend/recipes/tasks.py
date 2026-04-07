"""
Celery 작업: 유튜브 레시피 비동기 임포트.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger("backend")


@shared_task(bind=True, soft_time_limit=300, time_limit=320)
def youtube_import_recipe_task(self, user_id: int, youtube_url: str, job_id: str) -> None:
    """
    import_recipe_from_youtube 를 워커에서 실행하고, 결과를 캐시 job 에 반영한다.
    """
    from common.exceptions import BusinessLogicException

    from .youtube_import_jobs import update_job
    from .services import RecipeService

    update_job(job_id, status="processing", message="처리 중")

    User = get_user_model()
    user = User.objects.filter(pk=user_id).first()
    if not user:
        update_job(job_id, status="failed", error_message="사용자를 찾을 수 없습니다.")
        logger.warning("youtube_import task: user missing | job_id=%s | user_id=%s", job_id, user_id)
        return

    try:
        recipe = RecipeService.import_recipe_from_youtube(user, youtube_url)
        update_job(
            job_id,
            status="success",
            recipe_id=recipe.pk,
            message="유튜브 레시피가 생성되었습니다.",
            error_message="",
        )
        logger.info(
            "youtube_import task ok | job_id=%s | recipe_id=%s | user_id=%s",
            job_id,
            recipe.pk,
            user_id,
        )
    except BusinessLogicException as e:
        update_job(
            job_id,
            status="failed",
            recipe_id=None,
            error_message=e.message or "요청을 처리할 수 없습니다.",
            message="",
        )
        logger.info(
            "youtube_import task business error | job_id=%s | msg=%s",
            job_id,
            e.message,
        )
    except Exception as e:
        logger.exception("youtube_import task failed | job_id=%s", job_id)
        update_job(
            job_id,
            status="failed",
            recipe_id=None,
            error_message="서버 오류가 발생했습니다.",
            message="",
        )
