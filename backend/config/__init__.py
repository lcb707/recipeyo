from config.celery import app as celery_app

__all__ = ('celery_app',)

# 오류 발생 시 지연 임포트 시도 해볼 것