"""
커뮤니티 조회 로직 (그룹 일지 등).
읽기 전용·N+1 방지(select_related) 적용.
"""
from django.db.models import Count, Q, QuerySet

from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode

from .models import ConnectGroup, ConnectGroupMember, CookingJournal, CookingJournalComment, RecipeScrap, ScrapFolder


def get_my_accepted_groups(user) -> QuerySet:
    """내가 수락한(ACCEPTED) 그룹 목록. is_active인 그룹만."""
    return (
        ConnectGroup.objects.filter(
            is_active=True,
            connect_group_members__user=user,
            connect_group_members__status=ConnectGroupMember.Status.ACCEPTED,
        )
        .distinct()
        .order_by("-created_at")
    )


def get_group_for_user(user, group_id: int):
    """내가 멤버(ACCEPTED 또는 PENDING)인 그룹 단건. 없으면 None."""
    return (
        ConnectGroup.objects.filter(
            pk=group_id,
            connect_group_members__user=user,
            connect_group_members__status__in=(
                ConnectGroupMember.Status.ACCEPTED,
                ConnectGroupMember.Status.PENDING,
            ),
        )
        .distinct()
        .first()
    )


def get_group_for_user_with_members(user, group_id: int):
    """내가 멤버인 그룹 단건 + 멤버 목록 prefetch. 상세 조회(members 포함)용."""
    from django.db.models import Prefetch
    return (
        ConnectGroup.objects.filter(
            pk=group_id,
            connect_group_members__user=user,
            connect_group_members__status__in=(
                ConnectGroupMember.Status.ACCEPTED,
                ConnectGroupMember.Status.PENDING,
            ),
        )
        .prefetch_related(
            Prefetch(
                "connect_group_members",
                queryset=ConnectGroupMember.objects.select_related("user").order_by("joined_at"),
            )
        )
        .distinct()
        .first()
    )


def get_my_pending_invitations(user) -> QuerySet:
    """내가 초대받았으나 아직 수락하지 않은(PENDING) 그룹 목록."""
    return (
        ConnectGroup.objects.filter(
            connect_group_members__user=user,
            connect_group_members__status=ConnectGroupMember.Status.PENDING,
        )
        .distinct()
        .order_by("-created_at")
    )


def get_my_recipe_scraps(user, recipe_id=None) -> QuerySet:
    """내 스크랩 목록. recipe_id 지정 시 해당 레시피만. 폴더 무관 일괄 조회용."""
    qs = (
        RecipeScrap.objects.filter(user=user)
        .select_related("recipe", "folder")
        .order_by("-created_at")
    )
    if recipe_id is not None:
        qs = qs.filter(recipe_id=recipe_id)
    return qs


def get_my_scrap_folders(user) -> QuerySet:
    """내 개인 폴더 + 내가 ACCEPTED인 그룹의 공유 폴더(is_active). scrap_count annotate."""
    return (
        ScrapFolder.objects.filter(
            Q(user=user) | Q(group__is_active=True, group__connect_group_members__user=user, group__connect_group_members__status=ConnectGroupMember.Status.ACCEPTED)
        )
        .filter(is_active=True)
        .distinct()
        .annotate(scrap_count=Count("recipe_scraps"))
        .order_by("order", "created_at")
    )


def get_my_cooking_journals(user) -> QuerySet:
    """내가 작성한 요리 일지 목록. user, recipe select_related, target_groups prefetch."""
    return (
        CookingJournal.objects.filter(user=user)
        .select_related("user", "recipe")
        .prefetch_related("target_groups")
        .order_by("-cooked_at", "-created_at")
    )


def get_journal(user, journal_id: int):
    """내 요리 일지 단건 조회. 없으면 None."""
    return (
        CookingJournal.objects.filter(user=user, pk=journal_id)
        .select_related("user", "recipe")
        .prefetch_related("target_groups")
        .first()
    )


def _user_can_view_journal(user, journal) -> bool:
    """요리 일지 조회 권한: 작성자, PUBLIC, ALL_GROUPS(멤버), SPECIFIC_GROUPS(대상 그룹 멤버)."""
    if journal.user_id == user.id:
        return True
    if journal.visibility == CookingJournal.Visibility.PUBLIC:
        return True
    if journal.visibility == CookingJournal.Visibility.PRIVATE:
        return False
    if journal.visibility == CookingJournal.Visibility.ALL_GROUPS:
        return ConnectGroupMember.objects.filter(
            user=user,
            status=ConnectGroupMember.Status.ACCEPTED,
        ).exists()
    # SPECIFIC_GROUPS
    group_ids = list(journal.target_groups.values_list("id", flat=True))
    return ConnectGroupMember.objects.filter(
        group_id__in=group_ids,
        user=user,
        status=ConnectGroupMember.Status.ACCEPTED,
    ).exists()


def get_journal_comments(user, journal_id: int) -> QuerySet:
    """해당 요리 일지의 댓글 목록. 일지 조회 권한이 있는 경우만."""
    journal = CookingJournal.objects.filter(pk=journal_id).select_related("user").prefetch_related("target_groups").first()
    if not journal:
        return CookingJournalComment.objects.none()
    if not _user_can_view_journal(user, journal):
        return CookingJournalComment.objects.none()
    return (
        CookingJournalComment.objects.filter(journal_id=journal_id)
        .select_related("user")
        .order_by("created_at")
    )


def get_group_cooking_journals(user, group_id: int) -> QuerySet:
    """
    user가 해당 group의 ACCEPTED 멤버인지 검증 후,
    해당 그룹에 공개된 CookingJournal 목록을 최신순으로 반환.
    - visibility=ALL_GROUPS 이고 작성자가 해당 그룹 멤버인 일지
    - visibility=SPECIFIC_GROUPS 이고 target_groups에 해당 그룹이 포함된 일지
    """
    is_accepted = ConnectGroupMember.objects.filter(
        group_id=group_id,
        user=user,
        status=ConnectGroupMember.Status.ACCEPTED,
    ).exists()
    if not is_accepted:
        raise BusinessLogicException(
            message="해당 그룹의 멤버가 아니거나 초대를 수락하지 않았습니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied,
        )

    return (
        CookingJournal.objects.filter(
            Q(
                visibility=CookingJournal.Visibility.ALL_GROUPS,
                user__connect_group_members__group_id=group_id,
                user__connect_group_members__status=ConnectGroupMember.Status.ACCEPTED,
            )
            | Q(
                visibility=CookingJournal.Visibility.SPECIFIC_GROUPS,
                target_groups__id=group_id,
            )
        )
        .distinct()
        .select_related("user", "recipe")
        .prefetch_related("target_groups")
        .order_by("-cooked_at", "-created_at")
    )
