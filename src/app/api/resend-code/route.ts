import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { sendEmail } from '@/lib/email/sendEmail';
import crypto from 'crypto';
import type { Surreal } from 'surrealdb';

interface RequestBody {
  email: string;
}

interface UserVerificationRecord {
  id: string;
  full_name?: string;
  is_verified: boolean;
}

type SurrealQueryResult = [
  {
    status: 'OK';
    result: UserVerificationRecord[];
  },
  ...any[],
];

export async function POST(request: NextRequest) {
  try {
    const { email }: RequestBody = await request.json();
    const db: Surreal = await getDB();

    if (!email) {
      return NextResponse.json(
        { message: 'Email обязателен.' },
        { status: 400 },
      );
    }

    const searchEmail: string = email.toLowerCase();

    const queryResult: SurrealQueryResult | unknown = await db.query(
      'SELECT id, full_name, is_verified FROM users WHERE email = $email',
      { email: searchEmail },
    );

    const results = (queryResult as SurrealQueryResult)?.[0]?.result;

    const user: UserVerificationRecord | undefined = results?.[0];

    if (!user) {
      return NextResponse.json(
        { message: 'Пользователь не найден.' },
        { status: 404 },
      );
    }

    if (user.is_verified) {
      return NextResponse.json(
        { message: 'Email уже подтвержден. Вы можете войти.' },
        { status: 400 },
      );
    }

    const newVerificationCode: string = crypto
      .randomInt(100000, 999999)
      .toString();

    const newExpiryTime: Date = new Date(Date.now() + 3600000);

    await db.query(
      `UPDATE $id SET verification_code = $code, code_expiry = $expiry`,
      { id: user.id, code: newVerificationCode, expiry: newExpiryTime },
    );

    const subject: string = 'Новый код подтверждения регистрации';
    const userName: string = user.full_name || 'пользователь';

    const htmlContent: string = `
            <p>Здравствуйте, ${userName}!</p>
            <p>Вы запросили новый **код подтверждения**:</p>
            <h3 style="color: #FF5722; font-size: 24px; text-align: center; background-color: #fff0e8; padding: 10px; border-radius: 5px;">${newVerificationCode}</h3>
            <p>Код действует в течение одного часа. Пожалуйста, введите его на странице подтверждения.</p>
        `;

    const emailSent: boolean = await sendEmail(
      searchEmail,
      subject,
      `Ваш новый код подтверждения: ${newVerificationCode}`,
      htmlContent,
    );

    if (!emailSent) {
      console.warn(
        `[WARNING] Код обновлен, но не удалось отправить письмо на ${searchEmail}.`,
      );
    }

    return NextResponse.json(
      { message: 'Новый код отправлен.' },
      { status: 200 },
    );
  } catch (error: any) {
    console.error('Ошибка API повторной отправки кода:', error);

    return NextResponse.json(
      {
        message: 'Внутренняя ошибка сервера при повторной отправке кода.',
        detail: error.message || String(error),
      },
      { status: 500 },
    );
  }
}
