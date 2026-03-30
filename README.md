# IT-Eco-For-SP

Образовательная экосистема с ИИ-ассистентом, интеграцией с Codeforces/AtCoder и системой рейтингов.

## 🚀 Quick Start

### 1. Настройка окружения

```bash
# Скопируйте шаблон переменных окружения
cp .env.example .env.local
```

**Обязательно заполните в `.env.local`:**

| Переменная | Описание | Пример |
|------------|----------|--------|
| `NEXTAUTH_SECRET` | Секрет сессий | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL приложения | `http://localhost:3000` |
| `SURREAL_HOST` | Подключение к БД | `ws://localhost:8000` |
| `SURREAL_USER` | Пользователь БД | `admin` |
| `SURREAL_PASSWORD` | Пароль БД | `ваш_пароль` |
| `ROUTERAI_API_KEY` | API ключ ИИ | `sk-...` |

**Опционально:**
- `DEV_PORT` — порт dev-сервера (по умолчанию: `3000`)
- `APP_PORT` — порт production (по умолчанию: `3000`)

> 📖 Подробная инструкция: [ENV_SETUP.md](./ENV_SETUP.md)

---

### 2. Запуск проекта

#### 🔹 Вариант A: Docker (рекомендуется)

```bash
# Dev-режим (с hot-reload)
docker-compose up dev

# Production
docker-compose up app
```

**Откройте:** http://localhost:3000 (или порт, указанный в `DEV_PORT`/`APP_PORT`)

> ⚠️ **Важно:** Используйте `docker-compose` (с дефисом), а не `docker compose`.
> Проверьте версию: `docker-compose --version` (требуется v2+)

#### 🔹 Вариант B: Локально (Node.js)

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

**Откройте:** http://localhost:3000

---

### 3. Проверка работы

- ✅ Откройте http://localhost:3000 в браузере
- ✅ Проверьте консоль на наличие ошибок
- ✅ Убедитесь, что подключение к SurrealDB успешно

---

## 📋 Документация

| Файл | Описание |
|------|----------|
| [ENV_SETUP.md](./ENV_SETUP.md) | Настройка переменных окружения |
| [README.docker.md](./README.docker.md) | Docker инструкция |

---

## 🛠️ Скрипты

```bash
npm run dev          # Запуск dev-сервера (порт 3000)
npm run build        # Production сборка
npm run start        # Запуск production
npm run lint         # Проверка кода
npm run type-check   # Проверка типов TypeScript
npm run validate     # Все проверки сразу
```

---

## 🐳 Docker команды

```bash
# Запуск dev-сервера
docker-compose up dev

# Запуск production
docker-compose up app

# Остановка
docker-compose down

# Пересборка без кэша
docker-compose build --no-cache

# Просмотр логов
docker-compose logs -f dev
```

**Переменные окружения для Docker:**

Создайте `.env` в корне проекта (не путать с `.env.local`):

```bash
# .env — для Docker Compose
DEV_PORT=3000
APP_PORT=3000
```

Или передайте в командной строке:

```bash
DEV_PORT=3001 docker-compose up dev
```

---

## 📁 Структура проекта

```
src/
├── app/              # Next.js App Router
│   ├── api/          # API endpoints
│   └── (otherpage)/  # Страницы приложения
├── components/       # React компоненты
└── lib/              # Утилиты и конфигурации
    ├── surreal/      # SurrealDB клиент
    ├── email/        # Отправка писем
    └── cron-worker.ts # Фоновые задачи
```

---

## 🔐 Безопасность

⚠️ **Никогда не коммитьте `.env.local` или `.env` в Git!**

В проекте используется:
- NextAuth.js для аутентификации
- bcrypt для хеширования паролей
- Email верификация пользователей
- Защищённые API endpoints

---

## ❓ Troubleshooting

### Порт уже занят

```bash
# Освободить порт 3000
lsof -ti:3000 | xargs kill -9

# Или измените порт в .env.local
DEV_PORT=3001
NEXTAUTH_URL=http://localhost:3001
```

### Docker Compose не работает

```bash
# Проверьте версию
docker-compose --version

# Если v1.x — установите v2:
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Ошибки подключения к БД

- Проверьте `SURREAL_HOST`, `SURREAL_USER`, `SURREAL_PASSWORD` в `.env.local`
- Убедитесь, что SurrealDB доступен по сети

---

## 📚 Ресурсы

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [RouterAI API](https://routerai.ru/docs)
