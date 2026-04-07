import os
import re
import uuid
from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


def _journal_image_upload_to(instance, filename: str) -> str:
    """요리 일지 이미지: community/journals/{user.identifier}/ (다른 user와 구분)."""
    user = getattr(instance, "user", None)
    identifier = "anonymous"
    if user:
        identifier = getattr(user, "identifier", None) or str(getattr(user, "pk", "anonymous"))
    safe = re.sub(r"[^\w\-]", "_", str(identifier).strip())[:50]
    # upload_to는 "디렉터리"가 아니라 "파일 경로(파일명 포함)"를 반환해야 함
    base, ext = os.path.splitext(filename or "")
    ext = (ext or "").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    return f"community/journals/{safe or 'anonymous'}/{uuid.uuid4().hex}{ext}"


class ConnectGroup(TimeStampedModel):
    """공유 그룹 (공유 냉장고/일지/장보기/스크랩 권한은 ConnectGroupMember로 일원화)."""

    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)


class ConnectGroupMember(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    class Status(models.TextChoices):
        PENDING = "PENDING", "대기(초대)"
        ACCEPTED = "ACCEPTED", "수락됨"

    group = models.ForeignKey(
        ConnectGroup,
        on_delete=models.CASCADE,
        related_name="connect_group_members",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="connect_group_members",
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACCEPTED,
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")


class ScrapFolder(TimeStampedModel):
    """유저 커스텀 스크랩 폴더 (개인: user 설정, 공유: group 설정)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scrap_folders',
        null=True,
        blank=True,
    )
    group = models.ForeignKey(
        ConnectGroup,
        on_delete=models.CASCADE,
        related_name='scrap_folders',
        null=True,
        blank=True,
    )
    # 그룹 생성 시 자동 생성되는 "그룹 전용 공유 스크랩 폴더" 플래그 (API로 삭제/수정 불가 대상)
    is_group_default = models.BooleanField(default=False)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "created_at"]
        constraints = [
            # group 전용 폴더는 그룹당 1개만 허용 (1:1).
            models.UniqueConstraint(
                fields=["group"],
                condition=models.Q(is_group_default=True),
                name="uniq_group_default_scrap_folder_per_group",
            ),
        ]


class RecipeScrap(models.Model):
    """레시피 스크랩 (folder nullable = 미분류)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='recipe_scraps',
    )
    recipe = models.ForeignKey(
        'recipes.Recipe',
        on_delete=models.CASCADE,
        related_name='recipe_scraps',
    )
    folder = models.ForeignKey(
        ScrapFolder,
        on_delete=models.CASCADE,
        related_name='recipe_scraps',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'folder', 'recipe')


class CookingJournal(TimeStampedModel):
    """요리 일지. 공개 범위는 visibility + target_groups로 제어."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "전체 공개"
        PRIVATE = "private", "비공개"
        ALL_GROUPS = "all_groups", "내 모든 그룹 공개"
        SPECIFIC_GROUPS = "specific_groups", "선택 그룹 공개"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cooking_journals',
    )
    recipe = models.ForeignKey(
        'recipes.Recipe',
        on_delete=models.CASCADE,
        related_name='cooking_journals',
        null=True,
        blank=True,
    )
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PRIVATE,
    )
    target_groups = models.ManyToManyField(
        ConnectGroup,
        related_name='cooking_journals_visible',
        blank=True,
        help_text="visibility=SPECIFIC_GROUPS일 때 공개할 그룹들.",
    )
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True, null=True)
    cooked_at = models.DateField()
    image = models.ImageField(upload_to=_journal_image_upload_to, blank=True, null=True)
    tags = models.JSONField(default=list, blank=True, help_text="해시태그 문자열 리스트")

    class Meta:
        ordering = ["-cooked_at", "-created_at"]


class CookingJournalComment(TimeStampedModel):
    """요리 일지 댓글."""

    journal = models.ForeignKey(
        CookingJournal,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cooking_journal_comments",
    )
    content = models.TextField()
