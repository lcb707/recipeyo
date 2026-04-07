import logging
from typing import Any, Dict, List, Optional

import requests
from django.core.files.base import ContentFile
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.db.utils import IntegrityError, OperationalError

from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode

from .models import Recipe, RecipeIngredient, RecipeStep, RecipeViewLog
from .models import RecipeCategory, RecipeCategoryRelation
from .youtube_import_sanitize import sanitize_youtube_ingredient_amount

logger = logging.getLogger("backend")


class RecipeService:
    """
    레시피 도메인 비즈니스 로직. View는 검증된 데이터만 전달하고,
    트랜잭션·검증·저장은 여기서만 수행한다.
    """
    MAX_YOUTUBE_DURATION_SECONDS = 20 * 60

    @staticmethod
    def _validate_create_input(
        user,
        recipe_data: dict,
        ingredients_data: list,
        steps_data: list,
    ) -> None:
        """필수 데이터 검증. 누락 시 BusinessLogicException 발생."""
        if user is None:
            raise BusinessLogicException(
                message="작성자 정보가 없습니다.",
                error_code=ResponseCode.ErrorCode.AuthenticationFailed,
            )
        # author FK 저장을 위해 pk 필요 (미저장 사용자/AnonymousUser 등 방지)
        if getattr(user, "pk", None) is None:
            raise BusinessLogicException(
                message="작성자 정보가 유효하지 않습니다. (저장된 사용자만 레시피 작성 가능)",
                error_code=ResponseCode.ErrorCode.AuthenticationFailed,
            )
        if not recipe_data or not isinstance(recipe_data, dict):
            raise BusinessLogicException(
                message="레시피 기본 정보가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        title = recipe_data.get("title")
        if title is None or not str(title).strip():
            raise BusinessLogicException(
                message="레시피 제목은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        if ingredients_data is None:
            raise BusinessLogicException(
                message="재료 목록이 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        if steps_data is None:
            raise BusinessLogicException(
                message="조리 순서 목록이 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        if len(ingredients_data) == 0:
            raise BusinessLogicException(
                message="재료는 최소 1개 이상 등록해야 합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        if len(steps_data) == 0:
            raise BusinessLogicException(
                message="조리 순서는 최소 1개 이상 등록해야 합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

    @staticmethod
    @transaction.atomic
    def create_recipe(
        user,
        recipe_data: dict,
        ingredients_data: list,
        steps_data: list,
        category_ids: list | None = None,
    ) -> Recipe:
        """
        레시피 기본 정보 + 재료 + 조리 순서를 한 번에 저장.
        @transaction.atomic 으로 전체가 하나의 트랜잭션: RecipeStep 저장 실패 시
        이미 저장된 Recipe, RecipeIngredient 도 함께 롤백된다.
        """
        if not isinstance(recipe_data, dict):
            recipe_data = dict(recipe_data) if recipe_data else {}
        if not isinstance(ingredients_data, list):
            ingredients_data = list(ingredients_data) if ingredients_data else []
        if not isinstance(steps_data, list):
            steps_data = list(steps_data) if steps_data else []
        RecipeService._validate_create_input(
            user, recipe_data, ingredients_data, steps_data
        )

        # Recipe 모델에 넣을 수 있는 필드만 사용 (author는 서비스에서 설정)
        _allowed = {
            "title", "description", "thumbnail_image", "serving_count",
            "cooking_time", "difficulty", "source_url", "is_ai_generated",
            "parsed_source_type", "youtube_video_id",
        }
        create_kwargs = {k: v for k, v in recipe_data.items() if k in _allowed}
        # DB/시리얼라이저 호환: cooking_time은 정수로 확정 (form-data 문자열 대비)
        if "cooking_time" in create_kwargs and create_kwargs["cooking_time"] is not None:
            try:
                create_kwargs["cooking_time"] = int(create_kwargs["cooking_time"])
            except (TypeError, ValueError):
                create_kwargs["cooking_time"] = None
        # author_id 명시로 FK 저장 시 엣지 케이스 방지
        author_pk = getattr(user, "pk", None)
        recipe = Recipe.objects.create(author_id=author_pk, **create_kwargs)

        # 카테고리 연결 (RecipeCategoryRelation)
        if category_ids:
            ids = []
            for x in category_ids:
                try:
                    ids.append(int(x))
                except (TypeError, ValueError):
                    continue
            ids = list(dict.fromkeys(ids))
            if ids:
                existing = set(RecipeCategory.objects.filter(pk__in=ids).values_list("pk", flat=True))
                missing = [cid for cid in ids if cid not in existing]
                if missing:
                    raise BusinessLogicException(
                        message="존재하지 않는 카테고리가 포함되어 있습니다.",
                        error_code=ResponseCode.ErrorCode.InputAreaInvalid,
                    )
                rels = [RecipeCategoryRelation(recipe=recipe, category_id=cid) for cid in ids]
                RecipeCategoryRelation.objects.bulk_create(rels, ignore_conflicts=True)
        ingredient_instances = []
        for idx, item in enumerate(ingredients_data):
            if not isinstance(item, dict):
                item = {}
            ingredient_instances.append(
                RecipeIngredient(
                    recipe=recipe,
                    name=item.get("name", ""),
                    amount=item.get("amount", ""),
                    unit=item.get("unit"),
                    order=item.get("order", idx),
                )
            )
        RecipeIngredient.objects.bulk_create(ingredient_instances)
        # 단계별 image(File) 저장을 위해 bulk_create 대신 save() 사용 (form-data step_image_N 지원)
        for idx, item in enumerate(steps_data):
            if not isinstance(item, dict):
                item = {}
            step = RecipeStep(
                recipe=recipe,
                step_number=item.get("step_number") if item.get("step_number") is not None else (idx + 1),
                description=item.get("description", ""),
                image=item.get("image"),
            )
            step.save()
        return recipe

    @staticmethod
    def get_existing_youtube_recipe(youtube_url: str) -> Optional[Recipe]:
        """
        같은 유튜브 URL(또는 동일 video_id)로 생성된 기존 레시피를 반환.
        없으면 None.
        """
        raw_url = (youtube_url or "").strip()
        if not raw_url:
            return None
        qs = Recipe.objects.filter(source_url=raw_url).order_by("-created_at")
        exists = qs.first()
        if exists:
            return exists
        try:
            from .youtube_extract import parse_youtube_video_id

            vid = parse_youtube_video_id(raw_url)
        except Exception:
            vid = None
        if vid:
            return (
                Recipe.objects.filter(youtube_video_id=vid)
                .order_by("-created_at")
                .first()
            )
        return None

    @staticmethod
    def import_recipe_from_youtube(user, youtube_url: str) -> Recipe:
        """
        유튜브 URL에서 메타데이터·(가능 시) 자막을 수집하고 OpenAI로 JSON 정형화 후,
        DB 저장만 ``@transaction.atomic`` 으로 묶는다 (외부 API는 트랜잭션 밖).
        """
        if user is None or getattr(user, "pk", None) is None:
            raise BusinessLogicException(
                message="작성자 정보가 유효하지 않습니다.",
                error_code=ResponseCode.ErrorCode.AuthenticationFailed,
            )
        url = (youtube_url or "").strip()
        if not url:
            raise BusinessLogicException(
                message="youtube_url은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

        existing = RecipeService.get_existing_youtube_recipe(url)
        if existing is not None:
            return existing

        _provider = str(getattr(settings, "LLM_PROVIDER", "openai") or "openai").strip().lower()
        if _provider == "gemini":
            if not (getattr(settings, "GEMINI_API_KEY", None) or "").strip():
                raise BusinessLogicException(
                    message="서버에 GEMINI_API_KEY가 설정되어 있지 않습니다.",
                    error_code=ResponseCode.ErrorCode.InternalServerError,
                )
        else:
            if not (getattr(settings, "OPENAI_API_KEY", None) or "").strip():
                raise BusinessLogicException(
                    message="서버에 OPENAI_API_KEY가 설정되어 있지 않습니다.",
                    error_code=ResponseCode.ErrorCode.InternalServerError,
                )

        yt_key = getattr(settings, "YOUTUBE_API_KEY", None)
        yt_key = (yt_key or "").strip() or None

        try:
            from .youtube_extract import fetch_youtube_bundle

            bundle = fetch_youtube_bundle(url, yt_key)
        except ValueError as e:
            logger.warning("youtube URL parse: %s", e)
            raise BusinessLogicException(
                message=str(e),
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            ) from e
        except RuntimeError as e:
            logger.warning("youtube metadata: %s", e)
            raise BusinessLogicException(
                message="유튜브 영상 정보를 가져오는 중 오류가 발생했습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            ) from e
        except Exception as e:
            logger.exception("youtube metadata unexpected: %s", e)
            raise BusinessLogicException(
                message="유튜브 메타데이터를 가져오는 중 오류가 발생했습니다.",
                error_code=ResponseCode.ErrorCode.InternalServerError,
            ) from e

        duration_seconds = bundle.get("duration_seconds")
        if isinstance(duration_seconds, (int, float)) and duration_seconds > RecipeService.MAX_YOUTUBE_DURATION_SECONDS:
            raise BusinessLogicException(
                message="20분 이하 유튜브 영상만 레시피 추출이 가능합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

        try:
            from .youtube_llm import parse_recipe_with_llm

            parsed = parse_recipe_with_llm(
                api_title=bundle.get("title") or "",
                api_description=bundle.get("description") or "",
                transcript=bundle.get("transcript") or "",
            )
        except RuntimeError as e:
            logger.warning("youtube LLM runtime error: %s", e)
            raise BusinessLogicException(
                message="레시피 분석 중 오류가 발생했습니다.",
                error_code=ResponseCode.ErrorCode.InternalServerError,
            ) from e
        except Exception as e:
            logger.exception("llm youtube import: %s", e)
            raise BusinessLogicException(
                message="레시피 분석(LLM) 중 오류가 발생했습니다.",
                error_code=ResponseCode.ErrorCode.InternalServerError,
            ) from e

        thumb_url = bundle.get("thumbnail_url")
        thumb_bytes: Optional[bytes] = None
        thumb_ext = ".jpg"
        if thumb_url:
            try:
                r = requests.get(thumb_url, timeout=30)
                r.raise_for_status()
                max_bytes = 5 * 1024 * 1024
                thumb_bytes = r.content[:max_bytes]
                ct = (r.headers.get("Content-Type") or "").lower()
                if "png" in ct:
                    thumb_ext = ".png"
                elif "webp" in ct:
                    thumb_ext = ".webp"
            except Exception as e:
                logger.warning("thumbnail download skipped: %s", e)
                thumb_bytes = None

        return RecipeService._create_recipe_from_youtube_bundle(
            user=user,
            video_id=bundle.get("video_id") or "",
            source_url=(bundle.get("source_url") or url)[:500],
            parsed=parsed,
            thumbnail_bytes=thumb_bytes,
            thumb_ext=thumb_ext,
        )

    @staticmethod
    @transaction.atomic
    def _create_recipe_from_youtube_bundle(
        user,
        *,
        video_id: str,
        source_url: str,
        parsed: dict,
        thumbnail_bytes: Optional[bytes],
        thumb_ext: str,
    ) -> Recipe:
        title = (parsed.get("title") or "").strip()[:255]
        if not title:
            title = "유튜브 레시피"
        description = (parsed.get("description") or "").strip()
        cooking_time = parsed.get("cooking_time")
        difficulty = parsed.get("difficulty") or Recipe.DifficultyChoices.EASY
        if difficulty not in (
            Recipe.DifficultyChoices.EASY,
            Recipe.DifficultyChoices.MEDIUM,
            Recipe.DifficultyChoices.HARD,
        ):
            difficulty = Recipe.DifficultyChoices.EASY

        create_kwargs: Dict[str, Any] = {
            "title": title,
            "description": description,
            "cooking_time": cooking_time,
            "difficulty": difficulty,
            "source_url": source_url[:200] if source_url else None,
            "parsed_source_type": Recipe.ParsedSourceType.YOUTUBE,
            "youtube_video_id": (video_id or "")[:20],
            "is_ai_generated": True,
        }
        if thumbnail_bytes:
            fname = f"yt_{(video_id or 'vid')[:11]}{thumb_ext}"
            create_kwargs["thumbnail_image"] = ContentFile(thumbnail_bytes, name=fname)

        recipe = Recipe.objects.create(author_id=user.pk, **create_kwargs)

        ingredients = parsed.get("ingredients") or []
        ing_objs: List[RecipeIngredient] = []
        for idx, ing in enumerate(ingredients):
            if not isinstance(ing, dict):
                continue
            name = str(ing.get("name") or "")[:255]
            amount = sanitize_youtube_ingredient_amount(ing.get("amount"))[:100]
            unit = ing.get("unit")
            u = None if unit is None or str(unit).strip() == "" else str(unit).strip()[:20]
            if not name:
                continue
            ing_objs.append(
                RecipeIngredient(
                    recipe_id=recipe.pk,
                    name=name,
                    amount=amount,
                    unit=u,
                    order=idx,
                )
            )
        if not ing_objs:
            ing_objs.append(
                RecipeIngredient(
                    recipe_id=recipe.pk,
                    name="재료",
                    amount="1",
                    unit=None,
                    order=0,
                )
            )
        RecipeIngredient.objects.bulk_create(ing_objs)

        steps_raw = parsed.get("steps") or []
        step_objs: List[RecipeStep] = []
        for item in steps_raw:
            if not isinstance(item, dict):
                continue
            try:
                sn = int(item.get("step_number") or 1)
            except (TypeError, ValueError):
                sn = 1
            desc = str(item.get("instruction") or item.get("description") or "").strip()
            if not desc:
                continue
            step_objs.append(
                RecipeStep(
                    recipe_id=recipe.pk,
                    step_number=sn,
                    description=desc,
                )
            )
        step_objs.sort(key=lambda x: x.step_number)
        for i, s in enumerate(step_objs):
            s.step_number = i + 1
        if not step_objs:
            step_objs.append(
                RecipeStep(
                    recipe_id=recipe.pk,
                    step_number=1,
                    description="조리 과정은 영상을 참고해 진행합니다.",
                )
            )
        RecipeStep.objects.bulk_create(step_objs)

        logger.info(
            "youtube recipe created | recipe_id=%s | video_id=%s | user_id=%s",
            recipe.pk,
            video_id,
            getattr(user, "pk", None),
        )
        return recipe

    @staticmethod
    @transaction.atomic
    def record_recipe_view(*, recipe: Recipe, user) -> bool:
        """
        레시피 조회수 기록.
        - 로그인 유저는 '하루에 레시피당 1회'만 증가
        - 증가 시 RecipeViewLog 생성 + Recipe.total_views 를 F()로 +1
        - 반환값: 이번 요청에서 조회수가 증가했으면 True, 아니면 False
        """
        if recipe is None:
            return False
        if user is None or getattr(user, "pk", None) is None:
            # 현재 API는 인증 필수이므로 보통 여기 안 옴. 확장 대비.
            RecipeViewLog.objects.create(recipe=recipe, user=None)
            Recipe.objects.filter(pk=recipe.pk).update(total_views=F("total_views") + 1)
            return True

        # 프로젝트 설정 USE_TZ=False(naive datetime) 환경에서도 동작하도록 방어
        now = timezone.now()
        today = timezone.localdate(now) if timezone.is_aware(now) else now.date()
        already = RecipeViewLog.objects.filter(
            recipe_id=recipe.pk,
            user_id=user.pk,
            created_at__date=today,
        ).exists()
        if already:
            return False

        RecipeViewLog.objects.create(recipe=recipe, user=user)
        Recipe.objects.filter(pk=recipe.pk).update(total_views=F("total_views") + 1)
        return True

    @staticmethod
    @transaction.atomic
    def create_recipe_with_nested(
        *,
        author,
        title: str,
        description: str = "",
        thumbnail_image: Optional[Any] = None,
        cooking_time: int,
        difficulty: str,
        ingredients: List[Dict[str, Any]],
        steps: List[Dict[str, Any]],
    ) -> Recipe:
        """기존 시리얼라이저 호환용. create_recipe 사용 권장."""
        recipe_data = {
            "title": title,
            "description": description,
            "thumbnail_image": thumbnail_image,
            "cooking_time": cooking_time,
            "difficulty": difficulty,
        }
        return RecipeService.create_recipe(author, recipe_data, ingredients, steps)

    _UPDATE_ALLOWED = {
        "title", "description", "thumbnail_image", "serving_count",
        "cooking_time", "difficulty", "source_url", "is_ai_generated",
        "parsed_source_type", "youtube_video_id",
    }

    @staticmethod
    @transaction.atomic
    def update_recipe_with_nested(
        *,
        instance: Recipe,
        title: Optional[str] = None,
        description: Optional[str] = None,
        thumbnail_image: Optional[Any] = None,
        cooking_time: Optional[int] = None,
        difficulty: Optional[str] = None,
        ingredients: Optional[List[Dict[str, Any]]] = None,
        steps: Optional[List[Dict[str, Any]]] = None,
        category_ids: Optional[list] = None,
        **kwargs,
    ) -> Recipe:
        """recipe_data(**kwargs) 중 허용 필드만 반영 후, ingredients/steps 전체 교체."""
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[update_recipe_with_nested] entry | recipe_id=%s | len(ingredients)=%s | len(steps)=%s", instance.id, len(ingredients) if ingredients else 0, len(steps) if steps else 0)
        for key, value in kwargs.items():
            if key in RecipeService._UPDATE_ALLOWED and value is not None:
                setattr(instance, key, value)
        if title is not None:
            instance.title = title
        if description is not None:
            instance.description = description
        if thumbnail_image is not None:
            instance.thumbnail_image = thumbnail_image
        if cooking_time is not None:
            instance.cooking_time = cooking_time
        if difficulty is not None:
            instance.difficulty = difficulty

        instance.save()
        # logger.info("[update_recipe_with_nested] instance.save done")

        if category_ids is not None:
            ids = []
            for x in (category_ids or []):
                try:
                    ids.append(int(x))
                except (TypeError, ValueError):
                    continue
            ids = list(dict.fromkeys(ids))
            existing = set(RecipeCategory.objects.filter(pk__in=ids).values_list("pk", flat=True))
            missing = [cid for cid in ids if cid not in existing]
            if missing:
                raise BusinessLogicException(
                    message="존재하지 않는 카테고리가 포함되어 있습니다.",
                    error_code=ResponseCode.ErrorCode.InputAreaInvalid,
                )
            instance.recipe_category_relations.all().delete()
            rels = [RecipeCategoryRelation(recipe=instance, category_id=cid) for cid in ids]
            if rels:
                RecipeCategoryRelation.objects.bulk_create(rels)

        if ingredients is not None:
            instance.recipe_ingredients.all().delete()
            _ingredients = ingredients if isinstance(ingredients, list) else []
            ingredient_instances = [
                RecipeIngredient(
                    recipe=instance,
                    name=(item if isinstance(item, dict) else {}).get("name", ""),
                    amount=(item if isinstance(item, dict) else {}).get("amount", ""),
                    unit=(item if isinstance(item, dict) else {}).get("unit"),
                    order=(item if isinstance(item, dict) else {}).get("order", idx),
                )
                for idx, item in enumerate(_ingredients)
            ]
            if ingredient_instances:
                RecipeIngredient.objects.bulk_create(ingredient_instances)
            # logger.info("[update_recipe_with_nested] RecipeIngredient bulk_create done | count=%s", len(ingredient_instances))

        if steps is not None:
            instance.recipe_steps.all().delete()
            _steps = steps if isinstance(steps, list) else []
            for idx, item in enumerate(_steps):
                _item = item if isinstance(item, dict) else {}
                step = RecipeStep(
                    recipe=instance,
                    step_number=_item.get("step_number") if _item.get("step_number") is not None else (idx + 1),
                    description=_item.get("description", ""),
                    image=_item.get("image"),
                )
                step.save()

        return instance

    @staticmethod
    @transaction.atomic
    def bulk_delete_recipes(user, recipe_ids: list) -> int:
        """
        요청 유저가 소유한 레시피만 삭제. recipe_ids 중 author != user 인 것은 무시.
        삭제된 개수를 반환.
        """
        if not isinstance(recipe_ids, list):
            recipe_ids = []
        ids = []
        for x in recipe_ids:
            if x is None:
                continue
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                continue
        if not ids:
            raise BusinessLogicException(
                message="삭제할 recipe_ids가 유효하지 않습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        deleted, _ = Recipe.objects.filter(pk__in=ids, author=user).delete()
        return deleted

