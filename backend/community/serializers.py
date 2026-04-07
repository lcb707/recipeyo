"""
커뮤니티 API Serializers.
조회용(List/Detail)과 쓰기용(Create/Update) 명확히 분리.
"""
from rest_framework import serializers

from common.image_url import AbsoluteImageField

from .models import ConnectGroup, ConnectGroupMember, CookingJournal, CookingJournalComment, RecipeScrap, ScrapFolder
from fridges.models import Fridge


# ----- ConnectGroup -----


class ConnectGroupMemberSerializer(serializers.Serializer):
    """그룹 멤버 한 명 (상세 조회 시 members 배열용)."""
    id = serializers.IntegerField(source="user.id")
    email = serializers.EmailField(source="user.email")
    nickname = serializers.CharField(source="user.nickname")
    role = serializers.CharField()
    status = serializers.CharField()


class ConnectGroupSerializer(serializers.ModelSerializer):
    """그룹 기본 정보 + 현재 요청 유저의 권한/상태(my_role, my_status) + 멤버 목록(members)."""
    my_role = serializers.SerializerMethodField()
    my_status = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    group_scrap_folder = serializers.SerializerMethodField()
    group_fridge = serializers.SerializerMethodField()

    class Meta:
        model = ConnectGroup
        fields = [
            "id",
            "name",
            "created_at",
            "updated_at",
            "my_role",
            "my_status",
            "members",
            "group_scrap_folder",
            "group_fridge",
        ]
        read_only_fields = fields

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return None
        m = ConnectGroupMember.objects.filter(group=obj, user=request.user).first()
        return m.role if m else None

    def get_my_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user:
            return None
        m = ConnectGroupMember.objects.filter(group=obj, user=request.user).first()
        return m.status if m else None

    def get_members(self, obj):
        """그룹에 속한 멤버 목록 (id, email, nickname, role, status). prefetch_related('connect_group_members__user') 권장."""
        if not hasattr(obj, "_prefetched_objects_cache") or "connect_group_members" not in obj._prefetched_objects_cache:
            members_qs = ConnectGroupMember.objects.filter(group=obj).select_related("user")
        else:
            members_qs = obj.connect_group_members.all()
        return ConnectGroupMemberSerializer(members_qs, many=True).data

    def get_group_scrap_folder(self, obj):
        folder = ScrapFolder.objects.filter(
            group=obj,
            is_group_default=True,
            is_active=True,
        ).first()
        if not folder:
            return None
        return {
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
            "order": folder.order,
            "is_active": folder.is_active,
        }

    def get_group_fridge(self, obj):
        fridge = Fridge.objects.filter(
            group=obj,
            fridge_type=Fridge.FridgeType.SHARED,
            is_active=True,
        ).first()
        if not fridge:
            return None
        return {
            "id": fridge.id,
            "name": fridge.name,
            "fridge_type": fridge.fridge_type,
            "is_active": fridge.is_active,
        }


class ConnectGroupCreateSerializer(serializers.Serializer):
    """POST /api/.../groups/ — 그룹 생성 및 초대. 초대 대상은 식별용 identifier 목록."""
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    invite_user_identifiers = serializers.ListField(
        child=serializers.CharField(max_length=12, min_length=12),
        required=False,
        default=list,
        allow_empty=True,
    )


class ConnectGroupUpdateSerializer(serializers.Serializer):
    """PATCH /api/.../groups/{id}/ — 그룹 이름 변경 (관리자만)."""
    name = serializers.CharField(max_length=100, trim_whitespace=True, required=False)


class ConnectGroupInviteSerializer(serializers.Serializer):
    """POST /api/.../groups/{id}/invite/ — 기존 그룹에 초대 (관리자만). 식별용 identifier 목록."""
    invite_user_identifiers = serializers.ListField(
        child=serializers.CharField(max_length=12, min_length=12),
        allow_empty=True,
    )


class ConnectGroupKickSerializer(serializers.Serializer):
    """POST/DELETE /api/.../groups/{id}/kick/ — 멤버 강퇴 (관리자만)."""
    user_identifier = serializers.CharField(max_length=255, trim_whitespace=True)


# ----- ScrapFolder -----


class ScrapFolderSerializer(serializers.ModelSerializer):
    """폴더 정보 + scrap_count. 소유자는 식별용 identifier만 노출."""
    scrap_count = serializers.IntegerField(read_only=True, default=0)
    user_identifier = serializers.CharField(source="user.identifier", read_only=True, allow_null=True)

    class Meta:
        model = ScrapFolder
        fields = [
            "id", "name", "description", "order",
            "user_identifier", "group", "created_at", "updated_at", "scrap_count",
        ]
        read_only_fields = ["id", "user_identifier", "group", "created_at", "updated_at", "scrap_count"]


