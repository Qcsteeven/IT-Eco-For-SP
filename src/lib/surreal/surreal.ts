import Surreal from "surrealdb";

let db: Surreal | null = null;

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

export async function getDB() {
  if (!db) {
    validateEnv();
    
    db = new Surreal();

    // Подключаемся к серверу (HTTP или WS)
    const host = process.env.SURREAL_HOST;
    await db.connect(host);

    // Авторизация
    await db.signin({
      username: process.env.SURREAL_USER,
      password: process.env.SURREAL_PASSWORD,
    });

    // Выбираем namespace и database
    await db.use({
      namespace: process.env.SURREAL_NAMESPACE,
      database: process.env.SURREAL_DATABASE,
    });
    
    console.log('[SurrealDB] Подключение успешно установлено');
  }
  return db;
}
