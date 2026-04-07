from django.contrib.auth import authenticate
from .models import User

class UserSelector:
    @staticmethod
    def authenticate_user(email, password):
        """사용자 인증 로직 (성공 시 user 객체, 실패 시 None)"""
        return authenticate(email=email, password=password)

    @staticmethod
    def get_user_by_email(email):
        """이메일로 유저 존재 여부 확인"""
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_user_by_nickname(nickname):
        """닉네임으로 유저 존재 여부 확인"""
        try:
            return User.objects.filter(nickname=nickname).exists()
        except User.DoesNotExist:
            return None 
    
    @staticmethod    
    def get_user_info(user):
        # 복잡한 쿼리나 캐싱 처리를 여기서 수행
        return user
    