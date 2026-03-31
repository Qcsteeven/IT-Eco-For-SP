import Surreal from "surrealdb";

let db: Surreal | null = null;
let isConnecting = false;
let connectionAttempts = 0;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Проверка необходимых переменных окружения
function validateEnv() {
  const required = ['SURREAL_HOST', 'SURREAL_USER', 'SURREAL_PASSWORD', 'SURREAL_NAMESPACE', 'SURREAL_DATABASE'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Отсутствуют переменные окружения: ${missing.join(', ')}. ` +
      `Проверьте файл .env.local`
    );
  }
}

// Задержка для retry
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Попытка подключения с retry логикой
async function connectWithRetry(): Promise<Surreal> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[SurrealDB] Попытка подключения ${attempt}/${MAX_RETRIES}...`);

      const newDb = new Surreal();
      const host = process.env.SURREAL_HOST!;

      await newDb.connect(host);

      await newDb.signin({
        username: process.env.SURREAL_USER!,
        password: process.env.SURREAL_PASSWORD!,
      });

      await newDb.use({
        namespace: process.env.SURREAL_NAMESPACE!,
        database: process.env.SURREAL_DATABASE!,
      });

      console.log('[SurrealDB] Подключение успешно установлено');
      return newDb;
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[SurrealDB] Ошибка подключения (попытка ${attempt}):`, errorMessage);

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * attempt); // Exponential backoff
      }
    }
  }

  throw new Error(
    `[SurrealDB] Не удалось подключиться после ${MAX_RETRIES} попыток. ` +
    `Последняя ошибка: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export async function getDB() {
  if (!db) {
    if (isConnecting) {
      // Ждем завершения существующего подключения
      await delay(100);
      if (db) return db;
    }

    isConnecting = true;

    try {
      validateEnv();
      db = await connectWithRetry();
      connectionAttempts = 0;
      return db;
    } catch (error) {
      connectionAttempts++;
      throw error;
    } finally {
      isConnecting = false;
    }
  }
  return db;
}

// Функция для выполнения запроса с retry
export async function queryWithRetry<T extends unknown[]>(
  query: string,
  variables?: Record<string, unknown>,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const database = await getDB();
      return await database.query<T>(query, variables);
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[SurrealDB] Ошибка запроса (попытка ${attempt}):`, errorMessage);

      if (attempt < retries) {
        await delay(RETRY_DELAY_MS * attempt);
        // Пробуем переподключиться
        db = null;
      }
    }
  }

  throw new Error(
    `[SurrealDB] Не удалось выполнить запрос после ${retries} попыток. ` +
    `Последняя ошибка: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

// Функция для сброса подключения (для обработки ошибок)
export async function resetConnection(): Promise<void> {
  if (db) {
    try {
      await db.close();
    } catch (error) {
      console.warn('[SurrealDB] Ошибка при закрытии соединения:', error);
    }
    db = null;
  }
}
