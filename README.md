# IT-Eco-For-SP

Образовательная экосистема для студентов с ИИ-ассистентом, интеграцией с Codeforces/AtCoder и системой рейтингов.

## Возможности

- 🤖 ИИ-ассистент на базе RAG (RouterAI API, модель Qwen)
- 📊 Интеграция с Codeforces и AtCoder для отслеживания рейтинга
- 📅 Календарь соревнований
- 📧 Email верификация пользователей
- 🔐 Аутентификация через NextAuth.js
- 📈 Система рейтингов (объединённый рейтинг CF + AtCoder)

**Стек:** Next.js 15, React 19, TypeScript, SurrealDB, NextAuth.js, Nodemailer

---

## Быстрый старт

### Требования

- Node.js 20+
- Docker и Docker Compose v2+ (для запуска в контейнере)
- Доступ к SurrealDB (удалённый или локальный)

---

### 1. Клонирование репозитория

```bash
git clone https://github.com/Qcsteeven/IT-Eco-For-SP.git
cd IT-Eco-For-SP
```

---

### 2. Настройка переменных окружения

```bash
# Скопируйте шаблон переменных окружения
cp .env.example .env.local
```

**Обязательно заполните в `.env.local`:**

| Переменная | Описание | Пример |
|------------|----------|--------|
| `NEXTAUTH_SECRET` | Секрет сессий | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL приложения | `http://localhost:3000` |
| `SURREAL_HOST` | Подключение к БД | `ws://45.149.234.80:8000` |
| `SURREAL_USER` | Пользователь БД | `admin` |
| `SURREAL_PASSWORD` | Пароль БД | `ваш_пароль` |
| `SURREAL_NAMESPACE` | Namespace БД | `bcsp` |
| `SURREAL_DATABASE` | Database БД | `site` |
| `EMAIL_USER` | Email для отправки | `your@gmail.com` |
| `EMAIL_PASS` | Пароль приложения Gmail | `xxxx xxxx xxxx xxxx` |
| `ROUTERAI_API_KEY` | API ключ ИИ | `sk-...` |

**Генерация NEXTAUTH_SECRET:**

```bash
openssl rand -base64 32
```

> 📖 Подробная инструкция: [ENV_SETUP.md](./ENV_SETUP.md)

---

### 3. Запуск проекта

#### Вариант A: Docker (рекомендуется)

```bash
# Dev-режим (с hot-reload)
docker compose up dev

# Production
docker compose up app
```

**Откройте:** http://localhost:3001 (dev) или http://localhost:3000 (production)

> ⚠️ **Важно:** Используйте команду `docker compose` (v2, через пробел), а не `docker-compose`.
> Проверьте версию: `docker compose version`

#### Вариант B: Локально (Node.js)

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

**Откройте:** http://localhost:3000

---

### 4. Проверка работы

- ✅ Откройте http://localhost:3001 в браузере
- ✅ Проверьте консоль на наличие ошибок
- ✅ Убедитесь, что подключение к SurrealDB успешно (логи в консоли)

---

## Docker команды

```bash
# Запуск dev-сервера
docker compose up dev

# Запуск production
docker compose up app

# Остановка
docker compose down

# Остановка с удалением volumes
docker compose down -v

# Пересборка без кэша
docker compose build --no-cache app

# Просмотр логов
docker compose logs -f dev

# Доступ в контейнер
docker compose exec dev sh
```

**Изменение порта:**

Создайте файл `.env` в корне проекта:

```bash
DEV_PORT=3001
APP_PORT=3000
```

Или передайте в командной строке:

```bash
DEV_PORT=3002 docker compose up dev
```

> 📖 Подробная Docker документация: [README.docker.md](./README.docker.md)

---

## Скрипты проекта

```bash
npm run dev          # Запуск dev-сервера (порт 3000)
npm run build        # Production сборка
npm run start        # Запуск production
npm run lint         # Проверка кода ESLint
npm run type-check   # Проверка типов TypeScript
npm run validate     # Все проверки сразу
npm run format       # Форматирование кода Prettier
```

---

## Структура проекта

```
IT-Eco-For-SP/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API endpoints
│   │   │   ├── auth/     # NextAuth
│   │   │   ├── chat/     # ИИ-чат
│   │   │   ├── profile/  # Профиль пользователя
│   │   │   └── ...
│   │   └── (otherpage)/  # Страницы приложения
│   ├── components/       # React компоненты
│   └── lib/              # Утилиты
│       ├── surreal/      # SurrealDB клиент
│       ├── email/        # Отправка писем
│       └── ...
├── .env.example          # Шаблон переменных окружения
├── .env.local            # Локальные переменные (не коммить!)
├── docker-compose.yml    # Docker Compose конфигурация
├── Dockerfile            # Docker образ
└── ENV_SETUP.md          # Документация по настройке
```

---

## Безопасность

⚠️ **Никогда не коммитьте `.env.local` или `.env` в Git!**

В проекте используется:

- NextAuth.js для аутентификации
- bcryptjs для хеширования паролей
- Email верификация пользователей
- Защищённые API endpoints
- Middleware для защиты роутов

---

## Документация

| Файл | Описание |
|------|----------|
| [ENV_SETUP.md](./ENV_SETUP.md) | Настройка переменных окружения |
| [README.docker.md](./README.docker.md) | Docker документация |
| [CONTEXT.md](./CONTEXT.md) | Контекст проекта и статус разработки |

---

## Troubleshooting

### Порт уже занят

```bash
# Освободить порт 3000/3001
lsof -ti:3000 | xargs kill -9

# Или измените порт в .env
DEV_PORT=3002
NEXTAUTH_URL=http://localhost:3002
```

### Docker Compose не работает

```bash
# Проверьте версию
docker compose version

# Если версия ниже 2.0, установите v2:
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Ошибки подключения к БД

- Проверьте `SURREAL_HOST`, `SURREAL_USER`, `SURREAL_PASSWORD` в `.env.local`
- Убедитесь, что SurrealDB доступен по сети
- Проверьте логи: `docker compose logs dev`

### Ошибки TypeScript/ESLint

```bash
# Установите зависимости
npm install

# Проверьте типы
npm run type-check

# Исправьте ошибки линтера
npm run lint -- --fix
```

---

## Ресурсы

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [RouterAI API](https://routerai.ru/docs)
- [Codeforces API](https://codeforces.com/apiHelp)
- [AtCoder API](https://github.com/kenkoooo/AtCoderProblems/blob/master/doc/api.md)

---

## Лицензия

MIT
