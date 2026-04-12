import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
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
    const userId = session?.user?.id?.toString();
    const userRole = session?.user?.role as string | undefined;

    // Строим запрос в зависимости от роли
    let query: string;
    let params: Record<string, unknown> = {};

    if (!userId) {
      // Гость — только public
      query = `SELECT * FROM events WHERE visibility_type = 'public' ORDER BY start_time_utc ASC;`;
    } else if (userRole === 'admin') {
      // Админ — всё
      query = `SELECT * FROM events ORDER BY start_time_utc ASC;`;
    } else if (userRole === 'coach') {
      // Тренер — всё + пометка какие он создал
      query = `SELECT *, (visibility_type = 'private' AND created_by = type::thing($userId)) AS is_mine FROM events ORDER BY start_time_utc ASC;`;
      params = { userId };
    } else {
      // Участник — public + private где он в participant_list
      query = `SELECT * FROM events WHERE visibility_type = 'public' OR $userId IN participant_list ORDER BY start_time_utc ASC;`;
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

    const body = (await req.json()) as CreateEventData;

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

    // Валидация participant_list для private
    if (
      body.visibility_type === 'private' &&
      (!body.participant_list || body.participant_list.length === 0)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Для private мероприятия необходимо указать participant_list',
        },
        { status: 400 },
      );
    }

    const db = await getDB();
    if (!db) throw new Error('Не удалось подключиться к базе данных SurrealDB');

    const eventData = {
      title: body.title,
      description: body.description || '',
      platform: body.platform,
      status: body.status,
      start_time_utc: body.start_time_utc,
      end_time_utc: body.end_time_utc,
      external_link: body.external_link,
      visibility_type: body.visibility_type,
      participant_list: body.participant_list || [],
      created_by: `users:${session.user.id}`,
      platform_contest_id: body.platform_contest_id || '',
    };

    const result = await db.query(
      `CREATE events CONTENT {
        title: $title,
        description: $description,
        platform: $platform,
        status: $status,
        start_time_utc: d'${body.start_time_utc}',
        end_time_utc: d'${body.end_time_utc}',
        external_link: $external_link,
        visibility_type: $visibility_type,
        participant_list: $participant_list,
        created_by: $created_by,
        platform_contest_id: $platform_contest_id,
        created_at: time::now(),
        updated_at: time::now()
      };`,
      {
        title: eventData.title,
        description: eventData.description,
        platform: eventData.platform,
        status: eventData.status,
        start_time_utc: eventData.start_time_utc,
        end_time_utc: eventData.end_time_utc,
        external_link: eventData.external_link,
        visibility_type: eventData.visibility_type,
        participant_list: eventData.participant_list,
        created_by: eventData.created_by,
        platform_contest_id: eventData.platform_contest_id,
      },
    );

    const createdEvent = (result[0] as unknown as Event[])?.[0];

    return NextResponse.json(
      { ok: true, data: createdEvent, message: 'Мероприятие создано' },
      { status: 201 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST Error:', errorMessage);
    return NextResponse.json(
      { ok: false, error: 'Ошибка сервера' },
      { status: 500 },
    );
  }
}
