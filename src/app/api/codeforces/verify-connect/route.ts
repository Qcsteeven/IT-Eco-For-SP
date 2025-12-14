import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import axios from 'axios';
import { Surreal } from 'surrealdb';

export async function POST(req: NextRequest) {
  let db: Surreal | null = null;
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Не указан ID пользователя' },
        { status: 400 },
      );
    }

    db = await getDB();

    // ИСПРАВЛЕНИЕ 1: Используем type::record($userId) для поиска
    const [result] = await db.query(
      `SELECT verification_code, handle_username FROM external_accounts 
             WHERE user_id = type::record($userId) AND platform_name = 'codeforces'`,
      { userId: userId },
    );

    const records = Array.isArray(result) ? result : [];
    const record = records[0];

    // Если запись не найдена (например, из-за ошибки типов ранее), вернется 404
    if (!record || !record.verification_code || !record.handle_username) {
      return NextResponse.json(
        { error: 'Запрос на подключение не найден или код отсутствует' },
        { status: 404 },
      );
    }

    const { verification_code, handle_username } = record;

    const cfUrl = `https://codeforces.com/api/user.info?handles=${handle_username}`;

    let cfResponse;
    try {
      cfResponse = await axios.get(cfUrl);
    } catch (apiError) {
      return NextResponse.json(
        { error: 'Не удалось связаться с Codeforces API' },
        { status: 503 },
      );
    }

    if (
      cfResponse.data.status !== 'OK' ||
      !cfResponse.data.result ||
      cfResponse.data.result.length === 0
    ) {
      return NextResponse.json(
        { error: 'Пользователь Codeforces не найден' },
        { status: 400 },
      );
    }

    const userProfile = cfResponse.data.result[0];
    // В Codeforces поле firstName может отсутствовать, иногда проверяют и поле "firstName" и "lastName" или поле "organization"
    // Но если вы договорились писать в имя, то оставляем так:
    const firstName = userProfile.firstName || '';

    if (firstName.includes(verification_code)) {
      const newRating = userProfile.rating || 0;

      await db.query(
        `
                BEGIN TRANSACTION;
                
                -- Обновляем статус внешнего аккаунта, очищаем код (пустая строка вместо NONE)
                UPDATE external_accounts SET 
                    is_verified = true, 
                    verification_code = '', -- <--- ИСПРАВЛЕНО ЗДЕСЬ (было NONE)
                    cf_rating = $newRating
                WHERE user_id = type::record($userId) AND platform_name = 'codeforces';
                
                -- Обновляем основной рейтинг пользователя
                UPDATE users SET bscp_rating = $newRating WHERE id = type::record($userId);

                COMMIT TRANSACTION;
            `,
        { userId: userId, newRating: newRating },
      );

      return NextResponse.json({
        success: true,
        message: `Аккаунт ${handle_username} подтвержден. Рейтинг: ${newRating}.`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `Код не найден в поле "Имя" (${firstName || 'пусто'}). Ожидалось: ${verification_code}.`,
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error('Ошибка проверки Codeforces:', error);
    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера при проверке',
      },
      { status: 500 },
    );
  }
}
