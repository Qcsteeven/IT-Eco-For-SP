# Внутренние фоновые задачи и API

Документ описывает согласованную схему: **веб-процесс Next.js** отдаёт защищённые HTTP-эндпоинты, а **отдельный процесс** (Render Cron, локальный `node-cron` в dev, скрипт `npm run calendar-sync`) вызывает их с секретом, не нагружая пользовательские запросы логикой опроса внешних API.

## Синхронизация календаря Codeforces

| Элемент | Назначение |
|--------|------------|
| [`src/lib/jobs/sync-codeforces-calendar.ts`](../src/lib/jobs/sync-codeforces-calendar.ts) | Общая логика: Codeforces API → эмбеддинги → SurrealDB `contests`. |
| `GET`/`POST` [`/api/internal/codeforces/sync-calendar`](../src/app/api/internal/codeforces/sync-calendar/route.ts) | Единственный HTTP-эндпоинт синхронизации для воркера и cron. |

### Авторизация

Эндпоинт `/api/internal/codeforces/sync-calendar` требует:

- В **production** переменная `CRON_SECRET` обязательна; заголовок `Authorization: Bearer <CRON_SECRET>`.
- В **не-production**, если `CRON_SECRET` не задан — запросы разрешены без заголовка (только для локальной разработки).

### Переменные окружения

| Переменная | Где используется |
|------------|------------------|
| `CRON_SECRET` | Секрет Bearer для воркера и для проверки в route handlers. |
| `APP_URL` / `INTERNAL_API_BASE_URL` / `NEXTAUTH_URL` | Базовый URL приложения: воркер и [`bin/calendar-sync-run.ts`](../bin/calendar-sync-run.ts) строят URL до `/api/internal/codeforces/sync-calendar`. |
| `ROUTERAI_API_KEY` | Эмбеддинги контестов (как и раньше). |

Подробнее см. [ENV_SETUP.md](./ENV_SETUP.md) (раздел про фоновые задачи).

### Локальная разработка

- `npm run dev` поднимает Next.js; в `development` [`src/app/layout.tsx`](../src/app/layout.tsx) вызывает `initCron()` из [`src/lib/cron-worker.ts`](../src/lib/cron-worker.ts), который раз в час дергает внутренний URL (по умолчанию `http://localhost:3000`).
- Если задан `CRON_SECRET`, добавьте его в `.env.local` — тот же секрет подставится в заголовок из cron-worker.

### Render (пример)

1. **Web Service** — обычный Next.js (`npm run build` / `npm start`).
2. **Cron Job** или **Background Worker** — команда `npm run calendar-sync` с env: `APP_URL` (публичный URL веб-сервиса), `CRON_SECRET` (тот же, что у веб-сервиса), при необходимости переменные БД не нужны скрипту: он ходит только по HTTP в уже запущенное приложение.

При необходимости добавьте в репозиторий собственный `render.yaml` под ваш аккаунт (имена сервисов, регион).

## Расширение

Новые тяжёлые джобы: вынести логику в `src/lib/jobs/`, добавить `src/app/api/internal/...` с проверкой [`cron-auth`](../src/lib/internal/cron-auth.ts), не вызывать внешние API из `layout` или пользовательских middleware-путей.
