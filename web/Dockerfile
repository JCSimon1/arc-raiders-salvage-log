FROM nginx:alpine

ARG APP_VERSION=dev
 
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY i18n.js /usr/share/nginx/html/i18n.js

RUN sed -i "s/%%VERSION%%/${APP_VERSION}/g" /usr/share/nginx/html/index.html