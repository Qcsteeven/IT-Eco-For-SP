This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Docker (рекомендуется)

```bash
# Production
docker compose up app

# Development (с hot-reload)
docker compose up dev
```

См. [README.docker.md](./README.docker.md) для подробной документации.

---

## Cron Worker (Фоновые задачи)

Проект использует изолированный Cron Worker для выполнения периодических задач (обновление календаря контестов, парсинг данных).

### ⚠️ Важно!

Worker **требует** запущенного Next.js сервера и должен запускаться **отдельно**.

### Запуск worker

```bash
# Терминал 1: Запустить Next.js сервер
npm run dev

# Терминал 2: Запустить worker (когда сервер готов)
npm run worker
```

### Docker с worker

```bash
# Запуск app + worker
docker compose up -d app worker

# Просмотр логов worker
docker compose logs -f worker
```

### Документация

Подробная документация доступна в [docs/CRON_WORKER.md](./docs/CRON_WORKER.md)

**Основные возможности:**
- 🕐 Автоматическое обновление календаря Codeforces каждый час
- 🔧 Изолированный процесс (не нагружает основной API)
- 🐳 Поддержка Docker deployment
- 📝 Гибкая настройка расписания через cron

---

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
