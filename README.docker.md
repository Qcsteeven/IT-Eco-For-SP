# Docker для IT-Eco-For-SP

## Быстрый старт

### Production режим

```bash
# Сборка и запуск
docker compose up app

# Или в фоновом режиме
docker compose up -d app

# Просмотр логов
docker compose logs -f app
```

Приложение доступно по адресу: http://localhost:3000

### Development режим (с hot-reload)

```bash
# Запуск dev-сервера
docker compose up dev

# Или в фоновом режиме
docker compose up -d dev

# Просмотр логов
docker compose logs -f dev
```

Приложение доступно по адресу: http://localhost:3001

## npm скрипты для Docker

```bash
# Сборка production образа
npm run build:docker

# Запуск production контейнера
npm run start:docker

# Запуск dev контейнера
npm run dev:docker
```

## Переменные окружения

1. Скопируйте `.env.example` в `.env.local`
2. Заполните необходимые переменные

```bash
cp .env.example .env.local
```

## Остановка контейнеров

```bash
# Остановить все сервисы
docker compose down

# Остановить и удалить volumes
docker compose down -v
```

## Пересборка

```bash
# Пересобрать без кэша
docker compose build --no-cache app

# Пересобрать dev сервис
docker compose build dev
```

## Логи

```bash
# Просмотр логов
docker compose logs

# Логи конкретного сервиса
docker compose logs app
docker compose logs dev

# Логи в реальном времени
docker compose logs -f app
```

## Доступ в контейнер

```bash
# Production контейнер
docker exec -it it-eco-app sh

# Dev контейнер
docker exec -it it-eco-dev sh
```

## Архитектура

### Production image (`app`)
- Многоэтапная сборка для минимального размера
- Запуск от не-root пользователя
- Оптимизированный standalone режим Next.js
- Порт: 3000

### Development image (`dev`)
- Hot-reload при изменении файлов
- Монтирование локальной директории
- Сохранение node_modules и .next в volumes
- Порт: 3001
