import { NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';

/**
 * GET /api/contests/all
 *
 * Объединённый список для календаря:
 * - external_contests: из таблицы contests (Codeforces/AtCoder)
 * - events: из таблицы events (внутренние мероприятия)
 *
 * Доступно всем (включая гостей).
 */
export async function GET() {
  try {
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // Запрашиваем обе таблицы параллельно
    const [contestsResult, eventsResult] = await Promise.all([
      db.query(
        'SELECT *, "external" AS source FROM contests ORDER BY start_time_utc ASC;',
      ),
      db.query(
        'SELECT *, "internal" AS source FROM events ORDER BY start_time_utc ASC;',
      ),
    ]);

    const contests = (contestsResult[0] || []) as Record<string, unknown>[];
    const events = (eventsResult[0] || []) as Record<string, unknown>[];

    // Объединяем и сортируем по дате
    const allItems = [...contests, ...events].sort((a, b) => {
      const dateA = new Date(a.start_time_utc as string).getTime();
      const dateB = new Date(b.start_time_utc as string).getTime();
      return dateA - dateB;
    });

    return NextResponse.json(allItems);
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch calendar data' },
      { status: 500 },
    );
  }
}
