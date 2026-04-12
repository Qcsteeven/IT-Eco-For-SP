import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import crypto from 'crypto';
import axios from 'axios';
import { fetchUserInfo, fetchUserContestList } from '@qatadaazzeh/atcoder-api';

// Генерация кода верификации
function generateVerificationCode(): string {
  return `CF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// GET - получение данных Codeforces пользователя
export async function GET() {
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

    // Получаем данные пользователя с Codeforces username и кэшем
    const userQuery = await db.query(
      `
      SELECT
        id,
        (SELECT * FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_account,
        (SELECT VALUE verification_code FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = false LIMIT 1)[0] AS pending_verification_code,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = false LIMIT 1)[0] AS pending_cf_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as
      | Record<string, unknown>
      | Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    console.log(
      `[CF GET] userId: ${userId}, query result:`,
      JSON.stringify(userData, null, 2),
    );

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не найден' },
        { status: 404 },
      );
    }

    // Если аккаунт не привязан
    if (!userData.cf_account) {
      return NextResponse.json({
        connected: false,
        cf_username: null,
        pending_verification: !!userData.pending_verification_code,
        pending_cf_username: userData.pending_cf_username,
        verification_code: userData.pending_verification_code,
      });
    }

    const cfAccount = userData.cf_account as Record<string, unknown>;
    const cfUsername = cfAccount.handle_username as string;

    // Проверяем кэш (TTL 1 час)
    const CACHE_TTL = 60 * 60 * 1000;
    const now = Date.now();
    const lastUpdate = cfAccount.updated_at
      ? new Date(cfAccount.updated_at as string).getTime()
      : 0;
    const cacheValid = lastUpdate && now - lastUpdate < CACHE_TTL;

    // Если кэш валиден, возвращаем его
    if (cacheValid && cfAccount.cached_user_info) {
      console.log('[CF GET] Using cached data');
      return NextResponse.json({
        connected: true,
        cf_username: cfUsername,
        user_info: JSON.parse(cfAccount.cached_user_info as string),
        submissions: JSON.parse(cfAccount.cached_submissions as string),
      });
    }

    console.log('[CF GET] Fetching from Codeforces API...');

    // Получаем данные с Codeforces API
    let userInfo: {
      rating: number;
      rank: string;
      max_rating: number;
      attended_contests_count: number;
    } | null = null;

    interface CodeforcesRatingEntry {
      contestId?: number;
      contestName?: string;
      rank?: number;
      oldRating?: number;
      newRating?: number;
      ratingUpdateTimeSeconds?: number;
      [key: string]: unknown;
    }

    let formattedHistory: {
      contest_id: number | string;
      contest_name: string;
      user_rank: number;
      user_old_rating: number;
      user_new_rating: number;
      user_rating_change: number;
      contest_end_time: string;
      is_rated: boolean;
    }[] = [];

    try {
      const cfRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${userData.cf_username}`,
      );

      if (
        cfRes.data.status === 'OK' &&
        cfRes.data.result &&
        cfRes.data.result.length > 0
      ) {
        const cfUser = cfRes.data.result[0];

        userInfo = {
          rating: cfUser.rating || 0,
          rank: cfUser.rank || '',
          max_rating: cfUser.maxRating || 0,
          attended_contests_count: cfUser.contestCount || 0,
        };

        // Получаем историю рейтинга
        const ratingRes = await axios.get(
          `https://codeforces.com/api/user.rating?handle=${userData.cf_username}`,
        );
        const ratingHistory: CodeforcesRatingEntry[] =
          ratingRes.data.status === 'OK' ? ratingRes.data.result : [];

        formattedHistory = ratingHistory.map((item) => ({
          contest_id: item.contestId || '',
          contest_name: item.contestName || '',
          user_rank: item.rank || 0,
          user_old_rating: item.oldRating || 0,
          user_new_rating: item.newRating || 0,
          user_rating_change: (item.newRating || 0) - (item.oldRating || 0),
          contest_end_time: new Date(
            item.ratingUpdateTimeSeconds * 1000,
          ).toISOString(),
          is_rated: true,
        }));
      }
    } catch (apiError: unknown) {
      const errorMessage =
        apiError instanceof Error ? apiError.message : String(apiError);
      console.error('Codeforces API Error:', errorMessage);
    }

    // Сохраняем в кэш
    try {
      await db.query(
        `UPDATE type::thing($id) SET cached_user_info = $userInfo, cached_submissions = $submissions, updated_at = time::now() WHERE platform_name = 'codeforces'`,
        {
          id: cfAccount.id,
          userInfo: JSON.stringify(userInfo),
          submissions: JSON.stringify(formattedHistory),
        },
      );
      console.log('[CF GET] Cache saved');
    } catch (e) {
      console.error('[CF GET] Cache save error:', e);
    }

    return NextResponse.json({
      connected: true,
      cf_username: cfUsername,
      user_info: userInfo,
      submissions: formattedHistory,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API GET Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// POST - начало процесса привязки (создание кода верификации)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { cf_handle } = body;

    if (!cf_handle || typeof cf_handle !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Неверный формат хендла' },
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Ошибка подключения к БД');

    const userId = session.user.id.toString();
    const verificationCode = generateVerificationCode();

    // Проверяем существование пользователя на Codeforces
    try {
      const cfRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${cf_handle.trim()}`,
      );

      if (
        cfRes.data.status !== 'OK' ||
        !cfRes.data.result ||
        cfRes.data.result.length === 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Пользователь с таким хендлом не найден на Codeforces',
          },
          { status: 404 },
        );
      }
    } catch (apiError: unknown) {
      const errorMessage =
        apiError instanceof Error ? apiError.message : String(apiError);
      console.error('Codeforces API validation Error:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Ошибка при проверке пользователя на Codeforces' },
        { status: 400 },
      );
    }

    // Проверяем, не привязан ли уже этот аккаунт к другому пользователю
    const existingBinding = await db.query(
      `SELECT user_id FROM external_accounts WHERE platform_name = 'codeforces' AND handle_username = $handle AND is_verified = true LIMIT 1`,
      { handle: cf_handle.trim() },
    );

    if (
      existingBinding &&
      existingBinding[0] &&
      Array.isArray(existingBinding[0]) &&
      existingBinding[0].length > 0
    ) {
      const existingUserId = (
        existingBinding[0] as Record<string, unknown>[]
      )?.[0]?.user_id;
      if (existingUserId && existingUserId.toString() !== userId) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Этот аккаунт Codeforces уже привязан к другому пользователю',
          },
          { status: 409 },
        );
      }
    }

    // Проверяем, есть ли уже непривязанная запись для этого пользователя
    const existingPending = await db.query(
      `SELECT id FROM external_accounts WHERE user_id = type::thing($user_id) AND platform_name = 'codeforces' AND is_verified = false LIMIT 1`,
      { user_id: userId },
    );

    const existingPendingArr = existingPending[0] as
      | Record<string, unknown>
      | Record<string, unknown>[];
    const existingPendingRecord = Array.isArray(existingPendingArr)
      ? existingPendingArr[0]
      : existingPendingArr;

    if (existingPendingRecord) {
      // Обновляем существующую запись
      await db.query(
        `UPDATE external_accounts SET 
          handle_username = $handle, 
          verification_code = $code, 
          api_token_hash = '', 
          cf_api_key = '',
          cf_api_secret = '',
          is_verified = false, 
          verified = false, 
          created_at = time::now() 
        WHERE id = $id`,
        {
          user_id: userId,
          id: existingPendingRecord.id,
          handle: cf_handle.trim(),
          code: verificationCode,
        },
      );
    } else {
      // Создаём новую запись
      await db.query(
        `CREATE external_accounts CONTENT {
          user_id: type::thing($user_id),
          platform_name: 'codeforces',
          handle_username: $handle,
          verification_code: $code,
          api_token_hash: '',
          cf_api_key: '',
          cf_api_secret: '',
          is_verified: false,
          verified: false,
          created_at: time::now()
        }`,
        { user_id: userId, handle: cf_handle.trim(), code: verificationCode },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Код верификации создан',
      cf_handle: cf_handle.trim(),
      verification_code: verificationCode,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// PUT - проверка кода в First Name и подтверждение привязки
export async function PUT() {
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
      `SELECT * FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = false LIMIT 1`,
      { id: userId },
    );

    const resultArr = verificationQuery[0] as
      | Record<string, unknown>
      | Record<string, unknown>[];
    const verificationRecord = Array.isArray(resultArr)
      ? resultArr[0]
      : resultArr;

    if (!verificationRecord) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Нет активной верификации. Начните процесс привязки заново.',
        },
        { status: 400 },
      );
    }

    const cfHandle = verificationRecord.handle_username as string;
    const expectedCode = verificationRecord.verification_code as string;

    // Проверяем, что код есть в профиле Codeforces (в поле firstName)
    try {
      const cfRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${cfHandle}`,
      );

      if (
        cfRes.data.status !== 'OK' ||
        !cfRes.data.result ||
        cfRes.data.result.length === 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Ошибка при получении данных профиля Codeforces',
          },
          { status: 500 },
        );
      }

      const cfUser = cfRes.data.result[0];
      const firstName = cfUser.firstName || '';

      console.log(
        `[Codeforces] Profile: ${cfHandle}, First Name: "${firstName}", Expected: "${expectedCode}"`,
      );

      if (!firstName.includes(expectedCode)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Код "${expectedCode}" не найден в поле First Name на Codeforces. Проверьте, что вы разместили код точно и сохранили изменения.`,
            current_first_name: firstName || '(не указано)',
          },
          { status: 400 },
        );
      }
    } catch (apiError: unknown) {
      const errorMessage =
        apiError instanceof Error ? apiError.message : String(apiError);
      console.error('Codeforces API verification Error:', errorMessage);
      return NextResponse.json(
        {
          ok: false,
          error:
            'Ошибка при проверке профиля Codeforces: ' +
            (errorMessage || 'Неизвестная ошибка'),
        },
        { status: 500 },
      );
    }

    // Получаем рейтинг Codeforces пользователя
    let cfRating = 0;
    try {
      const cfRes = await axios.get(
        `https://codeforces.com/api/user.info?handles=${cfHandle}`,
      );
      if (
        cfRes.data.status === 'OK' &&
        cfRes.data.result &&
        cfRes.data.result.length > 0
      ) {
        cfRating = cfRes.data.result[0].rating || 0;
      }
    } catch (e) {
      console.error('Error getting CF rating:', e);
    }

    // Получаем рейтинг и карму AtCoder пользователя (если привязан)
    let atcoderRating = 0;
    let atcoderKarma = 0;
    try {
      const atcoderQuery = await db.query(
        `SELECT
          (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($user_id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username,
          (SELECT VALUE total_karma FROM users WHERE id = type::thing($user_id) LIMIT 1)[0] AS current_total_karma
        FROM type::thing($user_id)`,
        { user_id: userId },
      );
      const atcoderResult = (atcoderQuery[0] as Record<string, unknown>[])?.[0];
      const atcoderUsername = atcoderResult?.atcoder_username as
        | string
        | undefined;

      if (atcoderUsername) {
        const userInfo = await fetchUserInfo(atcoderUsername);
        atcoderRating = userInfo.userRating || 0;
        // Карма AtCoder = сумма изменений рейтинга
        const contestHistory = await fetchUserContestList(atcoderUsername);
        atcoderKarma = contestHistory.reduce((sum: number, contest) => {
          const c = contest as unknown as Record<string, unknown>;
          const change =
            (c.userRatingChange as number) ||
            ((c.userNewRating as number) || 0) -
              ((c.userOldRating as number) || 0);
          return sum + change;
        }, 0);
      }
    } catch (e) {
      console.error('Error getting AtCoder data:', e);
    }

    // Вычисляем карму Codeforces из API
    let cfKarma = 0;
    try {
      const submissionsRes = await axios.get(
        `https://codeforces.com/api/user.status?handle=${cfHandle}&from=1&count=5000`,
        { timeout: 10000 },
      );
      if (submissionsRes.data.status === 'OK') {
        const submissions = submissionsRes.data.result;
        const okSubmissions = submissions.filter(
          (s: { verdict: string }) => s.verdict === 'OK',
        );
        const uniqueProblems = new Map<string, unknown>();
        for (let i = okSubmissions.length - 1; i >= 0; i--) {
          const sub = okSubmissions[i];
          const problemIndex = sub.problem?.index || sub.problemIndex;
          if (!sub.contestId || !problemIndex) continue;
          const key = `${sub.contestId}-${problemIndex}`;
          if (!uniqueProblems.has(key)) {
            uniqueProblems.set(key, sub);
          }
        }
        // Простая карма: easy=1, medium=3, hard=10
        let easyCount = 0;
        let mediumCount = 0;
        let hardCount = 0;
        uniqueProblems.forEach((sub: unknown) => {
          const s = sub as Record<string, unknown>;
          const problem = s.problem as Record<string, unknown> | undefined;
          const rating = problem?.rating as number | undefined;
          if (rating) {
            if (rating < 1200) easyCount++;
            else if (rating < 2000) mediumCount++;
            else hardCount++;
          }
        });
        cfKarma = easyCount * 1 + mediumCount * 3 + hardCount * 10;
      }
    } catch (e) {
      console.error('Error getting CF karma:', e);
    }

    // Итоговый рейтинг = MAX(CF, AtCoder)
    // Итоговая карма = CF karma + AtCoder karma
    const finalRating = Math.max(cfRating, atcoderRating);
    const totalKarma = cfKarma + atcoderKarma;

    // Подтверждаем привязку и обновляем рейтинг + карму
    const updateResult = await db.query(
      `
      BEGIN TRANSACTION;

      UPDATE external_accounts SET is_verified = true, verified = true, verified_at = time::now() WHERE id = $id;
      UPDATE users SET bscp_rating = $newRating, total_karma = $totalKarma WHERE id = type::thing($user_id);

      COMMIT TRANSACTION;
      `,
      {
        id: verificationRecord.id,
        user_id: userId,
        newRating: finalRating,
        totalKarma,
      },
    );

    console.log(
      `[CF PUT] Update result:`,
      JSON.stringify(updateResult, null, 2),
    );

    return NextResponse.json({
      ok: true,
      message: 'Аккаунт Codeforces успешно привязан',
      cf_handle: cfHandle,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PUT Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

// DELETE - отвязка аккаунта Codeforces
export async function DELETE() {
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

    // Получаем рейтинг и карму AtCoder пользователя (если привязан)
    let atcoderRating = 0;
    let atcoderKarma = 0;
    try {
      const atcoderQuery = await db.query(
        `SELECT
          (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($user_id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username
        FROM type::thing($user_id)`,
        { user_id: userId },
      );
      const atcoderResult = (atcoderQuery[0] as Record<string, unknown>[])?.[0];
      const atcoderUsername = atcoderResult?.atcoder_username as
        | string
        | undefined;

      if (atcoderUsername) {
        const userInfo = await fetchUserInfo(atcoderUsername);
        atcoderRating = userInfo.userRating || 0;
        // Карма AtCoder = сумма изменений рейтинга
        const contestHistory = await fetchUserContestList(atcoderUsername);
        atcoderKarma = contestHistory.reduce((sum: number, contest) => {
          const c = contest as unknown as Record<string, unknown>;
          const change =
            (c.userRatingChange as number) ||
            ((c.userNewRating as number) || 0) -
              ((c.userOldRating as number) || 0);
          return sum + change;
        }, 0);
      }
    } catch (e) {
      console.error('Error getting AtCoder data:', e);
    }

    // Итоговый рейтинг = AtCoder (т.к. CF отвязан)
    // Итоговая карма = только AtCoder karma
    const finalRating = atcoderRating;
    const totalKarma = atcoderKarma;

    // Удаляем привязку и обновляем рейтинг + карму
    await db.query(
      `
      BEGIN TRANSACTION;

      DELETE external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces';
      UPDATE users SET bscp_rating = $newRating, total_karma = $totalKarma WHERE id = type::thing($id);

      COMMIT TRANSACTION;
      `,
      { id: userId, newRating: finalRating, totalKarma },
    );

    return NextResponse.json({
      ok: true,
      message: 'Аккаунт Codeforces успешно отвязан',
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API DELETE Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
