import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';

interface IVerifyPayload {
  email?: string;
  code?: string;
}

interface IUser {
  id: string;
  is_verified: boolean;
  verification_code: string | null;
  code_expiry: string | null;
}

/**
 * @method POST
 * @description Маршрут для подтверждения email с помощью кода.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody: IVerifyPayload = await request.json();
    const { email: rawEmail, code } = rawBody;

    const email = rawEmail ? rawEmail.toLowerCase() : rawEmail;

    if (!email || !code) {
      return NextResponse.json(
        { message: 'Необходимо предоставить email и код подтверждения.' },
        { status: 400 },
      );
    }

    const db = await getDB();

    await db.use({ namespace: 'bcsp', database: 'site' });

    const findUserQuery = `
      SELECT id, is_verified, verification_code, code_expiry 
      FROM users 
      WHERE email = $email
    `;

    let queryResult: any;
    try {
      queryResult = await db.query(findUserQuery, { email });
    } catch (dbError: unknown) {
      console.error(`[API/VERIFY] Ошибка DB при SELECT:`, dbError);
      const errorMessage =
        dbError instanceof Error ? dbError.message : 'Unknown DB error';

      return NextResponse.json(
        {
          message: 'Внутренняя ошибка базы данных при поиске пользователя.',
          detail: errorMessage,
        },
        { status: 500 },
      );
    }

    const records = queryResult?.[0] || [];
    const userArray: IUser[] = Array.isArray(records)
      ? records
      : (records as any).result || [];

    if (userArray.length === 0) {
      return NextResponse.json(
        { message: 'Неверный email или код подтверждения.' },
        { status: 404 },
      );
    }

    const user = userArray[0];
    const currentTime = new Date();
    const expiryDate = user.code_expiry ? new Date(user.code_expiry) : null;

    if (user.is_verified) {
      return NextResponse.json(
        { message: 'Аккаунт уже верифицирован.' },
        { status: 409 },
      );
    }

    if (expiryDate && expiryDate < currentTime) {
      return NextResponse.json(
        {
          message:
            'Срок действия кода подтверждения истек. Пожалуйста, запросите новый код.',
        },
        { status: 403 },
      );
    }

    if (user.verification_code !== code) {
      return NextResponse.json(
        { message: 'Неверный email или код подтверждения.' },
        { status: 401 },
      );
    }

    try {
      await db.merge(user.id, {
        is_verified: true,
        verification_code: null,
        code_expiry: null,
      });
    } catch (dbError: unknown) {
      console.error(`[API/VERIFY] Ошибка DB при MERGE:`, dbError);
      const errorMessage =
        dbError instanceof Error ? dbError.message : 'Unknown DB error';

      return NextResponse.json(
        {
          message: 'Внутренняя ошибка базы данных при обновлении статуса.',
          detail: errorMessage,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: 'Аккаунт успешно верифицирован. Вы можете войти.',
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error(`[API/VERIFY] КРИТИЧЕСКАЯ ОШИБКА:`, error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown Server Error';

    return NextResponse.json(
      {
        message: 'Внутренняя ошибка сервера при верификации.',
        detail: errorMessage,
      },
      { status: 500 },
    );
  }
}
