/**
 * Cron Worker - изолированный процесс для фоновых задач
 * 
 * Запуск:
 *   npm run worker              # development режим
 *   npm run worker:prod         # production режим
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import axios from 'axios';

// Загружаем .env.local (для локальной разработки)
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// Конфигурация
const API_URL = process.env.CRON_API_URL || 'http://localhost:3000';
const UPDATE_INTERVAL = process.env.CRON_UPDATE_INTERVAL || '0 * * * *';

console.log('🕐 Cron Worker Process Starting...');
console.log('=====================================');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`API URL: ${API_URL}`);
console.log(`Update Interval: ${UPDATE_INTERVAL}`);
console.log('=====================================\n');

let isCronStarted = false;

const runCalendarUpdate = async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n--- [CRON ${timestamp}] Starting Calendar Update ---`);
  
  try {
    const url = `${API_URL}/api/codeforces/update-calendar`;
    console.log(`[CRON] Calling: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 60000,
    });
    
    console.log('[CRON] Success:', response.data);
    console.log(`[CRON] Added: ${response.data.data?.added || 0}, Updated: ${response.data.data?.updated || 0}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON] Error hitting API:', message);
    
    if (axios.isAxiosError(error)) {
      console.error('[CRON] Axios error details:', {
        status: error.response?.status,
        data: error.response?.data,
        code: error.code,
      });
    }
  }
};

const initCron = () => {
  if (isCronStarted) return;

  console.log(`[CRON] Initializing with schedule: ${UPDATE_INTERVAL}`);
  
  cron.schedule(UPDATE_INTERVAL, runCalendarUpdate, {
    timezone: 'UTC',
  });

  console.log('[CRON] Running initial update...\n');
  runCalendarUpdate();

  isCronStarted = true;
  console.log('[CRON] Scheduler initialized successfully\n');
};

const stopCron = () => {
  if (!isCronStarted) return;
  cron.getTasks().forEach(task => task.stop());
  isCronStarted = false;
  console.log('[CRON] Scheduler stopped');
};

// Инициализация
initCron();

// Обработка сигналов для graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[CRON WORKER] Received SIGINT, shutting down gracefully...');
  stopCron();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[CRON WORKER] Received SIGTERM, shutting down gracefully...');
  stopCron();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('✅ Cron Worker is running. Press Ctrl+C to stop.\n');
