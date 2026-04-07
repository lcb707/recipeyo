from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from common.exceptions import AuthenticationFailedException, BusinessLogicException
from .selectors import UserSelector
from .models import User , SocialAccount
from common.response_code import ResponseCode
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
from user.tasks import send_verification_email_task

import random
import requests
import logging
logger = logging.getLogger('backend') 

class UserService:
    @staticmethod
    @transaction.atomic # DB 전부 성공 or 전부 실패
    def signup(email, nickname, password, **kwargs):
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[UserService.signup] entry | email=%s", email)
        # 중복 체크 (Selector 사용은 아주 좋은 습관입니다)
        if UserSelector.get_user_by_email(email):
            raise BusinessLogicException(message="이미 등록된 이메일입니다.", error_code=ResponseCode.ErrorCode.DuplicateEmail)
        
        if UserSelector.get_user_by_nickname(nickname):
            raise BusinessLogicException(message="이미 사용 중인 닉네임입니다.", error_code=ResponseCode.ErrorCode.DuplicateNickname)
        
        try:
            # logger.info("[UserService.signup] User.objects.create_user before")
            user = User.objects.create_user(
                email=email, 
                nickname=nickname, 
                password=password,
                role=User.Role.USER_BASIC
            )
            # logger.info("[UserService.signup] create_user done | user_id=%s", user.id)
            # 가입 성공 후 Redis 티켓 삭제 (키 이름 통일)
            cache.delete(f"verified:email:{email}")

            return user
        except IntegrityError:
            # logger.exception("[UserService.signup] IntegrityError")
            raise BusinessLogicException(message="사용할 수 없는 계정 정보입니다.")
    
    @staticmethod
    def login(email, password):
        # [오류 추적용] 주석 해제 후 재현 시 로그로 지점 확인
        # logger.info("[UserService.login] entry | email=%s", email)
        # 1. Django 기본 인증 (password 체크 포함)
        user = UserSelector.authenticate_user(email=email, password=password)
        # logger.info("[UserService.login] authenticate_user done | user=%s", user.id if user else None)
        if not user:
            # logger.warning("[UserService.login] user is None (auth failed)")
            # 노드의 LoginFailUserNotExists / LoginFailIncorrectPassword 통합
            raise AuthenticationFailedException(
                message="이메일 또는 비밀번호가 올바르지 않습니다."
            )

        # 2. 유저 상태 체크 (노드의 UserStatus 체크 로직 이식)
        if not user.is_active:
            # logger.warning("[UserService.login] user.is_active=False | user_id=%s", user.id)
            # 이메일 미인증 또는 비활성 상태
            raise BusinessLogicException(
                message="비활성화된 계정입니다. 관리자에게 문의하세요.",
                error_code=ResponseCode.ErrorCode.LoginFailInactiveUser
            )

        # 여기서 추가적인 상태값(예: 이메일 인증 여부 등)이 있다면 더 체크 가능합니다.
        
        return user
   
    @staticmethod
    def delete_user(user):
        """계정 삭제"""
        user.delete()

    @staticmethod
    def change_password(user, current_password: str, new_password: str):
        """로그인 유저가 현재 비밀번호 확인 후 새 비밀번호로 변경."""
        if not user.check_password(current_password):
            raise BusinessLogicException(
                message="현재 비밀번호가 일치하지 않습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
            raise BusinessLogicException(
                message=messages[0] if messages else "비밀번호 형식이 유효하지 않습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            ) from exc
        user.set_password(new_password)
        user.save(update_fields=["password"])

    @staticmethod
    def set_password_after_reset(email: str, new_password: str):
        """비밀번호 재설정 확정: 이메일로 유저 조회 후 비밀번호 변경."""
        user = User.objects.filter(email=email).first()
        if not user:
            raise BusinessLogicException(
                message="해당 이메일로 등록된 계정이 없습니다.",
                error_code=ResponseCode.ErrorCode.UserNotFound,
            )
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            messages = exc.messages if hasattr(exc, "messages") else [str(exc)]
            raise BusinessLogicException(
                message=messages[0] if messages else "비밀번호 형식이 유효하지 않습니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            ) from exc
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return user

class EmailService:
    @staticmethod
    def send_verification_code(email: str):
        # 1. 6자리 인증번호 생성
        code = str(random.randint(100000, 999999))
        
        # 2. Redis 저장 (인증용)
        auth_info = {'code': code, 'attempts': 0}
        cache.set(f"auth:email:{email}", auth_info, timeout=300)
        
        # 3. 비동기 메일 발송 태스크 호출
        send_verification_email_task.delay(email, code)
        return True

    @staticmethod
    def verify_email_code(email: str, input_code: str):
        auth_info = cache.get(f"auth:email:{email}")
        
        if not auth_info:
            return False, "인증 시간이 만료되었습니다."
        
        if auth_info['attempts'] >= 3:
            cache.delete(f"auth:email:{email}")
            return False, "시도 횟수 초과. 다시 요청하세요."

        if auth_info['code'] == str(input_code):
            # 인증 성공 시 10분간 유효한 증표 저장
            cache.set(f"verified:email:{email}", True, timeout=600)
            cache.delete(f"auth:email:{email}")
            return True, "인증 성공"
        else:
            auth_info['attempts'] += 1
            cache.set(f"auth:email:{email}", auth_info, timeout=300)
            return False, f"번호 불일치 ({auth_info['attempts']}/3)"

    # 비밀번호 재설정용 (인증코드 발송·검증)
    PASSWORD_RESET_CACHE_PREFIX = "password_reset:email:"
    PASSWORD_RESET_TIMEOUT = 600  # 10분

    @classmethod
    def send_password_reset_code(cls, email: str):
        code = str(random.randint(100000, 999999))
        auth_info = {"code": code, "attempts": 0}
        cache.set(f"{cls.PASSWORD_RESET_CACHE_PREFIX}{email}", auth_info, timeout=cls.PASSWORD_RESET_TIMEOUT)
        send_verification_email_task.delay(email, code)  # 동일 6자리 메일 발송
        return True

    @classmethod
    def verify_password_reset_code(cls, email: str, input_code: str):
        auth_info = cache.get(f"{cls.PASSWORD_RESET_CACHE_PREFIX}{email}")
        if not auth_info:
            return False, "인증 시간이 만료되었습니다."
        if auth_info["attempts"] >= 3:
            cache.delete(f"{cls.PASSWORD_RESET_CACHE_PREFIX}{email}")
            return False, "시도 횟수 초과. 다시 요청하세요."
        if auth_info["code"] == str(input_code):
            cache.delete(f"{cls.PASSWORD_RESET_CACHE_PREFIX}{email}")
            return True, "인증 성공"
        auth_info["attempts"] += 1
        cache.set(f"{cls.PASSWORD_RESET_CACHE_PREFIX}{email}", auth_info, timeout=cls.PASSWORD_RESET_TIMEOUT)
        return False, f"번호 불일치 ({auth_info['attempts']}/3)"
        
class GoogleLoginService:
    GOOGLE_USER_INFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

    @staticmethod
    def get_google_user_info(access_token):
        """구글로부터 유저 정보(이메일, 이름 등)를 가져옴"""
        response = requests.get(
            GoogleLoginService.GOOGLE_USER_INFO_URL,
            params={'access_token': access_token}
        )
        if not response.ok:
            raise BusinessLogicException(
                message="구글 토큰이 유효하지 않습니다.",
                error_code=ResponseCode.ErrorCode.LoginFailNotConfirmed
            )
        return response.json()
    
    @staticmethod
    def authenticate_or_signup(access_token):
        # 1. 구글로부터 유저 정보 획득
        user_data = GoogleLoginService.get_google_user_info(access_token)
        email = user_data.get('email')
        google_id = user_data.get('sub') # 구글 고유 ID

        # 2. 먼저 이 구글 식별자로 연결된 계정이 있는지 확인
        social_account = SocialAccount.objects.filter(
            provider='GOOGLE', 
            social_id=google_id
        ).select_related('user').first()
        
        if social_account:
            user = social_account.user
        else:
            # 3. 이메일 기반으로 기존 유저 여부 확인 (계정 통합 로직)
            user = User.objects.filter(email=email).first()
            
            if not user:
                # 신규 가입
                user = User.objects.create_user(
                    email=email,
                    nickname=user_data.get('name', email.split('@')[0]),
                    role=User.Role.USER_BASIC, # 00001
                    initial_provider='GOOGLE'
                )
            
            # 4. 소셜 계정 정보 연결 (기존 유저든 신규 유저든 연결 정보 생성)
            SocialAccount.objects.get_or_create(
                user=user,
                provider='GOOGLE',
                defaults={'social_id': google_id}
            )
            logger.info(f"Account Link/Signup: {email} linked to GOOGLE")

        # 5. 최종 상태 체크 및 토큰 발급
        if not user.is_active:
            raise BusinessLogicException(
                message="비활성화된 계정입니다.",
                error_code=ResponseCode.ErrorCode.LoginFailInactiveUser
            )

        return TokenService.get_tokens_for_user(user)
    
class TokenService:
    @staticmethod
    def get_tokens_for_user(user):
        refresh = RefreshToken.for_user(user)

        refresh['email'] = user.email
        refresh['role'] = user.role
        
        return {
            "refresh_token": str(refresh),
            "access_token": str(refresh.access_token),
            "user": {
                "identifier": user.identifier,
                "email": user.email,
                "nickname": user.nickname,
                "role": user.role,
            }
        }