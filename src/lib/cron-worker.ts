import cron from 'node-cron';
import axios from 'axios';

// Конфигурация
const API_URL = process.env.CRON_API_URL || 'http://localhost:3000';
const UPDATE_INTERVAL = process.env.CRON_UPDATE_INTERVAL || '0 * * * *'; // Каждый час по умолчанию

// Переменная для предотвращения дублирования задач
let isCronStarted = false;

/**
 * Задача обновления календаря контестов
 */
const runCalendarUpdate = async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n--- [CRON ${timestamp}] Starting Calendar Update ---`);
  
  try {
    // В режиме Next.js (встроенный крон) используем localhost
    // В режиме standalone worker используем CRON_API_URL
    const url = `${API_URL}/api/codeforces/update-calendar`;
    console.log(`[CRON] Calling: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 60000, // 60 секунд таймаут
    });
    
    console.log('[CRON] Success:', response.data);
    console.log(`[CRON] Added: ${response.data.data?.added || 0}, Updated: ${response.data.data?.updated || 0}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Error hitting API:', message);
    
    // Дополнительная информация об ошибке
    if (axios.isAxiosError(error)) {
      console.error('[CRON] Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      });
    }
  }
};

/**
 * Инициализация cron планировщика
 */
export const initCron = () => {
  if (isCronStarted) {
    console.log('[CRON] Already started, skipping initialization');
    return;
  }

  console.log(`[CRON] Initializing with schedule: ${UPDATE_INTERVAL}`);
  console.log(`[CRON] API URL: ${API_URL}`);
  
  // Планируем задачу
  cron.schedule(UPDATE_INTERVAL, runCalendarUpdate, {
    timezone: 'UTC',
  });

  // Запускаем сразу при старте
  console.log('[CRON] Running initial update...\n');
  runCalendarUpdate();

  isCronStarted = true;
  console.log('[CRON] Scheduler initialized successfully\n');
};

/**
 * Остановка cron планировщика
 */
export const stopCron = () => {
  if (!isCronStarted) return;
  cron.getTasks().forEach(task => task.stop());
  isCronStarted = false;
  console.log('[CRON] Scheduler stopped');
};
