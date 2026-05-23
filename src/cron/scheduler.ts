/**
 * Отдельный Node-процесс: расписание node-cron + прямой вызов фоновых задач.
 * Запуск: `npm run cron` (рядом с `npm run dev` или только на сервере воркера).
 * Не использует HTTP к Next — нагрузка не в том же процессе, что веб.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

import cron from 'node-cron';

import { syncCodeforcesKarmaForAllUsers } from '@/lib/codeforces/karma-service';
import { syncCodeforcesCalendar } from '@/lib/jobs/sync-codeforces-calendar';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function runCalendarSync(): Promise<void> {
  console.log('[cron] calendar sync start', new Date().toISOString());
  const result = await syncCodeforcesCalendar();
  if (result.ok) {
    console.log('[cron] calendar ok', {
      scanned: result.scanned,
      synced: result.synced,
      upserted: result.upserted,
      errorCount: result.errorCount,
    });
  } else {
    console.error(
      '[cron] calendar failed',
      result.error,
      'status',
      result.status,
    );
  }
}

async function runKarmaSync(): Promise<void> {
  console.log('[cron] karma sync start', new Date().toISOString());
  const result = await syncCodeforcesKarmaForAllUsers();
  console.log(
    result.ok ? '[cron] karma ok' : '[cron] karma completed with errors',
    {
      scanned: result.scanned,
      synced: result.synced,
      skipped: result.skipped,
      failed: result.failed,
      errorCount: result.errors.length,
    },
  );
}

const calendarSchedule = process.env.CRON_SCHEDULE?.trim() || '0 * * * *';
const karmaSchedule = process.env.KARMA_CRON_SCHEDULE?.trim() || '0 */12 * * *';

if (!cron.validate(calendarSchedule)) {
  console.error('[cron] Неверное выражение CRON_SCHEDULE:', calendarSchedule);
  process.exit(1);
}

if (!cron.validate(karmaSchedule)) {
  console.error(
    '[cron] Неверное выражение KARMA_CRON_SCHEDULE:',
    karmaSchedule,
  );
  process.exit(1);
}

cron.schedule(calendarSchedule, () => {
  void runCalendarSync();
});

cron.schedule(karmaSchedule, () => {
  void runKarmaSync();
});

void runCalendarSync();
void runKarmaSync();

console.log('[cron] Процесс запущен, расписание:', {
  calendarSchedule,
  karmaSchedule,
});
