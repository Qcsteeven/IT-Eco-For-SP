// src/app/api/resend-code/route.js

import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal'; // Предполагается, что это ваш модуль для SurrealDB
import { sendEmail } from '@/lib/email/sendEmail'; // Предполагается, что это ваш модуль для отправки почты
import crypto from 'crypto'; 

export async function POST(request) {
    try {
        const { email } = await request.json();
        const db = await getDB();

        // 1. Проверка наличия email
        if (!email) {
            return NextResponse.json({ message: 'Email обязателен.' }, { status: 400 });
        }

        const searchEmail = email.toLowerCase(); // Лучшая практика: работаем с нижним регистром

        // --- 2. Поиск пользователя ---
        // Ищем по email, чтобы получить ID и статус верификации
        const queryResult = await db.query(
            'SELECT id, full_name, is_verified FROM users WHERE email = $email', 
            { email: searchEmail }
        );
        
        // Используем безопасную распаковку результата SurrealDB:
        const user = queryResult?.[0]?.result?.[0]; 

        if (!user) {
            // Пользователь не найден, вероятно, email был введен неверно или регистрация не завершена.
            return NextResponse.json({ message: 'Пользователь не найден.' }, { status: 404 });
        }
        
        if (user.is_verified) {
            // Если email уже подтвержден, нет смысла отправлять код
            return NextResponse.json({ message: 'Email уже подтвержден. Вы можете войти.' }, { status: 400 });
        }

        // --- 3. Генерация нового кода ---
        const newVerificationCode = crypto.randomInt(100000, 999999).toString();
        // Устанавливаем срок действия: 1 час (3600000 миллисекунд)
        const newExpiryTime = new Date(Date.now() + 3600000); 

        // --- 4. Обновление пользователя в БД ---
        // Обновляем код и срок его действия
        await db.query(
            `UPDATE $id SET verification_code = $code, code_expiry = $expiry`,
            { id: user.id, code: newVerificationCode, expiry: newExpiryTime }
        );

        // --- 5. Отправка нового письма ---
        const subject = 'Новый код подтверждения регистрации';
        const htmlContent = `
          <p>Здравствуйте, ${user.full_name || 'пользователь'}!</p>
          <p>Вы запросили новый **код подтверждения**:</p>
          <h3 style="color: #FF5722; font-size: 24px; text-align: center; background-color: #fff0e8; padding: 10px; border-radius: 5px;">${newVerificationCode}</h3>
          <p>Код действует в течение одного часа. Пожалуйста, введите его на странице подтверждения.</p>
        `;

        const emailSent = await sendEmail(
            searchEmail, // Используем приведенный к нижнему регистру email
            subject,
            `Ваш новый код подтверждения: ${newVerificationCode}`,
            htmlContent
        );

        if (!emailSent) {
            console.warn(`[WARNING] Код обновлен, но не удалось отправить письмо на ${searchEmail}.`);
        }

        // --- 6. Успешный ответ ---
        return NextResponse.json({ message: 'Новый код отправлен.' }, { status: 200 });

    } catch (error) {
        console.error('Ошибка API повторной отправки кода:', error);
        // Внутренняя ошибка сервера
        return NextResponse.json({ 
            message: 'Внутренняя ошибка сервера при повторной отправке кода.', 
            detail: error.message 
        }, { status: 500 });
    }
}