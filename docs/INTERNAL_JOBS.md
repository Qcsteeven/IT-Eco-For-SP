# Внутренние фоновые задачи и API

Документ описывает согласованную схему: **веб-процесс Next.js** отдаёт защищённые HTTP-эндпоинты, а **внешний планировщик** (Render Cron, другой хостинг с HTTP cron, локальный `node-cron` в dev) дергает URL с секретом. Одноразовые обёртки в репозитории не нужны: достаточно обычного HTTP-клиента (`curl`, встроенный «HTTP request» в панели и т.д.).

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
| `APP_URL` / `INTERNAL_API_BASE_URL` / `NEXTAUTH_URL` | Базовый URL приложения: [`cron-worker`](../src/lib/cron-worker.ts) строит URL до `/api/internal/codeforces/sync-calendar`. |
| `ROUTERAI_API_KEY` | Эмбеддинги контестов (как и раньше). |

Подробнее см. [ENV_SETUP.md](./ENV_SETUP.md) (раздел про фоновые задачи).

### Локальная разработка

- `npm run dev` поднимает Next.js; в `development` [`src/app/layout.tsx`](../src/app/layout.tsx) вызывает `initCron()` из [`src/lib/cron-worker.ts`](../src/lib/cron-worker.ts), который раз в час дергает внутренний URL (по умолчанию `http://localhost:3000`).
- Если задан `CRON_SECRET`, добавьте его в `.env.local` — тот же секрет подставится в заголовок из cron-worker.

### Ручной или внешний вызов (без файлов в репозитории)

Пример одноразового запуска с машины, где есть `curl` (подставьте свой URL и секрет):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "${APP_URL%/}/api/internal/codeforces/sync-calendar"
```

На Render в **Cron Job** можно указать ту же команду (env `APP_URL`, `CRON_SECRET`) или использовать тип задания «HTTP request», если платформа это поддерживает.

## Расширение

Новые тяжёлые джобы: вынести логику в `src/lib/jobs/`, добавить `src/app/api/internal/...` с проверкой [`cron-auth`](../src/lib/internal/cron-auth.ts), не вызывать внешние API из `layout` или пользовательских middleware-путей.
