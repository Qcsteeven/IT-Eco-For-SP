import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import type { Event } from '@/lib/types/event';

/**
 * GET /api/events/my
 *
 * Получение мероприятий, назначенных текущему пользователю.
 * Включает:
 * - Все private мероприятия, где пользователь в participant_list
 * - Все public мероприятия (для контекста)
 *
 * Доступно для всех авторизованных пользователей.
 */
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
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const userId = session.user.id.toString();

    // Получаем private мероприятия где пользователь в participant_list
    const privateResult = await db.query<Event[][]>(
      `SELECT *, 'assigned' AS access_reason FROM contests WHERE visibility_type = 'private' AND type::string($userId) IN participant_list ORDER BY start_time_utc ASC;`,
      { userId },
    );

    // Получаем все public мероприятия
    const publicResult = await db.query<Event[][]>(
      `SELECT *, 'public' AS access_reason FROM contests WHERE visibility_type = 'public' ORDER BY start_time_utc ASC;`,
      {},
    );

    const privateEvents = privateResult[0] || [];
    const publicEvents = publicResult[0] || [];

    // Объединяем и сортируем по дате
    const allEvents = [...privateEvents, ...publicEvents].sort((a, b) => {
      const dateA = new Date(a.start_time_utc).getTime();
      const dateB = new Date(b.start_time_utc).getTime();
      return dateA - dateB;
    });

    // Помечаем мероприятия меткой источника доступа
    const eventsWithAccess = allEvents.map((event) => ({
      ...event,
      is_assigned:
        (event as unknown as Record<string, unknown>).access_reason ===
        'assigned',
    }));

    return NextResponse.json(
      {
        ok: true,
        data: {
          events: eventsWithAccess,
          assigned_count: privateEvents.length,
          public_count: publicEvents.length,
          total_count: allEvents.length,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}
