# Внутренние фоновые задачи и API

## Синхронизация календаря Codeforces

| Элемент | Назначение |
|--------|------------|
| [`src/lib/jobs/sync-codeforces-calendar.ts`](../src/lib/jobs/sync-codeforces-calendar.ts) | Общая логика: Codeforces API → эмбеддинги → SurrealDB `contests`. |
| [`src/cron/scheduler.ts`](../src/cron/scheduler.ts) | Отдельный процесс `npm run cron`: `node-cron` + **прямой** вызов `syncCodeforcesCalendar()` (без HTTP к Next). |
| `GET`/`POST` [`/api/internal/codeforces/sync-calendar`](../src/app/api/internal/codeforces/sync-calendar/route.ts) | HTTP-эндпоинт для внешнего планировщика (Render Cron с `curl`, другой хост). |

### Два способа запуска по расписанию

1. **Отдельный воркер (`npm run cron`)** — рекомендуется локально и как второй сервис на Render: свой процесс Node, те же переменные `SURREAL_*` и `ROUTERAI_API_KEY`, что у приложения. `CRON_SECRET` для этого пути **не нужен** (доверие к процессу с доступом к env).

2. **HTTP** — если удобнее один деплой и вызов по URL: `curl` или встроенный HTTP-cron с `Authorization: Bearer $CRON_SECRET` (см. ниже).

### Авторизация (только для HTTP-эндпоинта)

`/api/internal/codeforces/sync-calendar` требует:

- В **production** переменная `CRON_SECRET` обязательна; заголовок `Authorization: Bearer <CRON_SECRET>`.
- В **не-production**, если `CRON_SECRET` не задан — запросы разрешены без заголовка (только для локальной разработки).

### Переменные окружения

| Переменная | Где используется |
|------------|------------------|
| `CRON_SECRET` | Только для **HTTP**-вызова внутреннего эндпоинта. |
| `CRON_SCHEDULE` | Опционально для `npm run cron` (cron-выражение, по умолчанию `0 * * * *`). |
| `SURREAL_*`, `ROUTERAI_API_KEY` | И веб, и `npm run cron` (прямой sync). |
| `APP_URL` и т.п. | Только если дергаете sync **по HTTP** (`curl` и т.д.). |

Подробнее см. [ENV_SETUP.md](./ENV_SETUP.md).

### Локальная разработка

- Терминал 1: `npm run dev` — только веб, без фонового крона внутри Next.
- Терминал 2: `npm run cron` — отдельный процесс, раз в час (или по `CRON_SCHEDULE`) синхронизирует календарь.

### Ручной HTTP-вызов

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "${APP_URL%/}/api/internal/codeforces/sync-calendar"
```

## Расширение

Новые тяжёлые джобы: вынести логику в `src/lib/jobs/`, добавить задачу в [`src/cron/scheduler.ts`](../src/cron/scheduler.ts) и/или `src/app/api/internal/...` с [`cron-auth`](../src/lib/internal/cron-auth.ts).
