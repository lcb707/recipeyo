from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import exceptions

class RedisJWTAuthentication(JWTAuthentication):
    """
    SimpleJWT를 확장하여 Redis 블랙리스트를 먼저 확인하는 인증 클래스
    """
    def authenticate(self, request):
        # 1. 상위 클래스의 authenticate를 호출하여 기본적인 토큰 유효성(서명, 만료 등) 검사
        header = self.get_header(request)
        if header is None:
            return None

        raw_token = self.get_raw_token(header)
        if raw_token is None:
            return None

        # 유효한 토큰인지 검사 (여기서 실패하면 예외 발생)
        validated_token = self.get_validated_token(raw_token)
        
        # 2. 🌟 Redis 블랙리스트 체크 (최적화 핵심)
        # 토큰 내부의 jti (JWT ID)를 키로 사용하여 Redis 조회
        jti = validated_token.get('jti')
        if jti and cache.get(f"blacklist_{jti}"):
            raise exceptions.AuthenticationFailed(
                "이미 로그아웃된 토큰입니다. 다시 로그인해주세요.",
                code="token_blacklisted"
            )

        # 3. 모든 검사를 통과하면 유저 객체와 토큰 반환
        return self.get_user(validated_token), validated_token