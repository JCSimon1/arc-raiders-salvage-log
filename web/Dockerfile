FROM nginx:alpine

ARG APP_VERSION=dev

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

RUN sed -i "s/%%VERSION%%/${APP_VERSION}/g" /usr/share/nginx/html/index.html