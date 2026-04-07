"""
커뮤니티 API. View는 요청 파싱·Service/Selector 호출·ResponseMaker 반환만 수행.
DB/비즈니스 로직은 services.py, selectors.py에 위임.
"""
import logging
from django.db.models import Prefetch
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser

from drf_spectacular.utils import extend_schema
from common.exceptions import BusinessLogicException
from common.pagination import (
    DEFAULT_PAGE_SIZE,
    build_paginated_response,
    get_page_params,
    paginate_queryset,
)
from common.utils import ResponseMaker
from common.response_code import ResponseCode
from recipes.serializers import RecipeListSerializer

from .selectors import (
    get_group_cooking_journals,
    get_group_for_user,
    get_group_for_user_with_members,
    get_journal,
    get_journal_comments,
    get_my_accepted_groups,
    get_my_cooking_journals,
    get_my_pending_invitations,
    get_my_recipe_scraps,
    get_my_scrap_folders,
)
from .serializers import (
    ConnectGroupCreateSerializer,
    ConnectGroupInviteSerializer,
    ConnectGroupKickSerializer,
    ConnectGroupSerializer,
    ConnectGroupUpdateSerializer,
    CookingJournalCommentCreateSerializer,
    CookingJournalCommentSerializer,
    CookingJournalCreateSerializer,
    CookingJournalDetailSerializer,
    CookingJournalListSerializer,
    CookingJournalUpdateSerializer,
    RecipeScrapListSerializer,
    RecipeScrapToggleSerializer,
    ScrapFolderAddRecipeSerializer,
    ScrapFolderCreateSerializer,
    ScrapFolderSerializer,
    ScrapFolderUpdateSerializer,
)
from .models import ConnectGroupMember
from .services import CommentService, GroupService, JournalService, ScrapService
from .form_data_parser import normalize_cooking_journal_request_data

logger = logging.getLogger("backend")


