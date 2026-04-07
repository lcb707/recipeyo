# common/exceptions.py
from rest_framework.views import exception_handler
from rest_framework import exceptions as drf_exceptions
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from .utils import ResponseMaker
from .response_code import ResponseCode
import logging

logger = logging.getLogger('backend')

class BaseCustomException(Exception):
    def __init__(self, message, error_code=ResponseCode.ErrorCode.ServerError):
        self.message = message
        self.error_code = error_code
        super().__init__(message)

class AuthenticationFailedException(BaseCustomException):
    def __init__(self, message="아이디 또는 비밀번호가 올바르지 않습니다."):
        super().__init__(message=message, error_code=ResponseCode.ErrorCode.AuthenticationFailed)

class BusinessLogicException(BaseCustomException):
    def __init__(self, message, error_code=ResponseCode.ErrorCode.Failed):
        super().__init__(message=message, error_code=error_code)

def custom_exception_handler(exc, context):
    view_name = context['view'].__class__.__name__
    # [오류 추적용] 주석 해제 후 재현 시 어떤 예외 타입으로 들어왔는지 확인
    # logger.info("[exception_handler] exc_type=%s view=%s message=%s", type(exc).__name__, view_name, getattr(exc, "message", getattr(exc, "detail", str(exc))))

    # 1. 비즈니스 커스텀 예외 (우리가 의도적으로 던진 에러)
    if isinstance(exc, BaseCustomException):
        # logger.info("[Business Error] %s: %s", view_name, exc.message)
        return ResponseMaker.error_response(
            error_code=exc.error_code, 
            message=exc.message
        )

    # 2. 인증 관련 예외 (401 Unauthorized)
    # RedisJWTAuthentication 등에서 발생하는 예외를 세밀하게 처리
    if isinstance(exc, (drf_exceptions.AuthenticationFailed, drf_exceptions.NotAuthenticated)):
        error_code = ResponseCode.ErrorCode.AuthenticationFailed
        message = "인증 정보가 유효하지 않습니다."
        
        # [추가] Redis 블랙리스트 토큰 체크 (특정 code 값 확인)
        # exc.get_codes()는 DRF 예외 객체에서 설정된 code를 반환합니다.
        exc_code = getattr(exc, 'get_codes', lambda: None)()
        if exc_code == "token_blacklisted":
            error_code = ResponseCode.ErrorCode.TokenBlacklisted 
            message = str(exc.detail) 

        logger.warning(f"[Auth Error] {view_name}: {message}")
        return ResponseMaker.error_response(
            error_code=error_code,
            message=message,
            status_code=401
        )

    # 3. 데이터 유효성/파싱 에러 (400 Bad Request)
    if isinstance(exc, (drf_exceptions.ValidationError, drf_exceptions.ParseError, DjangoValidationError)):
        # 구체적인 에러 메시지가 필요하면 exc.detail을 파싱할 수 있으나, 보안상 축소 응답
        logger.warning("[Input Error] %s: validation/parsing failed (%s)", view_name, type(exc).__name__)
        return ResponseMaker.error_response(
            error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            message="입력 정보가 유효하지 않거나 형식이 틀립니다.",
            status_code=400
        )

    # 4. 권한 에러 (403 Forbidden)
    if isinstance(exc, drf_exceptions.PermissionDenied):
        logger.warning(f"[Permission Error] {view_name}: {str(exc)}")
        return ResponseMaker.error_response(
            error_code=ResponseCode.ErrorCode.PermissionDenied,
            message="접근 권한이 없습니다.",
            status_code=403
        )

    # 5. 404 리소스 없음
    if isinstance(exc, Http404):
        return ResponseMaker.error_response(
            error_code=404,
            message="존재하지 않는 리소스입니다.",
            status_code=404
        )

    # 6. 기타 DRF 기본 예외 (Method Not Allowed 등)
    response = exception_handler(exc, context)
    if response is not None:
        logger.warning(f"[DRF Exception] {view_name}: status={response.status_code}, detail={exc}")
        if isinstance(exc, drf_exceptions.Throttled):
            wait = getattr(exc, "wait", None)
            wait_seconds = int(wait) if wait is not None else None
            message = (
                f"요청이 너무 많습니다. {wait_seconds}초 후 다시 시도해주세요."
                if wait_seconds is not None
                else "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
            )
            throttle_response = ResponseMaker.error_response(
                error_code=response.status_code,
                message=message,
                status_code=response.status_code,
            )
            if wait_seconds is not None:
                throttle_response["Retry-After"] = str(wait_seconds)
            return throttle_response
        return ResponseMaker.error_response(
            error_code=response.status_code,
            message="요청을 처리할 수 없습니다.",
            status_code=response.status_code
        )

    # 7. 서버 내부 오류 (500) — 위 분기에서 처리되지 않은 예외
    # 500 원인 파악을 위해 traceback을 항상 서버 로그에 남긴다.
    # (요청 바디/파일 등 민감한 데이터는 로깅하지 않는다)
    request = context.get("request")
    try:
        logger.exception(
            "[exception_handler] 500 unhandled | view=%s method=%s path=%s content_type=%s user_id=%s exc_type=%s exc=%s",
            view_name,
            getattr(request, "method", None),
            getattr(request, "path", None),
            getattr(request, "content_type", None),
            getattr(getattr(request, "user", None), "id", None),
            type(exc).__name__,
            type(exc).__name__,
        )
    except Exception:
        # 로깅 자체가 실패해도 응답은 유지
        logger.exception("[exception_handler] 500 unhandled (logging failed) | view=%s", view_name)
    return ResponseMaker.error_response(
        error_code=500, 
        message="서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 
        status_code=500
    )