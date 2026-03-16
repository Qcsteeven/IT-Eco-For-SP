import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { fetchUserInfo, fetchUserContestList } from '@qatadaazzeh/atcoder-api';
import crypto from 'crypto';

// Генерация кода верификации
function generateVerificationCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET - получение данных AtCoder пользователя
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();

    // Получаем данные пользователя с AtCoder username
    const userQuery = await db.query(
      `
      SELECT
        id,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username,
        (SELECT VALUE verification_code FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = false LIMIT 1)[0] AS pending_verification_code,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = false LIMIT 1)[0] AS pending_atcoder_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as any;
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не найден' },
        { status: 404 },
      );
    }

    // Если аккаунт не привязан
    if (!userData.atcoder_username) {
      return NextResponse.json({
        ok: true,
        data: {
          connected: false,
          atcoder_username: null,
          submissions: [],
          pending_verification: !!userData.pending_verification_code,
          pending_atcoder_username: userData.pending_atcoder_username,
          verification_code: userData.pending_verification_code,
        },
      });
    }

    // Получаем данные с AtCoder через API клиент
    try {
      // Получаем информацию о пользователе
      const userInfo = await fetchUserInfo(userData.atcoder_username);

      // Получаем contest history
      const contestHistory = await fetchUserContestList(userData.atcoder_username);
      
      console.log('[AtCoder] Raw contest history:', JSON.stringify(contestHistory, null, 2).substring(0, 1000));

      // Форматируем данные
      const formattedSubmissions = contestHistory.map((contest: any) => {
        // Пробуем разные варианты названий полей
        const contestId = contest.contestId || contest.contest_id || contest.contestId || '';
        const contestName = contest.contestName || contest.contest_name || contestId || '';
        
        console.log('[AtCoder] Mapped contest:', { contestId, contestName });
        
        return ({
          contest_id: contestId,
          contest_name: contestName,
          user_rank: contest.userRank || contest.user_rank || 0,
          user_old_rating: contest.userOldRating || contest.user_old_rating || 0,
          user_new_rating: contest.userNewRating || contest.user_new_rating || 0,
          user_rating_change: contest.userRatingChange || contest.user_rating_change || 0,
          user_performance: contest.userPerformance || contest.user_performance || 0,
          contest_end_time: contest.contestEndTime || contest.contest_end_time || '',
          is_rated: contest.isRated || contest.is_rated || false,
        });
      });

      return NextResponse.json({
        ok: true,
        data: {
          connected: true,
          atcoder_username: userData.atcoder_username,
          user_info: {
            rating: userInfo.userRating || 0,
            rank: userInfo.currentRank || '',
            attended_contests_count: userInfo.userContestCount || 0,
            rated_point_sum: 0,
          },
          submissions: formattedSubmissions,
        },
      });
    } catch (apiError: any) {
      console.error('AtCoder API Error:', apiError);
      return NextResponse.json({
        ok: false,
        error: 'Ошибка при получении данных с AtCoder',
        data: {
          connected: true,
          atcoder_username: userData.atcoder_username,
          submissions: [],
        },
      });
    }
  } catch (err: any) {
    console.error('API GET Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// POST - начало процесса привязки (создание кода верификации)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { atcoder_username } = body;

    if (!atcoder_username || typeof atcoder_username !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Неверный формат имени пользователя' },
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();
    const verificationCode = generateVerificationCode();

    // Проверяем существование пользователя на AtCoder
    try {
      const userInfo = await fetchUserInfo(atcoder_username.trim());
      if (!userInfo || !userInfo.userName) {
        return NextResponse.json(
          { ok: false, error: 'Пользователь с таким именем не найден на AtCoder' },
          { status: 404 },
        );
      }
    } catch (apiError: any) {
      console.error('AtCoder API validation Error:', apiError);
      return NextResponse.json(
        { ok: false, error: 'Ошибка при проверке пользователя на AtCoder' },
        { status: 400 },
      );
    }

    // Проверяем, не привязан ли уже этот аккаунт к другому пользователю
    const existingBinding = await db.query(
      `SELECT user_id FROM external_accounts WHERE platform_name = 'atcoder' AND handle_username = $username AND is_verified = true LIMIT 1`,
      { username: atcoder_username.trim() },
    );

    if (existingBinding && existingBinding[0] && (existingBinding[0] as any[]).length > 0) {
      const existingUserId = (existingBinding[0] as any)[0]?.user_id;
      if (existingUserId && existingUserId.toString() !== userId) {
        return NextResponse.json(
          { ok: false, error: 'Этот аккаунт AtCoder уже привязан к другому пользователю' },
          { status: 409 },
        );
      }
    }

    // Проверяем, есть ли уже непривязанная запись для этого пользователя
    const existingPending = await db.query(
      `SELECT id FROM external_accounts WHERE user_id = type::thing($user_id) AND platform_name = 'atcoder' AND is_verified = false LIMIT 1`,
      { user_id: userId },
    );

    const existingPendingArr = existingPending[0] as any;
    const existingPendingRecord = Array.isArray(existingPendingArr) ? existingPendingArr[0] : existingPendingArr;

    if (existingPendingRecord) {
      // Обновляем существующую запись
      await db.query(
        `UPDATE external_accounts SET 
          handle_username = $username, 
          verification_code = $code, 
          api_token_hash = '', 
          is_verified = false, 
          verified = false, 
          created_at = time::now() 
        WHERE id = $id`,
        { user_id: userId, id: existingPendingRecord.id, username: atcoder_username.trim(), code: verificationCode },
      );
    } else {
      // Создаём новую запись
      await db.query(
        `CREATE external_accounts CONTENT {
          user_id: type::thing($user_id),
          platform_name: 'atcoder',
          handle_username: $username,
          verification_code: $code,
          api_token_hash: '',
          is_verified: false,
          verified: false,
          created_at: time::now()
        }`,
        { user_id: userId, username: atcoder_username.trim(), code: verificationCode },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Код верификации создан',
      atcoder_username: atcoder_username.trim(),
      verification_code: verificationCode,
    });
  } catch (err: any) {
    console.error('API POST Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// PUT - проверка кода в Affiliation и подтверждение привязки
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();

    // Получаем непривязанную запись
    const verificationQuery = await db.query(
      `SELECT * FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = false LIMIT 1`,
      { id: userId },
    );

    const resultArr = verificationQuery[0] as any;
    const verificationRecord = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!verificationRecord) {
      return NextResponse.json(
        { ok: false, error: 'Нет активной верификации. Начните процесс привязки заново.' },
        { status: 400 },
      );
    }

    const atcoderUsername = verificationRecord.handle_username;
    const expectedCode = verificationRecord.verification_code;

    // Проверяем, что код есть в профиле AtCoder (в поле Affiliation) через парсинг HTML
    try {
      // Получаем HTML страницы профиля пользователя
      const profileUrl = `https://atcoder.jp/users/${atcoderUsername}`;
      const response = await fetch(profileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      
      // Сохраняем HTML для отладки (первые 5000 символов)
      console.log(`[AtCoder] Fetched profile: ${profileUrl}, status: ${response.status}`);
      console.log(`[AtCoder] HTML length: ${html.length}`);
      
      // Ищем поле Affiliation - может быть в разных форматах
      // Формат 1: <th>Affiliation</th><td>VALUE</td>
      // Формат 2: <th class="label">Affiliation</th><td>VALUE</td>
      const patterns = [
        /<th[^>]*>Affiliation<\/th>\s*<td[^>]*>([^<]+)<\/td>/i,
        /<th[^>]*class="[^"]*label[^"]*"[^>]*>Affiliation<\/th>\s*<td[^>]*>([^<]+)<\/td>/i,
        /"label":"Affiliation"[^}]*"value":"([^"]+)"/i,
      ];
      
      let userAffiliation = '';
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          userAffiliation = match[1].trim();
          break;
        }
      }
      
      // Для отладки - ищем весь блок с Affiliation
      const fullMatch = html.match(/<tr[^>]*>[\s\S]*?Affiliation[\s\S]*?<\/tr>/i);
      console.log(`[AtCoder] Full TR match: ${fullMatch ? fullMatch[0].substring(0, 300).replace(/\s+/g, ' ') : 'NOT FOUND'}`);
      console.log(`[AtCoder] Parsed Affiliation: "${userAffiliation}", Expected: "${expectedCode}"`);
      
      if (!userAffiliation || !userAffiliation.includes(expectedCode)) {
        return NextResponse.json(
          { 
            ok: false, 
            error: `Код "${expectedCode}" не найден в поле Affiliation на AtCoder. Проверьте, что вы разместили код точно и сохранили изменения.`,
            current_affiliation: userAffiliation || '(не указано)',
          },
          { status: 400 },
        );
      }
    } catch (apiError: any) {
      console.error('AtCoder profile parsing Error:', apiError);
      return NextResponse.json(
        { ok: false, error: 'Ошибка при проверке профиля AtCoder: ' + (apiError?.message || 'Неизвестная ошибка') },
        { status: 500 },
      );
    }

    // Подтверждаем привязку
    await db.query(
      `UPDATE external_accounts SET is_verified = true, verified = true, verified_at = time::now() WHERE id = $id`,
      { id: verificationRecord.id },
    );

    return NextResponse.json({
      ok: true,
      message: 'Аккаунт AtCoder успешно привязан',
      atcoder_username: atcoderUsername,
    });
  } catch (err: any) {
    console.error('API PUT Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// DELETE - отвязка аккаунта AtCoder
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();

    // Удаляем привязку
    await db.query(
      `DELETE external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder'`,
      { id: userId },
    );

    return NextResponse.json({
      ok: true,
      message: 'Аккаунт AtCoder успешно отвязан',
    });
  } catch (err: any) {
    console.error('API DELETE Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
