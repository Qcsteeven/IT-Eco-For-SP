import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { hashPassword, verifyPassword } from '@/lib/surreal/auth';

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
        (SELECT VALUE handle_username FROM external_accounts WHERE user_id = type::thing($id) AND platform_name = 'codeforces' LIMIT 1)[0] AS cf_username
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

    let liveHistory: any[] = [];
    let calculatedTotalRating = 0;

    if (userData.cf_username) {
      try {
        const cfRes = await fetch(
          `https://codeforces.com/api/user.rating?handle=${userData.cf_username}`,
          { cache: 'no-store' },
        );
        const cfData = await cfRes.json();

        if (cfData.status === 'OK') {
          const cfResults: CF_RatingResult[] = cfData.result;

          liveHistory = cfResults
            .slice()
            .reverse()
            .map((item) => {
              const diff = item.newRating - item.oldRating;
              calculatedTotalRating += diff;

              return {
                date_recorded: new Date(
                  item.ratingUpdateTimeSeconds * 1000,
                ).toISOString(),
                placement: item.rank.toString(), // Только цифра места, без текста и скобок
                mmr_change: diff,
                is_manual: false,
                source_rating_change: diff >= 0 ? `+${diff}` : `${diff}`,
                contest: {
                  title: item.contestName,
                  platform: 'Codeforces',
                },
              };
            });

          if (userData.bscp_rating !== calculatedTotalRating) {
            await db.query(
              `UPDATE type::thing($id) SET bscp_rating = $newRating`,
              { id: userId, newRating: calculatedTotalRating },
            );
            userData.bscp_rating = calculatedTotalRating;
          }
        }
      } catch (e) {
        console.error('CF Fetch Error:', e);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        user: userData,
        history: liveHistory,
      },
    });
  } catch (err: any) {
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

    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;

    if (newPassword && newPassword.trim().length > 0) {
      const userRes = await db.query(
        'SELECT password_hash FROM type::thing($id)',
        { id: userId },
      );
      const userDataInDb = (userRes[0] as any)?.[0];
      const currentHash = userDataInDb?.password_hash;

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
  } catch (err: any) {
    console.error('API PUT Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сохранения' },
      { status: 500 },
    );
  }
}
