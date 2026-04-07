"""
커뮤니티(그룹·스크랩·폴더) 비즈니스 로직.
Service Layer Pattern: 트랜잭션·권한 검증·예외는 여기서만 처리.
"""
import logging
from django.db import transaction

from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode

from fridges.models import Fridge
from .models import ConnectGroup, ConnectGroupMember, CookingJournal, CookingJournalComment, RecipeScrap, ScrapFolder


def _get_user_model():
    from django.contrib.auth import get_user_model
    return get_user_model()

logger = logging.getLogger("backend")

class GroupService:
    @staticmethod
    @transaction.atomic
    def create_group_and_invite(user, group_name: str, invite_user_identifiers: list):
        """
        그룹 생성 후 생성자를 ADMIN·ACCEPTED로 추가하고,
        invite_user_identifiers(식별용 12자리) 대상은 MEMBER·PENDING으로 bulk_create.
        """
        if not (group_name and str(group_name).strip()):
            raise BusinessLogicException(
                message="그룹명은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        User = _get_user_model()
        identifiers = [str(x).strip() for x in (invite_user_identifiers or []) if str(x).strip()]
        identifiers = [i for i in identifiers if len(i) == 12]
        invite_user_ids = list(
            User.objects.filter(identifier__in=identifiers).exclude(pk=user.id).values_list("pk", flat=True)
        )

        group = ConnectGroup.objects.create(name=group_name.strip())

        ScrapFolder.objects.create(
            group=group,
            user=None,
            is_group_default=True,
            name=f"{group_name.strip()} 공유 스크랩",
            order=0,
        )
        Fridge.objects.create(
            group=group,
            owner=None,
            name=f"{group_name.strip()} 공유 냉장고",
            fridge_type=Fridge.FridgeType.SHARED,
        )

        ConnectGroupMember.objects.create(
            group=group,
            user=user,
            role=ConnectGroupMember.Role.ADMIN,
            status=ConnectGroupMember.Status.ACCEPTED,
        )

        if invite_user_ids:
            User = _get_user_model()
            existing = set(
                ConnectGroupMember.objects.filter(
                    group=group,
                    user_id__in=invite_user_ids,
                ).values_list("user_id", flat=True)
            )
            to_create = [
                ConnectGroupMember(
                    group=group,
                    user_id=uid,
                    role=ConnectGroupMember.Role.MEMBER,
                    status=ConnectGroupMember.Status.PENDING,
                )
                for uid in invite_user_ids
                if uid not in existing
            ]
            if to_create:
                ConnectGroupMember.objects.bulk_create(to_create)

        return group

    @staticmethod
    @transaction.atomic
    def accept_group_invite(user, group_id: int):
        """해당 유저의 PENDING 초대를 ACCEPTED로 변경. 없으면 BusinessLogicException."""
        membership = ConnectGroupMember.objects.filter(
            group_id=group_id,
            user=user,
            status=ConnectGroupMember.Status.PENDING,
        ).first()
        if not membership:
            raise BusinessLogicException(
                message="수락할 그룹 초대가 없거나 이미 처리되었습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        membership.status = ConnectGroupMember.Status.ACCEPTED
        membership.save(update_fields=["status"])
        return membership

    @staticmethod
    @transaction.atomic
    def reject_group_invite(user, group_id: int):
        """해당 유저의 PENDING 초대를 거절(멤버십 삭제). 없으면 BusinessLogicException."""
        membership = ConnectGroupMember.objects.filter(
            group_id=group_id,
            user=user,
            status=ConnectGroupMember.Status.PENDING,
        ).first()
        if not membership:
            raise BusinessLogicException(
                message="거절할 그룹 초대가 없거나 이미 처리되었습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        membership.delete()

    @staticmethod
    def require_group_admin(user, group_id: int) -> "ConnectGroup":
        """그룹이 존재하고 user가 해당 그룹의 ADMIN(ACCEPTED)인지 검증. 아니면 예외."""
        membership = ConnectGroupMember.objects.filter(
            group_id=group_id,
            user=user,
            role=ConnectGroupMember.Role.ADMIN,
            status=ConnectGroupMember.Status.ACCEPTED,
        ).select_related("group").first()
        if not membership or not membership.group.is_active:
            raise BusinessLogicException(
                message="그룹 관리자만 수행할 수 있습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )
        return membership.group

    @staticmethod
    @transaction.atomic
    def invite_to_group(user, group_id: int, invite_user_identifiers: list) -> "ConnectGroup":
        """기존 그룹에 멤버 초대(식별용 identifier 목록). ADMIN만 가능."""
        group = GroupService.require_group_admin(user, group_id)
        User = _get_user_model()
        identifiers = [str(x).strip() for x in (invite_user_identifiers or []) if str(x).strip() and len(str(x).strip()) == 12]
        invite_user_ids = list(User.objects.filter(identifier__in=identifiers).exclude(pk=user.id).values_list("pk", flat=True))
        existing = set(
            ConnectGroupMember.objects.filter(group=group).values_list("user_id", flat=True)
        )
        to_create = [
            ConnectGroupMember(
                group=group,
                user_id=uid,
                role=ConnectGroupMember.Role.MEMBER,
                status=ConnectGroupMember.Status.PENDING,
            )
            for uid in invite_user_ids
            if uid not in existing
        ]
        if to_create:
            ConnectGroupMember.objects.bulk_create(to_create)
        return group

    @staticmethod
    @transaction.atomic
    def update_group(user, group_id: int, name: str = None) -> "ConnectGroup":
        """그룹 이름 등 설정 변경. ADMIN만 가능."""
        group = GroupService.require_group_admin(user, group_id)
        if name is not None and str(name).strip():
            group.name = str(name).strip()
            group.save(update_fields=["name", "updated_at"])
        return group

    @staticmethod
    @transaction.atomic
    def kick_member(requester, group_id: int, user_identifier: str):
        """
        관리자가 특정 멤버를 그룹에서 강퇴. requester가 해당 그룹 ADMIN일 때만 가능.
        본인 강퇴 시도 시 403.

        user_identifier(문자열)로 대상 유저를 특정한다.
        - 우선순위: identifier 정확 일치 -> email 정확 일치 -> nickname 정확 일치
        - nickname 중복 등으로 다중 매칭되는 경우는 예외 처리
        """
        group = GroupService.require_group_admin(requester, group_id)
        raw = (user_identifier or "").strip()
        if not raw:
            raise BusinessLogicException(
                message="user_identifier가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

        User = _get_user_model()
        target = User.objects.filter(identifier=raw).first()
        if not target:
            target = User.objects.filter(email__iexact=raw).first()
        if not target:
            qs = User.objects.filter(nickname__iexact=raw)
            cnt = qs.count()
            if cnt == 1:
                target = qs.first()
            elif cnt > 1:
                raise BusinessLogicException(
                    message="검색어로 유저를 특정할 수 없습니다. identifier 또는 email을 사용해주세요.",
                    error_code=ResponseCode.ErrorCode.InputAreaInvalid,
                )

        if not target:
            raise BusinessLogicException(
                message="대상 유저를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )

        if target.id == requester.id:
            raise BusinessLogicException(
                message="본인을 강퇴할 수 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )
        membership = ConnectGroupMember.objects.filter(
            group=group,
            user=target,
        ).first()
        if not membership:
            raise BusinessLogicException(
                message="해당 그룹의 멤버가 아닙니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        membership.delete()

    @staticmethod
    @transaction.atomic
    def leave_group(user, group_id: int):
        """그룹 탈퇴. 멤버만 가능. 탈퇴 후 그룹에 멤버가 없으면 비활성화."""
        membership = ConnectGroupMember.objects.filter(
            group_id=group_id, user=user
        ).select_related("group").first()
        if not membership:
            raise BusinessLogicException(
                message="해당 그룹의 멤버가 아닙니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        group = membership.group
        membership.delete()
        remaining = ConnectGroupMember.objects.filter(group=group).count()
        if remaining == 0:
            group.is_active = False
            group.save(update_fields=["is_active", "updated_at"])
            ScrapFolder.objects.filter(group=group).update(is_active=False)
            Fridge.objects.filter(group=group).update(is_active=False)

    @staticmethod
    @transaction.atomic
    def disband_group(user, group_id: int):
        """그룹 해체. ADMIN만 가능. 그룹·공유 폴더·공유 냉장고 is_active=False."""
        group = GroupService.require_group_admin(user, group_id)
        group.is_active = False
        group.save(update_fields=["is_active", "updated_at"])
        ScrapFolder.objects.filter(group=group).update(is_active=False)
        Fridge.objects.filter(group=group).update(is_active=False)


class ScrapService:
    @staticmethod
    @transaction.atomic
    def create_scrap_folder(user, name: str, description: str = "", order: int = 0) -> ScrapFolder:
        """개인 스크랩 폴더 생성 (user 소유, group=None)."""
        if not (name and str(name).strip()):
            raise BusinessLogicException(
                message="폴더 이름은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        return ScrapFolder.objects.create(
            user=user,
            group=None,
            name=str(name).strip(),
            description=str(description).strip() if description else "",
            order=order,
        )

    @staticmethod
    @transaction.atomic
    def update_scrap_folder(user, folder_id: int, name: str = None, description: str = None, order: int = None) -> ScrapFolder:
        """
        폴더 수정 규칙
        - 개인 폴더(group=None): 소유자만 name/description/order 수정 가능
        - 그룹 폴더(group!=None):
          - 그룹 전용 기본 폴더(is_group_default=True): 그룹 ADMIN만 **name만** 수정 가능 (삭제는 별도 로직에서 금지)
          - 그 외 공유 폴더: 수정 불가
        """
        folder = ScrapFolder.objects.filter(pk=folder_id).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )

        # 그룹 폴더 처리
        if folder.group_id is not None:
            # 그룹 전용 기본 폴더만 "이름 변경" 허용 (ADMIN만)
            if not getattr(folder, "is_group_default", False):
                raise BusinessLogicException(
                    message="공유 스크랩 폴더는 수정할 수 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
            is_admin = ConnectGroupMember.objects.filter(
                group_id=folder.group_id,
                user=user,
                role=ConnectGroupMember.Role.ADMIN,
                status=ConnectGroupMember.Status.ACCEPTED,
            ).exists()
            if not is_admin:
                raise BusinessLogicException(
                    message="그룹 관리자만 폴더 이름을 변경할 수 있습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
            # 이름만 허용
            if description is not None or order is not None:
                raise BusinessLogicException(
                    message="그룹 전용 폴더는 이름(name)만 변경할 수 있습니다.",
                    error_code=ResponseCode.ErrorCode.InputAreaInvalid,
                )
            if name is not None and str(name).strip():
                folder.name = str(name).strip()
                folder.save(update_fields=["name", "updated_at"])
            return folder

        # 개인 폴더 처리
        if folder.user_id != user.id:
            raise BusinessLogicException(
                message="해당 폴더를 수정할 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )
        if name is not None and str(name).strip():
            folder.name = str(name).strip()
        if description is not None:
            folder.description = str(description).strip()
        if order is not None:
            folder.order = max(0, int(order))
        folder.save(update_fields=["name", "description", "order", "updated_at"])
        return folder

    @staticmethod
    @transaction.atomic
    def add_recipe_to_folder(user, folder_id: int, recipe_id: int) -> RecipeScrap:
        """해당 폴더에 레시피 추가. 이미 같은 폴더에 있으면 400 '이미 스크랩된 레시피입니다'."""
        folder = ScrapFolder.objects.filter(pk=folder_id).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        # 접근 권한: 개인 폴더는 소유자만, 공유 폴더는 그룹 ACCEPTED 멤버
        if folder.user_id is not None:
            if folder.user_id != user.id:
                raise BusinessLogicException(
                    message="해당 폴더에 스크랩을 추가할 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        else:
            if not ConnectGroupMember.objects.filter(
                group=folder.group,
                user=user,
                status=ConnectGroupMember.Status.ACCEPTED,
            ).exists():
                raise BusinessLogicException(
                    message="해당 폴더에 스크랩을 추가할 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        from recipes.models import Recipe
        if not Recipe.objects.filter(pk=recipe_id).exists():
            raise BusinessLogicException(
                message="해당 레시피를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if RecipeScrap.objects.filter(
            user=user,
            recipe_id=recipe_id,
            folder_id=folder_id,
        ).exists():
            raise BusinessLogicException(
                message="이미 스크랩된 레시피입니다.",
                error_code=ResponseCode.ErrorCode.Duplicate,
            )
        return RecipeScrap.objects.create(user=user, recipe_id=recipe_id, folder=folder)

    @staticmethod
    @transaction.atomic
    def remove_recipe_from_folder(user, folder_id: int, recipe_id: int) -> None:
        """해당 폴더에서 레시피 연결 해제(미분류로 이동)."""
        folder = ScrapFolder.objects.filter(pk=folder_id).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if folder.user_id is not None:
            if folder.user_id != user.id:
                raise BusinessLogicException(
                    message="해당 폴더에서 스크랩을 제거할 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        else:
            if not ConnectGroupMember.objects.filter(
                group=folder.group,
                user=user,
                status=ConnectGroupMember.Status.ACCEPTED,
            ).exists():
                raise BusinessLogicException(
                    message="해당 폴더에서 스크랩을 제거할 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        scrap = RecipeScrap.objects.filter(user=user, recipe_id=recipe_id, folder_id=folder_id).first()
        if not scrap:
            raise BusinessLogicException(
                message="해당 폴더에 해당 레시피 스크랩이 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        scrap.folder = None
        scrap.save(update_fields=["folder", "folder_id"])

    @staticmethod
    @transaction.atomic
    def toggle_recipe_scrap(user, recipe_id: int, folder_id: int = None):
        """
        folder_id 범위에서만 토글.
        - folder_id가 있으면 (user, recipe, folder_id)만 토글
        - folder_id가 없으면 미분류 (folder=None)만 토글
        """
        if folder_id is not None:
            folder = ScrapFolder.objects.filter(pk=folder_id).first()
            if not folder:
                raise BusinessLogicException(
                    message="해당 폴더를 찾을 수 없습니다.",
                    error_code=ResponseCode.ErrorCode.ApiNotFound,
                )
            if folder.user_id != user.id and not (
                folder.group_id
                and ConnectGroupMember.objects.filter(
                    group=folder.group,
                    user=user,
                    role=ConnectGroupMember.Role.ADMIN,
                    status=ConnectGroupMember.Status.ACCEPTED,
                ).exists()
            ):
                raise BusinessLogicException(
                    message="해당 폴더에 스크랩을 추가할 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        else:
            folder = None

        scrap = RecipeScrap.objects.filter(
            user=user,
            recipe_id=recipe_id,
            folder=folder,
        ).first()
        if scrap:
            scrap.delete()
            return None

        return RecipeScrap.objects.create(
            user=user,
            recipe_id=recipe_id,
            folder=folder,
        )

    @staticmethod
    @transaction.atomic
    def delete_scrap_folder(user, folder_id: int):
        """
        폴더 소유자 또는 그룹 ADMIN인지 검증 후,
        해당 폴더의 RecipeScrap들을 미분류(folder=null)로 일괄 업데이트한 뒤 폴더 삭제.
        """
        folder = ScrapFolder.objects.filter(pk=folder_id).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if folder.group_id is not None:
            raise BusinessLogicException(
                message="공유 스크랩 폴더는 삭제할 수 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )

        is_owner = folder.user_id == user.id
        is_group_admin = (
            folder.group_id is not None
            and ConnectGroupMember.objects.filter(
                group=folder.group,
                user=user,
                role=ConnectGroupMember.Role.ADMIN,
                status=ConnectGroupMember.Status.ACCEPTED,
            ).exists()
        )
        if not is_owner and not is_group_admin:
            raise BusinessLogicException(
                message="해당 폴더를 삭제할 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )

        RecipeScrap.objects.filter(folder=folder).update(folder=None)
        folder.delete()


class JournalService:
    """요리 일지 생성/수정/삭제. visibility, target_groups 지원."""

    @staticmethod
    @transaction.atomic
    def create_journal(user, validated_data: dict):
        visibility = validated_data.get("visibility") or CookingJournal.Visibility.PRIVATE
        target_group_ids = validated_data.get("target_group_ids") or []
        if visibility == CookingJournal.Visibility.SPECIFIC_GROUPS and target_group_ids:
            for gid in target_group_ids:
                is_accepted = ConnectGroupMember.objects.filter(
                    group_id=gid,
                    user=user,
                    status=ConnectGroupMember.Status.ACCEPTED,
                ).exists()
                if not is_accepted:
                    raise BusinessLogicException(
                        message="선택한 그룹 중 멤버가 아닌 그룹이 있습니다.",
                        error_code=ResponseCode.ErrorCode.PermissionDenied,
                    )
        journal = None
        try:
            journal = CookingJournal.objects.create(
                user=user,
                recipe_id=validated_data.get("recipe_id"),
                visibility=visibility,
                title=validated_data["title"],
                content=validated_data.get("content") or "",
                cooked_at=validated_data["cooked_at"],
                image=validated_data.get("image"),
                tags=validated_data.get("tags") or [],
            )
        except Exception as e:
            logger.exception(
                "[create_journal] CookingJournal.objects.create failed | user_id=%s visibility=%s target_group_ids=%s error=%s",
                getattr(user, "id", None),
                visibility,
                target_group_ids,
                e,
            )
            raise
        if visibility == CookingJournal.Visibility.SPECIFIC_GROUPS and target_group_ids:
            journal.target_groups.set(target_group_ids)
        return journal

    @staticmethod
    @transaction.atomic
    def update_journal(user, journal_id: int, validated_data: dict):
        journal = CookingJournal.objects.filter(pk=journal_id, user=user).prefetch_related("target_groups").first()
        if not journal:
            raise BusinessLogicException(
                message="해당 요리 일지를 찾을 수 없거나 수정 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        allowed = {"recipe_id", "visibility", "title", "content", "cooked_at", "image", "tags"}
        update_fields = [k for k in allowed if k in validated_data]
        for key in update_fields:
            setattr(journal, key, validated_data[key])
        if "visibility" in update_fields and journal.visibility != CookingJournal.Visibility.SPECIFIC_GROUPS:
            journal.target_groups.clear()
        if "target_group_ids" in validated_data:
            target_group_ids = validated_data["target_group_ids"]
            if journal.visibility == CookingJournal.Visibility.SPECIFIC_GROUPS:
                for gid in target_group_ids:
                    is_accepted = ConnectGroupMember.objects.filter(
                        group_id=gid,
                        user=user,
                        status=ConnectGroupMember.Status.ACCEPTED,
                    ).exists()
                    if not is_accepted:
                        raise BusinessLogicException(
                            message="선택한 그룹 중 멤버가 아닌 그룹이 있습니다.",
                            error_code=ResponseCode.ErrorCode.PermissionDenied,
                        )
            journal.target_groups.set(target_group_ids)
        if update_fields:
            journal.save(update_fields=update_fields)
        return journal

    @staticmethod
    @transaction.atomic
    def delete_journal(user, journal_id: int):
        journal = CookingJournal.objects.filter(pk=journal_id, user=user).first()
        if not journal:
            raise BusinessLogicException(
                message="해당 요리 일지를 찾을 수 없거나 삭제 권한이 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        journal.delete()


class CommentService:
    """요리 일지 댓글 작성/삭제."""

    @staticmethod
    @transaction.atomic
    def create_comment(user, journal_id: int, content: str) -> CookingJournalComment:
        """일지 조회 권한 확인 후 댓글 생성. (visibility에 따라 작성자/공개/그룹 멤버만 댓글 가능.)"""
        journal = CookingJournal.objects.filter(pk=journal_id).select_related("user").prefetch_related("target_groups").first()
        if not journal:
            raise BusinessLogicException(
                message="해당 요리 일지를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if journal.user_id != user.id:
            can_view = False
            if journal.visibility == CookingJournal.Visibility.PUBLIC:
                can_view = True
            elif journal.visibility == CookingJournal.Visibility.ALL_GROUPS:
                can_view = ConnectGroupMember.objects.filter(
                    user=user,
                    status=ConnectGroupMember.Status.ACCEPTED,
                ).exists()
            elif journal.visibility == CookingJournal.Visibility.SPECIFIC_GROUPS:
                group_ids = list(journal.target_groups.values_list("id", flat=True))
                can_view = ConnectGroupMember.objects.filter(
                    group_id__in=group_ids,
                    user=user,
                    status=ConnectGroupMember.Status.ACCEPTED,
                ).exists()
            if not can_view:
                raise BusinessLogicException(
                    message="해당 요리 일지에 댓글을 달 권한이 없습니다.",
                    error_code=ResponseCode.ErrorCode.PermissionDenied,
                )
        if not (content and str(content).strip()):
            raise BusinessLogicException(
                message="댓글 내용은 필수입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        return CookingJournalComment.objects.create(
            journal=journal,
            user=user,
            content=str(content).strip(),
        )

    @staticmethod
    @transaction.atomic
    def delete_comment(user, comment_id: int):
        """본인 댓글만 삭제 가능."""
        comment = CookingJournalComment.objects.filter(pk=comment_id).first()
        if not comment:
            raise BusinessLogicException(
                message="해당 댓글을 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        if comment.user_id != user.id:
            raise BusinessLogicException(
                message="본인의 댓글만 삭제할 수 있습니다.",
                error_code=ResponseCode.ErrorCode.PermissionDenied,
            )
        comment.delete()
