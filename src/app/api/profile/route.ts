import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { hashPassword, verifyPassword } from '@/lib/surreal/auth';
import { fetchUserInfo, fetchUserContestList } from '@qatadaazzeh/atcoder-api';

interface CF_RatingResult {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

interface HistoryItem {
  date_recorded: string;
  placement: string;
  mmr_change: number;
  is_manual: boolean;
  source_rating_change: string;
  contest: {
    title: string;
    platform: string;
    id: string;
  };
}

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

    const userQuery = await db.query(
      `
      SELECT
        id, full_name, email, bscp_rating, phone, codeforces_karma,
        (SELECT * FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_account,
        (SELECT * FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_account
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не найден' },
        { status: 404 },
      );
    }

    // Извлекаем usernames из аккаунтов
    const cfAccount = userData.cf_account as
      | Record<string, unknown>
      | undefined;
    const atcoderAccount = userData.atcoder_account as
      | Record<string, unknown>
      | undefined;

    const cfUsername = cfAccount?.handle_username as string | undefined;
    const atcoderUsername = atcoderAccount?.handle_username as
      | string
      | undefined;

    // Проверяем кэш (обновляем если прошло больше 1 часа)
    const CACHE_TTL = 60 * 60 * 1000; // 1 час в миллисекундах
    const now = Date.now();

    const cfLastUpdate = cfAccount?.updated_at
      ? new Date(cfAccount.updated_at as string).getTime()
      : 0;
    const atcoderLastUpdate = atcoderAccount?.updated_at
      ? new Date(atcoderAccount.updated_at as string).getTime()
      : 0;

    const cfCacheValid = cfLastUpdate && now - cfLastUpdate < CACHE_TTL;
    const atcoderCacheValid =
      atcoderLastUpdate && now - atcoderLastUpdate < CACHE_TTL;

    let liveHistory: HistoryItem[] = [];
    let cfCurrentRating = 0;
    let atcoderCurrentRating = 0;

    // Параллельные запросы к Codeforces и AtCoder для ускорения
    // Используем кэш если он валиден
    const [cfResult, atCoderResult] = await Promise.allSettled([
      // Запрос к Codeforces
      (async () => {
        if (!cfUsername) return { history: [], rating: 0 };

        // Если кэш валиден, используем его
        if (cfCacheValid && cfAccount?.cached_history) {
          console.log('[CF] Using cached data');
          return {
            history: JSON.parse(
              cfAccount.cached_history as string,
            ) as HistoryItem[],
            rating: (cfAccount.cached_rating as number) || 0,
          };
        }

        try {
          console.log('[CF] Fetching from API...');
          const cfRes = await fetch(
            `https://codeforces.com/api/user.rating?handle=${cfUsername}`,
            { cache: 'no-store' },
          );
          const cfData = await cfRes.json();

