FROM nginx:alpine

ARG APP_VERSION=dev
 
COPY fonts/ /usr/share/nginx/html/fonts/
COPY fonts.css /usr/share/nginx/html/fonts.css
COPY i18n.js /usr/share/nginx/html/i18n.js
COPY index.html /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY particles.js /usr/share/nginx/html/particles.js
COPY particles.css /usr/share/nginx/html/particles.css
COPY style.css /usr/share/nginx/html/style.css
COPY trophy.js /usr/share/nginx/html/trophy.js
COPY trophy.css /usr/share/nginx/html/trophy.css


RUN sed -i "s/%%VERSION%%/${APP_VERSION}/g" /usr/share/nginx/html/index.html