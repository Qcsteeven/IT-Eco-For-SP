// src/app/api/register/route.js

import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal'; 
import { sendEmail } from '@/lib/email/sendEmail'; // 👈 ИМПОРТ ДЛЯ ОТПРАВКИ ПИСЬМА
import crypto from 'crypto'; // 👈 ИМПОРТ ДЛЯ ГЕНЕРАЦИИ КОДА
// import bcrypt from 'bcryptjs';

export async function POST(request) {
 try {
  const { email, password, full_name } = await request.json();
  const db = await getDB();
  
  // --- 1. ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ ПОЛЕЙ ---
  if (!email || !password || !full_name) {
    return NextResponse.json({ message: 'Заполните все поля.' }, { status: 400 });
  }

  // --- 2. ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА СУЩЕСТВОВАНИЯ ---
  const queryResult = await db.query('SELECT id FROM users WHERE email = $email', { email });
  const existingUsersArray = queryResult?.[0]?.result || []; 
  
  if (existingUsersArray.length > 0) {
   return NextResponse.json({ 
    message: 'Пользователь с таким email уже существует.', 
   }, { status: 409 });
  }

    // 🚀 НОВЫЙ ШАГ: ГЕНЕРАЦИЯ КОДА ВЕРИФИКАЦИИ
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiryTime = new Date(Date.now() + 3600000); // Срок действия: 1 час

  // --- 3. БЕЗОПАСНОСТЬ: ХЕШИРОВАНИЕ ---
  // ВАЖНО: В РЕАЛЬНОМ ПРОЕКТЕ ИСПОЛЬЗУЙТЕ bcrypt!
  const passwordHash = `UNSAFE_HASH_${password}`; 

  // --- 4. СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ В SURREALDB (С КОДОМ ВЕРИФИКАЦИИ) ---
  await db.create('users', {
   email,
   password_hash: passwordHash,
   full_name,
   phone: '', 
      // 👈 ПОЛЯ ДЛЯ ВЕРИФИКАЦИИ
      is_verified: false,
      verification_code: verificationCode,
      code_expiry: expiryTime,
   registration_date: new Date(),
   role: 'user', 
  });

    // 🚀 НОВЫЙ ШАГ: ОТПРАВКА ПИСЬМА ПОДТВЕРЖДЕНИЯ
    const subject = 'Код подтверждения регистрации';
    const htmlContent = `
      <p>Здравствуйте, ${full_name}!</p>
      <p>Ваш **код подтверждения** для завершения активации аккаунта:</p>
      <h3 style="color: #4CAF50; font-size: 24px; text-align: center; background-color: #e8ffe8; padding: 10px; border-radius: 5px;">${verificationCode}</h3>
      <p>Код действует в течение одного часа.</p>
    `;

    // Вызываем нашу утилиту sendEmail
    const emailSent = await sendEmail(
      email,
      subject,
      `Ваш код подтверждения: ${verificationCode}`,
      htmlContent
    );

    if (!emailSent) {
        // Логируем ошибку, но даем клиенту ответ 201, так как аккаунт создан.
        // Пользователь может запросить код повторно позже.
        console.warn(`[WARNING] Регистрация успешна, но не удалось отправить письмо на ${email}.`);
    }

  // --- 5. УСПЕШНЫЙ ОТВЕТ КЛИЕНТУ ---
  return NextResponse.json({ 
        message: 'Пользователь создан. Требуется подтверждение email.', 
        email: email // Возвращаем email для перенаправления
    }, { status: 201 });
  
 } catch (error) {
  
  console.error('Ошибка регистрации API:', error);
  
  // --- 6. ОБРАБОТКА ОШИБКИ УНИКАЛЬНОСТИ ---
  const isDuplicateError = error.message.includes('Database index `unique_email`');
  
  if (isDuplicateError) {
   return NextResponse.json({ 
    message: 'Пользователь с таким email уже существует.', 
   }, { status: 409 });
  }
  
  // --- 7. ОБРАБОТКА ПРОЧИХ ОШИБОК ---
  return NextResponse.json({ 
    message: 'Внутренняя ошибка сервера при регистрации.', 
    detail: error.message 
  }, { status: 500 });
 }
}