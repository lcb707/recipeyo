from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .api.v1.views import UserViewSet

app_name = 'user'  # 네임스페이스 지정으로 재사용성 향상

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
]