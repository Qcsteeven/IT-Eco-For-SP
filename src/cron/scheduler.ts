/**
 * Отдельный Node-процесс: расписание node-cron + прямой вызов syncCodeforcesCalendar.
 * Запуск: `npm run cron` (рядом с `npm run dev` или только на сервере воркера).
 * Не использует HTTP к Next — нагрузка не в том же процессе, что веб.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

import cron from 'node-cron';

import { syncCodeforcesCalendar } from '@/lib/jobs/sync-codeforces-calendar';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function runSync(): Promise<void> {
  console.log('[cron] sync start', new Date().toISOString());
  const result = await syncCodeforcesCalendar();
  if (result.ok) {
    console.log('[cron] ok', {
      scanned: result.scanned,
      synced: result.synced,
      upserted: result.upserted,
      errorCount: result.errorCount,
    });
  } else {
    console.error('[cron] failed', result.error, 'status', result.status);
  }
}

const schedule = process.env.CRON_SCHEDULE?.trim() || '0 * * * *';

if (!cron.validate(schedule)) {
  console.error('[cron] Неверное выражение CRON_SCHEDULE:', schedule);
  process.exit(1);
}

cron.schedule(schedule, () => {
  void runSync();
});

void runSync();

console.log('[cron] Процесс запущен, расписание:', schedule);
