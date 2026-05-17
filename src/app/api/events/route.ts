import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getDB } from '@/lib/surreal/surreal';
import { authOptions } from '@/lib/authOptions';
import { toGroupThingId, toUserThingId } from '@/lib/surreal/ids';
import { listCalendarEvents } from '@/lib/calendar/events';
import type {
  CreateEventData,
  Event,
  EventVisibility,
} from '@/lib/types/event';

function rowsFromQuery(result: unknown): Record<string, unknown>[] {
  if (!Array.isArray(result)) return [];

  const first = result[0] as { result?: unknown } | unknown[] | undefined;
  if (Array.isArray(first)) {
    return first.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null,
    );
  }

  if (first && typeof first === 'object' && Array.isArray(first.result)) {
    return first.result.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null,
    );
  }

  return result.filter(
    (row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null,
  );
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function toIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const events = await listCalendarEvents({
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    includeCodeforces: searchParams.get('includeCodeforces') === 'true',
    includeContests: searchParams.get('includeContests') === 'true',
    includeEvents: searchParams.get('includeEvents') !== 'false',
  });

  return NextResponse.json({ ok: true, data: events }, { status: 200 });
}

export async function POST(req: NextRequest) {
  let rawBodyForLog: unknown = undefined;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return jsonError('Не авторизован', 401);
    }

    if (session.user.role !== 'coach' && session.user.role !== 'admin') {
      return jsonError('Доступно только тренерам и администраторам', 403);
    }

    rawBodyForLog = await req.json().catch(() => ({}));
    const body = rawBodyForLog as CreateEventData;

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
        return jsonError(`Отсутствует обязательное поле: ${field}`, 400);
      }
    }

    const validVisibility: EventVisibility[] = ['public', 'private'];
    if (!validVisibility.includes(body.visibility_type)) {
      return jsonError(
        'Недопустимый тип видимости. Используйте public или private',
        400,
      );
    }

    const startDateTime = toIsoDate(body.start_time_utc);
    const endDateTime = toIsoDate(body.end_time_utc);

    if (!startDateTime || !endDateTime) {
      return jsonError('Некорректная дата начала или окончания', 400);
    }

    if (new Date(endDateTime).getTime() <= new Date(startDateTime).getTime()) {
      return jsonError('Окончание должно быть позже начала мероприятия', 400);
    }

    const normalizedParticipants = (body.participant_list || [])
      .map(toUserThingId)
      .filter(Boolean);
    const normalizedGroups = (body.target_groups || [])
      .map(toGroupThingId)
      .filter(Boolean);

    if (
      body.visibility_type === 'private' &&
      normalizedParticipants.length === 0 &&
      normalizedGroups.length === 0
    ) {
      return jsonError(
        'Для private мероприятия необходимо указать participant_list или target_groups',
        400,
      );
    }

    const db = await getDB();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных SurrealDB');
    }

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
        created_by: type::thing($created_by_id),
        platform_contest_id: $platform_contest_id,
        created_at: time::now(),
        updated_at: time::now()
      };`,
      {
        title: body.title.trim(),
        description: body.description?.trim() || '',
        platform: body.platform,
        status: body.status,
        start_time_utc: startDateTime,
        end_time_utc: endDateTime,
        external_link: body.external_link.trim(),
        visibility_type: body.visibility_type,
        participant_list:
          body.visibility_type === 'private' ? normalizedParticipants : [],
        target_groups:
          body.visibility_type === 'private' ? normalizedGroups : [],
        created_by_id: toUserThingId(session.user.id.toString()),
        platform_contest_id: body.platform_contest_id || '',
      },
    );

    const createdEvent = rowsFromQuery(result)[0] as unknown as
      | Event
      | undefined;

    return NextResponse.json(
      { ok: true, data: createdEvent, message: 'Мероприятие создано' },
      { status: 201 },
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('API POST /events Error:', errorMessage);
    console.error(
      'Request body:',
      JSON.stringify(rawBodyForLog ?? {}, null, 2),
    );

    return jsonError(`Ошибка сервера: ${errorMessage}`, 500);
  }
}