          if (cfData.status === 'OK') {
            const cfResults: CF_RatingResult[] = cfData.result;

            let currentRating = 0;
            if (cfResults.length > 0) {
              const lastContest = cfResults[cfResults.length - 1];
              currentRating = lastContest.newRating;
            }

            const cfHistory = cfResults
              .slice()
              .reverse()
              .map((item) => {
                const diff = item.newRating - item.oldRating;

                return {
                  date_recorded: new Date(
                    item.ratingUpdateTimeSeconds * 1000,
                  ).toISOString(),
                  placement: item.rank.toString(),
                  mmr_change: diff,
                  is_manual: false,
                  source_rating_change: diff >= 0 ? `+${diff}` : `${diff}`,
                  contest: {
                    title: item.contestName,
                    platform: 'Codeforces',
                    id: item.contestId.toString(),
                  },
                };
              });

            // Сохраняем в кэш
            try {
              await db.query(
                `UPDATE type::thing($id) SET cached_history = $history, cached_rating = $rating, updated_at = time::now() WHERE platform_name = 'codeforces'`,
                {
                  id: cfAccount.id,
                  history: JSON.stringify(cfHistory),
                  rating: currentRating,
                },
              );
            } catch (e) {
              console.error('[CF] Cache save error:', e);
            }

            return { history: cfHistory, rating: currentRating };
          }
        } catch (e) {
          console.error('CF Fetch Error:', e);
        }

        return { history: [], rating: 0 };
      })(),

      // Запрос к AtCoder
      (async () => {
        if (!atcoderUsername) return { history: [], rating: 0 };

        // Если кэш валиден, используем его
        if (atcoderCacheValid && atcoderAccount?.cached_history) {
          console.log('[AtCoder] Using cached data');
          return {
            history: JSON.parse(
              atcoderAccount.cached_history as string,
            ) as HistoryItem[],
            rating: (atcoderAccount.cached_rating as number) || 0,
          };
        }

        console.log(`[AtCoder] Fetching history for: ${atcoderUsername}`);

        try {
          const [userInfo, contestHistory] = await Promise.all([
            fetchUserInfo(atcoderUsername),
            fetchUserContestList(atcoderUsername),
          ]);

          console.log(`[AtCoder] Contests fetched: ${contestHistory.length}`);

          const currentRating = userInfo.userRating || 0;

          const atCoderHistory = contestHistory.map((contest: any) => {
            const diff =
              contest.userRatingChange ||
              (contest.userNewRating || 0) - (contest.userOldRating || 0);
            const fullContestId = contest.contestId || '';
            const shortContestId = fullContestId.split('.')[0] || '';

            return {
              date_recorded: new Date(
                contest.contestEndTime ||
                  contest.contest_end_time ||
                  Date.now(),
              ).toISOString(),
              placement: (contest.userRank || contest.rank || '0').toString(),
              mmr_change: diff,
              is_manual: false,
              source_rating_change: diff >= 0 ? `+${diff}` : `${diff}`,
              contest: {
                title: contest.contestName || contest.contest_id || '',
                platform: 'AtCoder',
                id: shortContestId,
              },
            };
          });

          console.log(`[AtCoder] Formatted history:`, atCoderHistory);
          console.log(
            `[AtCoder] Total history after merge: ${atCoderHistory.length}`,
          );

          // Сохраняем в кэш
          try {
            await db.query(
              `UPDATE type::thing($id) SET cached_history = $history, cached_rating = $rating, updated_at = time::now() WHERE platform_name = 'atcoder'`,
              {
                id: atcoderAccount.id,
                history: JSON.stringify(atCoderHistory),
                rating: currentRating,
              },
            );
          } catch (e) {
            console.error('[AtCoder] Cache save error:', e);
          }

          return { history: atCoderHistory, rating: currentRating };
        } catch (e) {
          console.error('AtCoder Fetch Error:', e);
          return { history: [], rating: 0 };
        }
      })(),
    ]);

    // Обрабатываем результаты
    if (cfResult.status === 'fulfilled') {
      liveHistory = [...liveHistory, ...cfResult.value.history];
      cfCurrentRating = cfResult.value.rating;
    }

    if (atCoderResult.status === 'fulfilled') {
      liveHistory = [...liveHistory, ...atCoderResult.value.history];
      atcoderCurrentRating = atCoderResult.value.rating;
    }

    // Сортируем по дате (новые сверху)
    liveHistory.sort(
      (a, b) =>
        new Date(b.date_recorded).getTime() -
        new Date(a.date_recorded).getTime(),
    );

    // Итоговый рейтинг = MAX(CF, AtCoder)
    const finalRating = Math.max(cfCurrentRating, atcoderCurrentRating);

    // Обновляем рейтинг если изменился
    if (userData.bscp_rating !== finalRating && finalRating !== 0) {
      await db.query(`UPDATE type::thing($id) SET bscp_rating = $newRating`, {
        id: userId,
        newRating: finalRating,
      });
      userData.bscp_rating = finalRating;
    }

    // Добавляем codeforces_karma если нет
    if (!userData.codeforces_karma) {
      userData.codeforces_karma = 0;
    }

    return NextResponse.json({
      ok: true,
      data: {
        user: userData,
        history: liveHistory,
      },
    });
  } catch (err: unknown) {
    console.error('API GET Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );

    const body = await req.json();
    const { full_name, phone, oldPassword, newPassword, cf_username } = body;
    const db = await getDB();
    if (!db) throw new Error('Ошибка БД');
    const userId = session.user.id;

    if (cf_username === null) {
      await db.query(
        `
        DELETE external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces';
        UPDATE type::thing($id) SET bscp_rating = 0;
        `,
        { id: userId },
      );
      return NextResponse.json({ ok: true, new_rating: 0 });
    }

    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;

    if (newPassword && newPassword.trim().length > 0) {
      const userRes = await db.query(
        'SELECT password_hash FROM type::thing($id)',
        { id: userId },
      );
      const userDataInDb = (userRes[0] as Record<string, unknown>[])?.[0];
      const currentHash = (userDataInDb as Record<string, unknown>)
        ?.password_hash;

      if (!currentHash)
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );

      const isMatch = await verifyPassword(oldPassword, currentHash as string);
      if (!isMatch)
        return NextResponse.json(
          { ok: false, error: 'Старый пароль неверный' },
          { status: 400 },
        );

      updateData.password_hash = await hashPassword(newPassword);
    }

    await db.query(`UPDATE type::thing($id) MERGE $data`, {
      id: userId,
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('API PUT Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сохранения' },
      { status: 500 },
    );
  }
}
