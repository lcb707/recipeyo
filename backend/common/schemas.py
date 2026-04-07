"""
공통 API 응답 스키마 (Swagger/OpenAPI 문서화용).
실제 응답 형식: { "status": "success" | "error", "data": {...} | null, "message": "..." }
"""
from rest_framework import serializers


class SuccessResponseSerializer(serializers.Serializer):
    """성공 응답 공통 형식 (status, data, message)."""
    status = serializers.ChoiceField(choices=["success"], help_text="성공 시 'success'")
    data = serializers.JSONField(allow_null=True, help_text="응답 데이터 (객체/배열/null)")
    message = serializers.CharField(help_text="응답 메시지")


class ErrorResponseSerializer(serializers.Serializer):
    """에러 응답 공통 형식."""
    status = serializers.ChoiceField(choices=["error"], help_text="에러 시 'error'")
    data = serializers.JSONField(allow_null=True, help_text="에러 코드 등 (예: error_code)")
    message = serializers.CharField(help_text="에러 메시지")


# 하위 호환: 기존 스키마에서 참조하던 이름 (items → data 로 실제 API와 일치)
class BaseResponseSerializer(serializers.Serializer):
    """성공 응답 (Swagger 예시용, data 필드로 통일)."""
    status = serializers.ChoiceField(choices=["success"])
    data = serializers.JSONField(allow_null=True, required=False)
    message = serializers.CharField()


class PaginatedDataSerializer(serializers.Serializer):
    """페이지네이션 목록 응답의 data 내부 구조."""
    count = serializers.IntegerField(help_text="전체 개수")
    next = serializers.URLField(allow_null=True, help_text="다음 페이지 URL")
    previous = serializers.URLField(allow_null=True, help_text="이전 페이지 URL")
    results = serializers.ListField(child=serializers.DictField(), help_text="목록 데이터")


class PaginatedResponseSerializer(serializers.Serializer):
    """페이지네이션 목록 API 응답 (status, data: { count, next, previous, results }, message)."""
    status = serializers.ChoiceField(choices=["success"])
    data = PaginatedDataSerializer()
    message = serializers.CharField()
