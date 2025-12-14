import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { hashPassword } from '@/lib/surreal/auth';
import { sendEmail } from '@/lib/email/sendEmail';
import crypto from 'crypto';
import { Surreal } from 'surrealdb';

interface RegistrationRequestBody {
  email: string;
  password: string;
  full_name: string;
}

interface UserRecord {
  email: string;
  password_hash: string;
  full_name: string;
  phone: string;
  is_verified: boolean;
  verification_code: string;
  code_expiry: Date;
  registration_date: Date;
  role: 'user' | 'admin';

  [key: string]: any;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name }: RegistrationRequestBody =
      await request.json();
    const db: Surreal = await getDB();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { message: 'Заполните все обязательные поля.' },
        { status: 400 },
      );
    }

    const queryResult: any = await db.query(
      'SELECT id FROM users WHERE email = $email',
      { email },
    );

    const existingUsersArray = queryResult?.[0]?.result || [];

    if (existingUsersArray.length > 0) {
      return NextResponse.json(
        {
          message: 'Пользователь с таким email уже существует.',
        },
        { status: 409 },
      );
    }

    const verificationCode: string = crypto
      .randomInt(100000, 999999)
      .toString();
    const expiryTime: Date = new Date(Date.now() + 3600000);

    const passwordHash: string = await hashPassword(password);

    const newUserRecord: UserRecord = {
      email,
      password_hash: passwordHash,
      full_name,
      phone: '',
      is_verified: false,
      verification_code: verificationCode,
      code_expiry: expiryTime,
      registration_date: new Date(),
      role: 'user',
    };

    await db.create('users', newUserRecord);

    const subject: string = 'Код подтверждения регистрации';
    const htmlContent: string = `
      <p>Здравствуйте, ${full_name}!</p>
      <p>Ваш **код подтверждения** для завершения активации аккаунта:</p>
      <h3 style="color: #4CAF50; font-size: 24px; text-align: center; background-color: #e8ffe8; padding: 10px; border-radius: 5px;">${verificationCode}</h3>
      <p>Код действует в течение одного часа. Пожалуйста, не передавайте его никому.</p>
    `;

    const emailSent: boolean = await sendEmail(
      email,
      subject,
      `Ваш код подтверждения: ${verificationCode}`,
      htmlContent,
    );

    if (!emailSent) {
      console.warn(
        `[WARNING] Регистрация успешна, но не удалось отправить письмо на ${email}.`,
      );
    }

    return NextResponse.json(
      {
        message: 'Пользователь создан. Требуется подтверждение email.',
        email: email,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Ошибка регистрации API:', error);

    const errorMessage = error.message || String(error);
    const isDuplicateError =
      errorMessage.includes('Database index `unique_email`') ||
      errorMessage.includes('constraint failed on table users');

    if (isDuplicateError) {
      return NextResponse.json(
        {
          message: 'Пользователь с таким email уже существует.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: 'Внутренняя ошибка сервера при регистрации.',
        detail: errorMessage,
      },
      { status: 500 },
    );
  }
}
