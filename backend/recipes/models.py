import os
import re
import uuid
from django.conf import settings
from django.db import models


def _user_identifier_subpath(user) -> str:
    """파일 경로용 사용자 식별자. 다른 user와 구분하기 위해 identifier 폴더 사용."""
    if user is None:
        return "anonymous"
    identifier = getattr(user, "identifier", None) or str(getattr(user, "pk", "anonymous"))
    # 파일시스템 안전: 영숫자·하이픈·언더스코어만 허용, 길이 제한
    safe = re.sub(r"[^\w\-]", "_", str(identifier).strip())[:50]
    return safe or "anonymous"


def recipe_thumbnail_upload_to(instance, filename: str) -> str:
    """레시피 썸네일: recipes/thumbnails/{author.identifier}/"""
    identifier = _user_identifier_subpath(getattr(instance, "author", None))
    # upload_to는 파일명까지 포함한 경로를 반환해야 함
    _, ext = os.path.splitext(filename or "")
    ext = (ext or "").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    return f"recipes/thumbnails/{identifier}/{uuid.uuid4().hex}{ext}"


def recipe_step_image_upload_to(instance, filename: str) -> str:
    """조리 순서 이미지: recipes/steps/{recipe.author.identifier}/"""
    author = None
    if hasattr(instance, "recipe") and instance.recipe:
        author = getattr(instance.recipe, "author", None)
    identifier = _user_identifier_subpath(author)
    _, ext = os.path.splitext(filename or "")
    ext = (ext or "").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    return f"recipes/steps/{identifier}/{uuid.uuid4().hex}{ext}"


class Recipe(models.Model):
    class DifficultyChoices(models.TextChoices):
        EASY = 'easy', 'Easy'
        MEDIUM = 'medium', 'Medium'
        HARD = 'hard', 'Hard'

    class ParsedSourceType(models.TextChoices):
        MANUAL = 'manual', 'Manual'
        YOUTUBE = 'youtube', 'YouTube'
        AI = 'ai', 'AI'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    thumbnail_image = models.ImageField(
        upload_to=recipe_thumbnail_upload_to,
        blank=True,
        null=True,
    )
    serving_count = models.PositiveSmallIntegerField(blank=True, null=True)
    cooking_time = models.PositiveIntegerField(help_text='조리 시간(분 단위)', blank=True, null=True)
    difficulty = models.CharField(
        max_length=20,
        choices=DifficultyChoices.choices,
        default=DifficultyChoices.EASY,
        blank=True,
        null=True,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recipes',
    )
    source_url = models.URLField(blank=True, null=True)
    is_ai_generated = models.BooleanField(default=False)
    parsed_source_type = models.CharField(
        max_length=20,
        choices=ParsedSourceType.choices,
        blank=True,
        null=True,
    )
    youtube_video_id = models.CharField(max_length=20, blank=True, null=True)
    # 전체 조회수 캐시 (정렬/랭킹 빠른 조회용)
    total_views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.title


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name='recipe_ingredients',
    )
    name = models.CharField(max_length=255)
    amount = models.CharField(max_length=100)
    unit = models.CharField(max_length=20, blank=True, null=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self) -> str:
        return f'{self.name} ({self.amount})'


class RecipeStep(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name='recipe_steps',
    )
    step_number = models.PositiveIntegerField()
    description = models.TextField()
    image = models.ImageField(
        upload_to=recipe_step_image_upload_to,
        blank=True,
        null=True,
    )

    class Meta:
        ordering = ['step_number']

    def __str__(self) -> str:
        return f'Step {self.step_number} for {self.recipe.title}'


class RecipeCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
        return self.name


class RecipeTag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self) -> str:
        return self.name


class RecipeCategoryRelation(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name='recipe_category_relations',
    )
    category = models.ForeignKey(
        RecipeCategory,
        on_delete=models.CASCADE,
        related_name='recipe_category_relations',
    )

    class Meta:
        unique_together = ('recipe', 'category')


class RecipeTagRelation(models.Model):
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name='recipe_tag_relations',
    )
    tag = models.ForeignKey(
        RecipeTag,
        on_delete=models.CASCADE,
        related_name='recipe_tag_relations',
    )

    class Meta:
        unique_together = ('recipe', 'tag')


class RecipeViewLog(models.Model):
    """레시피 조회 로그 (기간별 조회수 산출용)."""

    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="view_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recipe_view_logs",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["recipe", "created_at"]),
            models.Index(fields=["user", "recipe", "created_at"]),
        ]


class RecipeReport(models.Model):
    """레시피 신고 (스팸·저작권 등)."""

    class Reason(models.TextChoices):
        SPAM = "spam", "스팸"
        COPYRIGHT = "copyright", "저작권 침해"
        INAPPROPRIATE = "inappropriate", "부적절한 콘텐츠"
        OTHER = "other", "기타"

    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recipe_reports",
    )
    reason = models.CharField(max_length=50, choices=Reason.choices)
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipe"]), models.Index(fields=["reporter"])]

