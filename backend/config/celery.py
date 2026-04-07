# config/celery.py
import os
from celery import Celery

# 1. 장고 설정 모듈 경로를 config.settings로 변경
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config') # 프로젝트의 핵심 이름

# 2. CELERY_ 접두사가 붙은 설정들을 settings.py에서 읽어옴
app.config_from_object('django.conf:settings', namespace='CELERY')

# 3. 각 앱에 정의된 tasks.py를 자동으로 발견
app.autodiscover_tasks()