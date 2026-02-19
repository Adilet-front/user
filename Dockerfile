# Этап 1: Сборка
FROM node:20-alpine AS build
WORKDIR /app

# Копируем конфиги и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем остальной код и собираем проект
COPY . .
RUN npm run build

# Этап 2: Раздача статики через Nginx
FROM nginx:stable-alpine
# Vite по умолчанию собирает всё в папку 'dist'
COPY --from=build /app/dist /usr/share/nginx/html

# Добавляем конфиг для Nginx, чтобы работал React Router (важно!)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]