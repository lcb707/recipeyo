from django.urls import path, re_path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView
from django.conf import settings
from django.conf.urls.static import static
from common.views import AdminStatsView, HealthCheckView, HealthLiveView, HealthReadyView

urlpatterns = [
    # 사용자 엔드포인트: 복수형 users 로 통일 (기존 /user/ 경로는 백워드 호환용)
    path('api/v1/users/', include('user.urls_v1')),
    #path('api/v1/user/', include('user.urls_v1')),

    path('api/v1/recipes/', include('recipes.urls_v1')),
    path('api/v1/fridges/', include('fridges.urls_v1')),
    path('api/v1/community/', include('community.urls_v1')),
    path('api/v1/admin/', include([
        path('stats/', AdminStatsView.as_view(), name='admin_stats'),
    ])),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Swagger UI: 개발자가 가장 많이 보는 화면
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Redoc: 좀 더 깔끔한 문서 형태
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('health/ready/', HealthReadyView.as_view(), name='health_ready'),
    path('health/live/', HealthLiveView.as_view(), name='health_live'),
]