class ScrapFolderCreateSerializer(serializers.Serializer):
    """POST /api/v1/community/scrap-folders/ — 개인 폴더 생성."""
    name = serializers.CharField(max_length=100, trim_whitespace=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    order = serializers.IntegerField(required=False, min_value=0, default=0)


class ScrapFolderUpdateSerializer(serializers.Serializer):
    """PATCH/PUT /api/v1/community/scrap-folders/{id}/ — 폴더 수정."""
    name = serializers.CharField(max_length=100, trim_whitespace=True, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    order = serializers.IntegerField(required=False, min_value=0)


# ----- CookingJournal: Read vs Write -----


class CookingJournalListSerializer(serializers.ModelSerializer):
    """요리 일지 목록 조회 — visibility, target_group_ids 포함."""
    user_identifier = serializers.CharField(source="user.identifier", read_only=True)
    recipe_id = serializers.IntegerField(source="recipe.id", read_only=True, allow_null=True)
    recipe_title = serializers.CharField(source="recipe.title", read_only=True, allow_null=True)
    image = AbsoluteImageField(required=False, allow_null=True)
    target_group_ids = serializers.SerializerMethodField()

    class Meta:
        model = CookingJournal
        fields = [
            "id", "user_identifier", "recipe_id", "recipe_title",
            "visibility", "target_group_ids",
            "title", "content", "cooked_at", "image", "tags", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_target_group_ids(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "target_groups" in obj._prefetched_objects_cache:
            return [g.id for g in obj.target_groups.all()]
        return list(obj.target_groups.values_list("id", flat=True))


class CookingJournalDetailSerializer(serializers.ModelSerializer):
    """요리 일지 상세 조회."""
    user_identifier = serializers.CharField(source="user.identifier", read_only=True)
    recipe_id = serializers.IntegerField(source="recipe.id", read_only=True, allow_null=True)
    recipe_title = serializers.CharField(source="recipe.title", read_only=True, allow_null=True)
    image = AbsoluteImageField(required=False, allow_null=True)
    target_group_ids = serializers.SerializerMethodField()

    class Meta:
        model = CookingJournal
        fields = [
            "id", "user_identifier", "recipe_id", "recipe_title",
            "visibility", "target_group_ids",
            "title", "content", "cooked_at", "image", "tags", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_target_group_ids(self, obj):
        if hasattr(obj, "_prefetched_objects_cache") and "target_groups" in obj._prefetched_objects_cache:
            return [g.id for g in obj.target_groups.all()]
        return list(obj.target_groups.values_list("id", flat=True))


class CookingJournalCreateSerializer(serializers.Serializer):
    """요리 일지 생성 — visibility, target_groups 지원."""
    recipe_id = serializers.IntegerField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(
        choices=CookingJournal.Visibility.choices,
        default=CookingJournal.Visibility.PRIVATE,
        required=False,
    )
    target_group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        allow_empty=True,
    )
    title = serializers.CharField(max_length=200, trim_whitespace=True)
    content = serializers.CharField(required=False, allow_blank=True, default="")
    cooked_at = serializers.DateField()
    image = serializers.ImageField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, default=list, allow_empty=True)


class CookingJournalUpdateSerializer(serializers.Serializer):
    """요리 일지 수정 — visibility, target_group_ids 포함."""
    recipe_id = serializers.IntegerField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(choices=CookingJournal.Visibility.choices, required=False)
    target_group_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
    title = serializers.CharField(max_length=200, trim_whitespace=True, required=False)
    content = serializers.CharField(required=False, allow_blank=True)
    cooked_at = serializers.DateField(required=False)
    image = serializers.ImageField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(max_length=50), required=False, allow_empty=True)


# ----- RecipeScrap: Read vs Write -----


class RecipeScrapListSerializer(serializers.ModelSerializer):
    """스크랩 목록 — 레시피/폴더 요약 포함. 유저는 식별용 identifier만 노출."""
    user_identifier = serializers.CharField(source="user.identifier", read_only=True)
    recipe_id = serializers.IntegerField(source="recipe.id", read_only=True)
    recipe_title = serializers.CharField(source="recipe.title", read_only=True)
    folder_id = serializers.IntegerField(source="folder.id", read_only=True, allow_null=True)
    folder_name = serializers.CharField(source="folder.name", read_only=True, allow_null=True)

    class Meta:
        model = RecipeScrap
        fields = ["id", "user_identifier", "recipe_id", "recipe_title", "folder_id", "folder_name", "created_at"]
        read_only_fields = fields


class RecipeScrapDetailSerializer(serializers.ModelSerializer):
    """스크랩 상세 — 동일."""
    user_identifier = serializers.CharField(source="user.identifier", read_only=True)
    recipe_id = serializers.IntegerField(source="recipe.id", read_only=True)
    recipe_title = serializers.CharField(source="recipe.title", read_only=True)
    folder_id = serializers.IntegerField(source="folder.id", read_only=True, allow_null=True)
    folder_name = serializers.CharField(source="folder.name", read_only=True, allow_null=True)

    class Meta:
        model = RecipeScrap
        fields = ["id", "user_identifier", "recipe_id", "recipe_title", "folder_id", "folder_name", "created_at"]
        read_only_fields = fields


class CookingJournalCommentSerializer(serializers.ModelSerializer):
    """요리 일지 댓글 조회/작성. 유저는 식별용 identifier만 노출."""
    user_identifier = serializers.CharField(source="user.identifier", read_only=True)
    user_nickname = serializers.CharField(source="user.nickname", read_only=True)

    class Meta:
        model = CookingJournalComment
        fields = ["id", "journal", "user_identifier", "user_nickname", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "user_identifier", "user_nickname", "created_at", "updated_at"]


class CookingJournalCommentCreateSerializer(serializers.Serializer):
    """요리 일지 댓글 작성."""
    journal_id = serializers.IntegerField()
    content = serializers.CharField(allow_blank=False)


class RecipeScrapToggleSerializer(serializers.Serializer):
    """POST .../recipe-scraps/toggle/ — recipe_id 필수, folder_id 선택."""
    recipe_id = serializers.IntegerField()
    folder_id = serializers.IntegerField(required=False, allow_null=True)


class ScrapFolderAddRecipeSerializer(serializers.Serializer):
    """POST .../scrap-folders/{id}/add-recipe/ — 폴더에 레시피 추가."""
    recipe_id = serializers.IntegerField()
