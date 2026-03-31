# Docker для IT-Eco-For-SP

## Быстрый старт

### Development режим (с hot-reload)

```bash
# Запуск dev-сервера
docker-compose up dev

# Или в фоновом режиме
docker-compose up -d dev

# Просмотр логов
docker-compose logs -f dev
```

**Приложение доступно по адресу:** http://localhost:3000

> ⚠️ **Важно:** Используйте `docker-compose` (с дефисом), а не `docker compose`.
> Проверьте версию: `docker-compose --version` (требуется v2+)

### Production режим

```bash
# Сборка и запуск
docker-compose up app

# Или в фоновом режиме
docker-compose up -d app

# Просмотр логов
docker-compose logs -f app
```

**Приложение доступно по адресу:** http://localhost:3000

---

## 🔧 Настройка портов

### Изменение порта

Порт по умолчанию: **3000**. Для изменения создайте файл `.env` в корне проекта:

```bash
# .env — для Docker Compose (не путать с .env.local!)

# Порт для dev-режима
DEV_PORT=3001

# Порт для production-режима
APP_PORT=3001
```

Или передайте переменную в командной строке:

```bash
# Запуск на порту 3001
DEV_PORT=3001 docker-compose up dev

# Запуск на порту 3001 (production)
APP_PORT=3001 docker-compose up app
```

### Если порт занят

```bash
# Освободить порт 3000
lsof -ti:3000 | xargs kill -9

# Или используйте другой порт
DEV_PORT=3002 docker-compose up dev
```

---

## Переменные окружения

1. Скопируйте `.env.example` в `.env.local`
2. Заполните необходимые переменные

```bash
cp .env.example .env.local
```

**Важно:** `NEXTAUTH_URL` в `.env.local` должен совпадать с портом Docker:

```bash
# Если DEV_PORT=3001
NEXTAUTH_URL=http://localhost:3001
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
