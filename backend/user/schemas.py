"""
User API Swagger 스키마 (drf-spectacular).
extend_schema / extend_schema_view 로 ViewSet 각 액션에 문서 적용.
"""
from drf_spectacular.utils import (
    extend_schema,
    extend_schema_view,
    OpenApiExample,
    OpenApiParameter,
)
from rest_framework import serializers

from common.schemas import (
    SuccessResponseSerializer,
    ErrorResponseSerializer,
    PaginatedResponseSerializer,
)
from .api.v1.serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    MeUpdateSerializer,
)


# ----- Request/Response 보조 시리얼라이저 (문서용) -----

class TokenRefreshRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(help_text="JWT refresh token")


class TokenRefreshResponseDataSerializer(serializers.Serializer):
    access_token = serializers.CharField(help_text="새 JWT access token")
    refresh_token = serializers.CharField(required=False, allow_null=True, help_text="새 JWT refresh token (설정 시)")


class LogoutRequestSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, help_text="JWT refresh token (선택)")


class GoogleLoginRequestSerializer(serializers.Serializer):
    access_token = serializers.CharField(help_text="구글 OAuth access token")


# ----- extend_schema_view: UserViewSet 전체 액션 매핑 (views.py 에서 @user_viewset_schema 로 적용) -----

user_viewset_schema = extend_schema_view(
    list=extend_schema(
        summary="유저 목록 조회",
        description="관리자 전용. 페이지네이션·정렬(ordering) 지원.",
        parameters=[
            OpenApiParameter(name="page", type=int, description="페이지 번호"),
            OpenApiParameter(name="page_size", type=int, description="페이지 크기 (기본 20, 최대 100)"),
            OpenApiParameter(name="ordering", type=str, enum=["date_joined", "-date_joined", "email", "-email"]),
        ],
        responses={200: PaginatedResponseSerializer},
        tags=["Users"],
    ),
    retrieve=extend_schema(
        summary="개별 유저 조회",
        description="관리자 전용. Path는 12자리 identifier 사용.",
        responses={200: SuccessResponseSerializer},
        tags=["Users"],
    ),
    create=extend_schema(
        summary="회원가입",
        description="이메일 인증 완료 후 호출. 이메일, 닉네임, 비밀번호 입력.",
        request=RegisterSerializer,
        responses={201: SuccessResponseSerializer, 400: ErrorResponseSerializer},
        examples=[
            OpenApiExample(
                "회원가입 성공",
                value={"status": "success", "data": {"user": {"identifier": "xxx", "email": "user@example.com", "nickname": "닉네임", "role": "00001"}}, "message": "회원가입에 성공했습니다."},
                response_only=True,
                status_codes=["201"],
            ),
        ],
        tags=["Users"],
    ),
    login=extend_schema(
        summary="로그인",
        description="이메일·비밀번호로 로그인. access/refresh 토큰 반환.",
        request=LoginSerializer,
        responses={200: SuccessResponseSerializer, 401: ErrorResponseSerializer},
        examples=[
            OpenApiExample(
                "로그인 성공",
                value={"status": "success", "data": {"access_token": "eyJ...", "refresh_token": "eyJ...", "user": {"identifier": "xxx", "email": "user@example.com", "nickname": "닉네임", "role": "00001"}}, "message": "로그인에 성공했습니다."},
                response_only=True,
                status_codes=["200"],
            ),
        ],
        tags=["Users"],
    ),
    verify_email=extend_schema(
        summary="이메일 인증 (발송/검증)",
        description="POST: 인증 코드 발송. PATCH: 코드 검증.",
        request=serializers.Serializer,
        responses={200: SuccessResponseSerializer, 400: ErrorResponseSerializer},
        tags=["Users"],
    ),
    token_refresh=extend_schema(
        summary="토큰 갱신",
        description="refresh 토큰으로 새 access 토큰 발급. Public.",
        request=TokenRefreshRequestSerializer,
        responses={200: SuccessResponseSerializer, 401: ErrorResponseSerializer},
        tags=["Users"],
    ),
    google_login=extend_schema(
        summary="구글 로그인",
        request=GoogleLoginRequestSerializer,
        responses={200: SuccessResponseSerializer, 400: ErrorResponseSerializer},
        tags=["Users"],
    ),
    logout=extend_schema(
        summary="로그아웃",
        description="Body에 refresh 있으면 블랙리스트 등록. 없어도 200 성공.",
        request=LogoutRequestSerializer,
        responses={200: SuccessResponseSerializer},
        tags=["Users"],
    ),
    search=extend_schema(
        summary="유저 검색",
        description="query 또는 keyword 로 이메일/닉네임 부분 일치 검색.",
        parameters=[
            OpenApiParameter(name="query", type=str, description="검색어"),
            OpenApiParameter(name="keyword", type=str, description="검색어 (query 대체)"),
        ],
        responses={200: SuccessResponseSerializer},
        tags=["Users"],
    ),
    me_counts=extend_schema(
        summary="내 갯수 조회",
        description="레시피·스크랩·요리일지 개수.",
        responses={200: SuccessResponseSerializer},
        tags=["Users"],
    ),
    me=extend_schema(
        summary="내 정보 (조회/수정/탈퇴)",
        description="GET: 조회, PATCH: 수정(nickname, profile_image), DELETE: 회원 탈퇴.",
        request=MeUpdateSerializer,
        responses={200: SuccessResponseSerializer, 204: None},
        tags=["Users"],
    ),
    change_password=extend_schema(
        summary="비밀번호 변경",
        request=ChangePasswordSerializer,
        responses={200: SuccessResponseSerializer, 400: ErrorResponseSerializer},
        tags=["Users"],
    ),
    password_reset=extend_schema(
        summary="비밀번호 재설정 요청",
        description="이메일로 재설정 인증코드 발송. Public.",
        request=PasswordResetRequestSerializer,
        responses={200: SuccessResponseSerializer},
        tags=["Users"],
    ),
    password_reset_confirm=extend_schema(
        summary="비밀번호 재설정 확정",
        description="코드 검증 후 새 비밀번호 설정. Public.",
        request=PasswordResetConfirmSerializer,
        responses={200: SuccessResponseSerializer, 400: ErrorResponseSerializer},
        tags=["Users"],
    ),
    suspend=extend_schema(
        summary="회원 정지 (관리자)",
        description="해당 유저 is_active=False.",
        responses={200: SuccessResponseSerializer, 404: ErrorResponseSerializer},
        tags=["Users"],
    ),
    unsuspend=extend_schema(
        summary="회원 정지 해제 (관리자)",
        responses={200: SuccessResponseSerializer, 404: ErrorResponseSerializer},
        tags=["Users"],
    ),
)