@extend_schema(tags=["Community"])
class ConnectGroupViewSet(viewsets.ModelViewSet):
    """그룹 목록/상세/생성, 초대 목록, 수락/거절, 그룹 요리 일지."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConnectGroupSerializer

    def get_queryset(self):
        return get_my_accepted_groups(self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().prefetch_related(
            Prefetch(
                "connect_group_members",
                queryset=ConnectGroupMember.objects.select_related("user").order_by("joined_at"),
            )
        )
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = ConnectGroupSerializer(
            page_queryset, many=True, context={"request": request}
        )
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="내 그룹 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, *args, **kwargs):
        group = get_group_for_user_with_members(request.user, int(kwargs["pk"]))
        if not group:
            raise BusinessLogicException(
                message="해당 그룹을 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        serializer = ConnectGroupSerializer(group, context={"request": request})
        return ResponseMaker.success_response(
            message="그룹 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def create(self, request, *args, **kwargs):
        ser = ConnectGroupCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        group = GroupService.create_group_and_invite(
            request.user,
            group_name=ser.validated_data["name"],
            invite_user_identifiers=ser.validated_data.get("invite_user_identifiers") or [],
        )
        out = ConnectGroupSerializer(group, context={"request": request})
        return ResponseMaker.success_response(
            message="그룹을 생성하고 초대를 보냈습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    @action(detail=False, url_path="invitations", methods=["get"])
    def invitations(self, request):
        """내가 초대받았으나 아직 수락하지 않은(PENDING) 그룹 목록."""
        queryset = get_my_pending_invitations(request.user)
        serializer = ConnectGroupSerializer(
            queryset, many=True, context={"request": request}
        )
        return ResponseMaker.success_response(
            message="초대 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="accept", methods=["post"])
    def accept(self, request, pk=None):
        """초대 수락."""
        GroupService.accept_group_invite(request.user, int(pk))
        group = get_group_for_user(request.user, int(pk))
        serializer = ConnectGroupSerializer(group, context={"request": request})
        return ResponseMaker.success_response(
            message="그룹 초대를 수락했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="reject", methods=["post"])
    def reject(self, request, pk=None):
        """초대 거절. PENDING 멤버십을 삭제하여 초대를 거절한다."""
        GroupService.reject_group_invite(request.user, int(pk))
        return ResponseMaker.success_response(
            message="그룹 초대를 거절했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def partial_update(self, request, *args, **kwargs):
        """PATCH 그룹 설정 변경 (이름 등). 관리자만."""
        pk = int(kwargs["pk"])
        ser = ConnectGroupUpdateSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        group = GroupService.update_group(request.user, pk, name=ser.validated_data.get("name"))
        out = ConnectGroupSerializer(group, context={"request": request})
        return ResponseMaker.success_response(
            message="그룹 설정을 변경했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def destroy(self, request, *args, **kwargs):
        """DELETE 그룹 해체. 관리자만. 그룹·공유 폴더·공유 냉장고 비활성화."""
        GroupService.disband_group(request.user, int(kwargs["pk"]))
        return ResponseMaker.success_response(
            message="그룹을 해체했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="invite", methods=["post"])
    def invite(self, request, pk=None):
        """기존 그룹에 멤버 초대. 관리자만."""
        ser = ConnectGroupInviteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        group = GroupService.invite_to_group(
            request.user, int(pk), ser.validated_data["invite_user_identifiers"]
        )
        out = ConnectGroupSerializer(group, context={"request": request})
        return ResponseMaker.success_response(
            message="초대를 보냈습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    @action(detail=True, url_path="leave", methods=["post"])
    def leave(self, request, pk=None):
        """그룹 탈퇴."""
        GroupService.leave_group(request.user, int(pk))
        return ResponseMaker.success_response(
            message="그룹에서 탈퇴했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="kick", methods=["post", "delete"])
    def kick(self, request, pk=None):
        """멤버 강퇴. 관리자만 가능. 본인 강퇴 불가."""
        ser = ConnectGroupKickSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        GroupService.kick_member(
            request.user,
            group_id=int(pk),
            user_identifier=ser.validated_data["user_identifier"],
        )
        return ResponseMaker.success_response(
            message="해당 멤버를 그룹에서 내보냈습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, url_path="journals", methods=["get"])
    def journals(self, request, pk=None):
        """해당 그룹의 요리 일지 조회. page, page_size, ordering 지원."""
        queryset = get_group_cooking_journals(request.user, int(pk))
        ordering = (request.query_params.get("ordering") or "-created_at").strip()
        if ordering.lstrip("-") in ("created_at", "updated_at", "cooked_at"):
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by("-created_at")
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = CookingJournalListSerializer(
            page_queryset, many=True, context={"request": request}
        )
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="그룹 요리 일지 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Community"])
class ScrapFolderViewSet(viewsets.ModelViewSet):
    """스크랩 폴더 CRUD, 폴더별 레시피 추가/제거."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ScrapFolderSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options", "delete"]

    def get_queryset(self):
        return get_my_scrap_folders(self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return ScrapFolderCreateSerializer
        if self.action in ("update", "partial_update"):
            return ScrapFolderUpdateSerializer
        return ScrapFolderSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = ScrapFolderSerializer(queryset, many=True)
        return ResponseMaker.success_response(
            message="스크랩 폴더 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        folder = queryset.filter(pk=kwargs["pk"]).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        serializer = ScrapFolderSerializer(folder)
        return ResponseMaker.success_response(
            message="스크랩 폴더 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def create(self, request, *args, **kwargs):
        ser = ScrapFolderCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        folder = ScrapService.create_scrap_folder(
            request.user,
            name=ser.validated_data["name"],
            description=ser.validated_data.get("description") or "",
            order=ser.validated_data.get("order", 0),
        )
        out = ScrapFolderSerializer(get_my_scrap_folders(request.user).filter(pk=folder.pk).first())
        return ResponseMaker.success_response(
            message="스크랩 폴더를 생성했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        ser = ScrapFolderUpdateSerializer(data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        folder = ScrapService.update_scrap_folder(
            request.user,
            int(kwargs["pk"]),
            name=ser.validated_data.get("name"),
            description=ser.validated_data.get("description"),
            order=ser.validated_data.get("order"),
        )
        out = ScrapFolderSerializer(get_my_scrap_folders(request.user).filter(pk=folder.pk).first())
        return ResponseMaker.success_response(
            message="스크랩 폴더를 수정했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        ScrapService.delete_scrap_folder(request.user, int(kwargs["pk"]))
        return ResponseMaker.success_response(
            message="스크랩 폴더를 삭제했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, methods=["get"], url_path="recipes")
    def recipes(self, request, pk=None):
        """해당 스크랩 폴더에 담긴 레시피 목록 조회."""
        queryset = self.get_queryset()
        folder = queryset.filter(pk=pk).first()
        if not folder:
            raise BusinessLogicException(
                message="해당 폴더를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        scraps = folder.recipe_scraps.select_related("recipe").all()
        recipes = [s.recipe for s in scraps]
        serializer = RecipeListSerializer(recipes, many=True, context={"request": request})
        return ResponseMaker.success_response(
            message="폴더 내 스크랩 레시피 목록 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, methods=["post"], url_path="add-recipe")
    def add_recipe(self, request, pk=None):
        """해당 폴더에 레시피 추가. Body: {"recipe_id": 123}. 이미 있으면 400."""
        ser = ScrapFolderAddRecipeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ScrapService.add_recipe_to_folder(
            request.user,
            folder_id=int(pk),
            recipe_id=ser.validated_data["recipe_id"],
        )
        folder = self.get_queryset().filter(pk=pk).first()
        out = ScrapFolderSerializer(folder)
        return ResponseMaker.success_response(
            message="폴더에 레시피를 추가했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    @action(detail=True, methods=["delete"], url_path="remove-recipe")
    def remove_recipe(self, request, pk=None):
        """해당 폴더에서 레시피 연결 해제. recipe_id: Body 또는 Query."""
        recipe_id = request.data.get("recipe_id") if request.data else None
        if recipe_id is None:
            q = request.query_params.get("recipe_id")
            try:
                recipe_id = int(q) if q is not None else None
            except (ValueError, TypeError):
                recipe_id = None
        if recipe_id is None:
            raise BusinessLogicException(
                message="recipe_id가 필요합니다. (Body 또는 Query Parameter)",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        ScrapService.remove_recipe_from_folder(
            request.user,
            folder_id=int(pk),
            recipe_id=int(recipe_id),
        )
        return ResponseMaker.success_response(
            message="폴더에서 레시피를 제거했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Community"])
class RecipeScrapViewSet(viewsets.GenericViewSet):
    """스크랩 토글 + 내 스크랩 일괄 조회 + 특정 레시피 스크랩 여부 조회."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """
        GET /api/v1/community/recipe-scraps/
        폴더 무관, 내가 스크랩한 레시피 목록. page, page_size, recipe_id 필터.
        """
        recipe_id = request.query_params.get("recipe_id")
        try:
            recipe_id = int(recipe_id) if recipe_id is not None else None
        except (TypeError, ValueError):
            recipe_id = None
        queryset = get_my_recipe_scraps(request.user, recipe_id=recipe_id)
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = RecipeScrapListSerializer(
            page_queryset, many=True, context={"request": request}
        )
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="내 스크랩 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="check", methods=["get"])
    def check(self, request):
        """
        GET /api/v1/community/recipe-scraps/check/?recipe_id=123
        해당 레시피 스크랩 여부·폴더 id 목록 반환.
        """
        recipe_id = request.query_params.get("recipe_id")
        try:
            recipe_id = int(recipe_id) if recipe_id else None
        except (TypeError, ValueError):
            recipe_id = None
        if recipe_id is None:
            raise BusinessLogicException(
                message="recipe_id 쿼리 파라미터가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        scraps = list(get_my_recipe_scraps(request.user, recipe_id=recipe_id))
        folder_ids = [s.folder_id for s in scraps if s.folder_id is not None]
        return ResponseMaker.success_response(
            message="스크랩 여부 조회에 성공했습니다.",
            result={
                "scraped": len(scraps) > 0,
                "folder_ids": folder_ids,
            },
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, url_path="toggle", methods=["post"])
    def toggle(self, request):
        """recipe_id 필수, folder_id 선택. 스크랩 있으면 삭제, 없으면 생성."""
        ser = RecipeScrapToggleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        recipe_id = ser.validated_data["recipe_id"]
        folder_id = ser.validated_data.get("folder_id")
        scrap = ScrapService.toggle_recipe_scrap(
            request.user, recipe_id=recipe_id, folder_id=folder_id
        )
        if scrap is None:
            return ResponseMaker.success_response(
                message="스크랩을 해제했습니다.",
                result={"scraped": False},
                status_code=ResponseCode.HttpStatusCode.Success,
            )
        return ResponseMaker.success_response(
            message="스크랩을 추가했습니다.",
            result={"scraped": True, "scrap_id": scrap.id},
            status_code=ResponseCode.HttpStatusCode.Created,
        )


@extend_schema(tags=["Community"])
class NotificationsViewSet(viewsets.GenericViewSet):
    """알림·초대 요약 (헤더 배지 등)."""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, url_path="summary", methods=["get"])
    def summary(self, request):
        """
        GET /api/v1/community/notifications/summary/
        PENDING 초대 건수 등 요약.
        """
        pending_invitation_count = get_my_pending_invitations(request.user).count()
        return ResponseMaker.success_response(
            message="알림 요약 조회에 성공했습니다.",
            result={"pending_invitation_count": pending_invitation_count},
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Community"])
class CookingJournalViewSet(viewsets.ModelViewSet):
    """요리 일지 CRUD. 개인/공유 일지 지원."""
    permission_classes = [permissions.IsAuthenticated]

    def get_parser_classes(self):
        # 이미지 업로드 필수: 생성/수정은 form-data 전용 (JSON 미지원)
        if self.action in ("create", "update", "partial_update"):
            return [MultiPartParser, FormParser]
        return super().get_parser_classes()

    def get_queryset(self):
        return get_my_cooking_journals(self.request.user)

    def get_serializer_class(self):
        if self.action == "list":
            return CookingJournalListSerializer
        if self.action == "retrieve":
            return CookingJournalDetailSerializer
        if self.action == "create":
            return CookingJournalCreateSerializer
        if self.action in ("update", "partial_update"):
            return CookingJournalUpdateSerializer
        return CookingJournalDetailSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().order_by("-created_at")
        visibility = (request.query_params.get("visibility") or "").strip()
        if visibility:
            queryset = queryset.filter(visibility=visibility)
        recipe_id = request.query_params.get("recipe_id")
        if recipe_id:
            try:
                queryset = queryset.filter(recipe_id=int(recipe_id))
            except (TypeError, ValueError):
                pass
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = CookingJournalListSerializer(
            page_queryset, many=True, context={"request": request}
        )
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="요리 일지 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, *args, **kwargs):
        journal = get_journal(request.user, int(kwargs["pk"]))
        if not journal:
            from common.exceptions import BusinessLogicException
            raise BusinessLogicException(
                message="해당 요리 일지를 찾을 수 없습니다.",
                error_code=ResponseCode.ErrorCode.ApiNotFound,
            )
        serializer = CookingJournalDetailSerializer(journal, context={"request": request})
        return ResponseMaker.success_response(
            message="요리 일지 조회에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def create(self, request, *args, **kwargs):
        try:
            data = normalize_cooking_journal_request_data(request)
            ser = CookingJournalCreateSerializer(data=data)
            ser.is_valid(raise_exception=True)
            journal = JournalService.create_journal(request.user, ser.validated_data)
            out = CookingJournalDetailSerializer(journal, context={"request": request})
        except Exception as e:
            logger.exception("[journal create] failed: %s", e)
            raise
        return ResponseMaker.success_response(
            message="요리 일지를 등록했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    def update(self, request, *args, **kwargs):
        try:
            data = normalize_cooking_journal_request_data(request)
            ser = CookingJournalUpdateSerializer(data=data, partial=True)
            ser.is_valid(raise_exception=True)
            journal = JournalService.update_journal(
                request.user, int(kwargs["pk"]), ser.validated_data
            )
            out = CookingJournalDetailSerializer(journal, context={"request": request})
        except Exception as e:
            logger.exception("[journal update] failed: %s", e)
            raise
        return ResponseMaker.success_response(
            message="요리 일지를 수정했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        JournalService.delete_journal(request.user, int(kwargs["pk"]))
        return ResponseMaker.success_response(
            message="요리 일지를 삭제했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )


@extend_schema(tags=["Community"])
class CookingJournalCommentViewSet(viewsets.GenericViewSet):
    """요리 일지 댓글 조회/작성/삭제."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """GET /api/v1/community/comments/?journal_id= — 해당 일지 댓글 목록. page, page_size 지원."""
        journal_id = request.query_params.get("journal_id")
        if not journal_id:
            raise BusinessLogicException(
                message="journal_id 쿼리 파라미터가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        try:
            journal_id = int(journal_id)
        except (ValueError, TypeError):
            raise BusinessLogicException(
                message="유효한 journal_id가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        queryset = get_journal_comments(request.user, journal_id).order_by("created_at")
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = CookingJournalCommentSerializer(page_queryset, many=True)
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="댓글 목록 조회에 성공했습니다.",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def create(self, request):
        """POST /api/v1/community/comments/ — 댓글 작성. Body: journal_id, content."""
        ser = CookingJournalCommentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        journal_id = ser.validated_data["journal_id"]
        content = ser.validated_data["content"]
        comment = CommentService.create_comment(request.user, journal_id, content)
        out = CookingJournalCommentSerializer(comment)
        return ResponseMaker.success_response(
            message="댓글을 등록했습니다.",
            result=out.data,
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    def destroy(self, request, pk=None):
        """DELETE /api/v1/community/comments/{id}/ — 본인 댓글 삭제."""
        CommentService.delete_comment(request.user, int(pk))
        return ResponseMaker.success_response(
            message="댓글을 삭제했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )
