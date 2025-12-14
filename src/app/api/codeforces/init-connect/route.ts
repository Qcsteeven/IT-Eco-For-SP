import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import crypto from 'crypto';
import { Surreal } from 'surrealdb';

/**
 * [POST] /api/codeforces/init-connect
 */
export async function POST(req: NextRequest) {
  let db: Surreal | null = null;
  try {
    const { handle, userId } = await req.json();

    if (!handle || !userId) {
      return NextResponse.json(
        { error: 'Не указан хендл или ID пользователя' },
        { status: 400 },
      );
    }

    db = await getDB();

    const verificationCode = `CF-VERIFY-${crypto.randomBytes(6).toString('hex')}`;

    const [existingResult] = await db.query(
      `SELECT * FROM external_accounts WHERE user_id = type::record($userId) AND platform_name = 'codeforces'`,
      { userId: userId },
    );

    const existingRecords = Array.isArray(existingResult) ? existingResult : [];

    let query;
    let params = { userId, handle, code: verificationCode };

    if (existingRecords.length > 0) {
      query = `
                UPDATE external_accounts SET 
                    verification_code = $code, 
                    handle_username = $handle, 
                    is_verified = false,
                    api_token_hash = '',
                    cf_api_key = '', 
                    cf_api_secret = ''
                -- ИСПРАВЛЕНИЕ 2: Используем type::record($userId) в условии WHERE
                WHERE user_id = type::record($userId) AND platform_name = 'codeforces'
            `;
    } else {
      query = `
                CREATE external_accounts CONTENT {
                    -- ИСПРАВЛЕНИЕ 3: Явно преобразуем строку в Record ID
                    user_id: type::record($userId),
                    platform_name: 'codeforces',
                    handle_username: $handle,
                    verification_code: $code,
                    is_verified: false,
                    api_token_hash: '',
                    cf_api_key: '',
                    cf_api_secret: ''
                }
            `;
    }

    await db.query(query, params);

    return NextResponse.json({
      success: true,
      code: verificationCode,
    });
  } catch (error) {
    console.error('Ошибка инициализации Codeforces:', error);

    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера при инициализации',
      },
      { status: 500 },
    );
  }
}
