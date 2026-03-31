import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { hashPassword, verifyPassword } from '@/lib/surreal/auth';
import { fetchUserInfo, fetchUserContestList, type UserContest } from '@qatadaazzeh/atcoder-api';

interface CF_RatingResult {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
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
        id, full_name, email, bscp_rating, phone,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' AND is_verified = true LIMIT 1)[0] AS cf_username,
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'atcoder' AND is_verified = true LIMIT 1)[0] AS atcoder_username
      FROM type::thing($id);
      `,
      { id: userId },
    );

    const resultArr = userQuery[0] as Record<string, unknown> | Record<string, unknown>[];
    const userData = Array.isArray(resultArr) ? resultArr[0] : resultArr;

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не найден' },
        { status: 404 },
      );
    }

    let liveHistory: {
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
    }[] = [];
    let cfCurrentRating = 0;
    let atcoderCurrentRating = 0;

    // Получаем историю с Codeforces и текущий рейтинг
    if (userData.cf_username) {
      try {
        const cfRes = await fetch(
          `https://codeforces.com/api/user.rating?handle=${userData.cf_username}`,
          { cache: 'no-store' },
        );
        const cfData = await cfRes.json();

        if (cfData.status === 'OK') {
          const cfResults: CF_RatingResult[] = cfData.result;

          // Текущий рейтинг - последний newRating в списке (самый свежий)
          if (cfResults.length > 0) {
            const lastContest = cfResults[cfResults.length - 1];
            cfCurrentRating = lastContest.newRating;
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

          liveHistory = [...liveHistory, ...cfHistory];
        }
      } catch (e) {
        console.error('CF Fetch Error:', e);
      }
    }

    // Получаем историю с AtCoder и текущий рейтинг
    if (userData.atcoder_username && typeof userData.atcoder_username === 'string') {
      console.log(`[AtCoder] Fetching history for: ${userData.atcoder_username}`);

      try {
        // Используем @qatadaazzeh/atcoder-api для получения данных
        const userInfo = await fetchUserInfo(userData.atcoder_username);
        const contestHistory = await fetchUserContestList(userData.atcoder_username);

        console.log(`[AtCoder] Contests fetched: ${contestHistory.length}`);

        // Текущий рейтинг из userInfo
        atcoderCurrentRating = userInfo.userRating || 0;

        const atCoderHistory = contestHistory.map((contest: UserContest) => {
          const diff = contest.userRatingChange || ((contest.userNewRating || 0) - (contest.userOldRating || 0));
          // Извлекаем короткий ID (abc446 из abc446.contest.atcoder.jp)
          const fullContestId = contest.contestId || '';
          const shortContestId = fullContestId.split('.')[0] || '';

          return {
            date_recorded: new Date(contest.contestEndTime || Date.now()).toISOString(),
            placement: (contest.userRank || 0).toString(),
            mmr_change: diff,
            is_manual: false,
            source_rating_change: diff >= 0 ? `+${diff}` : `${diff}`,
            contest: {
              title: contest.contestName || '',
              platform: 'AtCoder',
              id: shortContestId,
            },
          };
        });

        console.log(`[AtCoder] Formatted history:`, atCoderHistory);
        liveHistory = [...liveHistory, ...atCoderHistory];
        console.log(`[AtCoder] Total history after merge: ${liveHistory.length}`);
      } catch (e) {
        console.error('AtCoder Fetch Error:', e);
      }
    }

    // Сортируем по дате (новые сверху)
    liveHistory.sort((a, b) => new Date(b.date_recorded).getTime() - new Date(a.date_recorded).getTime());

    // Итоговый рейтинг = MAX(CF, AtCoder)
    const finalRating = Math.max(cfCurrentRating, atcoderCurrentRating);

    // Обновляем рейтинг если изменился
    if (userData.bscp_rating !== finalRating && finalRating !== 0) {
      await db.query(
        `UPDATE type::thing($id) SET bscp_rating = $newRating`,
        { id: userId, newRating: finalRating },
      );
      userData.bscp_rating = finalRating;
    }

    return NextResponse.json({
      ok: true,
      data: {
        user: userData,
        history: liveHistory,
      },
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
      const currentHash = userDataInDb?.password_hash as string | undefined;

      if (!currentHash)
        return NextResponse.json(
          { ok: false, error: 'Пользователь не найден' },
          { status: 404 },
        );

      const isMatch = await verifyPassword(oldPassword, currentHash);
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API PUT Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сохранения' },
      { status: 500 },
    );
  }
}
