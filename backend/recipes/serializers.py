import re

from rest_framework import serializers

from common.image_url import AbsoluteImageField

from .models import Recipe, RecipeCategory, RecipeIngredient, RecipeReport, RecipeStep, RecipeTag
from .services import RecipeService

# 재료 양(amount): 숫자와 "/" 만 허용 (예: 1, 1/2, 2/3)
AMOUNT_PATTERN = re.compile(r"^[0-9/]+$")


class RecipeCategoryIdsField(serializers.Field):
    """
    category_ids 공통 Field (입력/출력 겸용).
    - 입력: [1,2] 형태의 배열(또는 form-data에서 파싱된 배열)을 받음
    - 출력: recipe_category_relations 기반 category_id 배열 반환
    """

    def to_internal_value(self, data):
        if data is None:
            return []
        if not isinstance(data, list):
            raise serializers.ValidationError("category_ids는 배열이어야 합니다.")
        out = []
        for x in data:
            try:
                out.append(int(x))
            except (TypeError, ValueError):
                raise serializers.ValidationError("category_ids는 숫자 배열이어야 합니다.")
        return out

    def to_representation(self, value):
        # source='*'로 전체 객체가 들어오도록 사용
        obj = value
        rels = getattr(obj, "recipe_category_relations", None)
        if rels is None:
            return []
        try:
            return [r.category_id for r in rels.all()]
        except Exception:
            return []


class RecipeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeCategory
        fields = ["id", "name"]
        read_only_fields = fields


class RecipeTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecipeTag
        fields = ["id", "name"]
        read_only_fields = fields


class RecipeIngredientSerializer(serializers.ModelSerializer):
    """재료: name, amount(양), unit(단위) 분리 입력·저장. amount는 숫자와 '/' 만 입력 가능."""

    class Meta:
        model = RecipeIngredient
        fields = ["id", "name", "amount", "unit"]
        read_only_fields = ["id"]

    def validate_amount(self, value):
        if value is None:
            return value
        s = str(value).strip()
        if not s:
            return s
        if not AMOUNT_PATTERN.fullmatch(s):
            raise serializers.ValidationError(
                "재료 양은 숫자와 '/' 만 입력할 수 있습니다. (예: 1, 1/2)"
            )
        return s


class RecipeStepSerializer(serializers.ModelSerializer):
    image = AbsoluteImageField(required=False, allow_null=True)
    # LLM/외부 스펙과의 용어 통일: instruction == description (읽기 전용 별칭)
    instruction = serializers.CharField(source="description", read_only=True)

    class Meta:
        model = RecipeStep
        fields = ["id", "step_number", "description", "instruction", "image"]
        read_only_fields = ["id", "instruction"]


class RecipeListSerializer(serializers.ModelSerializer):
    thumbnail_image = AbsoluteImageField(required=False, allow_null=True)
    # 외부 스펙 호환: main_image == thumbnail_image
    main_image = AbsoluteImageField(source="thumbnail_image", read_only=True, required=False)
    author_identifier = serializers.CharField(source="author.identifier", read_only=True)
    category_ids = RecipeCategoryIdsField(source="*", required=False)

    class Meta:
        model = Recipe
        fields = [
            "id",
            "title",
            "thumbnail_image",
            "main_image",
            "total_views",
            "category_ids",
            "cooking_time",
            "difficulty",
            "author_identifier",
            "created_at",
        ]
        read_only_fields = fields


class RecipeDetailSerializer(serializers.ModelSerializer):
    thumbnail_image = AbsoluteImageField(required=False, allow_null=True)
    main_image = AbsoluteImageField(source="thumbnail_image", read_only=True, required=False)
    ingredients = RecipeIngredientSerializer(many=True, read_only=True, source="recipe_ingredients")
    steps = RecipeStepSerializer(many=True, read_only=True, source="recipe_steps")
    author_identifier = serializers.CharField(source="author.identifier", read_only=True)
    category_ids = RecipeCategoryIdsField(source="*", required=False)

    class Meta:
        model = Recipe
        fields = [
            "id",
            "title",
            "description",
            "thumbnail_image",
            "main_image",
            "total_views",
            "category_ids",
            "cooking_time",
            "difficulty",
            "author_identifier",
            "ingredients",
            "steps",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class RecipeCreateSerializer(serializers.ModelSerializer):
    thumbnail_image = AbsoluteImageField(required=False, allow_null=True)
    main_image = AbsoluteImageField(source="thumbnail_image", read_only=True, required=False)
    ingredients = RecipeIngredientSerializer(many=True, source="recipe_ingredients")
    steps = RecipeStepSerializer(many=True, source="recipe_steps")
    author_identifier = serializers.CharField(source="author.identifier", read_only=True)
    # 입력/출력 모두 category_ids로 통일
    category_ids = RecipeCategoryIdsField(required=False)

    class Meta:
        model = Recipe
        fields = [
            "id",
            "title",
            "description",
            "thumbnail_image",
            "main_image",
            "total_views",
            "category_ids",
            "cooking_time",
            "difficulty",
            "author_identifier",
            "ingredients",
            "steps",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author_identifier", "created_at", "updated_at"]

    def create(self, validated_data):
        # 시리얼라이저 필드명(ingredients/steps) 또는 클라이언트 키(recipe_ingredients/recipe_steps) 모두 처리
        ingredients_data = validated_data.pop("recipe_ingredients", validated_data.pop("ingredients", [])) or []
        steps_data = validated_data.pop("recipe_steps", validated_data.pop("steps", [])) or []

        request = self.context.get('request')
        author = getattr(request, 'user', None)

        recipe = RecipeService.create_recipe_with_nested(
            author=author,
            ingredients=ingredients_data,
            steps=steps_data,
            **validated_data,
        )
        return recipe

    def update(self, instance, validated_data):
        # ingredients/steps 또는 recipe_ingredients/recipe_steps 모두 처리
        ingredients_data = validated_data.pop("recipe_ingredients", validated_data.pop("ingredients", None))
        steps_data = validated_data.pop("recipe_steps", validated_data.pop("steps", None))

        recipe = RecipeService.update_recipe_with_nested(
            instance=instance,
            ingredients=ingredients_data,
            steps=steps_data,
            **validated_data,
        )
        return recipe


class RecipeReportSerializer(serializers.Serializer):
    """POST /api/v1/recipes/{id}/report/ — reason 필수, detail 선택."""
    reason = serializers.ChoiceField(choices=RecipeReport.Reason.choices)
    detail = serializers.CharField(required=False, allow_blank=True, default="")


class YouTubeImportSerializer(serializers.Serializer):
    """POST /api/v1/recipes/youtube-import/ — 유튜브 영상 URL."""

    youtube_url = serializers.URLField(required=True)
    # Python 예약어(async) 때문에 필드 선언 대신 to_internal_value에서 처리
    async_bool = serializers.BooleanField(required=False, default=False)

    def to_internal_value(self, data):
        incoming = dict(data or {})
        raw_async = incoming.pop("async", False)
        parsed = super().to_internal_value(incoming)
        parsed["async"] = self.fields["async_bool"].run_validation(raw_async)
        return parsed

    def validate_youtube_url(self, value):
        from .youtube_extract import parse_youtube_video_id, normalize_and_validate_youtube_url

        normalized = normalize_and_validate_youtube_url(value)
        if not parse_youtube_video_id(normalized):
            raise serializers.ValidationError("지원하는 YouTube 영상 URL 형식이 아닙니다.")
        return normalized
