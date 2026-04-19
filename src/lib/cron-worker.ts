import cron from 'node-cron';
import axios from 'axios';

let isCronStarted = false;

function syncBaseUrl(): string {
  const raw =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function calendarSyncPath(): string {
  return `${syncBaseUrl()}/api/internal/codeforces/sync-calendar`;
}

const runCalendarUpdate = async () => {
  console.log('--- [CRON] Starting Calendar Update (internal) ---');
  try {
    const url = calendarSyncPath();
    const secret = process.env.CRON_SECRET?.trim();
    const headers: Record<string, string> = {};
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
    }
    const response = await axios.get(url, { headers, validateStatus: () => true });
    if (response.status >= 400) {
      console.error('[CRON] HTTP', response.status, response.data);
      return;
    }
    console.log('[CRON] Success:', response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Error hitting API:', message);
  }
};

export const initCron = () => {
  if (isCronStarted) return;

  cron.schedule('0 * * * *', runCalendarUpdate);

  runCalendarUpdate();

  isCronStarted = true;
  console.log('[CRON] Scheduler initialized →', calendarSyncPath());
};
