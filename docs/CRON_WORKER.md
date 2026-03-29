# Cron Worker Documentation

## Overview

Cron Worker — это изолированный фоновый процесс для выполнения периодических задач (обновление календаря контестов, парсинг данных и т.д.). Выделение в отдельный процесс позволяет:

- **Снизить нагрузку на основной API** — фоновые задачи выполняются независимо
- **Масштабировать независимо** — можно запускать несколько воркеров
- **Упростить мониторинг** — отдельные логи и метрики для фоновых задач
- **Избежать проблем в production** — на платформах типа Vercel cron работает через external triggers

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cron Worker   │────>│  Next.js API     │────>│   SurrealDB     │
│  (isolated)     │     │  Endpoint        │     │   Database      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │  Schedule:            │  GET /api/codeforces/
        │  Every hour           │  update-calendar
        │  (0 * * * *)          │
```

## Files Structure

```
src/
├── lib/
│   └── cron-worker.ts       # Основная логика cron задач
├── worker/
│   └── cron-worker.ts       # Entry point для запуска worker
└── app/
    └── api/
        └── codeforces/
            └── update-calendar/
                └── route.ts  # API endpoint для обновления календаря
```

## Local Development

### Option 1: Run worker separately

```bash
# Terminal 1 - Run Next.js dev server
npm run dev

# Terminal 2 - Run cron worker
npm run worker
```

### Option 2: Run both together

```bash
# Run both dev server and worker in one command
npm run dev:all
```

### Option 3: Built-in cron (development only)

В режиме разработки cron автоматически запускается в `layout.tsx`:

```typescript
if (process.env.NODE_ENV === 'development') {
  initCron();
}
```

**Note:** Этот подход не рекомендуется для production.

## Docker Deployment

### Build and run with worker

```bash
# Build all services
docker compose build

# Run app + worker
docker compose up -d app worker

# View worker logs
docker compose logs -f worker
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_API_URL` | `http://localhost:3000` | URL API для вызова endpoints |
| `CRON_UPDATE_INTERVAL` | `0 * * * *` | Cron schedule (каждый час) |
| `NODE_ENV` | `production` | Режим работы |

### Docker Compose Services

```yaml
services:
  app:    # Main Next.js application
  worker: # Cron worker (isolated)
  dev:    # Development with hot reload
```

## Cron Schedule Format

Standard cron format: `Minute Hour Day Month Weekday`

Examples:
- `0 * * * *` — каждый час (в 00 минут)
- `0 */2 * * *` — каждые 2 часа
- `0 0 * * *` — каждый день в полночь
- `0 0 * * 1` — каждый понедельник в полночь
- `*/15 * * * *` — каждые 15 минут

## Available Tasks

### Calendar Update (Codeforces)

**Schedule:** Every hour (`0 * * * *`)

**What it does:**
1. Fetches contest list from Codeforces API
2. Filters relevant contests (CF, ICPC types, last 2 years + future)
3. Updates/inserts contests into SurrealDB
4. Generates embeddings for AI search

**Endpoint:** `GET /api/codeforces/update-calendar`

**Response:**
```json
{
  "ok": true,
  "message": "Calendar updated successfully",
  "data": {
    "added": 5,
    "updated": 10,
    "total": 15
  }
}
```

## Adding New Tasks

### Step 1: Create API endpoint

```typescript
// src/app/api/my-task/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Your task logic here
  return NextResponse.json({ ok: true });
}
```

### Step 2: Add cron job

```typescript
// src/lib/cron-worker.ts
const runMyTask = async () => {
  console.log('[CRON] Running my task...');
  const response = await axios.get(`${API_URL}/api/my-task`);
  console.log('[CRON] Task completed:', response.data);
};

export const initCron = () => {
  // ...existing code...
  cron.schedule('0 0 * * *', runMyTask); // Daily at midnight
};
```

### Step 3: Update documentation

Add your task to this README with description and schedule.

## Monitoring & Debugging

### View logs

```bash
# Docker worker logs
docker compose logs -f worker

# Local worker logs
npm run worker
```

### Manual trigger

```bash
# Call the endpoint directly
curl http://localhost:3000/api/codeforces/update-calendar
```

### Health check

Worker считается здоровым, если:
- Процесс запущен (PID существует)
- В логах нет ошибок за последний интервал
- Задачи выполняются по расписанию

## Graceful Shutdown

Worker корректно обрабатывает сигналы завершения:

```bash
# Send SIGTERM
docker compose stop worker

# Or Ctrl+C in terminal
```

Логи при остановке:
```
[CRON WORKER] Received SIGTERM, shutting down gracefully...
[CRON] Scheduler stopped
```

## Production Considerations

### For Vercel/Serverless

Vercel не поддерживает долгоживущие процессы. Используйте:

1. **Vercel Cron Jobs** (платно)
2. **GitHub Actions** с расписанием
3. **External cron services** (cron-job.org, EasyCron)
4. **Separate worker server** (этот проект)

### For Docker/VM

- Запускайте worker как отдельный сервис
- Настройте restart policy (`unless-stopped`)
- Используйте health checks
- Настройте логирование в файл или syslog

### Rate Limiting

Codeforces API имеет лимиты:
- Не делайте запросы чаще раза в 5 минут
- Кэшируйте результаты при возможности
- Обрабатывайте ошибки 429 (Too Many Requests)

## Troubleshooting

### Worker не запускается

```bash
# Check if port 3000 is available
netstat -ano | findstr :3000

# Check environment variables
echo $CRON_API_URL
```

### Задачи не выполняются

1. Проверьте логи worker
2. Убедитесь, что API доступен
3. Проверьте подключение к SurrealDB

### Ошибки Codeforces API

- **429 Too Many Requests** — уменьшите частоту запросов
- **503 Service Unavailable** — Codeforces недоступен, повторится позже
- **NOT_FOUND** — пользователь/контест не найден

## Security Notes

- Не коммитьте `.env` файлы с API ключами
- Используйте `.env.example` для документации переменных
- Ограничьте доступ к worker endpoint извне (firewall)
