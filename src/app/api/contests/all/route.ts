import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';

/**
 * GET /api/contests/all
 *
 * Получение списка всех контестов с фильтрацией по ролям.
 * Используется календарём.
 *
 * Логика:
 * - Гость — только public
 * - Участник — public + private где он в participant_list
 * - Coach/Admin — все
 */
export async function GET() {
  try {
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id?.toString();
    const userRole = session?.user?.role as string | undefined;

    let query: string;
    let params: Record<string, unknown> = {};

    if (!userId) {
      // Гость — только public
      query = `SELECT * FROM contests WHERE visibility_type = 'public' ORDER BY start_time_utc ASC;`;
    } else if (userRole === 'admin' || userRole === 'coach') {
      // Admin/Coach — всё
      query = `SELECT * FROM contests ORDER BY start_time_utc ASC;`;
    } else {
      // Участник — public + private где он в participant_list
      query = `SELECT * FROM contests WHERE visibility_type = 'public' OR $userId IN participant_list ORDER BY start_time_utc ASC;`;
      params = { userId };
    }

    const result = await db.query(query, params);
    const contests = result[0] || [];

    return NextResponse.json(contests);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch contests' },
      { status: 500 },
    );
  }
}
