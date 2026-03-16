import cron from 'node-cron';
import axios from 'axios';

// Переменная для предотвращения дублирования задач при перезагрузке dev-сервера
let isCronStarted = false;

const runCalendarUpdate = async () => {
  console.log('--- [CRON] Starting Calendar Update ---');
  try {
    // Вызываем твой же API эндпоинт локально
    // Важно: в dev режиме порт обычно 3000
    const response = await axios.get(
      'http://localhost:3000/api/codeforces/update-calendar',
    );
    console.log('[CRON] Success:', response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Error hitting API:', message);
  }
};

export const initCron = () => {
  if (isCronStarted) return;

  // Расписание: каждый час (0 * * * *)
  cron.schedule('0 * * * *', runCalendarUpdate);

  // Запускаем задачу сразу после старта сервера
  runCalendarUpdate();

  isCronStarted = true;
  console.log('[CRON] Scheduler initialized');
};
