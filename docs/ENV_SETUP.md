# Настройка окружения IT-Eco-For-SP

## 📋 Быстрый старт

### 1. Скопируйте файл переменных окружения

```bash
cp .env.example .env.local
```

### 2. Заполните обязательные переменные

**Минимальный набор для запуска:**

```bash
# Порт приложения (должен совпадать с NEXTAUTH_URL)
DEV_PORT=3000
APP_PORT=3000

# Секрет для сессий (сгенерируйте новый!)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000

# База данных SurrealDB
SURREAL_HOST=ws://localhost:8000
SURREAL_USER=admin
SURREAL_PASSWORD=ваш_пароль
SURREAL_NAMESPACE=bcsp
SURREAL_DATABASE=site

# ИИ-ассистент (RouterAI)
ROUTERAI_API_KEY=ваш_api_ключ
```

### 3. Запустите проект

**Docker (рекомендуется):**

```bash
docker compose up dev
```

**Локально:**

```bash
npm install
npm run dev
```

---

## 🔧 Настройка портов

### Изменение порта

Если порт 3000 занят, измените порт в `.env.local`:

```bash
# Для Docker dev-режима
DEV_PORT=3001
NEXTAUTH_URL=http://localhost:3001

# Для Docker production-режима
APP_PORT=3001

# Для локального запуска (в package.json порт задаётся в команде)
# npm run dev использует порт 3000 по умолчанию
```

### Запуск на случайном порту

```bash
# Docker автоматически выберет свободный порт
docker compose up dev

# Узнать назначенный порт
docker compose port dev 3000
```

---

## 🔐 Генерация NEXTAUTH_SECRET

### Linux/macOS:

```bash
openssl rand -base64 32
```

### Windows (PowerShell):

```powershell
[System.Web.Security.Membership]::GeneratePassword(32, 8)
```

### Онлайн-генератор:

https://generate-secret.vercel.app/32

---

## 📧 Настройка Email (Unisender Go Web API)

Отправка регистрационных кодов и писем восстановления пароля работает только через HTTPS API Unisender Go. SMTP не используется.

Заполните в `.env.local`:

```bash
UNISENDER_GO_API_KEY=your_api_key
UNISENDER_GO_SENDER_EMAIL=no-reply@example.com
UNISENDER_GO_SENDER_NAME=IT-Eco-For-SP
```

`UNISENDER_GO_SENDER_EMAIL` должен быть подтвержденным отправителем в Unisender Go.

---

## 🗄️ Настройка SurrealDB

### Локальная установка

```bash
# Docker
docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start --log debug --user admin --pass admin

# Или через бинарник
surreal start --log debug --user admin --pass admin memory
```

### Переменные для локальной БД:

```bash
SURREAL_HOST=ws://localhost:8000
SURREAL_USER=admin
SURREAL_PASSWORD=admin
SURREAL_NAMESPACE=bcsp
SURREAL_DATABASE=site
```

### Production (удалённый сервер)

```bash
SURREAL_HOST=wss://db.yourdomain.com
SURREAL_USER=admin
SURREAL_PASSWORD=secure_password_here
SURREAL_NAMESPACE=production
SURREAL_DATABASE=site
```

---

## 🤖 RouterAI API

Получите API ключ в личном кабинете RouterAI:

```bash
ROUTERAI_API_KEY=rsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ⏱ Фоновая синхронизация календаря Codeforces

Подробности — в [INTERNAL_JOBS.md](./INTERNAL_JOBS.md).

**Отдельный процесс (рекомендуется):** те же `SURREAL_*` и `ROUTERAI_API_KEY`, что для приложения. Во втором терминале рядом с `npm run dev`:

```bash
npm run cron
```

Опционально своё расписание (выражение `node-cron`):

```bash
CRON_SCHEDULE="*/30 * * * *" npm run cron
```

**Только HTTP** (например Render Cron без второго Node): секрет и URL приложения:

```bash
CRON_SECRET=$(openssl rand -base64 32)
APP_URL=https://your-app.onrender.com
```

Вызов из shell:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "${APP_URL%/}/api/internal/codeforces/sync-calendar"
```

---

## ✅ Проверка настройки

### 1. Проверка переменных окружения

```bash
# Убедитесь, что .env.local существует
ls -la .env.local

# Проверьте, что файл не пустой
cat .env.local | grep -v "^#" | grep -v "^$"
```

### 2. Тест подключения к БД

```bash
npm run dev
# В логах должно быть: [SurrealDB] Подключение успешно установлено
```

### 3. Тест отправки Email

После регистрации нового пользователя проверьте логи:

```
[Email] Письмо отправлено на user@example.com через Unisender Go: <job-id>
```

---

## 🚨 Частые ошибки

### ❌ "Отсутствуют переменные окружения"

**Решение:** Убедитесь, что `.env.local` в корне проекта и все переменные заполнены.

### ❌ "Cannot connect to SurrealDB"

**Решение:**

- Проверьте, запущен ли SurrealDB сервер
- Убедитесь, что `SURREAL_HOST` правильный
- Проверьте логин/пароль

### ❌ "Email отправка не удалась"

**Решение:**

- Убедитесь, что `UNISENDER_GO_API_KEY` заполнен
- Проверьте, что `UNISENDER_GO_SENDER_EMAIL` подтвержден в Unisender Go
- Проверьте, что в Unisender Go разрешена транзакционная отправка через Web API

### ❌ "NEXTAUTH_SECRET не установлен"

**Решение:** Сгенерируйте новый секрет и перезапустите сервер:

```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32) npm run dev
```

---

## 📁 Структура .env файлов

| Файл               | Назначение             | Коммит в Git |
| ------------------ | ---------------------- | ------------ |
| `.env.example`     | Шаблон с примерами     | ✅ Да        |
| `.env.local`       | Локальные переменные   | ❌ Нет       |
| `.env.production`  | Production переменные  | ❌ Нет       |
| `.env.development` | Development переменные | ❌ Нет       |

---

## 🔒 Безопасность

### Никогда не коммитьте:

- ✅ `.env.local`
- ✅ `.env.production`
- ✅ Любой файл `.env*` кроме `.env.example`

### Production checklist:

- [ ] Сгенерировать новый `NEXTAUTH_SECRET`
- [ ] Использовать сложные пароли для БД
- [ ] Настроить подтвержденного отправителя в Unisender Go
- [ ] Ограничить доступ к SurrealDB по IP
- [ ] Использовать secrets manager (Vault, AWS Secrets Manager)

---

## 📚 Дополнительные ресурсы

- [NextAuth.js Documentation](https://next-auth.js.org/configuration/options#secret)
- [Unisender Go Web API](https://godocs.unisender.ru/web-api)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [RouterAI API Documentation](https://routerai.ru/docs)
