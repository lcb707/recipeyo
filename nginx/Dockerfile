FROM nginx:latest

WORKDIR /etc/nginx

RUN mkdir -p /tmp/nginx/cache
RUN mkdir -p /tmp/nginx/dev-cache

COPY conf.d/* ./conf.d/
COPY nginx.conf ./

EXPOSE  61000 443 80
