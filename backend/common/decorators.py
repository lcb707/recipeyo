# common/decorators.py
import logging
import time
import functools
from rest_framework.exceptions import ValidationError,ParseError,NotAuthenticated,PermissionDenied
from django.http import Http404
from common.exceptions import BaseCustomException

logger = logging.getLogger('backend')

def trace_log(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        
        # 1. 유저 정보 추출 로직
        user_info = "Anonymous"
        
        # APIView 내의 메서드인 경우 self.request가 존재함
        # 보통 args[0]은 self (View 객체)
        if args and hasattr(args[0], 'request'):
            user = args[0].request.user
            if user and user.is_authenticated:
                # 로그에는 최소 식별자만 남겨 민감정보 노출을 줄인다.
                user_info = f"User(id={user.id})"

        # 2. 실행 시작 로그 (유저 정보 포함)
        #logger.info(f"▶ [START] [{user_info}] {func.__module__}.{func.__name__}")

        try:
            result = func(*args, **kwargs)
            
            # 3. 실행 완료 로그
            #duration = time.time() - start_time
            #logger.info(f"✔ [END] [{user_info}] {func.__name__} | Time: {duration:.4f}s")
            
            return result
        except (ValidationError, BaseCustomException, ParseError, 
                NotAuthenticated, PermissionDenied, Http404) as e:
            #logger.info(f"[Expected Exception] {func.__name__}: {str(e)}")  # 예상 가능한 예외는 info 레벨로 기록
            raise e
        except Exception as e:
            # 4. 에러 로그 (어떤 유저에게 발생했는지 명확히 기록)
            logger.error(
                "✘ [ERROR] [%s] %s | exception_type=%s",
                user_info,
                func.__name__,
                type(e).__name__,
                exc_info=True
            )
            raise e

    return wrapper