#!/bin/sh
set -e
echo "=== ENTRYPOINT START ==="

MYSQL_HOST=${MYSQL_HOST:-mysql_dj} 
MYSQL_PORT=${MYSQL_PORT:-3306}

echo "Waiting for MySQL at $MYSQL_HOST:$MYSQL_PORT..."
while ! nc -z "$MYSQL_HOST" "$MYSQL_PORT"; do
  echo "  └─ MySQL not ready yet..."
  sleep 1
done

echo "MySQL is ready!"
echo "Applying migrations..."

#python manage.py makemigrations --noinput ## 
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "=== END OF ENTRYPOINT ==="


# 2. 슈퍼유저 자동 생성
# 환경 변수를 사용하여 계정 정보를 설정합니다.
 #USER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-lcb707@naver.com}
 #USER_NAME=${DJANGO_SUPERUSER_USERNAME:-root}
 #USER_PASS=${DJANGO_SUPERUSER_PASSWORD:-sky707707}

 #echo "Checking for superuser: $USER_PASS"

# Django ORM을 직접 사용하여 슈퍼유저를 생성하는 Python 코드를 실행
 #python manage.py shell <<EOF
 #from django.contrib.auth import get_user_model
 #User = get_user_model()
 #if not User.objects.filter(username='$USER_NAME').exists():
 #   print('Creating superuser...')
 #   User.objects.create_superuser('$USER_NAME', '$USER_EMAIL', '$USER_PASS')
 #else:
 #    print('Superuser already exists. Skipping creation.')
 #EOF

# createsuperuser 명령을 사용하여 존재하지 않을 경우에만 계정 생성
# --noinput을 사용하여 사용자 입력을 방지하고, 환경 변수로 비밀번호 설정

exec "$@"