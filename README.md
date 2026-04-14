# Recipeyo

AI 기반 유튜브 레시피 추출, 냉장고 재고 관리, 커뮤니티 공유를 연결한 풀스택 웹 애플리케이션입니다.

## 프로젝트 개요

- **목표**: 레시피 CRUD + 냉장고 파먹기 + 커뮤니티 + 유튜브 URL 기반 자동 레시피 생성
- **배포 환경**: Docker Compose, Nginx, AWS EC2
- **운영 URL**: [https://recipeyo.duckdns.org/](https://recipeyo.duckdns.org/)

## 기술 스택

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **Backend**: Django, Django REST Framework, uWSGI
- **Auth**: SimpleJWT + Redis 블랙리스트
- **Async**: Celery + Redis
- **Database**: MySQL 8
- **Infra**: Docker, Docker Compose, Nginx, AWS EC2

## 아키텍처 요약

1. 클라이언트는 Nginx(80/443)로 접속
2. `/api/*` 요청은 Django(uWSGI)로 전달
3. 웹 페이지 요청은 Next.js로 전달
4. 유튜브 임포트는 Celery 워커에서 비동기 처리
5. 정적 파일/업로드 미디어는 공유 볼륨을 통해 서빙

## 저장소 구조

```text
.
├── backend/                  # DRF API 서버
├── frontend/                 # Next.js 프론트엔드
├── nginx/                    # Nginx 설정
├── redis/                    # Redis 설정/데이터
├── db_mysql/                 # MySQL 초기화/데이터 디렉터리
├── docker-compose.yml        # 로컬/개발용 compose
├── docker-compose-aws.yml    # EC2 운영용 compose
└── Makefile                  # 주요 실행 명령어
```

## 핵심 기능

- 회원가입/로그인/마이페이지/회원 탈퇴
- 레시피 등록/수정/삭제/검색/필터/스크랩
- 냉장고 재료 관리 및 유통기한 관리
- 커뮤니티 그룹, 요리일지, 공유 기능
- 유튜브 URL 기반 레시피 자동 생성 (비동기 Job ID 상태조회)

## 로컬 실행

### 1) 사전 준비

- Docker + Docker Compose plugin
- `backend/.env` 생성 (`backend/.env.example` 참고)
- `redis/.env` 생성 (`REDIS_PASSWORD` 설정)

### 2) 네트워크/볼륨 생성 (최초 1회)

```bash
docker network create net_default
mkdir -p ./volume/static_value
mkdir -p ./volume/outgoing_volume
```

### 3) 전체 기동

```bash
docker-compose up -d --build
```

또는 Makefile:

```bash
make system-all
```

### 4) 접속 확인

- Nginx: `http://localhost:31000`
- Frontend: `http://localhost:40001`
- Backend(직접): `http://localhost:60000` (구성에 따라 내부 용도)


요약 명령:

```bash
make aws-up
make aws-logs
make aws-down
```

## 자주 쓰는 명령어

```bash
# 전체
make system-all

# 서비스별 재기동
make up-backend
make up-frontend
make up-nginx
make up-celery
make up-redis
make up-db_mysql

# 운영 로그
make aws-logs
```

## 운영 시 주의사항

- `ALLOWED_HOSTS`, `SECURE_PROXY_SSL_HEADER` 설정 확인
- `NEXT_PUBLIC_*` 값은 프론트 빌드 타임 고정
- Celery/Backend/Nginx의 미디어 볼륨 마운트 경로 일치 필수
- `.env`, `.env.aws`, API 키는 Git에 커밋 금지
