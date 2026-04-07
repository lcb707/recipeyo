# Django Dockerfile
FROM python:3.11-slim

WORKDIR /usr/src/app

# 시스템 deps
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev gcc pkg-config \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Django 코드 복사
COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]

# uWSGI 실행
CMD ["uwsgi", "--ini", "uwsgi.ini"]
