up-redis:
	docker-compose down redis
	docker-compose up -d --build redis

up-db_mysql:
	docker-compose down mysql_dj
	docker-compose up -d --build mysql_dj

up-backend:
	docker-compose down dj-server60000
	docker-compose up -d --build dj-server60000

up-frontend:
	docker-compose down frontend
	docker-compose up -d --build frontend

up-nginx:
	docker-compose down nginx
	docker-compose up -d --build nginx

up-celery:
	docker-compose down celery_worker
	docker-compose up -d --build celery_worker

all: up-backend up-frontend up-nginx up-celery

no-all:
	docker-compose down dj-server60000 frontend nginx celery_worker
	docker-compose build --no-cache dj-server60000 frontend nginx celery_worker
	docker-compose up -d dj-server60000 frontend nginx celery_worker

system-all: 
	docker-compose down
	docker-compose up -d --build

aws-up:
	docker compose -f docker-compose-aws.yml --env-file .env.aws up -d --build

aws-down:
	docker compose -f docker-compose-aws.yml --env-file .env.aws down

aws-logs:
	docker compose -f docker-compose-aws.yml --env-file .env.aws logs -f nginx dj-server60000 frontend celery_worker

.PHONY: setting-all local_dj_setting

setting-all:
	docker network create net_default
	nano ./backend/.env
	nano ./redis/.env
	mkdir -p ./volume/static_value
	mkdir -p ./volume/outgoing_volume

#local_makemigrations:
#	sudo apt update
#	sudo apt install python3-pip python3-venv python3-dev libmysqlclient-dev pkg-config build-essential -y
#	
#	cd backend
#	python3 -m venv venv # (최초 1회 )

#	source venv/bin/activate # 가상환경 활성화
#	pip install -r requirements.txt
#  	python manage.py makemigrations 