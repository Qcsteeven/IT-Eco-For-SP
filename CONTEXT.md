# IT-Eco-For-SP — Контекст проекта

## 📁 О проекте

**IT-Eco-For-SP** — образовательная экосистема для студентов с:
- ИИ-ассистентом (RAG + RouterAI API)
- Интеграцией с Codeforces и AtCoder
- Системой рейтингов
- Календарём соревнований
- Email верификацией пользователей

**Стек:** Next.js 15, React 19, TypeScript, SurrealDB, NextAuth.js, Nodemailer

---

## 🔧 Выполненные изменения (ветка `feature/security-fixes`)

### 1. Безопасность — убран хардкод секретов

**Файлы изменены:**
- `src/lib/surreal/surreal.ts` — убраны хардкод пароли БД, добавлена валидация переменных окружения
- `src/lib/email/sendEmail.js` — улучшена обработка ошибок SMTP

**Файлы созданы:**
- `.env.example` — шаблон всех необходимых переменных окружения
- `ENV_SETUP.md` — подробная документация по настройке окружения

**Файлы обновлены:**
- `.gitignore` — `.env*` игнорируются, кроме `.env.example`
- `README.md` — добавлены ссылки на документацию

### 2. Переменные окружения (`.env.local`)

```bash
# NextAuth
NEXTAUTH_SECRET=XQcKN4UP8GYPACpyC9iy/isOtB3w5huhLIc9iiLsklU=
NEXTAUTH_URL=http://localhost:3000

# SurrealDB
SURREAL_HOST=ws://45.149.234.80:8000
SURREAL_USER=admin
SURREAL_PASSWORD=lbvfkjigtl
SURREAL_NAMESPACE=bcsp
SURREAL_DATABASE=site

# Email (Gmail)
EMAIL_USER=levs7346@gmail.com
EMAIL_PASS=upxp klux wytl ouup

# RouterAI API
ROUTERAI_API_KEY=sk-hgIGeuri4kE6h0WQ7g-sNQX6R5eVgfxq
```

### 3. Docker

**Команды для запуска:**
```bash
# Production
docker compose up app

# Development
docker compose up dev
```

**Проблема:** У пользователя устаревшая версия `docker-compose` (v1.29.2), несовместимая с Python 3.13.

**Решение:** Использовать новую команду `docker compose` (v2, через пробел):
```bash
docker compose version  # проверить версию
docker compose up dev   # запуск
```

---

## 📁 Структура проекта

```
IT-Eco-For-SP/
├── src/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── chat/
│   │   │   ├── profile/
│   │   │   ├── register/
│   │   │   ├── verify-email/
│   │   │   └── ...
│   │   └── (otherpage)/      # Страницы приложения
│   │       ├── auth/
│   │       ├── chat/
│   │       ├── profile/
│   │       ├── calendar/
│   │       └── ...
│   ├── components/
│   │   ├── layout/
│   │   ├── CodeforcesConnect.tsx
│   │   └── SessionWrapper.js
│   └── lib/
│       ├── surreal/          # SurrealDB клиент
│       │   ├── surreal.ts    # ⚠️ Изменено: убран хардкод
│       │   └── auth.ts
│       ├── email/
│       │   └── sendEmail.js  # ⚠️ Изменено: улучшена обработка ошибок
│       ├── cron-worker.ts
│       ├── rag.ts
│       ├── prompts.ts
│       └── ...
├── .env.example              # ✨ Создано
├── .env.local                # Локальные переменные
├── ENV_SETUP.md              # ✨ Создано: документация
├── docker-compose.yml
├── Dockerfile
└── ...
```

---

## 🚨 Выявленные проблемы (требуют исправления)

### Критические (🔴)

| Проблема | Файл | Решение |
|----------|------|---------|
| 40+ мест с `any` | Весь код | Заменить на конкретные типы |
| Нет тестов | Весь проект | Добавить Jest + React Testing Library |
| Смешение bcrypt/bcryptjs | package.json | Оставить один bcryptjs |

### Средние (🟡)

| Проблема | Файл | Решение |
|----------|------|---------|
| profile/page.tsx 1563 строки | src/app/(otherpage)/profile/page.tsx | Разделить на хуки |
| Не унифицированы API responses | Все API routes | Создать единый тип ApiResponse |
| Нет обработки ошибок БД | src/lib/surreal/surreal.ts | Добавить retry-логику |

### Низкие (🟢)

| Проблема | Файл | Решение |
|----------|------|---------|
| Пустой Footer | src/components/layout/Footer.tsx | Заполнить |
| Нет страницы 404 | app/not-found.tsx | Создать |
| Сложная анимация печати | src/app/(otherpage)/chat/page.tsx | Упростить |

---

## 📊 Статус проверки

| Компонент | Статус |
|-----------|--------|
| Сервер Next.js | ✅ Работает (порт 3001 в Docker) |
| SurrealDB | ✅ Подключение успешно |
| API endpoints | ✅ Возвращают данные |
| Переменные окружения | ✅ Настроены |
| Docker Compose | ⚠️ Требуется v2 (команда `docker compose`) |

---

## 🔑 Ключевые файлы

### Аутентификация
- `src/lib/authOptions.ts` — настройки NextAuth
- `src/components/SessionWrapper.js` — SessionProvider
- `src/middleware.js` — защита роутов

### База данных
- `src/lib/surreal/surreal.ts` — подключение к SurrealDB
- `src/lib/surreal/auth.ts` — функции аутентификации

### API
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `src/app/api/register/route.ts` — регистрация
- `src/app/api/verify-email/route.ts` — верификация email
- `src/app/api/profile/route.ts` — данные профиля
- `src/app/api/chat/route.ts` — ИИ-чат (RouterAI)

### Интеграции
- Codeforces API — получение рейтинга и контестов
- AtCoder API — получение рейтинга и контестов
- RouterAI API — ИИ-ассистент (модель qwen/qwen3-235b-a22b-2507)

---

## 🐛 Известные ошибки

### ESLint
```
40+ ошибок: Unexpected any. Specify a different type
```

### TypeScript
```
Module not found: Can't resolve 'next-auth/react'
```
(Решается установкой зависимостей: `npm install`)

---

## 📦 Зависимости (ключевые)

```json
{
  "next": "^15.5.4",
  "react": "^19.1.0",
  "next-auth": "^4.24.13",
  "surrealdb": "^1.3.2",
  "nodemailer": "^7.0.11",
  "bcrypt": "^6.0.0",
  "bcryptjs": "^3.0.3"
}
```

---

## 🚀 Команды для разработки

```bash
# Установка зависимостей
npm install

# Dev сервер
npm run dev

# Проверки
npm run lint
npm run type-check
npm run validate  # все проверки

# Docker
docker compose up dev    # dev-сервер
docker compose up app    # production
```

---

## 📝 Следующие шаги для продолжения работы

1. **Проверить версию Docker Compose:**
   ```bash
   docker compose version
   ```

2. **Если v1 — установить v2:**
   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Запустить проект:**
   ```bash
   docker compose up dev
   ```

4. **Исправить приоритетные проблемы:**
   - Заменить `any` на конкретные типы
   - Добавить тесты
   - Рефакторинг profile/page.tsx

---

## 🔗 Ссылки

- [ENV_SETUP.md](./ENV_SETUP.md) — документация по переменным окружения
- [README.docker.md](./README.docker.md) — Docker документация
- [GitHub](https://github.com/Qcsteeven/IT-Eco-For-SP) — репозиторий проекта

---

**Дата создания:** 2026-03-30  
**Ветка:** `feature/security-fixes`  
**Статус:** Сервер работает, API отвечает, БД подключена
