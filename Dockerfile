FROM nginx:alpine

ENV NGINX_ENVSUBST_FILTER=^PORT$

COPY nginx.conf /etc/nginx/templates/default.conf.template

COPY . /usr/share/nginx/html/

CMD ["nginx", "-g", "daemon off;"]