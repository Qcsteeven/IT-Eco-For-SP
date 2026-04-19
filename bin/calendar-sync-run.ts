/**
 * Одноразовый запуск синхронизации календаря Codeforces по HTTP.
 * Для Render Cron / Background Worker: задайте APP_URL (или INTERNAL_API_BASE_URL) и CRON_SECRET.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const base =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (!base) {
    console.error(
      'Задайте APP_URL, INTERNAL_API_BASE_URL или NEXTAUTH_URL — базовый URL развёрнутого приложения.',
    );
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, '')}/api/internal/codeforces/sync-calendar`;
  const secret = process.env.CRON_SECRET?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = text;
  }

  if (!res.ok) {
    console.error('[calendar-sync]', res.status, body);
    process.exit(1);
  }

  console.log('[calendar-sync] ok', body);
}

main().catch((e) => {
  console.error('[calendar-sync]', e);
  process.exit(1);
});
