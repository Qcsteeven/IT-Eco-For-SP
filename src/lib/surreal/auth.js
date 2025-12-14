// src/lib/surreal/auth.js

import { getDB } from './surreal'; 
// import bcrypt from 'bcryptjs'; // Раскомментируйте, когда будете использовать хеширование

export async function getUserByEmail(email) {
    console.log(`[DB] Поиск пользователя по email: ${email}`);
    
    let queryResult;
    try {
        const db = await getDB();
        queryResult = await db.query('SELECT * FROM users WHERE email = $email', { email });
        
    } catch (error) {
        console.error("--- ❌ КРИТИЧЕСКАЯ ОШИБКА DB ---");
        console.error("[DB/ERROR] Ошибка при выполнении запроса к SurrealDB:", error.message || error);
        console.error("--------------------------------");
        return null; 
    }

    console.log("[DB] Результат db.query (JSON):", JSON.stringify(queryResult, null, 2));

    // 1. ПРОВЕРКА И КОРРЕКЦИЯ СТРУКТУРЫ ОТВЕТА
    
    // Ожидаемая структура: [ [ { user data } ] ]
    // Проверяем, что результат — это массив, и что его первый элемент — это массив.
    if (!Array.isArray(queryResult) || queryResult.length === 0 || !Array.isArray(queryResult[0])) {
        console.error("[DB] Неверный формат ответа от БД. Ожидается массив.");
        return null;
    }
    
    // Так как [result] = queryResult не сработало, мы берем первый элемент (который является массивом)
    const records = queryResult[0]; // records = [ { user data } ]
    
    console.log(`[DB] Найдено записей: ${records.length}`);

    if (records.length === 0) {
        console.log("[DB] Пользователь с таким email не найден в таблице.");
        return null; 
    }

    // 2. Получаем запись пользователя
    const userRecord = records[0]; 

    if (userRecord) {
        // Преобразуем ID в строку
        const idString = typeof userRecord.id === 'object' ? userRecord.id.toString() : userRecord.id;

        const finalUser = {
            ...userRecord,
            id: idString
        };
        
        console.log("[DB] Пользователь успешно загружен (email):", finalUser.email);
        
        return finalUser;
    }
    
    return null;
}

// Функции verifyPassword оставляем как есть, так как ошибка 401 показвае, 
// что проблема не дошла до этой функции.
// ... (verifyPassword)
export async function verifyPassword(inputPassword, storedHash) {
    if (!storedHash) {
        console.log("[AUTH] Хеш пароля отсутствует.");
        return false;
    }
    
    console.log(`[AUTH] Сравнение паролей. Ввод: ${inputPassword}, Хеш в DB: ${storedHash}`);
    
    // В ПРОДАКШЕНЕ: return await bcrypt.compare(inputPassword, storedHash);
    const isMatch = inputPassword === storedHash;
    
    console.log(`[AUTH] Пароль совпал: ${isMatch}`);
    return isMatch; 
}