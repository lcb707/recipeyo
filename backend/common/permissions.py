from rest_framework import permissions
from django.contrib.auth import get_user_model
from common.exceptions import BusinessLogicException
from common.response_code import ResponseCode

User = get_user_model()

class IsActiveAdmin(permissions.BasePermission):
    """
    1. 관리자 권한 (00009)
    - 오직 관리자 코드이며 활성화된 유저만 허용
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
            
        if hasattr(user, 'role') and user.role == '00009' and user.is_active:
            return True
            
        raise BusinessLogicException(
            message="관리자 권한이 필요한 서비스입니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied
        )

class IsPremiumUser(permissions.BasePermission):
    """
    2. 프리미엄 유저 권한 (00002 이상)
    - 일반유저(00001)를 제외한 확장 권한 유저 혹은 관리자 허용
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        # 00001(일반)보다 크고 00009(관리자) 이하인 코드를 가진 유저 체크
        # 문자열 비교이므로 '00001' < role <= '00009' 로직 적용
        if hasattr(user, 'role') and '00001' < user.role <= '00009' and user.is_active:
            return True

        raise BusinessLogicException(
            message="프리미엄 등급 이상의 유저만 이용 가능합니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied
        )

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    3. 소유자 전용 권한 (게시글 수정/삭제 등)
    - 읽기 권한은 모두에게 허용 (GET, HEAD, OPTIONS)
    - 쓰기 권한은 객체의 owner(또는 user) 필드가 현재 로그인한 유저와 같아야 함
    """
    def has_object_permission(self, request, view, obj):
        # SAFE_METHODS: GET, HEAD, OPTIONS (읽기 전용)
        if request.method in permissions.SAFE_METHODS:
            return True

        # 객체에 owner 또는 user 필드가 있는지 확인하고 비교
        # 모델에 따라 user 혹은 owner 등 필드명이 다를 수 있으므로 유연하게 대처
        owner = getattr(obj, 'user', getattr(obj, 'owner', None))
        
        if owner == request.user:
            return True
            
        raise BusinessLogicException(
            message="해당 컨텐츠의 소유자만 수정하거나 삭제할 수 있습니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied
        )


class IsAuthorOrReadOnly(permissions.BasePermission):
    """
    레시피 등 author 필드를 가진 객체용.
    - 읽기(GET, HEAD, OPTIONS)는 모두 허용.
    - 쓰기(PUT, PATCH, DELETE)는 obj.author == request.user 일 때만 허용.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        author = getattr(obj, "author", None)
        if author == request.user:
            return True
        raise BusinessLogicException(
            message="해당 레시피의 작성자만 수정하거나 삭제할 수 있습니다.",
            error_code=ResponseCode.ErrorCode.PermissionDenied,
        )