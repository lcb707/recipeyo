from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.files.uploadedfile import UploadedFile
from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode
from common.image_url import AbsoluteImageField
from django.core.cache import cache

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """일반적인 사용자 정보 출력용 (Profile). 대외 식별은 identifier만 노출."""
    profile_image = AbsoluteImageField(required=False, allow_null=True)
    class Meta:
        model = User
        fields = ("identifier", "email", "nickname", "role", "is_active", "profile_image")
        read_only_fields = ("identifier", "email", "role")


class UserSearchSerializer(serializers.ModelSerializer):
    """유저 검색 결과. id, identifier, email, nickname, role 노출 (그룹 초대 등)."""
    class Meta:
        model = User
        fields = ("id", "identifier", "email", "nickname", "role")
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """회원가입 입력 데이터 검증용 (DTO 역할)"""
    email = serializers.EmailField(max_length=255)
    nickname = serializers.CharField(max_length=50)
    password = serializers.CharField(
        max_length=128, 
        write_only=True,
        style={'input_type': 'password'}
    )

    def validate_password(self, value):
        """Django 기본 패스워드 검증 로직 적용 (보안 강화)"""
        validate_password(value)
        return value

    def validate_email(self, value):
        """이메일 중복 체크 (DB 접근 전 1차 검증)"""
        if User.objects.filter(email=value).exists():
            raise BusinessLogicException(
                message="이미 사용 중인 이메일입니다.",
                error_code=ResponseCode.ErrorCode.DuplicateEmail
            )
        return value

    def validate_nickname(self, value):
        """닉네임 중복 체크"""
        if User.objects.filter(nickname=value).exists():
            raise BusinessLogicException(
                message="이미 사용 중인 닉네임입니다.",
                error_code=ResponseCode.ErrorCode.DuplicateNickname
            )
        return value

    def validate(self, data):
        email = data.get('email')
        
        if not cache.get(f"verified:email:{email}"):
            raise BusinessLogicException(
                message="이메일 인증이 완료되지 않았거나 만료되었습니다.",
                error_code=ResponseCode.ErrorCode.ExpiredVerificationCode
            )
        
        return data
    
class LoginSerializer(serializers.Serializer):
    """로그인 입력 데이터 검증용"""
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(
        write_only=True, 
        style={'input_type': 'password'}
    )
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if not email or not password:
            raise BusinessLogicException(
                message="이메일과 비밀번호는 필수 입력 항목입니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid
            )

        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """비밀번호 변경 (로그인 유저)."""
    current_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """비밀번호 재설정 요청 (이메일로 인증코드 발송)."""
    email = serializers.EmailField(write_only=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """비밀번호 재설정 확정 (코드 검증 후 새 비밀번호 설정)."""
    email = serializers.EmailField(write_only=True)
    code = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_new_password(self, value):
        validate_password(value)
        return value


class MeUpdateSerializer(serializers.Serializer):
    """내 정보 수정 (PATCH /users/me/). 닉네임·프로필 이미지."""
    nickname = serializers.CharField(max_length=50, required=False)
    profile_image = serializers.ImageField(required=False, allow_null=True)

    def validate_nickname(self, value):
        if value and User.objects.filter(nickname=value).exclude(pk=self.context.get("user").pk).exists():
            raise BusinessLogicException(
                message="이미 사용 중인 닉네임입니다.",
                error_code=ResponseCode.ErrorCode.DuplicateNickname,
            )
        return value

    def validate_profile_image(self, value):
        # 프론트에서 경로 문자열이 들어오면 파일 업로드가 아니므로 명확히 차단
        if value is None:
            return value
        if not isinstance(value, UploadedFile):
            raise BusinessLogicException(
                message="profile_image는 파일 업로드 형식이어야 합니다.",
                error_code=ResponseCode.ErrorCode.InputAreaInvalid,
            )
        return value