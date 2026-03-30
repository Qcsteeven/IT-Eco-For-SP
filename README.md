# IT-Eco-For-SP

Образовательная экосистема с ИИ-ассистентом, интеграцией с Codeforces/AtCoder и системой рейтингов.

## 🚀 Quick Start

### 1. Настройка окружения

```bash
# Скопируйте шаблон переменных окружения
cp .env.example .env.local

# Заполните .env.local (обязательно!)
# См. подробную инструкцию: ENV_SETUP.md
```

**Минимальный набор:**
```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
SURREAL_HOST=ws://localhost:8000
SURREAL_USER=admin
SURREAL_PASSWORD=ваш_пароль
ROUTERAI_API_KEY=ваш_api_ключ
```

### 2. Установка и запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

---

## 📋 Документация

- **[ENV_SETUP.md](./ENV_SETUP.md)** — Настройка переменных окружения
- **[README.docker.md](./README.docker.md)** — Docker инструкция

---

## 🐳 Docker

```bash
# Production
docker compose up app

# Development (с hot-reload)
docker compose up dev
```

См. [README.docker.md](./README.docker.md) для подробной документации.

---

## 🛠️ Скрипты

```bash
npm run dev          # Запуск dev-сервера
npm run build        # Production сборка
npm run start        # Запуск production
npm run lint         # Проверка кода
npm run type-check   # Проверка типов TypeScript
npm run validate     # Все проверки сразу
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

⚠️ **Никогда не коммитьте `.env.local` в Git!**

В проекте используется:
- NextAuth.js для аутентификации
- bcrypt для хеширования паролей
- Email верификация пользователей
- Защищённые API endpoints

---

## 📚 Ресурсы

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [RouterAI API](https://routerai.ru/docs)
