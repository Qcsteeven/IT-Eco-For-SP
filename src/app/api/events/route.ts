import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import type {
  Event,
  EventVisibility,
  CreateEventData,
  EventPlatform,
  EventStatus,
} from '@/lib/types/event';

/**
 * GET /api/events
 *
 * Логика фильтрации по ролям:
 * - Гость (не авторизован) — только public мероприятия
 * - Участник (user) — public + private, где он в participant_list
 * - Тренер (coach) — все мероприятия + свои созданные
 * - Админ (admin) — все мероприятия
 */
export async function GET(req: NextRequest) {
  try {
    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const session = await getServerSession(authOptions);
    const userIdRaw = session?.user?.id?.toString();
    const userRole = session?.user?.role as string | undefined;

    // Строим запрос в зависимости от роли
    let query: string;
    let params: Record<string, unknown> = {};

    if (!userIdRaw) {
      // Гость — только public
      query = `SELECT * FROM events WHERE visibility_type = 'public' ORDER BY start_time_utc ASC;`;
    } else if (userRole === 'admin') {
      // Админ — всё
      query = `SELECT * FROM events ORDER BY start_time_utc ASC;`;
    } else if (userRole === 'coach') {
      // Тренер — всё + пометка какие он создал
      query = `SELECT *, (visibility_type = 'private' AND created_by = type::thing($userId)) AS is_mine FROM events ORDER BY start_time_utc ASC;`;
      params = { userId: toUserThingId(userIdRaw) };
    } else {
      // Участник — public + private где он в participant_list или в одной из target_groups
      const userId = toUserThingId(userIdRaw);
      query = `
        LET $my_groups = (SELECT VALUE group_id FROM group_members WHERE user_id = type::thing($userId));
        SELECT * FROM events
        WHERE
          visibility_type = 'public'
          OR (
            visibility_type = 'private'
            AND (
              $userId IN participant_list
              OR array::len(array::intersect(target_groups ?? [], $my_groups)) > 0
            )
          )
        ORDER BY start_time_utc ASC;
      `;
      params = { userId };
    }

    const result = await db.query<Event[][]>(query, params);
    const events = result[0] || [];

    return NextResponse.json({ ok: true, data: events }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    );
  }
}

/**
 * POST /api/events
 *
 * Создание мероприятия. Доступно только coach и admin.
 *
 * Тело запроса:
 * - title: string (обязательно)
 * - platform: 'codeforces' | 'atcoder' | 'custom' | 'other' (обязательно)
 * - status: 'upcoming' | 'active' | 'completed' | 'cancelled' (обязательно)
 * - start_time_utc: string ISO date (обязательно)
 * - end_time_utc: string ISO date (обязательно)
 * - external_link: string URL (обязательно)
 * - visibility_type: 'public' | 'private' (обязательно)
 * - participant_list: string[] (для private)
 * - description?: string
 * - platform_contest_id?: string
 */
export async function POST(req: NextRequest) {
  let rawBodyForLog: unknown = undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { ok: false, error: 'Неавторизован' },
        { status: 401 },
      );
    }

    // Только coach и admin могут создавать мероприятия
    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return NextResponse.json(
        { ok: false, error: 'Доступно только тренерам и администраторам' },
        { status: 403 },
      );
    }

    rawBodyForLog = await req.json().catch(() => ({}));
    const body = rawBodyForLog as CreateEventData;

    // Валидация обязательных полей
    const requiredFields: (keyof CreateEventData)[] = [
      'title',
      'platform',
      'status',
      'start_time_utc',
      'end_time_utc',
      'external_link',
      'visibility_type',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { ok: false, error: `Отсутствует обязательное поле: ${field}` },
          { status: 400 },
        );
      }
    }

    // Валидация visibility_type
    const validVisibility: EventVisibility[] = ['public', 'private'];
    if (!validVisibility.includes(body.visibility_type)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Недопустимый тип видимости. Используйте "public" или "private"',
        },
        { status: 400 },
      );
    }

    const normalizedParticipants = (body.participant_list || [])
      .map(toUserThingId)
      .filter(Boolean);
    const normalizedGroups = (body.target_groups || [])
      .map(toGroupThingId)
      .filter(Boolean);

    // Валидация для private: participant_list или target_groups (или оба)
    if (body.visibility_type === 'private') {
      if (normalizedParticipants.length === 0 && normalizedGroups.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Для private мероприятия необходимо указать participant_list или target_groups',
          },
          { status: 400 },
        );
      }
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    // ISO строку приводим к datetime на стороне Surreal (совместимо с разными версиями)
    const startDateTime = new Date(body.start_time_utc).toISOString();
    const endDateTime = new Date(body.end_time_utc).toISOString();

    const result = await db.query(
      `CREATE events CONTENT {
        title: $title,
        description: $description,
        platform: $platform,
        status: $status,
        start_time_utc: type::datetime($start_time_utc),
        end_time_utc: type::datetime($end_time_utc),
        external_link: $external_link,
        visibility_type: $visibility_type,
        participant_list: $participant_list,
        target_groups: $target_groups,
        participant_snapshot: NONE,
        created_by: type::thing("users", $created_by_id),
        platform_contest_id: $platform_contest_id,
        created_at: time::now(),
        updated_at: time::now()
      };`,
      {
        title: body.title,
        description: body.description || '',
        platform: body.platform,
        status: body.status,
        start_time_utc: startDateTime,
        end_time_utc: endDateTime,
        external_link: body.external_link,
        visibility_type: body.visibility_type,
        participant_list: normalizedParticipants,
        target_groups: normalizedGroups,
        created_by_id: session.user.id,
        platform_contest_id: body.platform_contest_id || '',
      },
    );

    const createdEvent = (result[0] as unknown as Event[])?.[0];

    return NextResponse.json(
      { ok: true, data: createdEvent, message: 'Мероприятие создано' },
      { status: 201 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST /events Error:', errorMessage);
    console.error('Request body:', JSON.stringify(rawBodyForLog ?? {}, null, 2));
    return NextResponse.json(
      { ok: false, error: `Ошибка сервера: ${errorMessage}` },
      { status: 500 },
    );
  }
}
