import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';

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

    const userId = session.user.id;

    const queryResponse = await db.query(
      `
      SELECT 
        full_name, 
        email, 
        bscp_rating, 
        phone,
        (
          SELECT 
            date_recorded, 
            placement, 
            mmr_change, 
            is_manual, 
            source_rating_change, 
            contest_id as contest 
          FROM history 
          WHERE user_id = type::thing($id) 
          ORDER BY date_recorded DESC 
          FETCH contest
        ) AS history
      FROM type::thing($id);
      `,
      { id: userId },
    );

    let userData: any = null;
    const rawResponse = queryResponse[0] as any;

    if (Array.isArray(rawResponse)) {
      userData = rawResponse[0];
    } else if (rawResponse && rawResponse.result) {
      userData = Array.isArray(rawResponse.result)
        ? rawResponse.result[0]
        : rawResponse.result;
    } else {
      userData = rawResponse;
    }

    if (!userData) {
      return NextResponse.json(
        { ok: false, error: 'Пользователь не найден' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          user: {
            full_name: userData.full_name ?? '',
            email: userData.email,
            bscp_rating: userData.bscp_rating ?? 0,
            phone: userData.phone,
          },
          history: userData.history || [],
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json(
      { ok: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}
