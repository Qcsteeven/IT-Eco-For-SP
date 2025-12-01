import Surreal from "surrealdb";

let db: Surreal | null = null;

export async function getDB() {
  if (!db) {
    db = new Surreal();

    // Подключаемся к серверу (HTTP или WS)
    await db.connect("ws://45.149.234.80:8000");

    // Авторизация
    await db.signin({
      username: "admin",   // логин
      password: "...",  // пароль
    });

    // Выбираем namespace и database
    await db.use({
      namespace: "test",   // namespace
      database: "test",    // database
    });
  }
  return db;
}
