dj:
	docker-compose down
	docker-compose up -d --build

all: dj

# Makefile

.PHONY: makemigrations up down logs dev test1 test2 test3 test4 test5 test6 test7 test_re test_enrich_search_keywords


makemigrations:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations

test1:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations chatbots 

test2:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations community

test3:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations fridges

test4:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations shopping

test5:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations user
test6:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations recipes

test7:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py makemigrations community --name cookingjournal_visibility_target_grou

test_re:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py migrate community 0006 --fake

test_enrich_search_keywords:
	docker-compose run --rm -v $(PWD):/usr/src/app dj-server60000 python manage.py enrich_search_keywords

up:
	docker-compose up --build -d


dev: makemigrations up	


down:
	docker-compose down

logs:
	docker-compose logs -f dj-server60000