import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { toUserThingId } from '@/lib/surreal/ids';
import type { Event } from '@/lib/types/event';
import { withRoleGuard } from '@/lib/rbac/guard';

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
export const GET = withRoleGuard(async (_req: NextRequest, session) => {
    try {

      const db = await getDB();
      if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

      const userId = toUserThingId(session.user.id.toString());

      // Получаем private мероприятия где пользователь в participant_list или его группах
      const privateResult = await db.query<Event[][]>(
        `
        LET $my_groups = (SELECT VALUE group_id FROM group_members WHERE user_id = type::thing($userId));
        SELECT *, 'assigned' AS access_reason
        FROM events
        WHERE
          visibility_type = 'private'
          AND (
            $userId IN participant_list
            OR array::len(array::intersect(target_groups ?? [], $my_groups)) > 0
          )
        ORDER BY start_time_utc ASC;
        `,
        { userId },
      );

      // Получаем все public мероприятия
      const publicResult = await db.query<Event[][]>(
        `SELECT *, 'public' AS access_reason FROM events WHERE visibility_type = 'public' ORDER BY start_time_utc ASC;`,
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
}, { requiredRole: 'user' });
