# 1. Сборка приложения (Builder Stage)
FROM node:20-alpine as builder

WORKDIR /usr/src/app

# Копируем package.json и lock-файл
COPY package*.json ./

# Копируем схему Prisma ДО установки зависимостей.
COPY prisma ./prisma

# Устанавливаем зависимости. Prisma Client будет сгенерирован здесь.
RUN npm install

# Копируем остальной код приложения
COPY . .

# Собираем приложение
RUN npm run build

# 2. Финальный образ (Production Stage)
FROM node:20-alpine

WORKDIR /usr/src/app

# Копируем только необходимые для запуска артефакты из стадии сборки
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Prisma также требует наличия файла схемы во время выполнения
COPY --from=builder /usr/src/app/prisma ./prisma

# Запускаем миграции
RUN npx prisma migrate deploy

# Открываем порт, который слушает NestJS внутри контейнера
EXPOSE 3000

# Запускаем приложение, используя правильный путь к main файлу
CMD [ "node", "dist/src/main.js" ]
