import logging

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils.timezone import now
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken

from common.decorators import trace_log
from common.exceptions import BusinessLogicException
from common.pagination import (
    DEFAULT_PAGE_SIZE,
    build_paginated_response,
    get_page_params,
    paginate_queryset,
)
from common.response_code import ResponseCode
from common.utils import ResponseMaker
from user.schemas import user_viewset_schema
from user.selectors import UserSelector
from user.services import UserService, TokenService, GoogleLoginService, EmailService

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserSearchSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    MeUpdateSerializer,
)

# 갯수 조회용 (레시피/스크랩/요리일지)
from recipes.models import Recipe
from community.models import RecipeScrap, CookingJournal

logger = logging.getLogger('backend')


@user_viewset_schema
class UserViewSet(viewsets.ViewSet):
    """
    /api/v1/users/ 이하에 User CRUD / ME / LOGIN / LOGOUT / EMAIL-VERIFY를 모두 통합.
    """

    def get_permissions(self):
        if self.action in ['create', 'login', 'verify_email', 'google_login', 'token_refresh', 'password_reset', 'password_reset_confirm']:
            return [permissions.AllowAny()]
        if self.action in ['list', 'retrieve', 'suspend', 'unsuspend']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def list(self, request):
        """
        GET /api/v1/users/  -> 유저 목록 (관리자 전용). page, page_size, ordering 지원.
        """
        User = get_user_model()
        queryset = User.objects.all().order_by("-date_joined")
        ordering = (request.query_params.get("ordering") or "").strip()
        allowed = {"date_joined", "-date_joined", "email", "-email"}
        if ordering in allowed:
            queryset = queryset.order_by(ordering)
        page, page_size = get_page_params(request, default_size=DEFAULT_PAGE_SIZE)
        page_queryset = paginate_queryset(queryset, page, page_size)
        serializer = UserSerializer(page_queryset, many=True, context={"request": request})
        data = build_paginated_response(
            request, queryset, page, page_size, serializer.data,
            base_path=request.path.rstrip("/"),
        )
        return ResponseMaker.success_response(
            message="유저 목록 조회 성공",
            result=data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    def retrieve(self, request, pk=None):
        """
        GET /api/v1/users/{identifier}/ -> 개별 유저 조회 (식별용 12자리 identifier 사용)
        """
        User = get_user_model()
        identifier = (pk or "").strip()
        if not identifier:
            raise BusinessLogicException(
                message="유저 식별자가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        user = User.objects.filter(identifier=identifier).first()
        if not user:
            raise BusinessLogicException(
                message="존재하지 않는 유저입니다.",
                error_code=ResponseCode.ErrorCode.UserNotFound,
            )
        serializer = UserSerializer(user, context={"request": request})
        return ResponseMaker.success_response(
            message="유저 조회 성공",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @trace_log
    def create(self, request):
        """
        POST /api/v1/users/  -> 회원가입(SignUp)
        """
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[user_create] start | request.data keys=%s", list(request.data.keys()) if hasattr(request.data, "keys") else None)
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # logger.info("[user_create] validated | email=%s", serializer.validated_data.get("email"))
        user = UserService.signup(**serializer.validated_data)

        return ResponseMaker.success_response(
            message="회원가입에 성공했습니다.",
            result={
                "user": {
                    "identifier": user.identifier,
                    "email": user.email,
                    "nickname": user.nickname,
                    "role": user.role,
                }
            },
            status_code=ResponseCode.HttpStatusCode.Created,
        )

    @action(detail=False, methods=['post'], url_path='login')
    @trace_log
    def login(self, request):
        """
        POST /api/v1/users/login/ -> 로그인
        """
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        #logger.info("[user_login] request.data=%s", request.data)
        #logger.info("[user_login] request.data.get('email')=%s", request.data.get('email'))
        #logger.info("[user_login] request.data.get('password')=%s", request.data.get('password'))
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserService.login(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
        )

        tokens = TokenService.get_tokens_for_user(user)
        # logger.info("[user_login] TokenService.get_tokens_for_user done | user_id=%s", user.id)
        return ResponseMaker.success_response(
            message="로그인에 성공했습니다.",
            result=tokens,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['post', 'patch'], url_path='verify-email')
    def verify_email(self, request):
        """
        POST /api/v1/users/verify-email/  -> 인증 코드 발송
        PATCH /api/v1/users/verify-email/ -> 코드 검증
        """
        if request.method == 'POST':
            email = request.data.get('email')
            if not email:
                return ResponseMaker.error_response(
                    error_code=ResponseCode.ErrorCode.InputAreaInvalid,
                    message="이메일이 필요합니다.",
                )

            EmailService.send_verification_code(email)
            return ResponseMaker.success_response(message="인증 번호가 발송되었습니다.")

        # PATCH: 코드 검증
        email = request.data.get('email')
        code = request.data.get('code')
        success, message = EmailService.verify_email_code(email, code)
        if success:
            return ResponseMaker.success_response(message=message)
        return ResponseMaker.error_response(
            error_code=ResponseCode.ErrorCode.InvalidVerificationCode,
            message=message,
        )

    @action(detail=False, methods=['post'], url_path='token/refresh')
    def token_refresh(self, request):
        """
        POST /api/v1/users/token/refresh/ -> Body: { "refresh": "<refresh_token>" }.
        Response: { "status": "success", "data": { "access": "<new_access_token>" }, "message": "..." }.
        """
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer
        serializer = TokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return ResponseMaker.success_response(
            message="토큰 갱신에 성공했습니다.",
            result=serializer.validated_data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['post'], url_path='google-login')
    @trace_log
    def google_login(self, request):
        """
        POST /api/v1/users/google-login/ -> 구글 로그인
        """
        access_token = request.data.get('access_token')
        if not access_token:
            raise BusinessLogicException(
                message="구글 액세스 토큰이 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )

        tokens = GoogleLoginService.authenticate_or_signup(access_token)
        return ResponseMaker.success_response(
            message="구글 로그인에 성공했습니다.",
            result=tokens,
        )

    @action(detail=False, methods=['post'], url_path='logout')
    @trace_log
    def logout(self, request):
        """
        POST /api/v1/users/logout/ -> 로그아웃.
        Body에 refresh 전달 시 블랙리스트 등록. 없어도 200 반환(현재 액세스 토큰만 무효화된 상태).
        """
        refresh_token = request.data.get("refresh") if isinstance(request.data, dict) else None
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # 이미 만료 등이어도 로그아웃 성공 처리
        if getattr(request, "auth", None):
            access_token = request.auth
            if isinstance(access_token, dict):
                jti = access_token.get("jti")
                exp = access_token.get("exp")
                if jti and exp and exp > int(now().timestamp()):
                    cache.set(f"blacklist_{jti}", "true", timeout=exp - int(now().timestamp()))
        return ResponseMaker.success_response(message="로그아웃 성공")

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        GET /api/v1/users/search/?query=... 또는 ?keyword=... — 이메일/닉네임 부분 일치 검색.
        Q(email__icontains) | Q(nickname__icontains) 로 검색하여 리스트 반환.
        """
        from django.db.models import Q
        User = get_user_model()
        q = (request.query_params.get("query") or request.query_params.get("keyword") or "").strip()
        if not q:
            raise BusinessLogicException(
                message="query 또는 keyword 쿼리 파라미터가 필요합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        users = User.objects.filter(
            Q(email__icontains=q) | Q(nickname__icontains=q)
        ).order_by("email")[:100]
        serializer = UserSearchSerializer(users, many=True)
        return ResponseMaker.success_response(
            message="유저 검색에 성공했습니다.",
            result=serializer.data,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['get'], url_path='me/counts')
    def me_counts(self, request):
        """
        GET /api/v1/users/me/counts/ -> 내 레시피·스크랩·요리일지 갯수 조회.
        인증 필수.
        """
        user = request.user
        recipe_count = Recipe.objects.filter(author=user).count()
        scrap_count = RecipeScrap.objects.filter(user=user).count()
        cooking_journal_count = CookingJournal.objects.filter(user=user).count()
        return ResponseMaker.success_response(
            message="갯수 조회에 성공했습니다.",
            result={
                "recipe_count": recipe_count,
                "scrap_count": scrap_count,
                "cooking_journal_count": cooking_journal_count,
            },
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['get', 'patch', 'delete'], url_path='me')
    @trace_log
    def me(self, request):
        """
        GET    /api/v1/users/me/ -> 내 정보 조회
        PATCH  /api/v1/users/me/ -> 내 정보 수정 (nickname, profile_image)
        DELETE /api/v1/users/me/ -> 회원 탈퇴
        """
        if request.method == 'GET':
            user = UserSelector().get_user_info(user=request.user)
            serializer = UserSerializer(user, context={"request": request})
            return ResponseMaker.success_response(
                message="유저 조회 성공",
                result=serializer.data,
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        if request.method == 'PATCH':
            serializer = MeUpdateSerializer(
                data=request.data,
                partial=True,
                context={"user": request.user},
            )
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            user = request.user
            if "nickname" in data:
                user.nickname = data["nickname"]
            if "profile_image" in data:
                user.profile_image = data["profile_image"]
            user.save(update_fields=[f for f in ("nickname", "profile_image") if f in data])
            out = UserSerializer(user, context={"request": request})
            return ResponseMaker.success_response(
                message="내 정보를 수정했습니다.",
                result=out.data,
                status_code=ResponseCode.HttpStatusCode.Success,
            )

        # DELETE
        UserService().delete_user(user=request.user)
        return ResponseMaker.success_response(
            message="계정이 삭제되었습니다.",
            status_code=status.HTTP_204_NO_CONTENT,
        )

    @action(detail=False, methods=['post'], url_path='me/change-password')
    def change_password(self, request):
        """POST /api/v1/users/me/change-password/ — Body: current_password, new_password."""
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        UserService.change_password(
            request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
        )
        return ResponseMaker.success_response(
            message="비밀번호가 변경되었습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['post'], url_path='password-reset')
    def password_reset(self, request):
        """POST /api/v1/users/password-reset/ — Body: email. 해당 이메일로 재설정 인증코드 발송 (Public)."""
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        EmailService.send_password_reset_code(email)
        return ResponseMaker.success_response(
            message="비밀번호 재설정 인증코드가 발송되었습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=False, methods=['post'], url_path='password-reset/confirm')
    def password_reset_confirm(self, request):
        """POST /api/v1/users/password-reset/confirm/ — Body: email, code, new_password (Public)."""
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        code = serializer.validated_data["code"]
        new_password = serializer.validated_data["new_password"]
        ok, msg = EmailService.verify_password_reset_code(email, code)
        if not ok:
            return ResponseMaker.error_response(
                message=msg,
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        UserService.set_password_after_reset(email, new_password)
        return ResponseMaker.success_response(
            message="비밀번호가 재설정되었습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend(self, request, pk=None):
        """POST /api/v1/users/{identifier}/suspend/ — 관리자 전용. 해당 유저 비활성화(로그인 차단)."""
        User = get_user_model()
        user = User.objects.filter(identifier=(pk or "").strip()).first()
        if not user:
            raise BusinessLogicException(
                message="존재하지 않는 유저입니다.",
                error_code=ResponseCode.ErrorCode.UserNotFound,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return ResponseMaker.success_response(
            message="해당 회원을 비활성화했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )

    @action(detail=True, methods=['post'], url_path='unsuspend')
    def unsuspend(self, request, pk=None):
        """POST /api/v1/users/{identifier}/unsuspend/ — 관리자 전용. 해당 유저 활성화."""
        User = get_user_model()
        user = User.objects.filter(identifier=(pk or "").strip()).first()
        if not user:
            raise BusinessLogicException(
                message="존재하지 않는 유저입니다.",
                error_code=ResponseCode.ErrorCode.UserNotFound,
            )
        user.is_active = True
        user.save(update_fields=["is_active"])
        return ResponseMaker.success_response(
            message="해당 회원을 활성화했습니다.",
            result=None,
            status_code=ResponseCode.HttpStatusCode.Success,
        )