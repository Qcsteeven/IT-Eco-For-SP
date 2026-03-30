# Настройка окружения IT-Eco-For-SP

## 📋 Быстрый старт

### 1. Скопируйте файл переменных окружения

```bash
cp .env.example .env.local
```

### 2. Заполните обязательные переменные

**Минимальный набор для запуска:**

```bash
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

```bash
npm install
npm run dev
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

## 📧 Настройка Email (Nodemailer)

### Gmail

1. Включите двухфакторную аутентификацию
2. Создайте App Password: https://myaccount.google.com/apppasswords
3. Заполните в `.env.local`:

```bash
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_char_app_password
```

### Yandex

1. Создайте пароль для внешних приложений: https://passport.yandex.ru/profile
2. Заполните:

```bash
EMAIL_SERVICE=yandex
EMAIL_USER=your_email@yandex.ru
EMAIL_PASS=your_app_password
```

### Custom SMTP

```bash
EMAIL_SERVICE=custom
EMAIL_SMTP_HOST=smtp.yourdomain.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_USER=your_email@yourdomain.com
EMAIL_PASS=your_password
```

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
[Email] Письмо отправлено на user@example.com: <message-id>
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
- Для Gmail используйте App Password, а не основной пароль
- Проверьте, что 2FA включён в аккаунте Google
- Убедитесь, что `EMAIL_USER` и `EMAIL_PASS` заполнены

### ❌ "NEXTAUTH_SECRET не установлен"

**Решение:** Сгенерируйте новый секрет и перезапустите сервер:
```bash
NEXTAUTH_SECRET=$(openssl rand -base64 32) npm run dev
```

---

## 📁 Структура .env файлов

| Файл | Назначение | Коммит в Git |
|------|-----------|--------------|
| `.env.example` | Шаблон с примерами | ✅ Да |
| `.env.local` | Локальные переменные | ❌ Нет |
| `.env.production` | Production переменные | ❌ Нет |
| `.env.development` | Development переменные | ❌ Нет |

---

## 🔒 Безопасность

### Никогда не коммитьте:
- ✅ `.env.local`
- ✅ `.env.production`
- ✅ Любой файл `.env*` кроме `.env.example`

### Production checklist:
- [ ] Сгенерировать новый `NEXTAUTH_SECRET`
- [ ] Использовать сложные пароли для БД
- [ ] Настроить HTTPS для SMTP
- [ ] Ограничить доступ к SurrealDB по IP
- [ ] Использовать secrets manager (Vault, AWS Secrets Manager)

---

## 📚 Дополнительные ресурсы

- [NextAuth.js Documentation](https://next-auth.js.org/configuration/options#secret)
- [Nodemailer Documentation](https://nodemailer.com/)
- [SurrealDB Documentation](https://surrealdb.com/docs)
- [RouterAI API Documentation](https://routerai.ru/docs)
