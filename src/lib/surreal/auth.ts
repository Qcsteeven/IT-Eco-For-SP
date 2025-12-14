import { getDB } from './surreal';
import * as bcrypt from 'bcrypt';


export interface User {
  id: string;
  email: string;
  password: string; 
  [key: string]: any;
}


type SurrealQueryResult = [User[], ...any[]];


export async function getUserByEmail(email: string): Promise<User | null> {
  console.log(`[DB] Поиск пользователя по email: ${email}`);

  let queryResult: SurrealQueryResult | unknown;

  try {
    const db = await getDB();
    queryResult = await db.query<SurrealQueryResult>('SELECT * FROM users WHERE email = $email', {
      email,
    });
  } catch (error: any) {
    console.error('--- ❌ КРИТИЧЕСКАЯ ОШИБКА DB ---');
    console.error(
      '[DB/ERROR] Ошибка при выполнении запроса к SurrealDB:',
      error.message || String(error),
    );
    return null;
  }

  if (
    !Array.isArray(queryResult) ||
    queryResult.length === 0 ||
    !Array.isArray(queryResult[0])
  ) {
    return null;
  }

  const records = queryResult[0] as User[];

  if (records.length === 0) {
    console.log('[DB] Пользователь не найден.');
    return null;
  }

  const userRecord = records[0];

  
  const idString =
    typeof userRecord.id === 'object'
      ? (userRecord.id as any).toString()
      : String(userRecord.id);

  const finalUser: User = {
    ...userRecord,
    id: idString,
  };

  return finalUser;
}


/**
 * Превращает чистый пароль (напр. "123456") в безопасный хеш.
 * Используйте это перед сохранением пользователя в БД.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 10; 
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  return hash;
}


export async function verifyPassword(inputPassword: string, storedHash: string | undefined | null): Promise<boolean> {
  if (!storedHash) {
    console.log('[AUTH] Хеш пароля отсутствует в БД.');
    return false;
  }

  console.log('[AUTH] Начало проверки хеша bcrypt...');

  
  
  const isMatch = await bcrypt.compare(inputPassword, storedHash);

  console.log(`[AUTH] Результат проверки пароля: ${isMatch ? '✅ Успех' : '❌ Неверно'}`);
  return isMatch;
}